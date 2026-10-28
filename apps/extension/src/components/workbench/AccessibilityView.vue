<script setup lang="ts">
import { computed } from "vue";
import { Info } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import { selectChecks } from "../../services/check-list";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import { badgeTone, checkTone, statusKey } from "./checks";
import PageHeading from "./PageHeading.vue";
import DataRow from "./DataRow.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { go } = useWorkbench();
const category = computed(
  () => props.audit.score.categories.find((item) => item.category === "accessibility") ?? null,
);
const checks = computed(() =>
  selectChecks(
    props.audit.checks.filter((check) => check.category === "accessibility"),
    { sort: "severity" },
  ),
);
const review = computed(() =>
  checks.value.filter((check) => check.status === "ERROR" || check.status === "WARNING"),
);
const notMeasured = computed(
  () =>
    checks.value.filter(
      (check) => check.status === "UNAVAILABLE" || check.status === "NOT_APPLICABLE",
    ).length,
);
</script>

<template>
  <PageHeading
    :overline="t('wb.ac.overline')"
    :title="t('nav.accessibility')"
    :text="t('wb.ac.text')"
  />
  <div class="compact-stats">
    <div class="kpi">
      <strong>{{ category?.available && category.value != null ? n(category.value) : "–" }}</strong>
      <span>{{ t("wb.ac.score") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(review.length) }}</strong
      ><span>{{ t("wb.ac.notes") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(notMeasured) }}</strong
      ><span>{{ t("status.unavailable") }}</span>
    </div>
  </div>
  <div class="section-heading">
    <div>
      <h2>{{ review.length ? t("wb.ac.review") : t("wb.ac.observed") }}</h2>
    </div>
  </div>
  <p v-if="!checks.length" class="callout">{{ t("a11y.note") }}</p>
  <DataRow
    v-for="check in checks"
    :key="check.id"
    link
    :title="check.title"
    :sub="check.description"
    :tone="checkTone(check.status)"
    :badge="t(statusKey[check.status])"
    :badge-tone="badgeTone(check.status)"
    @open="go('issues', { category: 'accessibility', check: check.id })"
  />
  <div class="callout">
    <Info class="ic" aria-hidden="true" />
    <span>{{ t("wb.ac.callout") }}</span>
  </div>
</template>
