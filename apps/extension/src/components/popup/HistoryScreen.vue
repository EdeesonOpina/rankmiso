<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import {
  byTime,
  compareRecords,
  readSavedReports,
  recordsForPage,
  type SavedReport,
} from "../../services/saved-reports";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ report: [section?: string] }>();
const { t, n } = useI18n();
const all = ref<SavedReport[]>([]);
const failed = ref(false);

onMounted(() => {
  readSavedReports()
    .then((items) => {
      all.value = items;
    })
    .catch(() => {
      failed.value = true;
    });
});

const records = computed(() => byTime(recordsForPage(all.value, props.audit.page.url), "asc"));
const latest = computed(() => records.value.at(-1) ?? null);
const baseline = computed(() => (records.value.length > 1 ? records.value[0]! : null));
const comparison = computed(() =>
  baseline.value && latest.value ? compareRecords(baseline.value, latest.value) : null,
);
const scored = computed(() =>
  records.value.filter((item) => item.comparison.score != null).slice(-8),
);
const points = computed(() => {
  const list = scored.value;
  return list.map((item, index) => ({
    x: list.length === 1 ? 136 : 14 + (index * 243) / (list.length - 1),
    y: 92 - ((item.comparison.score ?? 0) / 100) * 80,
  }));
});
const movement = computed(() => {
  const value = comparison.value;
  if (!value || value.findings !== "ready") return [];
  return [
    ...value.resolved.map((item) => ({ ...item, kind: "resolved" as const })),
    ...value.introduced.map((item) => ({ ...item, kind: "introduced" as const })),
    ...value.unchanged.map((item) => ({ ...item, kind: "unchanged" as const })),
  ].slice(0, 4);
});

const moveKey = {
  resolved: ["pm.moveResolved", "pm.moveResolvedSub"],
  introduced: ["pm.moveIntroduced", "pm.moveIntroducedSub"],
  unchanged: ["pm.moveUnchanged", "pm.moveUnchangedSub"],
} as const;

function day(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullDay(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scoreText(item: SavedReport | null): string {
  return item?.comparison.score == null ? "–" : n(item.comparison.score);
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.history") }}</span
    ><span class="minor">{{ t("pm.thisDevice") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.seoOverTime") }}</h2>
    <span class="badge">{{ t("pm.savedCount", { count: n(records.length) }) }}</span>
  </div>
  <div class="surface">
    <div class="pair" style="align-items: flex-end">
      <div>
        <span class="tiny-label">{{ t("pm.latestSaved") }}</span>
        <div class="metric-line" style="margin-top: 7px">
          <strong style="font-size: 41px">{{ scoreText(latest) }}</strong>
          <span
            v-if="
              comparison?.score.kind === 'delta' &&
              comparison.score.after !== comparison.score.before
            "
            :class="comparison.score.after > comparison.score.before ? 'delta-up' : 'delta-down'"
            >{{ comparison.score.after > comparison.score.before ? "↑ +" : "↓ "
            }}{{ n(comparison.score.after - comparison.score.before) }}</span
          >
        </div>
      </div>
      <span class="micro">{{ latest ? fullDay(latest.savedAt) : t("pm.noSaves") }}</span>
    </div>
    <template v-if="points.length">
      <svg
        class="mini-chart"
        viewBox="0 0 270 105"
        role="img"
        :aria-label="
          t('pm.chartLabel', { scores: scored.map((item) => item.comparison.score).join(', ') })
        "
      >
        <path class="grid" d="M5 23H265M5 55H265M5 87H265" />
        <path
          v-if="points.length > 1"
          class="line"
          :d="points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join('')"
        />
        <circle v-for="(point, index) in points" :key="index" :cx="point.x" :cy="point.y" r="4" />
      </svg>
      <div class="chart-foot">
        <span>{{ day(scored[0]!.savedAt) }}</span>
        <span v-if="scored.length > 2">{{
          day(scored[Math.floor(scored.length / 2)]!.savedAt)
        }}</span>
        <span v-if="scored.length > 1">{{ day(scored.at(-1)!.savedAt) }}</span>
      </div>
    </template>
    <p v-else class="helper" style="margin: 12px 0 0">
      {{ failed ? t("reports.saveFailed") : t("reports.popupEmpty") }}
    </p>
    <div class="pair" style="margin-top: 12px">
      <span class="badge">{{ t("pm.observations", { count: n(scored.length) }) }}</span>
      <span class="micro">{{ t("pm.noEstimates") }}</span>
    </div>
  </div>

  <template v-if="baseline && latest">
    <div class="title-row">
      <h2>{{ t("pm.beforeAfter") }}</h2>
      <button type="button" class="text-btn" @click="emit('report', 'reports')">
        {{ t("pm.compare") }} ↗
      </button>
    </div>
    <div class="grid2">
      <div class="mini-tile">
        <span style="margin: 0 0 8px">{{
          t("pm.baselineOn", { date: day(baseline.savedAt) })
        }}</span>
        <strong>{{ scoreText(baseline) }}</strong>
        <span>{{
          baseline.comparison.history
            ? t("issues.warningLine", { count: n(baseline.comparison.history.warnings) })
            : t("pm.countsNotSaved")
        }}</span>
      </div>
      <div class="mini-tile">
        <span style="margin: 0 0 8px">{{ t("pm.latestOn", { date: day(latest.savedAt) }) }}</span>
        <strong>{{ scoreText(latest) }}</strong>
        <span>{{
          latest.comparison.history
            ? t("issues.warningLine", { count: n(latest.comparison.history.warnings) })
            : t("pm.countsNotSaved")
        }}</span>
      </div>
    </div>
  </template>

  <template v-if="movement.length">
    <div class="title-row">
      <h2>{{ t("pm.issueMovement") }}</h2>
    </div>
    <div v-for="item in movement" :key="`${item.kind}-${item.id}`" class="row">
      <span
        class="mark"
        :class="{ green: item.kind === 'resolved', error: item.kind === 'introduced' }"
        aria-hidden="true"
        >{{ item.kind === "resolved" ? "✓" : "!" }}</span
      >
      <div class="row-content">
        <strong class="row-title">{{ item.title }}</strong>
        <p class="row-sub">{{ t(moveKey[item.kind][1]) }}</p>
      </div>
      <span
        class="badge"
        :class="{
          ok: item.kind === 'resolved',
          warn: item.kind === 'unchanged',
          err: item.kind === 'introduced',
        }"
        >{{ t(moveKey[item.kind][0]) }}</span
      >
    </div>
  </template>

  <div class="title-row">
    <h2>{{ t("pm.savedAudits") }}</h2>
    <span class="micro">{{ t("pm.thisDeviceOnly") }}</span>
  </div>
  <div v-if="records.length" class="surface" style="padding: 0 12px">
    <div v-for="item in [...records].reverse().slice(0, 5)" :key="item.id" class="row">
      <span class="mark blue" aria-hidden="true">↗</span>
      <span class="row-content">
        <strong class="row-title">{{ fullDay(item.savedAt) }}</strong>
        <span class="row-sub">{{ t("pm.savedRow", { score: scoreText(item) }) }}</span>
      </span>
    </div>
  </div>
  <p v-else class="note">{{ t("reports.popupEmpty") }}</p>
  <p class="micro" style="margin-top: 11px">{{ t("reports.separateCrawl") }}</p>
</template>
