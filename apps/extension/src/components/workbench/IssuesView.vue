<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from "vue";
import { Search } from "lucide-vue-next";
import type { AuditResult, Category, CheckStatus } from "../../types/audit";
import { selectChecks, type CheckSort } from "../../services/check-list";
import { categoryLabelKey } from "../../services/category-label";
import { findingGuide } from "../../locales/findings.en";
import type { MessageKey } from "../../locales/en";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import { badgeTone, statusKey } from "./checks";
import PageHeading from "./PageHeading.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { issueFocus } = useWorkbench();
const searchId = useId();
const categoryId = useId();
const sortId = useId();
const status = ref<CheckStatus | "all">("all");
const category = ref<Category | "all">(issueFocus.value?.category ?? "all");
const sort = ref<CheckSort>("severity");
const query = ref("");
const opened = ref<string | null>(issueFocus.value?.check ?? null);

const counts = computed(() => {
  const result: Partial<Record<CheckStatus, number>> = {};
  for (const check of props.audit.checks) result[check.status] = (result[check.status] ?? 0) + 1;
  return result;
});
const pills = computed(() => {
  const list: Array<[CheckStatus | "all", MessageKey, number]> = [
    ["all", "filter.all", props.audit.checks.length],
    ["WARNING", "filter.warnings", counts.value.WARNING ?? 0],
    ["ERROR", "filter.errors", counts.value.ERROR ?? 0],
    ["PASS", "filter.passed", counts.value.PASS ?? 0],
    ["INFO", "filter.info", counts.value.INFO ?? 0],
    ["UNAVAILABLE", "filter.unavailable", counts.value.UNAVAILABLE ?? 0],
  ];
  return list.filter(
    ([id, , count]) => id === "all" || id === "WARNING" || id === "ERROR" || count > 0,
  );
});
const categories = computed(() => [...new Set(props.audit.checks.map((check) => check.category))]);
const visible = computed(() =>
  selectChecks(props.audit.checks, {
    status: status.value,
    category: category.value,
    query: query.value,
    sort: sort.value,
  }),
);

onMounted(async () => {
  const id = issueFocus.value?.check;
  if (!id) return;
  await nextTick();
  document.querySelector(`[data-check="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center" });
});
</script>

<template>
  <PageHeading :overline="t('wb.is.overline')" :title="t('wb.is.title')" :text="t('wb.is.text')" />
  <div class="summary-strip">
    <div class="kpi">
      <strong>{{ n(audit.score.errors) }}</strong
      ><span>{{ t("score.errorName") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(audit.score.warnings) }}</strong
      ><span>{{ t("score.warningName") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(audit.score.passed) }}</strong
      ><span>{{ t("score.passedName") }}</span>
    </div>
  </div>
  <div class="pill-set" role="group" :aria-label="t('wb.is.filter')">
    <button
      v-for="[id, key, count] in pills"
      :key="id"
      type="button"
      class="pill"
      :class="{ active: status === id }"
      :aria-pressed="status === id"
      @click="status = id"
    >
      {{ id === "all" ? t(key) : `${t(key)} · ${n(count)}` }}
    </button>
  </div>
  <div class="filter-tools">
    <label class="search" :for="searchId">
      <Search class="ic" aria-hidden="true" />
      <input
        :id="searchId"
        v-model="query"
        type="search"
        autocomplete="off"
        :placeholder="t('search.checks')"
        :aria-label="t('search.checks')"
      />
    </label>
    <label class="select-field" :for="categoryId">
      <span>{{ t("filter.category") }}</span>
      <select :id="categoryId" v-model="category" :aria-label="t('filter.category')">
        <option value="all">{{ t("filter.all") }}</option>
        <option v-for="item in categories" :key="item" :value="item">
          {{ t(categoryLabelKey[item]) }}
        </option>
      </select>
    </label>
    <label class="select-field" :for="sortId">
      <span>{{ t("sort.label") }}</span>
      <select :id="sortId" v-model="sort" :aria-label="t('sort.label')">
        <option value="severity">{{ t("sort.severity") }}</option>
        <option value="title">{{ t("sort.title") }}</option>
      </select>
    </label>
  </div>
  <p v-if="!visible.length" class="callout">{{ t("empty.checksBody") }}</p>
  <div v-else class="finding-list">
    <article v-for="check in visible" :key="check.id" class="finding" :data-check="check.id">
      <div class="finding-type">
        <span class="badge" :class="badgeTone(check.status)">{{ t(statusKey[check.status]) }}</span>
        <span>{{ t(categoryLabelKey[check.category]) }}</span>
      </div>
      <h3>{{ check.title }}</h3>
      <p>{{ check.description }}</p>
      <p v-if="check.recommendation" class="finding-fix">
        <strong>{{ t("check.fix") }}:</strong> {{ check.recommendation }}
      </p>
      <details class="disclosure" :open="opened === check.id">
        <summary>{{ t("wb.is.evidence") }}<span aria-hidden="true">⌄</span></summary>
        <div class="details-body">
          <dl v-if="check.evidence.length" class="evidence">
            <div v-for="item in check.evidence" :key="`${item.label}-${item.value}`">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
          <p v-else>{{ t("wb.is.noEvidence") }}</p>
          <p v-if="findingGuide(check.id)">
            <strong>{{ t("check.verify") }}:</strong> {{ findingGuide(check.id)?.verify }}
          </p>
          <p v-if="findingGuide(check.id)?.example">
            <strong>{{ t("check.example") }}.</strong> {{ t("check.exampleNote") }}
            <code class="code-line">{{ findingGuide(check.id)?.example }}</code>
          </p>
          <p class="check-id">{{ check.id }}</p>
        </div>
      </details>
    </article>
  </div>
</template>
