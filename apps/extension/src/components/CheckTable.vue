<script setup lang="ts">
import { computed, ref } from "vue";
import { Search, SearchX } from "lucide-vue-next";
import type { CheckResult, CheckStatus } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import EmptyState from "./EmptyState.vue";
import StatusBadge from "./StatusBadge.vue";

const props = withDefaults(defineProps<{ checks: CheckResult[]; title?: string }>(), {
  title: "",
});
const { t } = useI18n();
const filter = ref<"all" | CheckStatus>("all");
const query = ref("");

const visible = computed(() =>
  props.checks.filter((check) => {
    const matchesFilter = filter.value === "all" || check.status === filter.value;
    const haystack = `${check.title} ${check.description} ${check.id}`.toLowerCase();
    return matchesFilter && haystack.includes(query.value.trim().toLowerCase());
  }),
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
      <span>{{ t("checks.count", { count: props.checks.length }) }}</span>
    </div>
    <div class="check-filter-scroll">
      <div class="check-filter-row">
        <button
          v-for="item in filters"
          :key="item[0]"
          type="button"
          class="rounded-full border border-border px-3 py-1 text-[12px]"
          :class="
            filter === item[0] ? 'bg-primary text-primary-contrast border-primary' : 'bg-surface'
          "
          :aria-pressed="filter === item[0]"
          @click="filter = item[0]"
        >
          {{ t(item[1]) }}
        </button>
      </div>
    </div>
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
          :placeholder="t('search.checks')"
          class="w-full rounded-panel border border-border bg-surface py-2 pl-9 pr-3"
        />
      </span>
    </label>
    <EmptyState
      v-if="visible.length === 0"
      :title="t('empty.checksTitle')"
      :description="t('empty.checksBody')"
    >
      <SearchX class="h-4 w-4" />
    </EmptyState>
    <ul v-else class="space-y-4">
      <li
        v-for="check in visible"
        :key="check.id"
        class="rounded-panel border border-border bg-surface p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="m-0 text-[14px] font-semibold">{{ check.title }}</h3>
          <StatusBadge :status="check.status" />
        </div>
        <p class="mb-0 mt-2 text-[13px]">{{ check.description }}</p>
        <p v-if="check.recommendation" class="mb-0 mt-2 text-[13px]">
          <span class="font-medium">{{ t("check.fix") }}:</span> {{ check.recommendation }}
        </p>
        <dl v-if="check.evidence.length" class="mt-2 space-y-1 text-[12px] text-muted">
          <div v-for="item in check.evidence" :key="`${check.id}-${item.label}-${item.value}`">
            <dt class="inline font-medium">{{ item.label }}:</dt>
            <dd class="inline break-all">{{ item.value }}</dd>
          </div>
        </dl>
        <p class="mb-0 mt-2 font-mono text-[11px] text-muted">{{ check.id }}</p>
      </li>
    </ul>
  </div>
</template>
