<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../../composables/useI18n";

const props = defineProps<{ value: number | null }>();
const { t } = useI18n();
const circumference = 2 * Math.PI * 42;
const offset = computed(() =>
  props.value == null
    ? circumference
    : circumference * (1 - Math.max(0, Math.min(100, props.value)) / 100),
);
const label = computed(() =>
  props.value == null ? t("wb.ov.ringUnavailable") : t("wb.ov.ringLabel", { score: props.value }),
);
</script>

<template>
  <svg class="score-svg" viewBox="0 0 110 110" role="img" :aria-label="label">
    <circle cx="55" cy="55" r="42" fill="none" class="ring-track" stroke-width="8" />
    <circle
      v-if="value != null"
      cx="55"
      cy="55"
      r="42"
      fill="none"
      class="ring-value"
      stroke-width="8"
      :stroke-dasharray="circumference.toFixed(2)"
      :stroke-dashoffset="offset.toFixed(2)"
      stroke-linecap="round"
      transform="rotate(-90 55 55)"
    />
    <text x="55" y="54" class="ring-word" text-anchor="middle" font-size="13" font-weight="800">
      SEO
    </text>
    <text x="55" y="69" class="ring-sub" text-anchor="middle" font-size="10">
      {{ t("wb.ov.ringWord") }}
    </text>
  </svg>
</template>
