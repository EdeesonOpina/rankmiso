<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { Search } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import { headingLevelCounts, selectHeadings } from "../../services/popup-summary";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { copy, highlight, clearMarks } = useWorkbench();
const searchId = useId();
const levelId = useId();
const query = ref("");
const level = ref(0);
const limit = ref(200);
const headings = computed(() => props.audit.details.headings);
const counts = computed(() => headingLevelCounts(headings.value));
const visible = computed(() => selectHeadings(headings.value, query.value, level.value));
const outline = computed(() =>
  headings.value
    .map((heading) => `H${heading.level} ${heading.text || t("value.empty")}`)
    .join("\n"),
);
</script>

<template>
  <PageHeading :overline="t('wb.hd.overline')" :title="t('nav.headings')" :text="t('wb.hd.text')" />
  <div class="heading-summary">
    <span
      ><b>{{ n(counts[0] ?? 0) }}</b> H1</span
    >
    <span
      ><b>{{ n(counts[1] ?? 0) }}</b> H2</span
    >
    <span
      ><b>{{ n(counts[2] ?? 0) }}</b> H3</span
    >
    <span
      ><b>{{ n((counts[3] ?? 0) + (counts[4] ?? 0) + (counts[5] ?? 0)) }}</b> H4+</span
    >
  </div>
  <div class="filter-tools">
    <label class="search" :for="searchId">
      <Search class="ic" aria-hidden="true" />
      <input
        :id="searchId"
        v-model="query"
        type="search"
        autocomplete="off"
        :placeholder="t('wb.hd.search')"
        :aria-label="t('outline.search')"
      />
    </label>
    <label class="select-field" :for="levelId">
      <span>{{ t("wb.hd.level") }}</span>
      <select :id="levelId" v-model.number="level" :aria-label="t('wb.hd.level')">
        <option :value="0">{{ t("filter.all") }}</option>
        <option v-for="value in [1, 2, 3, 4, 5, 6]" :key="value" :value="value">
          H{{ value }}
        </option>
      </select>
    </label>
    <button type="button" class="quiet" :disabled="!headings.length" @click="copy(outline)">
      {{ t("outline.copy") }}
    </button>
  </div>
  <p v-if="!headings.length" class="callout">{{ t("empty.headingsBody") }}</p>
  <p v-else-if="!visible.length" class="callout">{{ t("outline.noMatch") }}</p>
  <div v-else class="outline">
    <div
      v-for="(heading, index) in visible.slice(0, limit)"
      :key="`${heading.location}-${index}`"
      class="outline-row"
      :style="{ '--lvl': Math.min(heading.level, 6) }"
    >
      <span class="level">H{{ heading.level }}</span>
      <span :class="{ 'is-empty': !heading.text }">{{ heading.text || t("pm.emptyHeading") }}</span>
    </div>
  </div>
  <button
    v-if="visible.length > limit"
    type="button"
    class="subtle-btn more-btn"
    @click="limit += 200"
  >
    {{ t("wb.showMore", { count: n(visible.length - limit) }) }} →
  </button>
  <div class="actions-row" role="group" :aria-label="t('action.headingActions')">
    <button type="button" class="quiet" @click="highlight('headings')">
      {{ t("action.highlightHeadings") }}
    </button>
    <button type="button" class="quiet" @click="highlight('h1')">{{ t("pm.highlightH1") }}</button>
    <button type="button" class="quiet" @click="clearMarks">
      {{ t("action.clearHighlights") }}
    </button>
  </div>
  <RelatedChecks :audit="audit" category="headings" />
</template>
