<script setup lang="ts">
export interface ChartSeries {
  id: string;
  label: string;
  marker: "circle" | "square";
  values: Array<number | null>;
  connect: boolean[];
}

const props = defineProps<{
  label: string;
  ids: string[];
  points: string[];
  series: ChartSeries[];
  yMax: number;
  selected: number;
}>();

const emit = defineEmits<{ select: [index: number] }>();

const width = 640;
const height = 220;
const padLeft = 36;
const padRight = 16;
const padTop = 16;
const padBottom = 12;

function xAt(index: number): number {
  const inner = width - padLeft - padRight;
  if (props.points.length <= 1) return padLeft + inner / 2;
  return padLeft + (index / (props.points.length - 1)) * inner;
}

function yAt(value: number): number {
  const inner = height - padTop - padBottom;
  const max = props.yMax > 0 ? props.yMax : 1;
  return padTop + (1 - value / max) * inner;
}

function linePath(series: ChartSeries): string {
  let path = "";
  let drawing = false;
  series.values.forEach((value, index) => {
    if (value == null) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)} `;
    const next = series.values[index + 1];
    drawing = series.connect[index] !== false && next != null;
  });
  return path;
}

function focusY(index: number): number {
  for (const item of props.series) {
    const value = item.values[index];
    if (value != null) return yAt(value);
  }
  return height / 2;
}

function ticks(): number[] {
  const max = props.yMax > 0 ? props.yMax : 1;
  return [max, Math.round(max / 2), 0];
}

function move(index: number) {
  const next = Math.min(Math.max(index, 0), props.points.length - 1);
  emit("select", next);
}

function onKey(event: KeyboardEvent, index: number) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    move(index);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    move(index + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    move(index - 1);
  }
}
</script>

<template>
  <svg class="history-chart" :viewBox="`0 0 ${width} ${height}`" role="group" :aria-label="label">
    <g aria-hidden="true">
      <line
        v-for="tick in ticks()"
        :key="tick"
        class="grid"
        :x1="padLeft"
        :x2="width - padRight"
        :y1="yAt(tick)"
        :y2="yAt(tick)"
      />
      <text
        v-for="tick in ticks()"
        :key="`label-${tick}`"
        :x="padLeft - 8"
        :y="yAt(tick) + 4"
        text-anchor="end"
      >
        {{ tick }}
      </text>
    </g>
    <path
      v-for="item in series"
      :key="item.id"
      :class="`series series-${item.id}`"
      :d="linePath(item)"
      fill="none"
    />
    <g
      v-for="(point, index) in points"
      :key="ids[index] || point"
      class="point"
      :class="{ 'is-selected': index === selected }"
      role="button"
      tabindex="0"
      :aria-label="point"
      :aria-pressed="index === selected"
      @click="move(index)"
      @keydown="onKey($event, index)"
    >
      <circle class="hit" :cx="xAt(index)" :cy="focusY(index)" r="11" />
      <template v-for="item in series" :key="item.id">
        <circle
          v-if="item.marker === 'circle' && item.values[index] != null"
          :class="`mark series-${item.id}`"
          :cx="xAt(index)"
          :cy="yAt(item.values[index] ?? 0)"
          r="4.5"
        />
        <rect
          v-else-if="item.values[index] != null"
          :class="`mark series-${item.id}`"
          :x="xAt(index) - 4"
          :y="yAt(item.values[index] ?? 0) - 4"
          width="8"
          height="8"
        />
      </template>
    </g>
  </svg>
</template>
