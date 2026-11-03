<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { browser } from "wxt/browser";
import { safeFilename } from "@rankmiso/report-formats";
import { supportsSiteCrawling } from "../../config/features.config";
import { useI18n } from "../../composables/useI18n";
import { analyzeSnapshot } from "../../services/engine";
import {
  CRAWL_LIMITS,
  filterPages,
  loadCrawl,
  runSiteCrawl,
  saveCrawl,
  sortPages,
  type CrawlPage,
  type CrawlLimitReason,
  type CrawlSession,
} from "../../services/site-crawl";
import { extractCrawlPage, snapshotFromHtml } from "../../services/site-extract";
import {
  analyzeSite,
  filterSiteIssues,
  siteAnalysisCsv,
  siteAnalysisJson,
  sortSiteIssues,
} from "../../services/site-analysis";
import { permissionPatternMatchesUrl, sitePermission } from "../../services/page-access";
import {
  discoverSitemapUrls,
  fetchCrawlPage,
  mayFetchPath,
  readRobots,
} from "../../services/site-crawl-network";
import type { AuditResult } from "../../types/audit";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { surface, copy, openReport } = useWorkbench();
const report = surface === "report";
const pageUrl = computed(() => props.audit.page.url);
const session = ref<CrawlSession | null>(null);
const analysisSession = ref<CrawlSession | null>(null);
const running = ref(false);
const permissionPending = ref(false);
const message = ref("");
const query = ref("");
const filter = ref("all");
const sort = ref("url");
const shown = ref(40);
const selectedUrl = ref("");
const activeView = ref<"overview" | "issues" | "pages" | "links">("overview");
const issueCategory = ref("all");
const issueSeverity = ref<"all" | "error" | "warning" | "info" | "undefined">("all");
const issueSort = ref<"affected" | "severity" | "name">("affected");
let controller: AbortController | null = null;
let disposed = false;

const origin = computed(() => {
  try {
    return new URL(pageUrl.value).origin;
  } catch {
    return "";
  }
});
const visible = computed(() =>
  sortPages(filterPages(session.value?.pages ?? [], query.value, filter.value), sort.value),
);
const siteAnalysis = computed(() =>
  analysisSession.value ? analyzeSite(analysisSession.value) : null,
);
const visibleIssues = computed(() =>
  siteAnalysis.value
    ? sortSiteIssues(
        filterSiteIssues(
          siteAnalysis.value.issues,
          query.value,
          issueCategory.value,
          issueSeverity.value,
        ),
        issueSort.value,
      )
    : [],
);
const matchingLinks = computed(() => {
  const links = siteAnalysis.value?.links ?? [];
  const needle = query.value.trim().toLocaleLowerCase("und");
  return links.filter(
    (link) =>
      !needle ||
      `${link.source} ${link.target} ${link.rel.join(" ")} ${link.anchors.join(" ")}`
        .toLocaleLowerCase("und")
        .includes(needle),
  );
});
const visibleLinks = computed(() => matchingLinks.value.slice(0, shown.value));
const rows = computed(() => visible.value.slice(0, shown.value));
const selected = computed(
  () => session.value?.pages.find((page) => page.url === selectedUrl.value) ?? null,
);
const listedCount = computed(() => session.value?.pages.length ?? 0);
const fetchedCount = computed(
  () => session.value?.pages.filter((page) => page.status != null).length ?? 0,
);
const failedCount = computed(() => session.value?.pages.filter((page) => page.error).length ?? 0);
const skippedCount = computed(
  () => session.value?.pages.filter((page) => page.skipped).length ?? 0,
);
const crawlShare = computed(() => {
  if (CRAWL_LIMITS.maxPages <= 0) return "0%";
  return `${Math.min(100, (listedCount.value / CRAWL_LIMITS.maxPages) * 100)}%`;
});

onMounted(() => {
  if (origin.value) {
    session.value = loadCrawl(origin.value);
    analysisSession.value = session.value;
  }
});
onUnmounted(() => {
  disposed = true;
  controller?.abort();
});

