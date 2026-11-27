<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "../../composables/useI18n";
import type { CrawlSession } from "../../services/site-crawl";
import { analyzeSiteRelations } from "../../services/site-relations";
import type { CheckResult } from "../../types/audit";
import FindingList from "./FindingList.vue";
import SxPanel from "./SxPanel.vue";

/** Canonical and hreflang relationships across the open crawl, judged after it stops. */
const props = defineProps<{ session: CrawlSession }>();
const { t, n } = useI18n();
const findings = ref<CheckResult[]>([]);
const failed = ref(false);
const running = computed(() => props.session.status === "running");

let run = 0;
watch(
  () => [props.session.id, props.session.status, props.session.pages.length] as const,
  async () => {
    const current = ++run;
    if (running.value) return;
    try {
      const report = await analyzeSiteRelations(props.session);
      if (current === run) {
        findings.value = report.findings;
        failed.value = false;
      }
    } catch {
      if (current === run) {
        findings.value = [];
        failed.value = true;
      }
    }
  },
  { immediate: true },
);

const canonical = computed(() => findings.value.filter((f) => f.id.startsWith("SITE_CANONICAL")));
const hreflang = computed(() => findings.value.filter((f) => f.id.startsWith("SITE_HREFLANG")));
const review = (list: CheckResult[]) =>
  list.filter((f) => f.status === "WARNING" || f.status === "ERROR").length;
</script>

<template>
  <div class="sx-grid-two sx-relations">
    <SxPanel
      v-for="group in [
        { id: 'canonical', title: t('relations.canonical'), list: canonical },
        { id: 'hreflang', title: t('relations.hreflang'), list: hreflang },
      ]"
      :key="group.id"
      :title="group.title"
      :text="t('relations.text')"
      :badge="t('ready.groupCount', { count: n(review(group.list)) })"
    >
      <p v-if="running" class="sx-small sx-relations-note">{{ t("relations.running") }}</p>
      <p v-else-if="failed" class="sx-small sx-relations-note" role="status">
        {{ t("relations.failed") }}
      </p>
      <FindingList v-else :findings="group.list" />
    </SxPanel>
  </div>
</template>
