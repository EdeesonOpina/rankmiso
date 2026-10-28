<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { browser } from "wxt/browser";
import { safeFilename } from "@rankmiso/report-formats";
import { supportsOptionalExternalChecks } from "../config/features.config";
import { useI18n } from "../composables/useI18n";
import { analyzeSnapshot } from "../services/engine";
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
} from "../services/site-crawl";
import { extractCrawlPage, snapshotFromHtml } from "../services/site-extract";
import CopyButton from "./CopyButton.vue";

const props = defineProps<{ pageUrl: string }>();
const { t, n } = useI18n();
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
    return new URL(props.pageUrl).origin;
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
    const network = import.meta.env.FIREFOX ? null : await import("../services/site-crawl-network");
    if (!network) return;
    let robotsBody = "";
    const next = await runSiteCrawl({
      startUrl: props.pageUrl,
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
          props.pageUrl,
          controller?.signal ?? new AbortController().signal,
        ),
      mayFetch: (path) => network.mayFetchPath(robotsBody, path),
      fetchPage: (url, signal) => network.fetchCrawlPage(url, props.pageUrl, signal),
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

function statusLabel(page: CrawlPage): string {
  if (page.skipped) return t("site.skipped");
  if (page.error && page.status == null) return t("site.failedShort");
  return page.status == null ? "—" : String(page.status);
}
</script>

<template>
  <section class="report-section" aria-labelledby="site-explorer-heading">
    <h2 id="site-explorer-heading">{{ t("site.title") }}</h2>
    <p class="report-copy">{{ t("site.intro") }}</p>
    <dl class="essentials">
      <div>
        <dt>{{ t("site.website") }}</dt>
        <dd>{{ pageUrl }}</dd>
      </div>
      <div>
        <dt>{{ t("site.scope") }}</dt>
        <dd>{{ origin || t("site.noOrigin") }}</dd>
      </div>
      <div>
        <dt>{{ t("site.limit") }}</dt>
        <dd>{{ n(CRAWL_LIMITS.maxPages) }}</dd>
      </div>
      <div>
        <dt>{{ t("site.status") }}</dt>
        <dd>{{ crawlState() }}</dd>
      </div>
    </dl>
    <p v-if="!supportsOptionalExternalChecks" class="report-copy">{{ t("site.firefox") }}</p>
    <div v-else class="flex flex-wrap gap-2">
      <button type="button" class="inspector-action is-primary" :disabled="running" @click="start">
        {{ t("site.start") }}
      </button>
      <button type="button" class="inspector-action" :disabled="!running" @click="stop">
        {{ t("site.stop") }}
      </button>
    </div>
    <p v-if="message" class="report-copy" role="status">{{ message }}</p>
    <p v-if="session?.note" class="report-copy">{{ session.note }}</p>
    <p v-if="running" class="report-copy" role="status">
      {{ t("site.progress", { count: session?.pages.length ?? 0 }) }}
    </p>
    <template v-if="session && session.pages.length">
      <p class="metric-line">
        <span>{{ t("site.discovered") }} {{ n(session.pages.length) }}</span>
        <span
          >{{ t("site.fetched") }}
          {{ n(session.pages.filter((page) => page.status != null).length) }}</span
        >
        <span
          >{{ t("site.failedCount") }}
          {{ n(session.pages.filter((page) => page.error).length) }}</span
        >
        <span
          >{{ t("site.skippedCount") }}
          {{ n(session.pages.filter((page) => page.skipped).length) }}</span
        >
      </p>
      <p class="report-copy">{{ sitemapLine() }}</p>
      <p v-if="session.duplicates.length" class="report-copy">
        {{ t("site.duplicates", { count: session.duplicates.length }) }}
      </p>
      <p v-if="session.orphans.length" class="report-copy">
        {{ t("site.orphans", { count: session.orphans.length }) }}
      </p>
      <div class="inspector-tools">
        <label class="check-search">
          {{ t("site.search") }}
          <input v-model="query" type="search" />
        </label>
        <label class="check-search">
          {{ t("site.filter") }}
          <select v-model="filter">
            <option value="all">{{ t("site.filterAll") }}</option>
            <option value="issues">{{ t("site.filterIssues") }}</option>
            <option value="failed">{{ t("site.filterFailed") }}</option>
            <option value="skipped">{{ t("site.filterSkipped") }}</option>
          </select>
        </label>
        <label class="check-search">
          {{ t("site.sort") }}
          <select v-model="sort">
            <option value="url">{{ t("site.sortUrl") }}</option>
            <option value="title">{{ t("site.sortTitle") }}</option>
            <option value="issues">{{ t("site.sortIssues") }}</option>
          </select>
        </label>
      </div>
      <table class="site-table">
        <caption class="sr-only">
          {{
            t("site.caption")
          }}
        </caption>
        <thead>
          <tr>
            <th>{{ t("site.colStatus") }}</th>
            <th>{{ t("site.colUrl") }}</th>
            <th>{{ t("site.colTitle") }}</th>
            <th>{{ t("site.colIndex") }}</th>
            <th>{{ t("site.colIssues") }}</th>
            <th>{{ t("site.colLinks") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in rows" :key="page.url">
            <td>{{ statusLabel(page) }}</td>
            <td>
              <button type="button" class="report-text-action" @click="selectedUrl = page.url">
                {{ page.url }}
              </button>
            </td>
            <td>{{ page.title || "—" }}</td>
            <td>{{ page.indexability }}</td>
            <td>{{ n(page.issues.length) }}</td>
            <td>{{ n(page.internalLinks.length) }}</td>
          </tr>
        </tbody>
      </table>
      <button
        v-if="visible.length > rows.length"
        type="button"
        class="inspector-action"
        @click="shown += 40"
      >
        {{ t("site.more") }}
      </button>
      <section v-if="selected" class="stack" :aria-label="t('site.detail')">
        <h3>{{ selected.title || selected.url }}</h3>
        <dl class="essentials">
          <div>
            <dt>{{ t("field.url") }}</dt>
            <dd>
              {{ selected.finalUrl || selected.url }}
              <CopyButton :value="selected.finalUrl || selected.url" />
            </dd>
          </div>
          <div>
            <dt>{{ t("site.colStatus") }}</dt>
            <dd>{{ statusLabel(selected) }}</dd>
          </div>
          <div>
            <dt>{{ t("site.description") }}</dt>
            <dd>{{ selected.description || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("field.canonical") }}</dt>
            <dd>{{ selected.canonical || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("site.robotsMeta") }}</dt>
            <dd>{{ selected.robots || "—" }}</dd>
          </div>
          <div>
            <dt>{{ t("site.headings") }}</dt>
            <dd>{{ n(selected.h1Count) }}</dd>
          </div>
        </dl>
        <p v-if="selected.skipped" class="report-copy">{{ selected.skipped }}</p>
        <ul v-if="selected.issues.length" class="report-copy">
          <li v-for="issue in selected.issues" :key="issue">{{ issue }}</li>
        </ul>
      </section>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="inspector-action" @click="download('csv')">
          {{ t("site.exportCsv") }}
        </button>
        <button type="button" class="inspector-action" @click="download('json')">
          {{ t("site.exportJson") }}
        </button>
      </div>
      <p class="report-copy">{{ t("site.lifecycle") }}</p>
    </template>
  </section>
</template>
