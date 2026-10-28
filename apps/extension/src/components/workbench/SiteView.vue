<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { browser } from "wxt/browser";
import { safeFilename } from "@rankmiso/report-formats";
import { supportsOptionalExternalChecks } from "../../config/features.config";
import { useI18n } from "../../composables/useI18n";
import { analyzeSnapshot } from "../../services/engine";
import {
  CRAWL_LIMITS,
  filterPages,
  loadCrawl,
  runSiteCrawl,
  saveCrawl,
  sessionCsv,
  sessionJson,
  sortPages,
  type CrawlPage,
  type CrawlSession,
} from "../../services/site-crawl";
import { extractCrawlPage, snapshotFromHtml } from "../../services/site-extract";
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
const running = ref(false);
const message = ref("");
const query = ref("");
const filter = ref("all");
const sort = ref("url");
const shown = ref(40);
const selectedUrl = ref("");
let controller: AbortController | null = null;

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
  if (origin.value) session.value = loadCrawl(origin.value);
});
onUnmounted(() => controller?.abort());

async function start() {
  if (import.meta.env.FIREFOX || running.value || !origin.value) return;
  message.value = "";
  const granted = await browser.permissions.request({ origins: [`${origin.value}/*`] });
  if (!granted) {
    message.value = t("site.permissionDenied");
    return;
  }
  controller = new AbortController();
  running.value = true;
  shown.value = 40;
  try {
    const network = import.meta.env.FIREFOX
      ? null
      : await import("../../services/site-crawl-network");
    if (!network) return;
    let robotsBody = "";
    const next = await runSiteCrawl({
      startUrl: pageUrl.value,
      signal: controller.signal,
      readRobots: async () => {
        const result = await network.readRobots(
          origin.value,
          controller?.signal ?? new AbortController().signal,
        );
        robotsBody = result.body;
        return result;
      },
      discoverSitemaps: () =>
        network.discoverSitemapUrls(
          pageUrl.value,
          controller?.signal ?? new AbortController().signal,
        ),
      mayFetch: (path) => network.mayFetchPath(robotsBody, path),
      fetchPage: (url, signal) => network.fetchCrawlPage(url, pageUrl.value, signal),
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
          extracted.issues = audit.checks
            .filter((check) => check.status === "ERROR" || check.status === "WARNING")
            .map((check) => check.title)
            .slice(0, 12);
        } catch {
          extracted.error = t("site.scoreFailed");
        }
        return {
          ...page,
          ...extracted,
          url: page.url,
          fromSitemap: page.fromSitemap,
          depth: page.depth,
        };
      },
      onProgress: (current) => {
        session.value = { ...current, pages: current.pages.slice() };
      },
    });
    session.value = next;
    saveCrawl(next);
  } catch {
    message.value = t("site.failed");
  } finally {
    running.value = false;
    controller = null;
  }
}

function stop() {
  controller?.abort();
}

function download(kind: "csv" | "json") {
  if (!session.value) return;
  const content = kind === "csv" ? sessionCsv(session.value) : sessionJson(session.value);
  const blob = new Blob([content], { type: kind === "csv" ? "text/csv" : "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(`${origin.value}-site`, kind);
  anchor.click();
  URL.revokeObjectURL(url);
}

function crawlState(): string {
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
  if (running.value) return "warn";
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
    <div v-if="report && supportsOptionalExternalChecks" class="actions-row">
      <button type="button" class="primary" :disabled="running || !origin" @click="start">
        {{ t("site.start") }}
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
    <p v-if="report && !supportsOptionalExternalChecks">{{ t("site.firefox") }}</p>
  </div>
  <p v-if="message" class="callout" role="status">{{ message }}</p>
  <p v-if="session?.note" class="hint">{{ session.note }}</p>
  <p v-if="running" class="hint" role="status">
    {{ t("site.progress", { count: session?.pages.length ?? 0 }) }}
  </p>

  <div class="section-heading">
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
  <p v-if="!session || !session.pages.length" class="callout">
    {{ report ? t("wb.si.empty") : t("wb.si.emptySidebar") }}
  </p>
  <template v-else>
    <div class="site-notes">
      <span class="badge gray">{{ sitemapLine() }}</span>
      <span v-if="session.duplicates.length" class="badge warn">{{
        t("site.duplicates", { count: session.duplicates.length })
      }}</span>
      <span v-if="session.orphans.length" class="badge warn">{{
        t("site.orphans", { count: session.orphans.length })
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
