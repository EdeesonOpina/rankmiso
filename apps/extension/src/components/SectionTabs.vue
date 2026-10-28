<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { dismissNavHint, readNavHintDismissed } from "../adapters/storage";
import { useI18n } from "../composables/useI18n";
import { nextTabId, scrollThumb } from "../services/tablist";

const props = defineProps<{
  items: readonly { id: string; label: string }[];
  current: string;
  label: string;
  panelId?: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();
const { t } = useI18n();
const scroller = ref<HTMLElement | null>(null);
const canBack = ref(false);
const canForward = ref(false);
const dragging = ref(false);
const thumbSize = ref(100);
const thumbStart = ref(0);
const overflow = ref(false);
const hintDismissed = ref(true);
let observer: ResizeObserver | undefined;
let pointerId = -1;
let startX = 0;
let startScroll = 0;
let moved = false;
let suppressClick = false;

function update() {
  const el = scroller.value;
  if (!el) return;
  canBack.value = el.scrollLeft > 4;
  canForward.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
  const thumb = scrollThumb(el.scrollLeft, el.clientWidth, el.scrollWidth);
  overflow.value = thumb != null;
  thumbSize.value = thumb?.size ?? 100;
  thumbStart.value = thumb?.start ?? 0;
}

async function dismissHint() {
  hintDismissed.value = true;
  await dismissNavHint();
}

function reveal() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({
    inline: "nearest",
    block: "nearest",
    behavior: reduce ? "auto" : "smooth",
  });
}

function onKeys(event: KeyboardEvent) {
  const next = nextTabId(
    props.current,
    props.items.map((item) => item.id),
    event.key,
  );
  if (!next) return;
  event.preventDefault();
  emit("select", next);
  const list = event.currentTarget;
  if (list instanceof HTMLElement) {
    list.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  const el = scroller.value;
  if (!el) return;
  pointerId = event.pointerId;
  startX = event.clientX;
  startScroll = el.scrollLeft;
  moved = false;
}

function onPointerMove(event: PointerEvent) {
  if (pointerId !== event.pointerId) return;
  const el = scroller.value;
  if (!el) return;
  const delta = event.clientX - startX;
  if (!moved && Math.abs(delta) < 6) return;
  if (!moved) {
    moved = true;
    dragging.value = true;
    el.setPointerCapture(pointerId);
  }
  el.scrollLeft = startScroll - delta;
  event.preventDefault();
}

function endPointer(event: PointerEvent) {
  if (pointerId !== event.pointerId) return;
  const el = scroller.value;
  if (moved) suppressClick = true;
  if (el?.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
  pointerId = -1;
  moved = false;
  dragging.value = false;
  update();
}

function onClickCapture(event: MouseEvent) {
  if (!suppressClick) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}

onMounted(() => {
  void readNavHintDismissed().then((dismissed) => {
    hintDismissed.value = dismissed;
  });
  update();
  void nextTick(reveal);
  if (scroller.value) {
    observer = new ResizeObserver(() => {
      reveal();
      update();
    });
    observer.observe(scroller.value);
  }
});
onUnmounted(() => observer?.disconnect());
watch(
  () => props.current,
  () =>
    void nextTick(() => {
      reveal();
      update();
    }),
);
</script>

<template>
  <div class="section-tabs">
    <div class="section-tabs-frame">
      <div
        ref="scroller"
        class="section-tabs-scroll"
        :class="{ 'is-dragging': dragging }"
        role="tablist"
        :aria-label="label"
        @scroll="update"
        @keydown="onKeys"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="endPointer"
        @pointercancel="endPointer"
        @click.capture="onClickCapture"
      >
        <button
          v-for="item in items"
          :id="`tab-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          :data-tab="item.id"
          :aria-selected="current === item.id"
          :aria-controls="panelId"
          :tabindex="current === item.id ? 0 : -1"
          @click="emit('select', item.id)"
        >
          {{ item.label }}
        </button>
      </div>
      <span v-if="canBack" class="section-tabs-fade is-left" aria-hidden="true" />
      <span v-if="canForward" class="section-tabs-fade is-right" aria-hidden="true" />
    </div>
    <div v-if="overflow" class="section-tabs-status">
      <div class="section-tabs-meter" aria-hidden="true">
        <span :style="{ width: `${thumbSize}%`, marginInlineStart: `${thumbStart}%` }" />
      </div>
      <p v-if="!hintDismissed" class="section-tabs-hint">
        <span>{{ t("nav.dragHint") }}</span>
        <button type="button" @click="dismissHint">{{ t("nav.dismissHint") }}</button>
      </p>
    </div>
  </div>
</template>
