<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "../composables/useI18n";
import type { AuditResult, Category } from "../types/audit";
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
  MAX_SAVED_REPORTS,
  recordsForPage,
  scoreConnects,
  type MeasureChange,
  type SavedReport,
} from "../services/saved-reports";
import HistoryChart from "./HistoryChart.vue";

const props = defineProps<{
  reports: SavedReport[];
  pageUrl: string;
  audit: AuditResult | null;
}>();

const emit = defineEmits<{ delete: [id: string]; clear: [] }>();
const { t, n } = useI18n();
const showAll = ref(false);
const selected = ref(0);
const category = ref("metadata");
const baselineId = ref("");
const laterId = ref("");
const pairTouched = ref(false);
const confirmClear = ref(false);
const pendingExport = ref<"csv" | "json" | "html" | null>(null);

const pageReports = computed(() => byTime(recordsForPage(props.reports, props.pageUrl), "asc"));
const listed = computed(() => byTime(showAll.value ? props.reports : pageReports.value, "desc"));
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
  props.audit && againstCurrent.value
    ? compareAudits(againstCurrent.value.comparison, props.audit)
    : [],
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
  anchor.download = historyFilename(props.pageUrl, kind === "html" ? "html" : kind);
  anchor.click();
  URL.revokeObjectURL(url);
  pendingExport.value = null;
}

function confirmExport() {
  if (pendingExport.value) download(pendingExport.value);
}
</script>

