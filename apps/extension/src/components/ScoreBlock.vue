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

function share(count: number): string {
  const total = props.score.errors + props.score.warnings + props.score.passed;
  if (total <= 0 || count <= 0) return "0%";
  return `${(count / total) * 100}%`;
}
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
        <div class="health-copy min-w-0">
          <h2 id="score-heading" class="m-0 text-[15px] font-semibold">{{ t("score.label") }}</h2>
          <p v-if="!score.available" class="mb-0 mt-1 text-[13px] text-muted">
            {{ t("state.scoreUnavailable") }}
          </p>
          <dl class="health-tally">
            <div>
              <dt>{{ t("score.errorName") }}</dt>
              <dd class="text-danger">{{ n(score.errors) }}</dd>
            </div>
            <div>
              <dt>{{ t("score.warningName") }}</dt>
              <dd class="text-warning">{{ n(score.warnings) }}</dd>
            </div>
            <div>
              <dt>{{ t("score.passedName") }}</dt>
              <dd class="text-success">{{ n(score.passed) }}</dd>
            </div>
          </dl>
          <div
            class="status-meter"
            role="img"
            :aria-label="
              t('score.errors', { count: score.errors }) +
              ', ' +
              t('score.warnings', { count: score.warnings }) +
              ', ' +
              t('score.passed', { count: score.passed })
            "
          >
            <span
              v-if="score.errors"
              class="status-meter-error"
              :style="{ width: share(score.errors) }"
            />
            <span
              v-if="score.warnings"
              class="status-meter-warn"
              :style="{ width: share(score.warnings) }"
            />
            <span
              v-if="score.passed"
              class="status-meter-pass"
              :style="{ width: share(score.passed) }"
            />
          </div>
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
