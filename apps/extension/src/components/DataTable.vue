<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "../composables/useI18n";

const props = defineProps<{
  caption: string;
  columns: Array<{ label: string; width: number }>;
  wrap?: boolean;
}>();

const { t } = useI18n();
const widths = ref(props.columns.map((column) => column.width));
const resizing = ref(false);

function clampPair(index: number, nextLeft: number, nextRight: number) {
  const min = 12;
  if (nextLeft < min) {
    nextRight -= min - nextLeft;
    nextLeft = min;
  }
  if (nextRight < min) {
    nextLeft -= min - nextRight;
    nextRight = min;
  }
  const next = widths.value.slice();
  next[index] = nextLeft;
  next[index + 1] = nextRight;
  widths.value = next;
}

function widthAt(index: number): number {
  return widths.value[index] ?? 0;
}

function startResize(event: PointerEvent, index: number) {
  const handle = event.currentTarget as HTMLElement;
  const table = handle.closest("table");
  const tableWidth = table?.getBoundingClientRect().width || 1;
  const startX = event.clientX;
  const left = widthAt(index);
  const right = widthAt(index + 1);
  resizing.value = true;
  handle.setPointerCapture(event.pointerId);

  function onMove(move: PointerEvent) {
    const delta = ((move.clientX - startX) / tableWidth) * 100;
    clampPair(index, left + delta, right - delta);
  }

  function onUp(up: PointerEvent) {
    resizing.value = false;
    if (handle.hasPointerCapture(up.pointerId)) handle.releasePointerCapture(up.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
  }

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}

function nudge(event: KeyboardEvent, index: number) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const step = event.shiftKey ? 8 : 3;
  const delta = event.key === "ArrowRight" ? step : -step;
  clampPair(index, widthAt(index) + delta, widthAt(index + 1) - delta);
}
</script>

<template>
  <div class="overflow-x-auto">
    <table
      class="data-table w-full table-fixed border-collapse text-left text-[13px]"
      :class="[resizing ? 'select-none' : '', wrap ? 'is-wrap' : '']"
    >
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <colgroup>
        <col v-for="(width, index) in widths" :key="index" :style="{ width: `${width}%` }" />
      </colgroup>
      <thead>
        <tr class="border-b border-border">
          <th
            v-for="(column, index) in columns"
            :key="column.label"
            class="relative font-medium text-muted"
            scope="col"
          >
            {{ column.label }}
            <span
              v-if="index < columns.length - 1"
              role="separator"
              tabindex="0"
              aria-orientation="vertical"
              :aria-label="t('table.resize', { column: column.label })"
              :aria-valuemin="12"
              :aria-valuemax="76"
              :aria-valuenow="Math.round(widthAt(index))"
              class="absolute inset-y-1 right-0 w-2 cursor-col-resize touch-none rounded-full hover:bg-border focus-visible:bg-primary"
              @pointerdown.prevent="startResize($event, index)"
              @keydown="nudge($event, index)"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.data-table :deep(th),
.data-table :deep(td) {
  overflow: hidden;
  padding: 10px 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.data-table :deep(tbody tr) {
  border-bottom: 1px solid var(--border);
}

.data-table.is-wrap :deep(td) {
  overflow: visible;
  text-overflow: unset;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
