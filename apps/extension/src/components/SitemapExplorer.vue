<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { browser } from "wxt/browser";
import { safeFilename, toCsv } from "@rankmiso/report-formats";
import IssueCard from "./IssueCard.vue";
import { useI18n } from "../composables/useI18n";
import type { MessageKey } from "../locales/en";
import { analyzeSitemap, type SitemapReport } from "../services/sitemap-engine";
import {
  collectSitemaps,
  sitemapFindingsCsv,
  sitemapUrlsCsv,
  SITEMAP_LIMITS,
  type SitemapCollection,
  type SitemapFileRecord,
} from "../services/sitemap-explore";

const props = defineProps<{ pageUrl: string; network: boolean }>();
const { t } = useI18n();
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

function onTreeKey(event: KeyboardEvent) {
  const current = event.target;
  if (!(current instanceof HTMLElement)) return;
  const items = [
    ...current.closest("[role=tree]")!.querySelectorAll<HTMLElement>("[role=treeitem]"),
  ];
  const index = items.indexOf(current);
  if (event.key === "ArrowDown" && items[index + 1]) {
    items[index + 1]?.focus();
    event.preventDefault();
  }
  if (event.key === "ArrowUp" && items[index - 1]) {
    items[index - 1]?.focus();
    event.preventDefault();
  }
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    const url = current.dataset.url;
    if (!url) return;
    const open = expanded.value.includes(url);
    if (event.key === "ArrowRight" && !open) toggle(url);
    if (event.key === "ArrowLeft" && open) toggle(url);
    event.preventDefault();
  }
}

