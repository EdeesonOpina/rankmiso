<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "../../composables/useI18n";
import type { AuditResult, Category } from "../../types/audit";
import {
  byTime,
  categoryChange,
  categoryState,
  compareAudits,
  compareRecords,
  historyCsv,
  historyFilename,
  historyHtml,
  historyJson,
  clearSavedReports,
  deleteSavedReport,
  MAX_SAVED_REPORTS,
  readSavedReports,
  saveAudit,
  recordsForPage,
  scoreConnects,
  type MeasureChange,
  type SavedReport,
} from "../../services/saved-reports";
import HistoryChart from "../HistoryChart.vue";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { surface, ready, openReport } = useWorkbench();
const isReport = surface === "report";
const pageUrl = computed(() => props.audit.page.url);
const reports = ref<SavedReport[]>([]);
const reportMessage = ref("");
const saving = ref(false);

async function load() {
  try {
    reports.value = await readSavedReports();
  } catch {
    reports.value = [];
  }
}
onMounted(load);

async function saveCurrent() {
  if (saving.value) return;
  saving.value = true;
  const atCap = reports.value.length >= MAX_SAVED_REPORTS;
  try {
    await saveAudit(props.audit);
    await load();
    reportMessage.value = atCap ? t("reports.savedReplaced") : t("reports.saved");
  } catch {
    reportMessage.value = t("reports.saveFailed");
  } finally {
    saving.value = false;
  }
}

async function remove(id: string) {
  await deleteSavedReport(id);
  reports.value = reports.value.filter((report) => report.id !== id);
}

async function removeAll() {
  await clearSavedReports();
  reports.value = [];
  reportMessage.value = t("reports.cleared");
}
const showAll = ref(false);
const selected = ref(0);
const category = ref("metadata");
const baselineId = ref("");
const laterId = ref("");
const pairTouched = ref(false);
const confirmClear = ref(false);
const pendingExport = ref<"csv" | "json" | "html" | null>(null);

const pageReports = computed(() => byTime(recordsForPage(reports.value, pageUrl.value), "asc"));
const listed = computed(() => byTime(showAll.value ? reports.value : pageReports.value, "desc"));
const categories = computed(() => {
  const seen = new Set<string>();
  for (const report of pageReports.value) {
    for (const item of report.comparison.history?.categories ?? []) seen.add(item.category);
  }
  return [...seen];
});

watch(
  pageReports,
  (reports) => {
    selected.value = Math.max(0, reports.length - 1);
    if (pairTouched.value) return;
    const dated = reports.filter((report) => Number.isFinite(Date.parse(report.savedAt)));
    baselineId.value = dated.at(-2)?.id ?? "";
    laterId.value = dated.at(-1)?.id ?? "";
  },
  { immediate: true },
);

watch(categories, (items) => {
  if (items.length && !items.includes(category.value)) category.value = items[0] ?? "metadata";
});

const baseline = computed(
  () => pageReports.value.find((report) => report.id === baselineId.value) ?? null,
);
const later = computed(
  () => pageReports.value.find((report) => report.id === laterId.value) ?? null,
);
const comparison = computed(() =>
  baseline.value && later.value && baseline.value.id !== later.value.id
    ? compareRecords(baseline.value, later.value)
    : null,
);
const againstCurrent = computed(() => later.value ?? pageReports.value.at(-1) ?? null);
const currentDiffs = computed(() =>
  againstCurrent.value ? compareAudits(againstCurrent.value.comparison, props.audit) : [],
);
const categoryDelta = computed(() =>
  baseline.value && later.value
    ? categoryChange(baseline.value, later.value, category.value)
    : null,
);
const findingGroups = computed(() => {
  const current = comparison.value;
  if (!current || current.findings !== "ready") return [];
  return [
    { title: t("reports.resolved"), items: current.resolved },
    { title: t("reports.newIssues"), items: current.introduced },
    { title: t("reports.unchangedIssues"), items: current.unchanged },
    { title: t("reports.unknownIssues"), items: current.undetermined },
  ];
});
const selectedReport = computed(() => pageReports.value[selected.value] ?? null);

