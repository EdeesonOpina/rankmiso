<script setup lang="ts">
import { computed } from "vue";

/** Saved scores (0–100) in time order, drawn like the prototype's line chart. */
const props = withDefaults(
  defineProps<{ values: number[]; label: string; width?: number; height?: number }>(),
  { width: 360, height: 112 },
);
const top = 14;
const bottom = computed(() => props.height - 15);
const points = computed(() => {
  const span = props.width - 24;
  const count = props.values.length;
  return props.values.map((value, index) => ({
    x: 12 + (count === 1 ? span / 2 : (index * span) / (count - 1)),
    y: bottom.value - (Math.max(0, Math.min(100, value)) / 100) * (bottom.value - top),
  }));
});
const line = computed(() =>
  points.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
);
</script>

<template>
  <svg class="line-chart" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="label">
    <path
      :d="`M10 ${bottom} H${width - 10} M10 ${(bottom + top) / 2} H${width - 10}`"
      stroke="var(--line)"
      stroke-dasharray="4 5"
    />
    <polyline
      :points="line"
      stroke="var(--chart)"
      fill="none"
      stroke-width="3"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <circle
      v-for="(point, index) in points"
      :key="index"
      :cx="point.x"
      :cy="point.y"
      r="3.6"
      fill="var(--card)"
      stroke="var(--chart)"
      stroke-width="2"
    />
  </svg>
</template>
