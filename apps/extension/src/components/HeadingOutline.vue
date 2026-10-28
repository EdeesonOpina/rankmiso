<script setup lang="ts">
import { computed, ref } from "vue";
import { Heading } from "lucide-vue-next";
import { headingLevelCounts, selectHeadings } from "../services/popup-summary";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";
import EmptyState from "./EmptyState.vue";

const props = defineProps<{
  headings: readonly { level: number; text: string; location: string }[];
}>();
const { t, n } = useI18n();
const query = ref("");
const level = ref(0);
const counts = computed(() => headingLevelCounts(props.headings));
const visible = computed(() => selectHeadings(props.headings, query.value, level.value));
const outlineText = computed(() =>
  props.headings
    .map((heading) => `H${heading.level} ${heading.text || t("value.empty")}`)
    .join("\n"),
);

function label(heading: { text: string }): string {
  return heading.text || t("value.empty");
}
</script>

<template>
  <div class="inspector">
    <div class="inspector-tools">
      <ul class="outline-counts">
        <li>{{ t("outline.total", { count: headings.length }) }}</li>
        <li v-for="(count, index) in counts" v-show="count > 0" :key="index">
          H{{ index + 1 }} {{ n(count) }}
        </li>
      </ul>
      <CopyButton v-if="headings.length" :value="outlineText" :label="t('outline.copy')" />
    </div>
    <div v-if="headings.length" class="inspector-tools">
      <label class="check-search">
        {{ t("outline.search") }}
        <input v-model="query" type="search" />
      </label>
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('outline.search')">
        <button
          type="button"
          class="inspector-action"
          :class="level === 0 ? 'is-primary' : ''"
          :aria-pressed="level === 0"
          @click="level = 0"
        >
          {{ t("filter.all") }}
        </button>
        <button
          v-for="index in 6"
          :key="index"
          type="button"
          class="inspector-action"
          :class="level === index ? 'is-primary' : ''"
          :aria-pressed="level === index"
          @click="level = index"
        >
          H{{ index }}
        </button>
      </div>
    </div>
    <EmptyState
      v-if="headings.length === 0"
      :title="t('empty.headingsTitle')"
      :description="t('empty.headingsBody')"
    >
      <Heading class="h-4 w-4" />
    </EmptyState>
    <p v-else-if="visible.length === 0" class="m-0 text-[13px] text-muted">
      {{ t("outline.noMatch") }}
    </p>
    <ol v-else class="outline-list">
      <li
        v-for="(heading, index) in visible"
        :key="`${heading.location}-${index}`"
        :data-level="heading.level"
        :style="{ paddingInlineStart: `${Math.min(heading.level - 1, 3) * 12}px` }"
      >
        <span class="outline-level">H{{ heading.level }}</span>
        <span class="outline-text" :class="heading.text ? '' : 'text-muted'">{{
          label(heading)
        }}</span>
        <CopyButton v-if="heading.text" :value="heading.text" />
      </li>
    </ol>
  </div>
</template>