const scoreSeries = computed(() => [
  {
    id: "score",
    label: t("reports.fieldScore"),
    marker: "circle" as const,
    values: pageReports.value.map((report) => report.comparison.score),
    connect: pageReports.value.slice(0, -1).map((report, index) => {
      const next = pageReports.value[index + 1];
      return next ? scoreConnects(report, next) : false;
    }),
  },
]);
const issueSeries = computed(() => [
  {
    id: "error",
    label: t("reports.errors"),
    marker: "circle" as const,
    values: pageReports.value.map((report) => report.comparison.history?.errors ?? null),
    connect: issueConnects(),
  },
  {
    id: "warning",
    label: t("reports.warnings"),
    marker: "square" as const,
    values: pageReports.value.map((report) => report.comparison.history?.warnings ?? null),
    connect: issueConnects(),
  },
]);
const categorySeries = computed(() => [
  {
    id: "score",
    label: categoryLabel(category.value),
    marker: "circle" as const,
    values: pageReports.value.map((report) => {
      const state = categoryState(report, category.value);
      return state.kind === "score" ? state.value : null;
    }),
    connect: pageReports.value.slice(0, -1).map((report, index) => {
      const next = pageReports.value[index + 1];
      return next ? categoryChange(report, next, category.value).kind === "delta" : false;
    }),
  },
]);
const pointLabels = computed(() =>
  pageReports.value.map((report) => {
    const score =
      report.comparison.score == null ? t("reports.notRecorded") : n(report.comparison.score);
    return `${formatWhen(report.savedAt)}. ${t("reports.fieldScore")} ${score}`;
  }),
);
const issueMax = computed(() => {
  const values = issueSeries.value.flatMap((series) => series.values);
  return Math.max(1, ...values.filter((value): value is number => value != null));
});
const reversed = computed(() => {
  if (!baseline.value || !later.value) return false;
  const before = Date.parse(baseline.value.savedAt);
  const after = Date.parse(later.value.savedAt);
  return Number.isFinite(before) && Number.isFinite(after) && after < before;
});

function issueConnects(): boolean[] {
  return pageReports.value.slice(0, -1).map((report, index) => {
    const next = pageReports.value[index + 1];
    if (!next?.comparison.history || !report.comparison.history) return false;
    return report.comparison.history.rulesetVersion === next.comparison.history.rulesetVersion;
  });
}

function shortDay(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return t("reports.notRecorded");
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(time);
}

function formatWhen(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return t("reports.notRecorded");
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(time);
}

function changeText(change: MeasureChange | null): string {
  if (!change || change.kind === "missing") return t("reports.notRecorded");
  if (change.kind === "unmeasured") return t("reports.notMeasured");
  if (change.kind === "limited") return t("reports.notComparable");
  const value = change.after - change.before;
  return value > 0 ? `+${n(value)}` : n(value);
}

function measureText(
  report: SavedReport | null,
  kind: "score" | "errors" | "warnings" | "coverage",
): string {
  if (!report) return t("reports.notRecorded");
  if (kind === "score") {
    return report.comparison.score == null ? t("reports.notRecorded") : n(report.comparison.score);
  }
  const history = report.comparison.history;
  if (!history) return t("reports.notRecorded");
  if (kind === "errors") return n(history.errors);
  if (kind === "warnings") return n(history.warnings);
  return n(history.applicableChecks);
}

function categoryText(report: SavedReport | null): string {
  if (!report) return t("reports.notRecorded");
  const state = categoryState(report, category.value);
  if (state.kind === "missing") return t("reports.notRecorded");
  if (state.kind === "unmeasured") return t("reports.notMeasured");
  return n(state.value);
}

