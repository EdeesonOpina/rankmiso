<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "../composables/useI18n";
import { pageIdentity, readSavedReports, type SavedReport } from "../services/saved-reports";

const props = defineProps<{ pageUrl: string }>();
const { t, n } = useI18n();
const reports = ref<SavedReport[]>([]);
const failed = ref(false);

onMounted(() => {
  void readSavedReports()
    .then((items) => {
      reports.value = items;
    })
    .catch(() => {
      failed.value = true;
    });
});

const mine = computed(() =>
  reports.value.filter(
    (report) => pageIdentity(report.comparison.url) === pageIdentity(props.pageUrl),
  ),
);
const latest = computed(() => mine.value[0] ?? null);
</script>

<template>
  <div class="inspector-block stack">
    <h2 class="m-0 text-[14px] font-semibold">{{ t("nav.history") }}</h2>
    <p v-if="failed" class="report-copy">{{ t("reports.saveFailed") }}</p>
    <p v-else-if="mine.length === 0" class="report-copy">{{ t("reports.popupEmpty") }}</p>
    <template v-else>
      <p class="report-copy">{{ t("reports.popupCount", { count: mine.length }) }}</p>
      <p class="metric-line">
        <span>{{ t("reports.popupLatest") }}</span>
        <span>{{
          latest?.comparison.score == null ? t("reports.notRecorded") : n(latest.comparison.score)
        }}</span>
      </p>
    </template>
    <p class="report-copy">{{ t("reports.separateCrawl") }}</p>
  </div>
</template>
