<script setup lang="ts">
import type { ScoreSummary } from "../types/audit";
import { useI18n } from "../composables/useI18n";

defineProps<{ score: ScoreSummary }>();
const { t, n } = useI18n();
</script>

<template>
  <section
    class="rounded-panel border border-border bg-surface p-4"
    aria-labelledby="score-heading"
  >
    <div class="flex items-center gap-4">
      <p
        class="m-0 grid h-16 w-16 place-items-center rounded-full border-2 border-primary text-xl font-semibold"
        aria-hidden="true"
      >
        {{ score.available && score.value != null ? n(score.value) : "–" }}
      </p>
      <div>
        <h2 id="score-heading" class="m-0 text-[15px] font-semibold">{{ t("score.label") }}</h2>
        <p v-if="!score.available" class="mb-0 mt-1 text-[13px] text-muted">
          {{ t("state.scoreUnavailable") }}
        </p>
        <p class="mb-0 mt-1 text-[13px]">
          {{ t("score.errors", { count: score.errors }) }}
          · {{ t("score.warnings", { count: score.warnings }) }} ·
          {{ t("score.passed", { count: score.passed }) }}
        </p>
        <p class="mb-0 text-[12px] text-muted">
          {{ t("score.unavailable", { count: score.unavailable }) }}
        </p>
      </div>
    </div>
    <p class="mb-0 mt-3 text-[12px] text-muted">{{ score.disclaimer }}</p>
  </section>
</template>
