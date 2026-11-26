<script setup lang="ts">
import { computed } from "vue";
import { markFor, markPath } from "../config/platform-marks.config";

/** Decorative: the platform's name is always shown next to it. */
const props = defineProps<{ platformId: string; name: string }>();
const mark = computed(() => markFor(props.platformId));
</script>

<template>
  <span class="pmark" :class="{ mono: mark?.mono }" aria-hidden="true">
    <img v-if="mark" :src="markPath(mark)" alt="" width="20" height="20" draggable="false" />
    <template v-else>{{ name.charAt(0) }}</template>
  </span>
</template>
