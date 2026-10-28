<script setup lang="ts">
import type { Tone } from "./context";

withDefaults(
  defineProps<{
    title: string;
    sub?: string;
    tone?: Tone;
    badge?: string;
    badgeTone?: "ok" | "warn" | "err" | "gray";
    link?: boolean;
  }>(),
  { sub: "", tone: "good", badge: "", badgeTone: "gray", link: false },
);
defineEmits<{ open: [] }>();
</script>

<template>
  <component
    :is="link ? 'button' : 'div'"
    :type="link ? 'button' : undefined"
    class="data-row"
    :class="{ 'is-link': link }"
    @click="link && $emit('open')"
  >
    <div class="record-dot" :class="tone" aria-hidden="true" />
    <div class="data-main">
      <strong>{{ title }}</strong>
      <small v-if="sub">{{ sub }}</small>
      <slot />
    </div>
    <div v-if="badge || $slots.end" class="data-end">
      <slot name="end"
        ><span class="badge" :class="badgeTone">{{ badge }}</span></slot
      >
    </div>
  </component>
</template>
