<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { browser } from "wxt/browser";
import { safeFilename, toCsv } from "@rankmiso/report-formats";
import { useI18n } from "../../composables/useI18n";
import { supportsOptionalExternalChecks } from "../../config/features.config";
import { categoryLabelKey } from "../../services/category-label";
import type { AuditResult } from "../../types/audit";
import { badgeTone, statusKey } from "./checks";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";
import type { MessageKey } from "../../locales/en";
import { analyzeSitemap, type SitemapReport } from "../../services/sitemap-engine";
import {
  collectSitemaps,
  sitemapFindingsCsv,
  sitemapUrlsCsv,
  SITEMAP_LIMITS,
  type SitemapCollection,
  type SitemapFileRecord,
} from "../../services/sitemap-explore";

const props = defineProps<{ audit: AuditResult }>();
const network = supportsOptionalExternalChecks;
const pageUrl = computed(() => props.audit.page.url);
const { t, n } = useI18n();
const urlField = useId();
const searchField = useId();
const filterField = useId();
const userUrl = ref("");
const query = ref("");
const filter = ref<"all" | "issues">("all");
const sort = ref<"url" | "lastmod">("url");
const page = ref(0);
const status = ref<
  "idle" | "requesting" | "loading" | "done" | "partial" | "cancelled" | "denied" | "failed"
>("idle");
const message = ref("");
const collected = ref<SitemapCollection | null>(null);
const report = ref<SitemapReport | null>(null);
const expanded = ref<string[]>([]);
const pendingExport = ref<"summary" | "urls" | "findings" | null>(null);
let controller: AbortController | null = null;
const pageSize = 40;
const exportKinds = [
  ["summary", "sitemap.export.summary"],
  ["urls", "sitemap.export.urls"],
  ["findings", "sitemap.export.findings"],
] as const;

function matchLabel(match: string): MessageKey {
  if (match === "found") return "sitemap.match.found";
  if (match === "absent") return "sitemap.match.absent";
  if (match === "unknown") return "sitemap.match.unknown";
  return "sitemap.match.unchecked";
}

const roots = computed(() =>
  (collected.value?.files ?? []).filter((file) => file.source !== "child"),
);
const issueUrls = computed(() => {
  const values = new Set<string>();
  for (const finding of report.value?.findings ?? []) {
    for (const item of finding.evidence) values.add(item.value);
  }
  return values;
});
const rows = computed(() => {
  const list = (collected.value?.files ?? []).flatMap((file) =>
    file.entries.map((entry) => ({ ...entry, sitemap: file.url })),
  );
  const filtered = list.filter((row) => {
    const matchesQuery = !query.value || row.loc.toLowerCase().includes(query.value.toLowerCase());
    const matchesIssue = filter.value === "all" || issueUrls.value.has(row.loc);
    return matchesQuery && matchesIssue;
  });
  return filtered.sort((left, right) =>
    sort.value === "lastmod"
      ? left.lastmod.localeCompare(right.lastmod)
      : left.loc.localeCompare(right.loc),
  );
});
const visibleRows = computed(() =>
  rows.value.slice(page.value * pageSize, page.value * pageSize + pageSize),
);
const showResults = computed(
  () => collected.value && ["done", "partial", "cancelled"].includes(status.value),
);

function childFiles(file: SitemapFileRecord): SitemapFileRecord[] {
  return file.children
    .map((url) => collected.value?.files.find((item) => item.url === url))
    .filter((item): item is SitemapFileRecord => item != null);
}

function toggle(url: string) {
  expanded.value = expanded.value.includes(url)
    ? expanded.value.filter((item) => item !== url)
    : [...expanded.value, url];
}

async function discover() {
  if (!network) return;
  status.value = "requesting";
  message.value = "";
  try {
    const origin = new URL(pageUrl.value).origin;
    const granted = await browser.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      status.value = "denied";
      return;
    }
  } catch {
    status.value = "denied";
    return;
  }
  await run({ network: true, userUrl: userUrl.value });
}

