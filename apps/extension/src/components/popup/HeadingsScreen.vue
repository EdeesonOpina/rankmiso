<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ copy: [value: string]; highlight: [kind: string] }>();
const { t, n } = useI18n();
const query = ref("");
const LIMIT = 150;

const headings = computed(() => props.audit.details.headings);
const counts = computed(() => {
  const counts = { h1: 0, h2: 0, rest: 0 };
  for (const heading of headings.value) {
    if (heading.level === 1) counts.h1 += 1;
    else if (heading.level === 2) counts.h2 += 1;
    else counts.rest += 1;
  }
  return counts;
});
const rows = computed(() => {
  let h1Seen = 0;
  return headings.value.map((heading, index) => {
    if (heading.level === 1) h1Seen += 1;
    return { ...heading, index, h1Order: heading.level === 1 ? h1Seen : 0 };
  });
});
const shown = computed(() => {
  const needle = query.value.trim().toLowerCase();
  const matched = needle
    ? rows.value.filter((row) => row.text.toLowerCase().includes(needle))
    : rows.value;
  return matched.slice(0, LIMIT);
});
const outline = computed(() =>
  headings.value.map((heading) => `H${heading.level} ${heading.text || t("value.empty")}`).join("\n"),
);

function indent(level: number): string {
  const step = Math.min(level - 1, 3);
  return step ? `outline-indent${step}` : "";
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.headings") }}</span><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="pair" style="align-items: flex-end">
    <div>
      <h2 class="sec-heading">{{ t("popup.documentOutline") }}</h2>
      <p class="helper" style="margin: 5px 0 0">{{ t("pm.outlineHelp") }}</p>
    </div>
    <button
      v-if="headings.length"
      type="button"
      class="button-sm"
      :aria-label="t('outline.copy')"
      @click="emit('copy', outline)"
    >
      {{ t("action.copy") }} ↗
    </button>
  </div>
  <div class="grid3" style="margin: 15px 0">
    <div class="mini-tile">
      <strong :class="{ 'status-red': counts.h1 !== 1 }">{{ n(counts.h1) }}</strong><span>H1</span>
    </div>
    <div class="mini-tile"><strong>{{ n(counts.h2) }}</strong><span>H2</span></div>
    <div class="mini-tile"><strong>{{ n(counts.rest) }}</strong><span>H3–H6</span></div>
  </div>
  <label class="field-label" for="head-search">{{ t("popup.findHeading") }}</label>
  <input
    id="head-search"
    v-model="query"
    class="field"
    :placeholder="t('outline.search')"
  />

  <div class="title-row">
    <h2>{{ t("popup.pageOutline") }}</h2>
    <span class="badge" :class="counts.h1 === 1 ? 'ok' : 'warn'">{{
      t("pm.h1Found", { count: counts.h1 })
    }}</span>
  </div>
  <p v-if="!headings.length" class="note">{{ t("empty.headingsBody") }}</p>
  <p v-else-if="!shown.length" class="note">{{ t("outline.noMatch") }}</p>
  <div v-else class="timeline">
    <div
      v-for="row in shown"
      :key="`${row.location}-${row.index}`"
      class="t-row"
      :class="indent(row.level)"
    >
      <div class="t-code" :class="{ h1: row.level === 1 }">H{{ row.level }}</div>
      <div class="t-content">
        <strong v-if="row.text">{{ row.text }}</strong>
        <strong v-else class="muted">({{ t("pm.emptyHeading") }})</strong>
        <small v-if="!row.text" class="status-amber">{{ t("pm.needsReview") }}</small>
        <small v-else-if="row.h1Order === 1">{{ t("pm.mainTitle") }}</small>
        <small v-else-if="row.h1Order > 1" class="status-amber">{{
          t(row.h1Order === 2 ? "pm.extraH1" : "pm.additionalH1")
        }}</small>
      </div>
    </div>
  </div>
  <p v-if="headings.length > LIMIT && !query" class="micro">
    {{ t("pm.showingOf", { shown: n(LIMIT), total: n(headings.length) }) }}
  </p>
  <div class="actions">
    <button type="button" class="button-sm" @click="emit('highlight', 'headings')">
      {{ t("action.highlightHeadings") }}
    </button>
    <button type="button" class="button-sm" @click="emit('highlight', 'h1')">
      {{ t("pm.highlightH1") }}
    </button>
  </div>
</template>
