<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult, Category } from "../../types/audit";
import { selectChecks } from "../../services/check-list";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import { badgeTone, checkTone, statusKey } from "./checks";
import DataRow from "./DataRow.vue";

const props = defineProps<{ audit: AuditResult; category: Category }>();
const { t, n } = useI18n();
const { go, surface } = useWorkbench();
const all = computed(() =>
  selectChecks(
    props.audit.checks.filter((check) => check.category === props.category),
    { sort: "severity" },
  ),
);
// The narrow sidebar lists only what needs attention; Issues holds the rest.
const rows = computed(() =>
  surface === "sidebar"
    ? all.value.filter((check) => check.status === "ERROR" || check.status === "WARNING")
    : all.value,
);
</script>

<template>
  <section v-if="all.length" class="related-checks">
    <div class="section-heading">
      <div>
        <h2>{{ t("wb.checks") }}</h2>
      </div>
      <button type="button" class="subtle-btn" @click="go('issues', { category })">
        {{ t("wb.inIssues", { count: n(all.length) }) }} →
      </button>
    </div>
    <div class="list">
      <DataRow
        v-for="check in rows"
        :key="check.id"
        link
        :title="check.title"
        :sub="check.description"
        :tone="checkTone(check.status)"
        :badge="t(statusKey[check.status])"
        :badge-tone="badgeTone(check.status)"
        @open="go('issues', { category, check: check.id })"
      />
    </div>
  </section>
</template>