async function start() {
  if (!supportsSiteCrawling || running.value || permissionPending.value || !origin.value) return;
  message.value = "";
  const page = pageUrl.value;
  const permission = sitePermission(page);
  if (!permission || permission.origin !== origin.value) {
    message.value = t("site.noOrigin");
    return;
  }

  permissionPending.value = true;
  let request: Promise<boolean>;
  try {
    // Keep this request in the Start button's user-action context in Firefox.
    request = browser.permissions.request({ origins: [permission.pattern] });
  } catch {
    permissionPending.value = false;
    message.value = t("site.permissionDenied");
    return;
  }

  let granted = false;
  try {
    granted = await request;
    if (granted) {
      granted = await browser.permissions.contains({ origins: [permission.pattern] });
    }
  } catch {
    message.value = t("site.permissionUnavailable");
    return;
  } finally {
    permissionPending.value = false;
  }
  if (!granted) {
    message.value = t("site.permissionDenied");
    return;
  }
  if (disposed) return;
  if (pageUrl.value !== page) {
    message.value = t("site.permissionUnavailable");
    return;
  }

  const crawlController = new AbortController();
  controller = crawlController;
  running.value = true;
  shown.value = 40;
  let permissionRevoked = false;
  const stopForRevocation = () => {
    permissionRevoked = true;
    message.value = t("site.permissionRevoked");
    crawlController.abort();
  };
  const onPermissionRemoved = (removed: { origins?: string[] }) => {
    if (!removed.origins?.some((pattern) => permissionPatternMatchesUrl(pattern, page))) return;
    void browser.permissions
      .contains({ origins: [permission.pattern] })
      .then((stillAllowed) => {
        if (!stillAllowed) stopForRevocation();
      })
      .catch(stopForRevocation);
  };
  const authorizedFetch: typeof fetch = async (input, init) => {
    if (crawlController.signal.aborted) throw new DOMException("Stopped", "AbortError");
    const target =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(target).origin !== permission.origin) {
      throw new TypeError("A crawl request left the selected origin.");
    }
    if (!(await browser.permissions.contains({ origins: [permission.pattern] }))) {
      stopForRevocation();
      throw new DOMException("Website access was removed", "AbortError");
    }
    if (crawlController.signal.aborted) throw new DOMException("Stopped", "AbortError");
    return fetch(input, { ...init, referrerPolicy: "no-referrer" });
  };

  browser.permissions.onRemoved.addListener(onPermissionRemoved);
  try {
    let robotsBody = "";
    const next = await runSiteCrawl({
      startUrl: page,
      signal: crawlController.signal,
      readRobots: async (signal) => {
        const result = await readRobots(permission.origin, signal, authorizedFetch);
        robotsBody = result.body;
        return result;
      },
      discoverSitemaps: (signal) => discoverSitemapUrls(page, signal, authorizedFetch),
      mayFetch: (path) => mayFetchPath(robotsBody, path),
      fetchPage: (url, signal) => fetchCrawlPage(url, permission.origin, signal, authorizedFetch),
      inspect: async (page, html) => {
        const extracted = extractCrawlPage(html, page.finalUrl || page.url);
        try {
          const audit = await analyzeSnapshot(
            snapshotFromHtml(
              html,
              page.finalUrl || page.url,
              page.status ?? 0,
              page.contentType,
            ) as never,
          );
          const findings = audit.checks
            .filter((check) => check.status !== "PASS")
            .map((check) => ({
              id: check.id,
              category: check.category,
              title: check.title,
              description: check.description,
              recommendation: check.recommendation,
              status: check.status,
              evidence: check.evidence,
            }));
          extracted.issues = audit.checks
            .filter((check) => check.status === "ERROR" || check.status === "WARNING")
            .map((check) => check.title)
            .slice(0, 12);
          extracted.imageCount = audit.metrics.counts.images;
          extracted.imagesMissingAlt = audit.metrics.counts.imagesMissingAlt;
          extracted.structuredDataCount = Math.max(
            extracted.structuredDataCount ?? 0,
            audit.details.structuredData.length,
          );
          extracted.analyzed = true;
          return {
            page: {
              ...page,
              ...extracted,
              url: page.url,
              fromSitemap: page.fromSitemap,
              depth: page.depth,
            },
            findings,
          };
        } catch {
          extracted.error = t("site.scoreFailed");
        }
        return {
          ...page,
          ...extracted,
          url: page.url,
          fromSitemap: page.fromSitemap,
          depth: page.depth,
          analyzed: false,
        };
      },
      onProgress: (current) => {
        session.value = { ...current, pages: current.pages.slice() };
        if (current.pages.length === 1 || current.pages.length % 10 === 0) {
          analysisSession.value = { ...current, pages: current.pages.slice() };
        }
      },
    });
    if (!disposed) {
      session.value = next;
      analysisSession.value = next;
      if (!saveCrawl(next)) message.value = t("site.saveFailed");
    }
  } catch {
    if (!disposed && !permissionRevoked) message.value = t("site.failed");
  } finally {
    browser.permissions.onRemoved.removeListener(onPermissionRemoved);
    running.value = false;
    if (controller === crawlController) controller = null;
  }
}

