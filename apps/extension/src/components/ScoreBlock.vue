<script setup lang="ts">
import { computed } from "vue";
import type { ScoreSummary } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import { categoryLabelKey } from "../services/category-label";

const props = withDefaults(defineProps<{ score: ScoreSummary; disclaimer?: boolean }>(), {
  disclaimer: true,
});
const { t, n } = useI18n();

const markClass = computed(() => {
  const value = props.score.available ? props.score.value : null;
  if (value == null) return "text-muted";
  if (value >= 90) return "text-success";
  if (value >= 50) return "text-warning";
  return "text-danger";
});

const attention = computed(() =>
  props.score.categories.filter(
    (category) => category.available && category.value != null && category.value < 100,
  ),
);

function barClass(category: ScoreSummary["categories"][number]): string {
  if (!category.available || category.value == null) return "";
  if (category.value >= 90) return "category-fill-pass";
  if (category.value >= 50) return "category-fill-warn";
  return "category-fill-error";
}

function barWidth(category: ScoreSummary["categories"][number]): string {
  if (!category.available || category.value == null) return "0%";
  return `${category.value}%`;
}

const ringOffset = computed(() => {
  const value = props.score.available ? props.score.value : null;
  if (value == null) return null;
  return 100 - value;
});
</script>

<template>
  <div class="stack">
    <section class="inspector-block score-block" aria-labelledby="score-heading">
      <div class="score-summary">
        <div class="score-ring-wrap" :class="markClass">
          <svg class="score-ring" viewBox="0 0 80 80" aria-hidden="true">
            <circle class="score-ring-track" cx="40" cy="40" r="34" />
            <circle
              v-if="ringOffset != null"
              class="score-ring-value"
              cx="40"
              cy="40"
              r="34"
              pathLength="100"
              stroke-dasharray="100"
              :stroke-dashoffset="ringOffset"
            />
          </svg>
          <p class="score-value">
            {{ score.available && score.value != null ? n(score.value) : "–" }}
          </p>
        </div>
        <div class="min-w-0">
          <h2 id="score-heading" class="m-0 text-[15px] font-semibold">{{ t("score.label") }}</h2>
          <p v-if="!score.available" class="mb-0 mt-1 text-[13px] text-muted">
            {{ t("state.scoreUnavailable") }}
          </p>
          <p class="mb-0 mt-1 text-[13px]">
            {{ t("score.errors", { count: score.errors }) }}
            · {{ t("score.warnings", { count: score.warnings }) }} ·
            {{ t("score.passed", { count: score.passed }) }}
          </p>
          <p class="mb-0 mt-1 text-[12px] text-muted">
            {{ t("score.measured", { count: score.applicableChecks }) }}
            · {{ t("score.unavailable", { count: score.unavailable }) }}
          </p>
        </div>
      </div>
      <p v-if="disclaimer" class="mb-0 text-[12px] leading-relaxed text-muted">
        {{ score.disclaimer }}
      </p>
    </section>
    <section class="inspector-block" aria-labelledby="category-heading">
      <h2 id="category-heading" class="m-0 text-[13px] font-semibold">
        {{ t("score.categories") }}
      </h2>
      <ul v-if="attention.length" class="category-attention" :aria-label="t('score.categories')">
        <li v-for="category in attention" :key="category.category">
          <span>{{ t(categoryLabelKey[category.category]) }}</span>
          <span class="microbar" aria-hidden="true">
            <span :class="barClass(category)" :style="{ width: barWidth(category) }" />
          </span>
          <span>{{ n(category.value ?? 0) }}</span>
        </li>
      </ul>
      <p v-else class="mb-0 mt-3 text-[13px] text-muted">{{ t("score.attentionEmpty") }}</p>
      <details class="category-disclosure">
        <summary>{{ t("score.viewCategories") }}</summary>
        <ul class="category-health" :aria-label="t('score.categories')">
          <li v-for="category in score.categories" :key="category.category">
            <div class="category-health-label">
              <span>{{ t(categoryLabelKey[category.category]) }}</span>
              <span>
                {{
                  category.available && category.value != null
                    ? n(category.value)
                    : t("status.unavailable")
                }}
              </span>
            </div>
            <div class="category-track" aria-hidden="true">
              <div
                class="category-fill"
                :class="barClass(category)"
                :style="{ width: barWidth(category) }"
              />
            </div>
          </li>
        </ul>
        <p class="mb-0 mt-3 text-[12px] leading-relaxed text-muted">
          {{ t("score.categoryNote") }}
        </p>
      </details>
    </section>
  </div>
</template>