async function importFile(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (file.size > SITEMAP_LIMITS.maxBytes) {
    status.value = "failed";
    message.value = t("sitemap.tooLarge");
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  await run({ network: false, imported: [{ name: file.name, bytes }] });
}

async function run(extra: {
  network: boolean;
  userUrl?: string;
  imported?: Array<{ name: string; bytes: Uint8Array }>;
}) {
  controller?.abort();
  controller = new AbortController();
  status.value = "loading";
  message.value = "";
  try {
    const next = await collectSitemaps({
      pageUrl: pageUrl.value,
      signal: controller.signal,
      network: extra.network,
      userUrl: extra.userUrl,
      imported: extra.imported,
    });
    collected.value = next;
    report.value = await analyzeSitemap(next);
    page.value = 0;
    expanded.value = next.files.filter((file) => file.kind === "index").map((file) => file.url);
    status.value = next.cancelled
      ? "cancelled"
      : next.partial || report.value.partial
        ? "partial"
        : "done";
  } catch {
    if (controller.signal.aborted) status.value = "cancelled";
    else status.value = "failed";
  }
}

function cancel() {
  controller?.abort();
}

function download(kind: "summary" | "urls" | "findings") {
  const current = collected.value;
  const findings = report.value?.findings ?? [];
  if (!current) return;
  const host = new URL(pageUrl.value).hostname;
  const content =
    kind === "urls"
      ? sitemapUrlsCsv(current.files)
      : kind === "findings"
        ? sitemapFindingsCsv(findings)
        : toCsv(
            ["file", "source", "status", "kind", "urls", "truncated"],
            current.files.map((file) => [
              file.url,
              file.source,
              file.fetch,
              file.kind,
              file.entries.length,
              file.truncated ? "yes" : "no",
            ]),
          );
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(`${host}-sitemap-${kind}`, "csv");
  anchor.click();
  URL.revokeObjectURL(url);
  pendingExport.value = null;
}

function fileLabel(file: SitemapFileRecord): string {
  try {
    const url = new URL(file.url);
    return url.pathname.split("/").filter(Boolean).pop() || url.hostname;
  } catch {
    return file.url;
  }
}
</script>

<template>
  <PageHeading :overline="t('wb.sm.overline')" :title="t('wb.sm.title')" :text="t('wb.sm.text')" />
  <div class="compact-stats">
    <div class="kpi">
      <strong>{{ showResults && collected ? n(collected.files.length) : "–" }}</strong
      ><span>{{ t("sitemap.files") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ showResults && report ? n(report.urlCount) : "–" }}</strong
      ><span>{{ t("wb.sm.entries") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ showResults && report ? n(report.findings.length) : "–" }}</strong
      ><span>{{ t("pm.findings") }}</span>
    </div>
  </div>

  <WbCard :title="t('wb.sm.discovery')">
    <p class="hint first">{{ t("sitemap.intro") }}</p>
    <p v-if="!network" class="hint">{{ t("sitemap.firefox") }}</p>
    <div class="actions-row">
      <button
        v-if="network"
        type="button"
        class="primary"
        :disabled="status === 'loading' || status === 'requesting'"
        @click="discover"
      >
        {{ t("sitemap.discover") }}
      </button>
      <button v-if="status === 'loading'" type="button" class="secondary" @click="cancel">
        {{ t("sitemap.cancel") }}
      </button>
      <label class="secondary file-button">
        {{ t("sitemap.import") }}
        <input
          class="sitemap-file-input sr-only"
          type="file"
          accept=".xml,.gz,text/xml,application/xml,application/gzip"
          @change="importFile"
        />
      </label>
    </div>
    <div v-if="network" class="form-stack">
      <label :for="urlField">{{ t("sitemap.userUrl") }}</label>
      <input
        :id="urlField"
        v-model="userUrl"
        class="field"
        type="url"
        name="sitemap-url"
        autocomplete="off"
        :aria-describedby="`${urlField}-hint`"
        :placeholder="t('sitemap.userPlaceholder')"
      />
      <p :id="`${urlField}-hint`">{{ t("sitemap.userHint") }}</p>
    </div>
    <p role="status" aria-live="polite" class="hint">
      <span v-if="status === 'requesting'">{{ t("sitemap.requesting") }}</span>
      <span v-else-if="status === 'loading'" aria-busy="true">{{ t("sitemap.loading") }}</span>
      <span v-else-if="status === 'denied'">{{ t("sitemap.denied") }}</span>
      <span v-else-if="status === 'failed'">{{ message || t("sitemap.failed") }}</span>
      <span v-else-if="status === 'cancelled'">{{ t("sitemap.cancelled") }}</span>
      <span v-else-if="status === 'partial'">{{ t("sitemap.partial") }}</span>
      <span v-else-if="status === 'done'">{{ t("sitemap.done") }}</span>
      <span v-else>{{ t("sitemap.idle") }}</span>
    </p>
  </WbCard>

  <template v-if="showResults && collected && report">
    <div class="callout">
      <div>
        <strong>{{ t("sitemap.page") }} {{ t(matchLabel(report.pageMatch)) }}</strong>
        <p>{{ t("sitemap.coverage") }}</p>
      </div>
    </div>

    <div class="section-heading">
      <div>
        <h2>{{ t("wb.sm.hierarchy") }}</h2>
      </div>
    </div>
    <p v-if="!roots.length" class="callout">{{ t("sitemap.noFiles") }}</p>
    <template v-for="file in roots" :key="file.url">
      <details
        v-if="file.kind === 'index'"
        class="disclosure tree-node"
        :open="expanded.includes(file.url)"
        @toggle="
          ($event.target as HTMLDetailsElement).open !== expanded.includes(file.url) &&
          toggle(file.url)
        "
      >
        <summary>
          <span
            >{{ fileLabel(file) }} ·
            {{ t("wb.sm.children", { count: n(file.children.length) }) }}</span
          >
          <span aria-hidden="true">⌄</span>
        </summary>
        <div class="details-body">
          <div v-for="child in childFiles(file)" :key="child.url" class="data-row">
            <div
              class="record-dot"
              :class="['fetched', 'imported'].includes(child.fetch) ? 'good' : 'warn'"
              aria-hidden="true"
            />
            <div class="data-main">
              <strong>{{ fileLabel(child) }}</strong>
              <small
                >{{ t("wb.sm.urlEntries", { count: n(child.entries.length) }) }} ·
                {{ child.kind || child.fetch }}</small
              >
            </div>
            <div class="data-end">
              <span
                class="badge"
                :class="['fetched', 'imported'].includes(child.fetch) ? 'ok' : 'warn'"
                >{{ child.fetch }}</span
              >
            </div>
          </div>
        </div>
      </details>
      <div v-else class="data-row tree-node">
        <div
          class="record-dot"
          :class="['fetched', 'imported'].includes(file.fetch) ? 'good' : 'warn'"
          aria-hidden="true"
        />
        <div class="data-main">
          <strong>{{ fileLabel(file) }}</strong>
          <small
            >{{ t("wb.sm.urlEntries", { count: n(file.entries.length) }) }} ·
            {{ file.kind || file.fetch }} · {{ file.source }}</small
          >
        </div>
        <div class="data-end">
          <span
            class="badge"
            :class="['fetched', 'imported'].includes(file.fetch) ? 'ok' : 'warn'"
            >{{ file.fetch }}</span
          >
        </div>
      </div>
    </template>

    <div class="section-heading">
      <div>
        <h2>{{ t("wb.sm.inspector") }}</h2>
      </div>
    </div>
    <div class="filter-tools">
      <label class="search" :for="searchField">
        <span class="sr-only">{{ t("sitemap.search") }}</span>
        <input
          :id="searchField"
          v-model="query"
          type="search"
          name="sitemap-search"
          autocomplete="off"
          :placeholder="t('sitemap.search')"
          @input="page = 0"
        />
      </label>
      <label class="select-field" :for="filterField">
        <span>{{ t("sitemap.filter") }}</span>
        <select
          :id="filterField"
          v-model="filter"
          :aria-label="t('sitemap.filter')"
          @change="page = 0"
        >
          <option value="all">{{ t("filter.all") }}</option>
          <option value="issues">{{ t("sitemap.withIssues") }}</option>
        </select>
      </label>
      <label class="select-field" :for="`${filterField}-sort`">
        <span>{{ t("sort.label") }}</span>
        <select :id="`${filterField}-sort`" v-model="sort" :aria-label="t('sort.label')">
          <option value="url">{{ t("sitemap.colUrl") }}</option>
          <option value="lastmod">{{ t("sitemap.colLastmod") }}</option>
        </select>
      </label>
    </div>
    <p class="hint first">
      {{ t("sitemap.showing", { shown: visibleRows.length, total: rows.length }) }}
    </p>
    <div v-if="rows.length" class="simple-table" role="table" :aria-label="t('sitemap.urlList')">
      <div class="table-row table-head" role="row">
        <span role="columnheader">{{ t("wb.sm.pageUrl") }}</span>
        <span role="columnheader">{{ t("sitemap.colLastmod") }}</span>
      </div>
      <div
        v-for="row in visibleRows"
        :key="`${row.sitemap}-${row.loc}`"
        class="table-row"
        role="row"
      >
        <span role="cell">
          {{ row.loc }}
          <small class="cell-sub">
            {{ row.sitemap }} ·
            {{ issueUrls.has(row.loc) ? t("sitemap.rowIssue") : t("sitemap.rowOk") }}
          </small>
        </span>
        <span role="cell">{{ row.lastmod || "—" }}</span>
      </div>
    </div>
    <p v-else class="callout">{{ t("sitemap.noUrls") }}</p>
    <div v-if="rows.length > pageSize" class="actions-row">
      <button type="button" class="quiet" :disabled="page === 0" @click="page -= 1">
        {{ t("sitemap.prev") }}
      </button>
      <button
        type="button"
        class="quiet"
        :disabled="(page + 1) * pageSize >= rows.length"
        @click="page += 1"
      >
        {{ t("sitemap.next") }}
      </button>
    </div>

    <div class="section-heading">
      <div>
        <h2>{{ t("sitemap.findings") }}</h2>
      </div>
    </div>
    <div v-if="report.findings.length" class="finding-list">
      <article
        v-for="(finding, index) in report.findings"
        :key="`${finding.id}-${index}`"
        class="finding"
      >
        <div class="finding-type">
          <span class="badge" :class="badgeTone(finding.status)">{{
            t(statusKey[finding.status])
          }}</span>
          <span>{{ t(categoryLabelKey[finding.category] ?? "nav.sitemaps") }}</span>
        </div>
        <h3>{{ finding.title }}</h3>
        <p>{{ finding.description }}</p>
        <p v-if="finding.recommendation" class="finding-fix">
          <strong>{{ t("check.fix") }}:</strong> {{ finding.recommendation }}
        </p>
        <details v-if="finding.evidence.length" class="disclosure">
          <summary>{{ t("wb.is.evidence") }}<span aria-hidden="true">⌄</span></summary>
          <div class="details-body">
            <dl class="evidence">
              <div v-for="item in finding.evidence" :key="`${item.label}-${item.value}`">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </div>
        </details>
      </article>
    </div>
    <p v-else class="callout">{{ t("sitemap.noFindings") }}</p>

    <div class="section-heading">
      <div>
        <h2>{{ t("sitemap.export") }}</h2>
      </div>
    </div>
    <div class="actions-row">
      <button
        v-for="kind in exportKinds"
        :key="kind[0]"
        type="button"
        class="quiet"
        :aria-expanded="pendingExport === kind[0]"
        @click="pendingExport = pendingExport === kind[0] ? null : kind[0]"
      >
        {{ t(kind[1]) }}
      </button>
    </div>
    <div v-if="pendingExport" class="confirm-box">
      <p>{{ t("export.confirm") }}</p>
      <div class="actions-row">
        <button type="button" class="primary" @click="download(pendingExport)">
          {{ t("export.confirmAction") }}
        </button>
        <button type="button" class="secondary" @click="pendingExport = null">
          {{ t("sitemap.cancel") }}
        </button>
      </div>
    </div>
  </template>
  <p class="hint">{{ t("wb.sm.hint") }}</p>
</template>
