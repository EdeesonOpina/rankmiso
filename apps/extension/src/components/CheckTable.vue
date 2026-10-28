<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from "vue";
import { Search, SearchX } from "lucide-vue-next";
import type { Category, CheckResult, CheckStatus } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import { categoryLabelKey } from "../services/category-label";
import { selectChecks, type CheckSort } from "../services/check-list";
import EmptyState from "./EmptyState.vue";
import IssueCard from "./IssueCard.vue";

const props = withDefaults(
  defineProps<{
    checks: CheckResult[];
    title?: string;
    showCategory?: boolean;
    focusId?: string;
  }>(),
  { title: "", showCategory: false, focusId: "" },
);
const { t } = useI18n();
const categoryField = useId();
const sortField = useId();
const filter = ref<"all" | CheckStatus>("all");
const category = ref<Category | "all">("all");
const sort = ref<CheckSort>("severity");
const query = ref("");

const categories = computed(() => [...new Set(props.checks.map((check) => check.category))]);

const visible = computed(() =>
  selectChecks(props.checks, {
    status: filter.value,
    category: props.showCategory ? category.value : "all",
    query: query.value,
    sort: sort.value,
  }),
);

watch(
  () => props.focusId,
  async (id) => {
    if (!id) return;
    await nextTick();
    document.querySelector<HTMLElement>(`[data-check="${CSS.escape(id)}"]`)?.scrollIntoView({
      block: "nearest",
    });
  },
);

const filters = [
  ["all", "filter.all"],
  ["ERROR", "filter.errors"],
  ["WARNING", "filter.warnings"],
  ["PASS", "filter.passed"],
  ["INFO", "filter.info"],
  ["UNAVAILABLE", "filter.unavailable"],
] as const;
</script>

<template>
  <div class="check-table">
    <div class="check-table-heading">
      <h2>{{ props.title || t("checks.heading") }}</h2>
      <span>{{ t("checks.count", { count: visible.length }) }}</span>
    </div>
    <div class="check-filter-scroll">
      <div class="check-filter-row" role="group" :aria-label="t('filter.all')">
        <button
          v-for="item in filters"
          :key="item[0]"
          type="button"
          class="rounded-full border border-border px-3 py-1 text-[12px]"
          :class="
            filter === item[0]
              ? 'border-primary bg-primary text-primary-contrast'
              : 'bg-surface hover:border-primary'
          "
          :aria-pressed="filter === item[0]"
          @click="filter = item[0]"
        >
          {{ t(item[1]) }}
        </button>
      </div>
    </div>
    <div class="check-tools">
      <label class="check-search">
        <span>{{ t("search.checks") }}</span>
        <span class="check-search-field">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            v-model="query"
            type="search"
            name="check-filter"
            autocomplete="off"
            :placeholder="t('search.checks')"
            class="w-full rounded-panel border border-border bg-surface py-2 pl-9 pr-3"
          />
        </span>
      </label>
      <div v-if="showCategory" class="check-search">
        <label :for="categoryField">{{ t("filter.category") }}</label>
        <select :id="categoryField" v-model="category" class="check-select">
          <option value="all">{{ t("filter.all") }}</option>
          <option v-for="item in categories" :key="item" :value="item">
            {{ t(categoryLabelKey[item]) }}
          </option>
        </select>
      </div>
      <div class="check-search">
        <label :for="sortField">{{ t("sort.label") }}</label>
        <select :id="sortField" v-model="sort" class="check-select">
          <option value="severity">{{ t("sort.severity") }}</option>
          <option value="title">{{ t("sort.title") }}</option>
        </select>
      </div>
    </div>
    <EmptyState
      v-if="visible.length === 0"
      :title="t('empty.checksTitle')"
      :description="t('empty.checksBody')"
    >
      <SearchX class="h-4 w-4" />
    </EmptyState>
    <ul v-else class="m-0 list-none space-y-3 p-0">
      <li v-for="check in visible" :key="check.id" :data-check="check.id">
        <IssueCard :check="check" />
      </li>
    </ul>
  </div>
</template>
