<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult, Category } from "../../types/audit";
import { categoryLabelKey } from "../../services/category-label";
import { selectChecks } from "../../services/check-list";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult; focusId?: string }>();
const emit = defineEmits<{ go: [id: string]; report: [section?: string] }>();
const { t, n } = useI18n();
const filter = ref<"all" | "WARNING" | "ERROR">("all");

const score = computed(() => props.audit.score);
const findings = computed(() =>
  selectChecks(props.audit.checks, { status: "all", sort: "severity" }).filter(
    (check) => check.status === "ERROR" || check.status === "WARNING",
  ),
);
const rows = computed(() =>
  filter.value === "all"
    ? findings.value
    : findings.value.filter((check) => check.status === filter.value),
);
const shown = computed(() => {
  const preview = rows.value.slice(0, 3);
  const focus = rows.value.find((check) => check.id === props.focusId);
  if (focus && !preview.includes(focus)) preview.push(focus);
  return preview;
});
const total = computed(() => Math.max(1, score.value.applicableChecks));

function share(count: number): string {
  return `${(count / total.value) * 100}%`;
}

function paneFor(category: Category): string {
  return category === "structuredData" ? "schema" : category;
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.issues") }}</span
    ><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <section class="navy" :aria-label="t('issues.queue')">
    <div class="pair">
      <div>
        <span class="nv" style="font-size: 10px">{{ t("issues.queue") }}</span>
        <div class="metric-line" style="margin-top: 8px">
          <strong class="big nv-strong">{{ n(findings.length) }}</strong>
          <span class="nv">{{ t("issues.toReview") }}</span>
        </div>
      </div>
      <div class="badge nv-badge">
        {{ t("issues.checks", { count: n(score.applicableChecks) }) }}
      </div>
    </div>
    <div class="bars" style="margin-top: 18px" aria-hidden="true">
      <span v-if="score.errors" class="err" :style="{ width: share(score.errors) }" />
      <span v-if="score.warnings" class="warn" :style="{ width: share(score.warnings) }" />
      <span v-if="score.passed" class="ok" :style="{ width: share(score.passed) }" />
    </div>
    <div class="pair nv" style="font-size: 10px; margin-top: 9px">
      <span
        >{{ t("issues.errorLine", { count: n(score.errors) }) }} ·
        {{ t("issues.warningLine", { count: n(score.warnings) }) }}</span
      >
      <span>{{ t("issues.passedLine", { count: n(score.passed) }) }}</span>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("issues.findings") }}</h2>
    <span v-if="score.warnings" class="badge warn">{{ t("issues.warningsFirst") }}</span>
  </div>
  <div class="segmented" :aria-label="t('pm.findingFilters')">
    <button type="button" class="segment" :aria-pressed="filter === 'all'" @click="filter = 'all'">
      {{ t("filter.all") }} ({{ n(findings.length) }})
    </button>
    <button
      type="button"
      class="segment"
      :aria-pressed="filter === 'WARNING'"
      @click="filter = 'WARNING'"
    >
      {{ t("score.warningName") }}
    </button>
    <button
      type="button"
      class="segment"
      :aria-pressed="filter === 'ERROR'"
      @click="filter = 'ERROR'"
    >
      {{ t("score.errorName") }}
    </button>
  </div>
  <div v-if="shown.length">
    <button
      v-for="check in shown"
      :key="check.id"
      type="button"
      class="row go"
      :data-check="check.id"
      @click="emit('go', paneFor(check.category))"
    >
      <span class="mark" :class="{ error: check.status === 'ERROR' }" aria-hidden="true">!</span>
      <span class="row-content">
        <strong class="row-title">{{ check.title }}</strong>
        <span class="row-sub clamp1">{{ check.description }}</span>
        <span
          class="badge"
          :class="check.status === 'ERROR' ? 'err' : 'warn'"
          style="margin-top: 6px"
          >{{ t(categoryLabelKey[check.category]) }}</span
        >
      </span>
      <span class="row-side" aria-hidden="true">›</span>
    </button>
    <button
      type="button"
      class="button-sm"
      style="margin-top: 12px; width: 100%"
      @click="emit('report', 'issues')"
    >
      {{ t("issues.reviewAll", { count: n(rows.length) }) }} ↗
    </button>
  </div>
  <div v-else class="note" style="margin-top: 12px">
    {{ filter === "ERROR" ? t("pm.noErrors") : t("empty.issuesBody") }}
  </div>
</template>