<template>
  <div class="stack">
    <p v-if="reports.length >= MAX_SAVED_REPORTS" class="report-copy">{{ t("reports.cap") }}</p>
    <p class="report-copy">{{ t("reports.separateCrawl") }}</p>

    <section v-if="pageReports.length === 0" class="miso-card stack">
      <img class="history-mascot" src="/brand/rankmiso-fox.webp" width="96" height="96" alt="" />
      <h2>{{ t("reports.timeline") }}</h2>
      <p class="report-copy">{{ t("reports.historyEmpty") }}</p>
    </section>

    <template v-else>
      <dl class="health-tally">
        <div>
          <dt>{{ t("reports.timeline") }}</dt>
          <dd>{{ n(pageReports.length) }}</dd>
        </div>
        <div>
          <dt>{{ t("reports.fieldScore") }}</dt>
          <dd>{{ measureText(pageReports.at(-1) ?? null, "score") }}</dd>
        </div>
        <div>
          <dt>{{ t("reports.compareTwo") }}</dt>
          <dd>{{ pageReports.length > 1 ? t("value.yes") : t("value.no") }}</dd>
        </div>
      </dl>
      <div class="history-charts">
        <section class="miso-card stack">
          <h2>{{ t("reports.timeline") }}</h2>
          <p class="report-copy">
            {{ pageReports.length === 1 ? t("reports.onePoint") : t("reports.sequence") }}
          </p>
          <HistoryChart
            :label="t('reports.timeline')"
            :ids="pageReports.map((report) => report.id)"
            :points="pointLabels"
            :series="scoreSeries"
            :y-max="100"
            :selected="selected"
            @select="selected = $event"
          />
          <p v-if="selectedReport" class="metric-line">
            <span>{{ formatWhen(selectedReport.savedAt) }}</span>
            <span>{{ t("reports.fieldScore") }} {{ measureText(selectedReport, "score") }}</span>
            <span>{{ t("reports.errors") }} {{ measureText(selectedReport, "errors") }}</span>
            <span>{{ t("reports.warnings") }} {{ measureText(selectedReport, "warnings") }}</span>
            <span>{{ t("reports.coverage") }} {{ measureText(selectedReport, "coverage") }}</span>
          </p>
          <table class="site-table">
            <caption class="sr-only">
              {{
                t("reports.timeline")
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ t("reports.savedWhen") }}</th>
                <th scope="col">{{ t("reports.fieldScore") }}</th>
                <th scope="col">{{ t("reports.errors") }}</th>
                <th scope="col">{{ t("reports.warnings") }}</th>
                <th scope="col">{{ t("reports.coverage") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(report, index) in pageReports" :key="report.id">
                <th scope="row">
                  <button type="button" class="report-text-action" @click="selected = index">
                    {{ formatWhen(report.savedAt) }}
                  </button>
                </th>
                <td>{{ measureText(report, "score") }}</td>
                <td>{{ measureText(report, "errors") }}</td>
                <td>{{ measureText(report, "warnings") }}</td>
                <td>{{ measureText(report, "coverage") }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="miso-card stack">
          <h2>{{ t("reports.issuesTrend") }}</h2>
          <p class="report-copy">{{ t("reports.warningNote") }}</p>
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
        </section>
      </div>

      <section class="miso-card stack">
        <h2>{{ t("reports.categoryTrend") }}</h2>
        <p v-if="categories.length === 0" class="report-copy">{{ t("reports.noCategory") }}</p>
        <template v-else>
          <label class="check-search">
            {{ t("reports.categoryTrend") }}
            <select v-model="category">
              <option v-for="item in categories" :key="item" :value="item">
                {{ categoryLabel(item) }}
              </option>
            </select>
          </label>
          <p class="metric-line">
            <span>{{ t("reports.before") }} {{ categoryText(baseline) }}</span>
            <span>{{ t("reports.after") }} {{ categoryText(later) }}</span>
            <span>{{ t("reports.change") }} {{ changeText(categoryDelta) }}</span>
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
      </section>

      <section class="miso-card stack">
        <h2>{{ t("reports.compareTwo") }}</h2>
        <p v-if="pageReports.length < 2" class="report-copy">{{ t("reports.needSecond") }}</p>
        <template v-else>
          <div class="inspector-tools">
            <label class="check-search">
              {{ t("reports.baseline") }}
              <select v-model="baselineId" @change="pairTouched = true">
                <option v-for="report in pageReports" :key="report.id" :value="report.id">
                  {{ formatWhen(report.savedAt) }}
                </option>
              </select>
            </label>
            <label class="check-search">
              {{ t("reports.laterAudit") }}
              <select v-model="laterId" @change="pairTouched = true">
                <option v-for="report in pageReports" :key="report.id" :value="report.id">
                  {{ formatWhen(report.savedAt) }}
                </option>
              </select>
            </label>
          </div>
          <p v-if="reversed" class="report-copy">{{ t("reports.reversed") }}</p>
          <div v-if="comparison && baseline && later" class="compare-split">
            <article>
              <h3>{{ t("reports.baseline") }}</h3>
              <p>{{ formatWhen(baseline.savedAt) }}</p>
              <p>{{ t("reports.fieldScore") }} {{ measureText(baseline, "score") }}</p>
              <p>{{ t("reports.errors") }} {{ measureText(baseline, "errors") }}</p>
              <p>{{ t("reports.warnings") }} {{ measureText(baseline, "warnings") }}</p>
            </article>
            <article>
              <h3>{{ t("reports.laterAudit") }}</h3>
              <p>{{ formatWhen(later.savedAt) }}</p>
              <p>{{ t("reports.fieldScore") }} {{ measureText(later, "score") }}</p>
              <p>{{ t("reports.errors") }} {{ measureText(later, "errors") }}</p>
              <p>{{ t("reports.warnings") }} {{ measureText(later, "warnings") }}</p>
            </article>
          </div>
          <dl v-if="comparison" class="essentials">
            <div>
              <dt>{{ t("reports.fieldScore") }}</dt>
              <dd>
                {{ measureText(baseline, "score") }} {{ t("reports.to") }}
                {{ measureText(later, "score") }}
                · {{ changeText(comparison.score) }}
              </dd>
            </div>
            <div>
              <dt>{{ t("reports.errors") }}</dt>
              <dd>
                {{ measureText(baseline, "errors") }} {{ t("reports.to") }}
                {{ measureText(later, "errors") }}
                · {{ changeText(comparison.errors) }}
              </dd>
            </div>
            <div>
              <dt>{{ t("reports.warnings") }}</dt>
              <dd>
                {{ measureText(baseline, "warnings") }} {{ t("reports.to") }}
                {{ measureText(later, "warnings") }}
                · {{ changeText(comparison.warnings) }}
              </dd>
            </div>
            <div>
              <dt>{{ t("reports.coverage") }}</dt>
              <dd>
                {{ measureText(baseline, "coverage") }} {{ t("reports.to") }}
                {{ measureText(later, "coverage") }}
              </dd>
            </div>
          </dl>
          <p v-if="comparison?.coverageChanged" class="report-copy">
            {{ t("reports.coverageChanged") }}
          </p>
          <p v-if="comparison?.score.kind === 'limited'" class="report-copy">
            {{ t("reports.limited") }}
          </p>
          <template v-if="comparison">
            <p v-if="comparison.findings === 'missing'" class="report-copy">
              {{ t("reports.noFindingDetail") }}
            </p>
            <p v-else-if="comparison.findings === 'rules'" class="report-copy">
              {{ t("reports.ruleMismatch") }}
            </p>
            <template v-else>
              <template v-for="group in findingGroups" :key="group.title">
                <h3>{{ group.title }}</h3>
                <ul class="report-copy">
                  <li v-if="group.items.length === 0">{{ t("reports.none") }}</li>
                  <li v-for="item in group.items.slice(0, 8)" :key="item.id">
                    {{ item.title || item.id }}
                  </li>
                </ul>
                <p v-if="group.items.length > 8" class="report-copy">
                  {{ t("reports.moreFindings", { count: group.items.length - 8 }) }}
                </p>
              </template>
            </template>
          </template>
        </template>
      </section>
    </template>

    <section v-if="reports.length" class="miso-card stack">
      <div class="report-subheading">
        <h2>{{ t("reports.savedReports") }}</h2>
        <button type="button" class="report-text-action" @click="confirmClear = true">
          {{ t("reports.deleteAll") }}
        </button>
      </div>
      <p v-if="confirmClear" class="report-copy">
        {{ t("reports.deleteAllConfirm") }}
        <button
          type="button"
          class="inspector-action"
          @click="
            confirmClear = false;
            emit('clear');
          "
        >
          {{ t("reports.confirmDelete") }}
        </button>
        <button type="button" class="inspector-action" @click="confirmClear = false">
          {{ t("export.cancel") }}
        </button>
      </p>
      <div class="inspector-tools">
        <button
          type="button"
          class="inspector-action"
          :aria-pressed="!showAll"
          @click="showAll = false"
        >
          {{ t("reports.thisPage") }}
        </button>
        <button
          type="button"
          class="inspector-action"
          :aria-pressed="showAll"
          @click="showAll = true"
        >
          {{ t("reports.allPages") }}
        </button>
      </div>
      <p v-if="showAll" class="report-copy">{{ t("reports.mixedPages") }}</p>
      <table class="site-table">
        <caption class="sr-only">
          {{
            t("reports.savedReports")
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ t("reports.fieldTitle") }}</th>
            <th scope="col">{{ t("reports.savedWhen") }}</th>
            <th scope="col">{{ t("reports.fieldScore") }}</th>
            <th scope="col">{{ t("reports.colIssues") }}</th>
            <th scope="col">
              <span class="sr-only">{{ t("reports.deleteSelected") }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in listed" :key="report.id">
            <th scope="row">
              {{ report.comparison.title || t("metadata.untitled") }}
              <span class="report-copy">{{ report.comparison.url }}</span>
            </th>
            <td>{{ formatWhen(report.savedAt) }}</td>
            <td>{{ measureText(report, "score") }}</td>
            <td>{{ measureText(report, "errors") }} / {{ measureText(report, "warnings") }}</td>
            <td>
              <button type="button" class="report-text-action" @click="emit('delete', report.id)">
                {{ t("reports.deleteSelected") }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="pageReports.length" class="report-copy">{{ t("reports.exportScope") }}</p>
      <div v-if="pageReports.length" class="flex flex-wrap gap-2">
        <button type="button" class="inspector-action" @click="pendingExport = 'csv'">
          {{ t("reports.exportCsv") }}
        </button>
        <button type="button" class="inspector-action" @click="pendingExport = 'json'">
          {{ t("reports.exportJson") }}
        </button>
        <button type="button" class="inspector-action" @click="pendingExport = 'html'">
          {{ t("reports.exportHtml") }}
        </button>
      </div>
      <div v-if="pendingExport" class="report-copy">
        <p>{{ t("export.confirm") }}</p>
        <button type="button" class="inspector-action is-primary" @click="confirmExport">
          {{ t("export.confirmAction") }}
        </button>
        <button type="button" class="inspector-action" @click="pendingExport = null">
          {{ t("export.cancel") }}
        </button>
      </div>
    </section>

    <section v-if="audit && againstCurrent" class="miso-card stack">
      <h2>{{ t("reports.choose") }}</h2>
      <p class="report-copy">
        {{ t("reports.comparing", { url: againstCurrent.comparison.url }) }}
      </p>
      <p v-if="currentDiffs.length === 0" class="report-copy">{{ t("reports.noChanges") }}</p>
      <table v-else class="site-table">
        <thead>
          <tr>
            <th scope="col">{{ t("reports.field") }}</th>
            <th scope="col">{{ t("reports.savedValue") }}</th>
            <th scope="col">{{ t("reports.current") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="difference in currentDiffs" :key="difference.label">
            <th scope="row">{{ t(difference.label) }}</th>
            <td>{{ difference.previous }}</td>
            <td>{{ difference.current }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