async function discover() {
  if (!props.network) return;
  status.value = "requesting";
  message.value = "";
  try {
    const origin = new URL(props.pageUrl).origin;
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
      pageUrl: props.pageUrl,
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
  const host = new URL(props.pageUrl).hostname;
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
  <section class="report-section sitemap-explorer" aria-labelledby="sitemap-heading">
    <div class="max-w-3xl">
      <h2 id="sitemap-heading">{{ t("sitemap.title") }}</h2>
      <p class="text-[13px] leading-relaxed text-muted">{{ t("sitemap.intro") }}</p>
      <p v-if="!network" class="text-[13px] leading-relaxed">{{ t("sitemap.firefox") }}</p>
    </div>

    <div class="mt-4 flex flex-wrap items-end gap-2">
      <button
        v-if="network"
        type="button"
        class="min-h-10 rounded-panel bg-primary px-3 text-[13px] text-primary-contrast"
        :disabled="status === 'loading' || status === 'requesting'"
        @click="discover"
      >
        {{ t("sitemap.discover") }}
      </button>
      <button
        v-if="status === 'loading'"
        type="button"
        class="min-h-10 rounded-panel border border-border px-3 text-[13px]"
        @click="cancel"
      >
        {{ t("sitemap.cancel") }}
      </button>
      <label
        class="relative min-h-10 cursor-pointer rounded-panel border border-border bg-surface px-3 py-2 text-[13px]"
      >
        {{ t("sitemap.import") }}
        <input
          class="sitemap-file-input"
          type="file"
          accept=".xml,.gz,text/xml,application/xml,application/gzip"
          @change="importFile"
        />
      </label>
    </div>
    <div v-if="network" class="mt-3 max-w-xl">
      <label class="grid gap-1 text-[13px]" :for="urlField">
        {{ t("sitemap.userUrl") }}
        <input
          :id="urlField"
          v-model="userUrl"
          type="url"
          name="sitemap-url"
          autocomplete="off"
          class="rounded-panel border border-border bg-surface px-3 py-2"
          :aria-describedby="`${urlField}-hint`"
          :placeholder="t('sitemap.userPlaceholder')"
        />
      </label>
      <p :id="`${urlField}-hint`" class="mt-1 text-[12px] text-muted">
        {{ t("sitemap.userHint") }}
      </p>
    </div>

    <p role="status" aria-live="polite" class="mt-3 text-[13px]">
      <span v-if="status === 'requesting'">{{ t("sitemap.requesting") }}</span>
      <span v-else-if="status === 'loading'" aria-busy="true">{{ t("sitemap.loading") }}</span>
      <span v-else-if="status === 'denied'">{{ t("sitemap.denied") }}</span>
      <span v-else-if="status === 'failed'">{{ message || t("sitemap.failed") }}</span>
      <span v-else-if="status === 'cancelled'">{{ t("sitemap.cancelled") }}</span>
      <span v-else-if="status === 'partial'">{{ t("sitemap.partial") }}</span>
      <span v-else-if="status === 'done'">{{ t("sitemap.done") }}</span>
      <span v-else>{{ t("sitemap.idle") }}</span>
    </p>

    <template v-if="showResults && collected && report">
      <p class="metric-line mt-4">
        <span>{{ t("sitemap.files") }} {{ collected.files.length }}</span>
        <span>{{ t("sitemap.urls") }} {{ report.urlCount }}</span>
        <span>{{ t("sitemap.issues") }} {{ report.findings.length }}</span>
        <span>{{ t("sitemap.page") }} {{ t(matchLabel(report.pageMatch)) }}</span>
      </p>
      <p class="mt-2 text-[12px] leading-relaxed text-muted">{{ t("sitemap.coverage") }}</p>

      <h3 class="mt-6 text-[15px]">{{ t("sitemap.tree") }}</h3>
      <ul
        v-if="roots.length"
        class="sitemap-tree"
        role="tree"
        :aria-label="t('sitemap.tree')"
        @keydown="onTreeKey"
      >
        <li v-for="file in roots" :key="file.url" role="none">
          <button
            type="button"
            role="treeitem"
            class="sitemap-node"
            :data-url="file.url"
            :aria-expanded="file.kind === 'index' ? expanded.includes(file.url) : undefined"
            @click="file.kind === 'index' ? toggle(file.url) : undefined"
          >
            <span class="font-medium">{{ fileLabel(file) }}</span>
            <span class="text-muted"
              >{{ file.kind || file.fetch }} · {{ file.fetch }} ·
              {{ file.entries.length || file.children.length }}</span
            >
          </button>
          <ul v-if="file.kind === 'index' && expanded.includes(file.url)" role="group">
            <li v-for="child in childFiles(file)" :key="child.url" role="none">
              <button
                type="button"
                role="treeitem"
                class="sitemap-node sitemap-node-child"
                :data-url="child.url"
              >
                <span class="font-medium">{{ fileLabel(child) }}</span>
                <span class="text-muted"
                  >{{ child.kind || child.fetch }} · {{ child.fetch }} ·
                  {{ child.entries.length }}</span
                >
              </button>
            </li>
          </ul>
        </li>
      </ul>
      <p v-else class="text-[13px] text-muted">{{ t("sitemap.noFiles") }}</p>

      <h3 class="mt-6 text-[15px]">{{ t("sitemap.urlList") }}</h3>
      <div class="check-tools">
        <label class="check-search" :for="searchField">
          <span>{{ t("sitemap.search") }}</span>
          <input
            :id="searchField"
            v-model="query"
            type="search"
            name="sitemap-search"
            autocomplete="off"
            class="w-full rounded-panel border border-border bg-surface px-3 py-2"
            @input="page = 0"
          />
        </label>
        <div class="check-search">
          <label :for="filterField">{{ t("sitemap.filter") }}</label>
          <select :id="filterField" v-model="filter" class="check-select" @change="page = 0">
            <option value="all">{{ t("filter.all") }}</option>
            <option value="issues">{{ t("sitemap.withIssues") }}</option>
          </select>
        </div>
        <div class="check-search">
          <label :for="`${filterField}-sort`">{{ t("sort.label") }}</label>
          <select :id="`${filterField}-sort`" v-model="sort" class="check-select">
            <option value="url">{{ t("sitemap.colUrl") }}</option>
            <option value="lastmod">{{ t("sitemap.colLastmod") }}</option>
          </select>
        </div>
      </div>
      <p class="text-[12px] text-muted">
        {{ t("sitemap.showing", { shown: visibleRows.length, total: rows.length }) }}
      </p>
      <div v-if="rows.length" class="overflow-x-auto">
        <table class="w-full text-left text-[13px]">
          <caption class="sr-only">
            {{
              t("sitemap.urlList")
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col" class="px-2 py-2">{{ t("sitemap.colUrl") }}</th>
              <th scope="col" class="px-2 py-2">{{ t("sitemap.colSource") }}</th>
              <th scope="col" class="px-2 py-2">{{ t("sitemap.colLastmod") }}</th>
              <th scope="col" class="px-2 py-2">{{ t("sitemap.colStatus") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visibleRows"
              :key="`${row.sitemap}-${row.loc}`"
              class="border-t border-border"
            >
              <td class="break-all px-2 py-2">{{ row.loc }}</td>
              <td class="break-all px-2 py-2 text-muted">{{ row.sitemap }}</td>
              <td class="px-2 py-2">{{ row.lastmod || "—" }}</td>
              <td class="px-2 py-2">
                {{ issueUrls.has(row.loc) ? t("sitemap.rowIssue") : t("sitemap.rowOk") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-[13px] text-muted">{{ t("sitemap.noUrls") }}</p>
      <div v-if="rows.length > pageSize" class="mt-2 flex gap-2">
        <button
          type="button"
          class="min-h-10 rounded-panel border border-border px-3 text-[13px]"
          :disabled="page === 0"
          @click="page -= 1"
        >
          {{ t("sitemap.prev") }}
        </button>
        <button
          type="button"
          class="min-h-10 rounded-panel border border-border px-3 text-[13px]"
          :disabled="(page + 1) * pageSize >= rows.length"
          @click="page += 1"
        >
          {{ t("sitemap.next") }}
        </button>
      </div>

      <h3 class="mt-6 text-[15px]">{{ t("sitemap.findings") }}</h3>
      <ul v-if="report.findings.length" class="grid gap-3">
        <li v-for="(finding, index) in report.findings" :key="`${finding.id}-${index}`">
          <IssueCard :check="finding" />
        </li>
      </ul>
      <p v-else class="text-[13px] text-muted">{{ t("sitemap.noFindings") }}</p>

      <h3 class="mt-6 text-[15px]">{{ t("sitemap.export") }}</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="kind in exportKinds"
          :key="kind[0]"
          type="button"
          class="min-h-10 rounded-panel border border-border px-3 text-[13px]"
          @click="pendingExport = pendingExport === kind[0] ? null : kind[0]"
        >
          {{ t(kind[1]) }}
        </button>
      </div>
      <div v-if="pendingExport" class="mt-2 rounded-panel border border-border bg-surface p-3">
        <p class="m-0 text-[13px]">{{ t("export.confirm") }}</p>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            class="min-h-10 rounded-panel bg-primary px-3 text-[13px] text-primary-contrast"
            @click="download(pendingExport)"
          >
            {{ t("export.confirmAction") }}
          </button>
          <button
            type="button"
            class="min-h-10 rounded-panel border border-border px-3 text-[13px]"
            @click="pendingExport = null"
          >
            {{ t("sitemap.cancel") }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