function categoryLabel(value: string): string {
  switch (value as Category) {
    case "metadata":
      return t("nav.metadata");
    case "content":
      return t("nav.content");
    case "headings":
      return t("nav.headings");
    case "links":
      return t("nav.links");
    case "images":
      return t("nav.images");
    case "technical":
      return t("nav.technical");
    case "structuredData":
      return t("nav.schema");
    case "social":
      return t("nav.social");
    case "performance":
      return t("nav.performance");
    case "international":
      return t("nav.international");
    case "accessibility":
      return t("nav.accessibility");
    default:
      return value;
  }
}

function download(kind: "csv" | "json" | "html") {
  const records = byTime(pageReports.value, "asc");
  const compared = comparison.value;
  const content =
    kind === "csv"
      ? historyCsv(records)
      : kind === "json"
        ? historyJson(records, compared)
        : historyHtml(records, compared);
  const blob = new Blob([content], {
    type: kind === "csv" ? "text/csv" : kind === "html" ? "text/html" : "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = historyFilename(pageUrl.value, kind === "html" ? "html" : kind);
  anchor.click();
  URL.revokeObjectURL(url);
  pendingExport.value = null;
}

function confirmExport() {
  if (pendingExport.value) download(pendingExport.value);
}
</script>

<template>
  <PageHeading
    :overline="t('wb.hi.overline')"
    :title="t('wb.hi.title')"
    :text="isReport ? t('wb.hi.text') : t('wb.hi.textShort')"
  />
  <div class="save-strip">
    <div>
      <strong>{{ t("reports.compareTitle") }}</strong>
      <p role="status">
        {{
          reportMessage ||
          (reports.length === 0
            ? t("reports.empty")
            : t("reports.savedCount", { count: reports.length }))
        }}
      </p>
    </div>
    <button type="button" class="primary" :disabled="!ready || saving" @click="saveCurrent">
      {{ t("reports.saveCurrent") }}
    </button>
  </div>
  <p v-if="reports.length >= MAX_SAVED_REPORTS" class="hint">{{ t("reports.cap") }}</p>

  <div v-if="pageReports.length === 0" class="callout empty-history">
    <img src="/brand/rankmiso-fox.webp" width="72" height="72" alt="" />
    <div>
      <strong>{{ t("reports.timeline") }}</strong>
      <p>{{ t("reports.historyEmpty") }}</p>
    </div>
  </div>

  <template v-else>
    <div :class="isReport ? 'history-dashboard' : ''">
      <WbCard :title="isReport ? t('reports.timeline') : t('wb.hi.health')">
        <div class="history-top">
          <div>
            <span>{{ t("wb.ov.latestSaved") }}</span>
            <strong>{{ measureText(pageReports.at(-1) ?? null, "score") }}</strong>
            <small>{{ t("wb.hi.savedCount", { count: n(pageReports.length) }) }}</small>
          </div>
          <span class="badge" :class="pageReports.length > 1 ? 'ok' : 'gray'">
            {{ pageReports.length > 1 ? t("wb.hi.pair") : t("reports.onePoint") }}
          </span>
        </div>
        <HistoryChart
          :label="t('reports.timeline')"
          :ids="pageReports.map((report) => report.id)"
          :points="pointLabels"
          :series="scoreSeries"
          :y-max="100"
          :selected="selected"
          @select="selected = $event"
        />
        <div class="axis-notes">
          <span>{{ shortDay(pageReports[0]?.savedAt ?? "") }}</span>
          <span v-if="pageReports.length > 2">{{
            shortDay(pageReports[Math.floor(pageReports.length / 2)]?.savedAt ?? "")
          }}</span>
          <span>{{ shortDay(pageReports.at(-1)?.savedAt ?? "") }}</span>
        </div>
        <p v-if="isReport && selectedReport" class="hint">
          {{ formatWhen(selectedReport.savedAt) }} · {{ t("reports.fieldScore") }}
          {{ measureText(selectedReport, "score") }} · {{ t("reports.errors") }}
          {{ measureText(selectedReport, "errors") }} · {{ t("reports.warnings") }}
          {{ measureText(selectedReport, "warnings") }} · {{ t("reports.coverage") }}
          {{ measureText(selectedReport, "coverage") }}
        </p>
      </WbCard>

      <WbCard :title="t('wb.hi.beforeAfter')">
        <p v-if="pageReports.length < 2" class="hint first">{{ t("reports.needSecond") }}</p>
        <template v-else>
          <div class="compare-box">
            <div>
              <span
                >{{ t("reports.baseline") }} ·
                {{ baseline ? shortDay(baseline.savedAt) : "–" }}</span
              >
              <strong>{{ measureText(baseline, "score") }}</strong>
              <small>{{ t("score.warnings", { count: measureText(baseline, "warnings") }) }}</small>
            </div>
            <div class="compare-arrow" aria-hidden="true">→</div>
            <div>
              <span>{{ t("wb.hi.latest") }} · {{ later ? shortDay(later.savedAt) : "–" }}</span>
              <strong>{{ measureText(later, "score") }}</strong>
              <small>{{ t("score.warnings", { count: measureText(later, "warnings") }) }}</small>
            </div>
          </div>
          <p class="hint">
            {{ comparison ? `${t("wb.hi.delta", { value: changeText(comparison.score) })} ` : ""
            }}{{ t("wb.hi.compatible") }}
          </p>
          <div v-if="isReport" class="pair-fields">
            <label class="select-field">
              <span>{{ t("reports.baseline") }}</span>
              <select
                v-model="baselineId"
                :aria-label="t('reports.baseline')"
                @change="pairTouched = true"
              >
                <option v-for="report in pageReports" :key="report.id" :value="report.id">
                  {{ formatWhen(report.savedAt) }}
                </option>
              </select>
            </label>
            <label class="select-field">
              <span>{{ t("reports.laterAudit") }}</span>
              <select
                v-model="laterId"
                :aria-label="t('reports.laterAudit')"
                @change="pairTouched = true"
              >
                <option v-for="report in pageReports" :key="report.id" :value="report.id">
                  {{ formatWhen(report.savedAt) }}
                </option>
              </select>
            </label>
          </div>
          <p v-if="reversed" class="hint">{{ t("reports.reversed") }}</p>
        </template>
      </WbCard>
    </div>

    <template v-if="isReport">
      <div class="history-dashboard">
        <WbCard :title="t('reports.issuesTrend')">
          <p class="hint first">{{ t("reports.warningNote") }}</p>
          <ul class="history-legend">
            <li>
              <svg width="28" height="10" aria-hidden="true">
                <line class="series series-error" x1="0" y1="5" x2="28" y2="5" />
                <circle class="mark series-error" cx="14" cy="5" r="3" />
              </svg>
              {{ t("reports.errors") }}
            </li>
            <li>
              <svg width="28" height="10" aria-hidden="true">
                <line class="series series-warning" x1="0" y1="5" x2="28" y2="5" />
                <rect class="mark series-warning" x="10" y="1" width="8" height="8" />
              </svg>
              {{ t("reports.warnings") }}
            </li>
          </ul>
          <HistoryChart
            :label="t('reports.issuesTrend')"
            :ids="pageReports.map((report) => report.id)"
            :points="pointLabels"
            :series="issueSeries"
            :y-max="issueMax"
            :selected="selected"
            @select="selected = $event"
          />
        </WbCard>
        <WbCard :title="t('reports.categoryTrend')">
          <p v-if="categories.length === 0" class="hint first">{{ t("reports.noCategory") }}</p>
          <template v-else>
            <label class="select-field">
              <span>{{ t("filter.category") }}</span>
              <select v-model="category" :aria-label="t('filter.category')">
                <option v-for="item in categories" :key="item" :value="item">
                  {{ categoryLabel(item) }}
                </option>
              </select>
            </label>
            <p class="hint">
              {{ t("reports.before") }} {{ categoryText(baseline) }} · {{ t("reports.after") }}
              {{ categoryText(later) }} · {{ t("reports.change") }} {{ changeText(categoryDelta) }}
            </p>
            <HistoryChart
              :label="categoryLabel(category)"
              :ids="pageReports.map((report) => report.id)"
              :points="pointLabels"
              :series="categorySeries"
              :y-max="100"
              :selected="selected"
              @select="selected = $event"
            />
          </template>
        </WbCard>
      </div>

      <WbCard v-if="comparison && baseline && later" :title="t('reports.compareTwo')">
        <div class="properties">
          <div class="property">
            <span>{{ t("reports.fieldScore") }}</span>
            <strong
              >{{ measureText(baseline, "score") }} {{ t("reports.to") }}
              {{ measureText(later, "score") }} · {{ changeText(comparison.score) }}</strong
            >
          </div>
          <div class="property">
            <span>{{ t("reports.errors") }}</span>
            <strong
              >{{ measureText(baseline, "errors") }} {{ t("reports.to") }}
              {{ measureText(later, "errors") }} · {{ changeText(comparison.errors) }}</strong
            >
          </div>
          <div class="property">
            <span>{{ t("reports.warnings") }}</span>
            <strong
              >{{ measureText(baseline, "warnings") }} {{ t("reports.to") }}
              {{ measureText(later, "warnings") }} · {{ changeText(comparison.warnings) }}</strong
            >
          </div>
          <div class="property">
            <span>{{ t("reports.coverage") }}</span>
            <strong
              >{{ measureText(baseline, "coverage") }} {{ t("reports.to") }}
              {{ measureText(later, "coverage") }}</strong
            >
          </div>
        </div>
        <p v-if="comparison.coverageChanged" class="hint">{{ t("reports.coverageChanged") }}</p>
        <p v-if="comparison.score.kind === 'limited'" class="hint">{{ t("reports.limited") }}</p>
        <p v-if="comparison.findings === 'missing'" class="hint">
          {{ t("reports.noFindingDetail") }}
        </p>
        <p v-else-if="comparison.findings === 'rules'" class="hint">
          {{ t("reports.ruleMismatch") }}
        </p>
        <div v-else class="movement-grid">
          <div v-for="group in findingGroups" :key="group.title">
            <h3>{{ group.title }}</h3>
            <p v-if="group.items.length === 0" class="hint first">{{ t("reports.none") }}</p>
            <div v-for="item in group.items.slice(0, 8)" :key="item.id" class="note-row">
              {{ item.title || item.id }}
            </div>
            <p v-if="group.items.length > 8" class="hint">
              {{ t("reports.moreFindings", { count: group.items.length - 8 }) }}
            </p>
          </div>
        </div>
      </WbCard>
    </template>
  </template>

  <WbCard v-if="reports.length" :title="isReport ? t('wb.hi.saved') : t('reports.savedReports')">
    <template #action>
      <button v-if="isReport" type="button" class="subtle-btn danger" @click="confirmClear = true">
        {{ t("reports.deleteAll") }}
      </button>
      <button v-else type="button" class="subtle-btn" @click="openReport('reports')">
        {{ t("wb.hi.analytics") }} ↗
      </button>
    </template>
    <div v-if="isReport && confirmClear" class="confirm-box">
      <p>{{ t("reports.deleteAllConfirm") }}</p>
      <div class="actions-row">
        <button
          type="button"
          class="primary"
          @click="
            confirmClear = false;
            removeAll();
          "
        >
          {{ t("reports.confirmDelete") }}
        </button>
        <button type="button" class="secondary" @click="confirmClear = false">
          {{ t("export.cancel") }}
        </button>
      </div>
    </div>
    <div v-if="isReport" class="segmented" role="group" :aria-label="t('reports.savedReports')">
      <button
        type="button"
        :class="{ on: !showAll }"
        :aria-pressed="!showAll"
        @click="showAll = false"
      >
        {{ t("reports.thisPage") }}
      </button>
      <button
        type="button"
        :class="{ on: showAll }"
        :aria-pressed="showAll"
        @click="showAll = true"
      >
        {{ t("reports.allPages") }}
      </button>
    </div>
    <p v-if="showAll" class="hint first">{{ t("reports.mixedPages") }}</p>
    <div
      v-for="(report, index) in isReport ? listed : listed.slice(0, 5)"
      :key="report.id"
      class="data-row"
    >
      <div
        class="record-dot"
        :class="index === 0 && !showAll ? 'good' : 'warn'"
        aria-hidden="true"
      />
      <div class="data-main">
        <strong
          >{{ shortDay(report.savedAt) }} ·
          {{ report.comparison.title || t("metadata.untitled") }}</strong
        >
        <small>
          {{ t("reports.fieldScore") }} {{ measureText(report, "score") }} ·
          {{ t("score.warnings", { count: measureText(report, "warnings") }) }}
          <template v-if="showAll"> · {{ report.comparison.url }}</template>
        </small>
      </div>
      <div class="data-end">
        <span class="badge" :class="index === 0 && !showAll ? 'ok' : 'gray'">
          {{ index === 0 && !showAll ? t("wb.hi.latest") : t("wb.hi.savedBadge") }}
        </span>
        <button
          v-if="isReport"
          type="button"
          class="icon-text"
          :aria-label="`${t('reports.deleteSelected')} ${formatWhen(report.savedAt)}`"
          @click="remove(report.id)"
        >
          {{ t("reports.deleteSelected") }}
        </button>
      </div>
    </div>
    <template v-if="isReport && pageReports.length">
      <p class="hint">{{ t("reports.exportScope") }}</p>
      <div class="actions-row">
        <button type="button" class="quiet" @click="pendingExport = 'csv'">
          {{ t("reports.exportCsv") }}
        </button>
        <button type="button" class="quiet" @click="pendingExport = 'json'">
          {{ t("reports.exportJson") }}
        </button>
        <button type="button" class="quiet" @click="pendingExport = 'html'">
          {{ t("reports.exportHtml") }}
        </button>
      </div>
      <div v-if="pendingExport" class="confirm-box">
        <p>{{ t("export.confirm") }}</p>
        <div class="actions-row">
          <button type="button" class="primary" @click="confirmExport">
            {{ t("export.confirmAction") }}
          </button>
          <button type="button" class="secondary" @click="pendingExport = null">
            {{ t("export.cancel") }}
          </button>
        </div>
      </div>
    </template>
  </WbCard>

  <WbCard v-if="isReport && againstCurrent" :title="t('reports.choose')">
    <p class="hint first">{{ t("reports.comparing", { url: againstCurrent.comparison.url }) }}</p>
    <p v-if="currentDiffs.length === 0" class="hint">{{ t("reports.noChanges") }}</p>
    <div v-else class="simple-table three" role="table" :aria-label="t('reports.choose')">
      <div class="table-row table-head" role="row">
        <span role="columnheader">{{ t("reports.field") }}</span>
        <span role="columnheader">{{ t("reports.savedValue") }}</span>
        <span role="columnheader">{{ t("reports.current") }}</span>
      </div>
      <div v-for="difference in currentDiffs" :key="difference.label" class="table-row" role="row">
        <span role="rowheader">{{ t(difference.label) }}</span>
        <span role="cell">{{ difference.previous }}</span>
        <span role="cell">{{ difference.current }}</span>
      </div>
    </div>
  </WbCard>
  <p class="hint">{{ t("reports.separateCrawl") }}</p>
</template>
