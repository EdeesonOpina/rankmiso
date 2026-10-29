<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult, Category } from "../../types/audit";
import { categoryLabelKey } from "../../services/category-label";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ go: [id: string, check?: string] }>();
const { t, n } = useI18n();
const showCategories = ref(false);

const score = computed(() => props.audit.score);
const measured = computed(() => score.value.available && score.value.value != null);
// Circumference of the r=38 ring in the prototype.
const RING = 239;
const ringOffset = computed(() => RING * (1 - (score.value.value ?? 0) / 100));
const findings = computed(() =>
  props.audit.checks.filter((check) => check.status === "ERROR" || check.status === "WARNING"),
);
const ranked = computed(() =>
  [...findings.value].sort(
    (left, right) => Number(right.status === "ERROR") - Number(left.status === "ERROR"),
  ),
);
const focus = computed(() =>
  score.value.categories
    .filter((category) => category.available && category.value != null && category.value < 100)
    .slice()
    .sort((left, right) => (left.value ?? 0) - (right.value ?? 0))
    .slice(0, 3),
);

function tone(value: number): string {
  if (value < 50) return "status-red";
  if (value < 90) return "status-amber";
  return "status-green";
}

function paneFor(category: Category): string {
  return category === "structuredData" ? "schema" : category;
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("overview.snapshot") }}</span
    ><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <section class="navy" :aria-label="t('overview.health')">
    <div class="pair" style="position: relative; align-items: flex-start">
      <div>
        <div class="kicker" style="margin: 0 0 12px">{{ t("overview.health") }}</div>
        <div style="display: flex; gap: 5px; align-items: baseline">
          <strong class="hero-number hero-score">{{ measured ? n(score.value ?? 0) : "–" }}</strong>
          <span v-if="measured" class="hero-unit">/ 100</span>
        </div>
        <p class="hero-cover">
          <template v-if="!score.available">{{ t("state.scoreUnavailable") }}<br /></template>
          {{ t("score.measured", { count: score.applicableChecks }) }}<br />
          {{ t("score.unavailable", { count: score.unavailable }) }}
        </p>
      </div>
      <svg
        class="score-ring"
        width="88"
        height="88"
        viewBox="0 0 100 100"
        role="img"
        :aria-label="
          measured ? t('pm.scoreOf', { score: score.value ?? 0 }) : t('state.scoreUnavailable')
        "
      >
        <circle class="ring-track" cx="50" cy="50" r="38" stroke-width="8" fill="none" />
        <circle
          v-if="measured"
          class="ring-value"
          cx="50"
          cy="50"
          r="38"
          stroke-width="8"
          fill="none"
          :stroke-dasharray="RING"
          :stroke-dashoffset="ringOffset"
          transform="rotate(-90 50 50)"
          stroke-linecap="round"
        />
        <text class="ring-word" x="50" y="47" text-anchor="middle" font-size="18" font-weight="800">
          {{ t("overview.ringMark") }}
        </text>
        <text class="ring-sub" x="50" y="61" text-anchor="middle" font-size="10">
          {{ t("overview.ringWord") }}
        </text>
      </svg>
    </div>
    <div class="stat-grid divide">
      <div class="stat-item">
        <strong>{{ n(score.errors) }}</strong
        ><span>{{ t("score.errorName") }}</span>
      </div>
      <div class="stat-item">
        <strong class="status-amber">{{ n(score.warnings) }}</strong
        ><span>{{ t("score.warningName") }}</span>
      </div>
      <div class="stat-item">
        <strong class="status-green">{{ n(score.passed) }}</strong
        ><span>{{ t("score.passedName") }}</span>
      </div>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("overview.fixNext") }}</h2>
    <button v-if="findings.length" type="button" class="text-btn" @click="emit('go', 'issues')">
      {{ t("overview.findingsCount", { count: findings.length }) }} ↗
    </button>
  </div>
  <div v-if="ranked.length">
    <button
      v-for="check in ranked.slice(0, 3)"
      :key="check.id"
      type="button"
      class="row go finding-row"
      @click="emit('go', 'issues', check.id)"
    >
      <span class="mark" :class="{ error: check.status === 'ERROR' }" aria-hidden="true">!</span>
      <span class="row-content">
        <strong class="row-title">{{ check.title }}</strong>
        <span class="row-sub clamp1 inline-gap">{{ check.description }}</span>
      </span>
      <span class="row-side" aria-hidden="true">›</span>
    </button>
  </div>
  <div v-else class="row">
    <span class="mark green" aria-hidden="true">✓</span>
    <span class="row-content">
      <strong class="row-title">{{ t("empty.issuesTitle") }}</strong>
      <span class="row-sub">{{ t("empty.issuesBody") }}</span>
    </span>
  </div>

  <div class="title-row">
    <h2>{{ t("overview.focus") }}</h2>
    <button
      type="button"
      class="text-btn"
      :aria-expanded="showCategories"
      @click="showCategories = !showCategories"
    >
      {{ t("overview.allCategories") }} ↗
    </button>
  </div>
  <div v-if="focus.length" class="grid3">
    <button
      v-for="category in focus"
      :key="category.category"
      type="button"
      class="mini-tile"
      @click="emit('go', paneFor(category.category))"
    >
      <strong :class="tone(category.value ?? 0)">{{ n(category.value ?? 0) }}</strong>
      <span>{{ t(categoryLabelKey[category.category]) }}</span>
    </button>
  </div>
  <p v-else class="note">{{ t("score.attentionEmpty") }}</p>
  <dl v-if="showCategories" class="category-list">
    <div v-for="category in score.categories" :key="category.category" class="property">
      <dt>{{ t(categoryLabelKey[category.category]) }}</dt>
      <dd>
        <strong v-if="category.available && category.value != null" :class="tone(category.value)">{{
          n(category.value)
        }}</strong>
        <span v-else class="muted">{{ t("status.unavailable") }}</span>
      </dd>
    </div>
  </dl>
  <p class="micro" style="margin: 12px 0 0">{{ t("pm.overviewNote") }}</p>
</template>