function stop() {
  controller?.abort();
}

function download(kind: "csv" | "json") {
  if (!session.value) return;
  const content = kind === "csv" ? siteAnalysisCsv(session.value) : siteAnalysisJson(session.value);
  const blob = new Blob([content], { type: kind === "csv" ? "text/csv" : "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(`${origin.value}-site`, kind);
  anchor.click();
  URL.revokeObjectURL(url);
}

function crawlState(): string {
  if (permissionPending.value) return t("site.authorizing");
  if (running.value) return t("site.running");
  if (!session.value || session.value.status === "idle") return t("site.idle");
  if (session.value.status === "complete") return t("site.stateComplete");
  if (session.value.status === "stopped") return t("site.stateStopped");
  if (session.value.status === "error") return t("site.stateError");
  return t("site.running");
}

function sitemapLine(): string {
  if (!session.value) return "";
  if (session.value.sitemap === "urls")
    return `${t("site.sitemap.urls")} ${n(session.value.sitemapUrls)}`;
  if (session.value.sitemap === "empty") return t("site.sitemap.empty");
  if (session.value.sitemap === "unavailable") return t("site.sitemap.unavailable");
  return t("site.sitemap.notRead");
}

function stateBadge(): "ok" | "warn" | "err" | "gray" {
  if (running.value || permissionPending.value) return "warn";
  if (session.value?.status === "complete") return session.value.partial ? "warn" : "ok";
  if (session.value?.status === "error") return "err";
  if (session.value?.status === "stopped") return "warn";
  return "gray";
}

function pageTone(page: CrawlPage): "good" | "warn" | "err" | "gray" {
  if (page.skipped) return "gray";
  if (page.error || (page.status != null && page.status >= 400)) return "err";
  if (page.issues.length || page.redirectHops.length) return "warn";
  return "good";
}

function pageBadge(page: CrawlPage): string {
  if (page.skipped) return t("site.skipped");
  if (page.error && page.status == null) return t("site.failedShort");
  if (page.status != null && page.status >= 400) return String(page.status);
  if (page.redirectHops.length) return t("wb.si.redirected");
  return page.status == null ? "—" : t("wb.si.fetched", { status: page.status });
}

function path(url: string): string {
  try {
    const value = new URL(url);
    return value.origin === origin.value ? `${value.pathname}${value.search}` || "/" : url;
  } catch {
    return url;
  }
}

function statusLabel(page: CrawlPage): string {
  if (page.skipped) return t("site.skipped");
  if (page.error && page.status == null) return t("site.failedShort");
  return page.status == null ? "—" : String(page.status);
}

function showPage(url: string) {
  selectedUrl.value = url;
  activeView.value = "pages";
}

function limitLabel(limit: CrawlLimitReason): string {
  switch (limit) {
    case "pages":
      return t("site.limit.pages");
    case "discovered":
      return t("site.limit.discovered");
    case "depth":
      return t("site.limit.depth");
    case "time":
      return t("site.limit.time");
  }
}
</script>

<template>
  <PageHeading :overline="t('wb.si.overline')" :title="t('site.title')" :text="t('wb.si.text')" />
  <div class="crawl-hero">
    <div class="eyebrow">{{ t("wb.si.eyebrow") }}</div>
    <div class="crawl-status">
      <span class="crawl-host">{{
        origin ? origin.replace(/^https?:\/\//, "") : t("site.noOrigin")
      }}</span>
      <span class="badge" :class="stateBadge()">{{ crawlState() }}</span>
    </div>
    <p>
      {{ t("wb.si.limits", { pages: n(CRAWL_LIMITS.maxPages), depth: n(CRAWL_LIMITS.maxDepth) }) }}
    </p>
    <div class="track" role="img" :aria-label="t('site.progress', { count: listedCount })">
      <span class="fill red" :style="{ width: crawlShare }" />
    </div>
    <div class="crawl-metrics">
      <div class="kpi">
        <strong>{{ n(fetchedCount) }}</strong
        ><span>{{ t("site.fetched") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(listedCount) }}</strong
        ><span>{{ t("site.discovered") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(failedCount) }}</strong
        ><span>{{ t("site.failedCount") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(skippedCount) }}</strong
        ><span>{{ t("site.skippedCount") }}</span>
      </div>
    </div>
    <div v-if="report && supportsSiteCrawling" class="actions-row">
      <button
        type="button"
        class="primary"
        :disabled="running || permissionPending || !origin"
        @click="start"
      >
        {{ permissionPending ? t("site.authorizing") : t("site.start") }}
      </button>
      <button type="button" class="secondary" :disabled="!running" @click="stop">
        {{ t("site.stop") }}
      </button>
    </div>
    <div v-else-if="!report" class="actions-row">
      <button type="button" class="primary" @click="openReport('site')">
        {{ t("wb.si.inReport") }}
      </button>
    </div>
  </div>
  <p v-if="message" class="callout" role="status">{{ message }}</p>
  <p v-if="session?.note" class="hint">{{ session.note }}</p>
  <p v-if="running" class="hint" role="status">
    {{ t("site.progress", { count: session?.pages.length ?? 0 }) }}
  </p>

  <nav v-if="report && session?.pages.length" class="site-tabs" :aria-label="t('site.views')">
    <button
      v-for="view in ['overview', 'issues', 'pages', 'links'] as const"
      :key="view"
      type="button"
      :aria-current="activeView === view ? 'page' : undefined"
      @click="activeView = view"
    >
      {{ t(`site.view.${view}`) }}
    </button>
  </nav>

  <section
    v-if="report && activeView === 'overview' && siteAnalysis"
    class="site-overview"
    aria-live="polite"
  >
    <p v-if="siteAnalysis.summary.partial" class="callout" role="status">
      {{ t("site.partial", { count: siteAnalysis.summary.analyzed }) }}
      <span v-if="siteAnalysis.summary.limitsReached.length">
        {{ siteAnalysis.summary.limitsReached.map(limitLabel).join(", ") }}.
      </span>
    </p>
    <div class="crawl-metrics">
      <div class="kpi">
        <strong
          >{{ n(siteAnalysis.summary.analyzed) }} / {{ n(siteAnalysis.summary.pagesLimit) }}</strong
        ><span>{{ t("site.analyzed") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(siteAnalysis.summary.discovered) }}</strong
        ><span>{{ t("site.discovered") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(siteAnalysis.summary.failed) }}</strong
        ><span>{{ t("site.failedCount") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(siteAnalysis.summary.skipped) }}</strong
        ><span>{{ t("site.skippedCount") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(siteAnalysis.issues.length) }}</strong
        ><span>{{ t("site.issueGroups") }}</span>
      </div>
    </div>
    <div class="site-insight-grid">
      <WbCard :title="t('site.metadata')">
        <dl class="site-stats">
          <div>
            <dt>{{ t("site.missingTitles") }}</dt>
            <dd>{{ n(siteAnalysis.summary.missingTitles + siteAnalysis.summary.emptyTitles) }}</dd>
          </div>
          <div>
            <dt>{{ t("site.missingDescriptions") }}</dt>
            <dd>
              {{
                n(siteAnalysis.summary.missingDescriptions + siteAnalysis.summary.emptyDescriptions)
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t("site.duplicateTitles") }}</dt>
            <dd>
              {{ n(siteAnalysis.duplicates.filter((group) => group.kind === "title").length) }}
            </dd>
          </div>
          <div>
            <dt>{{ t("site.duplicateDescriptions") }}</dt>
            <dd>
              {{
                n(siteAnalysis.duplicates.filter((group) => group.kind === "description").length)
              }}
            </dd>
          </div>
        </dl>
      </WbCard>
      <WbCard :title="t('site.structure')">
        <dl class="site-stats">
          <div>
            <dt>{{ t("site.missingH1") }}</dt>
            <dd>{{ n(siteAnalysis.summary.h1Missing) }}</dd>
          </div>
          <div>
            <dt>{{ t("site.multipleH1") }}</dt>
            <dd>{{ n(siteAnalysis.summary.multipleH1) }}</dd>
          </div>
          <div>
            <dt>{{ t("site.imagesMissingAlt") }}</dt>
            <dd>{{ n(siteAnalysis.summary.imagesMissingAlt) }}</dd>
          </div>
          <div>
            <dt>{{ t("site.canonicalWarnings") }}</dt>
            <dd>{{ n(siteAnalysis.summary.canonicalIssues) }}</dd>
          </div>
        </dl>
      </WbCard>
    </div>
    <h2>{{ t("site.duplicateMetadata") }}</h2>
    <p v-if="!siteAnalysis.duplicates.length" class="hint">{{ t("site.noDuplicates") }}</p>
    <div v-else class="list">
      <div
        v-for="group in siteAnalysis.duplicates"
        :key="`${group.kind}:${group.value}`"
        class="note-row site-duplicate"
      >
        <strong>{{
          group.kind === "title" ? t("site.duplicateTitle") : t("site.duplicateDescription")
        }}</strong>
        <span>{{ group.value }}</span>
        <button
          type="button"
          class="subtle-btn"
          @click="
            activeView = 'pages';
            selectedUrl = group.urls[0] || '';
          "
        >
          {{ t("site.affectedPages", { count: group.urls.length }) }}
        </button>
        <ul class="site-url-list">
          <li v-for="url in group.urls" :key="url">
            <button type="button" class="site-url-button" @click="showPage(url)">{{ url }}</button>
          </li>
        </ul>
      </div>
    </div>
    <p v-if="siteAnalysis.summary.unavailableFindings" class="hint">
      {{ t("site.unavailableCount", { count: siteAnalysis.summary.unavailableFindings }) }}
    </p>
  </section>

  <section v-else-if="report && activeView === 'issues' && siteAnalysis" class="site-issues">
    <div class="filter-tools">
      <label class="search"
        ><span class="sr-only">{{ t("site.searchIssues") }}</span
        ><input
          v-model="query"
          type="search"
          autocomplete="off"
          :placeholder="t('site.searchIssues')"
          :aria-label="t('site.searchIssues')"
      /></label>
      <label class="select-field"
        ><span>{{ t("site.category") }}</span
        ><select v-model="issueCategory">
          <option value="all">{{ t("site.allCategories") }}</option>
          <option
            v-for="category in [...new Set(siteAnalysis.issues.map((issue) => issue.category))]"
            :key="category"
            :value="category"
          >
            {{ t(`site.category.${category}`) }}
          </option>
        </select></label
      >
      <label class="select-field"
        ><span>{{ t("site.severity") }}</span
        ><select v-model="issueSeverity">
          <option value="all">{{ t("site.allSeverities") }}</option>
          <option value="error">{{ t("site.severity.error") }}</option>
          <option value="warning">{{ t("site.severity.warning") }}</option>
          <option value="info">{{ t("site.severity.info") }}</option>
          <option value="undefined">{{ t("site.severity.undefined") }}</option>
        </select></label
      >
      <label class="select-field"
        ><span>{{ t("site.sort") }}</span
        ><select v-model="issueSort">
          <option value="affected">{{ t("site.sortAffected") }}</option>
          <option value="severity">{{ t("site.sortSeverity") }}</option>
          <option value="name">{{ t("site.sortName") }}</option>
        </select></label
      >
    </div>
    <p v-if="!visibleIssues.length" class="callout">{{ t("site.noIssues") }}</p>
    <div class="list">
      <article v-for="issue in visibleIssues.slice(0, shown)" :key="issue.id" class="site-issue">
        <header>
          <div>
            <span class="badge gray">{{ t(`site.category.${issue.category}`) }}</span>
            <h3>{{ issue.title }}</h3>
          </div>
          <span
            class="badge"
            :class="
              issue.statuses.includes('ERROR')
                ? 'err'
                : issue.statuses.includes('WARNING')
                  ? 'warn'
                  : 'gray'
            "
            >{{ issue.statuses.join(" / ") || t("site.severityUndefined") }}</span
          >
        </header>
        <p>{{ issue.description }}</p>
        <p v-if="issue.recommendation" class="hint">{{ issue.recommendation }}</p>
        <strong>{{ t("site.affectedPages", { count: issue.affected.length }) }}</strong>
        <ul class="site-url-list">
          <li v-for="page in issue.affected" :key="page.url">
            <button type="button" class="site-url-button" @click="showPage(page.url)">
              {{ page.url }}</button
            ><small v-if="page.evidence">{{ page.evidence }}</small>
          </li>
        </ul>
      </article>
    </div>
    <button
      v-if="visibleIssues.length > shown"
      type="button"
      class="subtle-btn more-btn"
      @click="shown += 40"
    >
      {{ t("site.moreIssues") }} →
    </button>
  </section>

  <section v-else-if="report && activeView === 'links' && siteAnalysis" class="site-links">
    <label class="search"
      ><span class="sr-only">{{ t("site.search") }}</span
      ><input
        v-model="query"
        type="search"
        autocomplete="off"
        :placeholder="t('site.searchLinks')"
        :aria-label="t('site.searchLinks')"
    /></label>
    <p class="hint">
      {{ t("site.linkScope")
      }}<span v-if="siteAnalysis.linksTruncated"> {{ t("site.linkTruncated") }}</span>
    </p>
    <WbCard :title="t('site.lowIncoming')">
      <p class="hint">{{ t("site.lowIncomingScope") }}</p>
      <ul class="site-url-list">
        <li v-for="item in siteAnalysis.lowIncomingPages" :key="item.url">
          <button type="button" class="site-url-button" @click="showPage(item.url)">
            {{ item.url }}</button
          ><small>{{ t("site.incomingCount", { count: item.incomingSources }) }}</small>
        </li>
      </ul>
    </WbCard>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{{ t("site.source") }}</th>
            <th>{{ t("site.target") }}</th>
            <th>{{ t("site.incomingObserved") }}</th>
            <th>{{ t("site.targetStatus") }}</th>
            <th>{{ t("site.linkDetails") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="link in visibleLinks" :key="`${link.source}|${link.target}`">
            <td class="site-url-cell">{{ link.source }}</td>
            <td class="site-url-cell">{{ link.target }}</td>
            <td>{{ n(link.incomingSources) }}</td>
            <td>{{ t(`site.linkState.${link.targetState}`) }}</td>
            <td>
              {{
                [
                  ...link.rel,
                  ...link.anchors,
                  ...(link.redirectTo ? [t("site.redirectsTo", { url: link.redirectTo })] : []),
                ].join(" · ") || "—"
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button
      v-if="matchingLinks.length > visibleLinks.length"
      type="button"
      class="subtle-btn more-btn"
      @click="shown += 40"
    >
      {{ t("site.moreLinks") }} →
    </button>
    <p v-if="siteAnalysis.links.length === 0" class="callout">{{ t("site.noLinks") }}</p>
  </section>

  <div v-if="!report || activeView === 'pages'" class="section-heading">
    <div>
      <h2>{{ t("pm.inspectedPages") }}</h2>
    </div>
    <button
      v-if="!report && session?.pages.length"
      type="button"
      class="subtle-btn"
      @click="openReport('site')"
    >
      {{ t("wb.si.details") }} ↗
    </button>
  </div>
  <p
    v-if="(!session || !session.pages.length) && (!report || activeView === 'pages')"
    class="callout"
  >
    {{ report ? t("wb.si.empty") : t("wb.si.emptySidebar") }}
  </p>
  <template v-if="session?.pages.length && (!report || activeView === 'pages')">
    <div class="site-notes">
      <span class="badge gray">{{ sitemapLine() }}</span>
      <span v-if="siteAnalysis?.duplicates.length" class="badge warn">{{
        t("site.duplicates", { count: siteAnalysis.duplicates.length })
      }}</span>
    </div>
    <div v-if="report" class="filter-tools">
      <label class="search">
        <span class="sr-only">{{ t("site.search") }}</span>
        <input
          v-model="query"
          type="search"
          name="site-search"
          autocomplete="off"
          :placeholder="t('site.search')"
          :aria-label="t('site.search')"
        />
      </label>
      <label class="select-field">
        <span>{{ t("site.filter") }}</span>
        <select v-model="filter" :aria-label="t('site.filter')">
          <option value="all">{{ t("site.filterAll") }}</option>
          <option value="issues">{{ t("site.filterIssues") }}</option>
          <option value="failed">{{ t("site.filterFailed") }}</option>
          <option value="skipped">{{ t("site.filterSkipped") }}</option>
        </select>
      </label>
      <label class="select-field">
        <span>{{ t("site.sort") }}</span>
        <select v-model="sort" :aria-label="t('site.sort')">
          <option value="url">{{ t("site.sortUrl") }}</option>
          <option value="title">{{ t("site.sortTitle") }}</option>
          <option value="issues">{{ t("site.sortIssues") }}</option>
        </select>
      </label>
    </div>
    <div :class="report ? 'site-split' : ''">
      <div class="list site-list" :aria-label="t('site.caption')">
        <button
          v-for="page in report ? rows : rows.slice(0, 12)"
          :key="page.url"
          type="button"
          class="data-row is-link"
          :class="{ 'is-selected': selectedUrl === page.url }"
          :aria-pressed="report ? selectedUrl === page.url : undefined"
          @click="report ? (selectedUrl = page.url) : openReport('site')"
        >
          <div class="record-dot" :class="pageTone(page)" aria-hidden="true" />
          <div class="data-main">
            <strong>{{ page.title || path(page.url) }}</strong>
            <small>{{ page.url }}</small>
            <small v-if="page.issues.length">{{
              t("wb.si.issues", { count: n(page.issues.length) })
            }}</small>
          </div>
          <div class="data-end">
            <span
              class="badge"
              :class="{
                ok: pageTone(page) === 'good',
                warn: pageTone(page) === 'warn',
                err: pageTone(page) === 'err',
              }"
            >
              {{ pageBadge(page) }}
            </span>
          </div>
        </button>
        <button
          v-if="report && visible.length > rows.length"
          type="button"
          class="subtle-btn more-btn"
          @click="shown += 40"
        >
          {{ t("site.more") }} →
        </button>
      </div>
      <WbCard
        v-if="report && selected"
        :title="selected.title || path(selected.url)"
        class="site-detail"
        :aria-label="t('site.detail')"
      >
        <div class="properties">
          <div class="property">
            <span>{{ t("field.url") }}</span>
            <strong>{{ selected.finalUrl || selected.url }}</strong>
            <button
              type="button"
              class="subtle-btn"
              @click="copy(selected.finalUrl || selected.url)"
            >
              {{ t("action.copy") }}
            </button>
          </div>
          <div class="property">
            <span>{{ t("site.colStatus") }}</span
            ><strong>{{ statusLabel(selected) }}</strong>
          </div>
          <div class="property">
            <span>{{ t("site.colIndex") }}</span
            ><strong>{{ selected.indexability }}</strong>
          </div>
          <div class="property">
            <span>{{ t("site.description") }}</span
            ><strong>{{ selected.description || "—" }}</strong>
          </div>
          <div class="property">
            <span>{{ t("field.canonical") }}</span
            ><strong>{{ selected.canonical || "—" }}</strong>
          </div>
          <div class="property">
            <span>{{ t("site.robotsMeta") }}</span
            ><strong>{{ selected.robots || "—" }}</strong>
          </div>
          <div class="property">
            <span>{{ t("site.headings") }}</span
            ><strong>{{ n(selected.h1Count) }}</strong>
          </div>
          <div class="property">
            <span>{{ t("site.colLinks") }}</span
            ><strong>{{ n(selected.internalLinks.length) }}</strong>
          </div>
        </div>
        <p v-if="selected.skipped" class="hint">{{ selected.skipped }}</p>
        <p v-if="selected.error" class="hint is-error">{{ selected.error }}</p>
        <div v-if="selected.issues.length" class="list">
          <div v-for="issue in selected.issues" :key="issue" class="note-row">{{ issue }}</div>
        </div>
      </WbCard>
    </div>
    <div v-if="report" class="actions-row">
      <button type="button" class="quiet" @click="download('csv')">
        {{ t("site.exportCsv") }}
      </button>
      <button type="button" class="quiet" @click="download('json')">
        {{ t("site.exportJson") }}
      </button>
    </div>
  </template>
  <p class="hint">{{ report ? t("site.lifecycle") : t("wb.si.sidebarHint") }}</p>
</template>
