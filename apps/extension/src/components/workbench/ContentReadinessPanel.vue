<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { CircleCheck, CircleHelp, CircleSlash, Lightbulb } from "lucide-vue-next";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";
import { crawlerAccessFor, renderingFor } from "../../services/ai-search-store";
import {
  analyzeReadiness,
  readinessGroups,
  summarize,
  type ReadinessGroup,
  type ReadinessReport,
} from "../../services/readiness";
import { sitePermission } from "../../services/page-access";
import type { AuditResult } from "../../types/audit";
import { useWorkbench } from "./context";
import SxPanel from "./SxPanel.vue";
import SxStat from "./SxStat.vue";
import FindingList from "./FindingList.vue";

const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ openAccess: [] }>();
const { t, n } = useI18n();
const { snapshot, go } = useWorkbench();
const report = ref<ReadinessReport | null>(null);
const failed = ref(false);

const url = computed(() => props.audit.page.url);
const host = computed(() => sitePermission(url.value)?.hostname ?? url.value);
const crawler = computed(() => crawlerAccessFor(url.value));
const rendering = computed(() => renderingFor(url.value));

let run = 0;
// Local only: the snapshot is already collected, and earlier check results are read, not re-run.
watch(
  [() => snapshot?.value, crawler, rendering],
  async ([page]) => {
    const current = ++run;
    failed.value = false;
    if (!page || page.url !== url.value) {
      report.value = null;
      return;
    }
    try {
      const next = await analyzeReadiness(page, crawler.value, rendering.value);
      if (current === run) report.value = next;
    } catch {
      if (current === run) {
        report.value = null;
        failed.value = true;
      }
    }
  },
  { immediate: true },
);

const totals = computed(() => summarize(report.value?.findings ?? []));

const order: Record<string, number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
  PASS: 3,
  UNAVAILABLE: 4,
  NOT_APPLICABLE: 5,
};
const groups = computed(() =>
  readinessGroups.map((id) => {
    const findings = (report.value?.findings ?? [])
      .filter((finding) => finding.group === id)
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    return { id, findings, summary: summarize(findings) };
  }),
);

const groupKey: Record<ReadinessGroup, { title: MessageKey; text: MessageKey }> = {
  discoverability: {
    title: "ready.group.discoverability",
    text: "ready.group.discoverabilityText",
  },
  structure: { title: "ready.group.structure", text: "ready.group.structureText" },
  clarity: { title: "ready.group.clarity", text: "ready.group.clarityText" },
  attribution: { title: "ready.group.attribution", text: "ready.group.attributionText" },
  structuredData: { title: "ready.group.structuredData", text: "ready.group.structuredDataText" },
  accessibility: { title: "ready.group.accessibility", text: "ready.group.accessibilityText" },
};

const pageTypeKey: Record<ReadinessReport["pageType"], MessageKey> = {
  article: "ready.pageType.article",
  product: "ready.pageType.product",
  other: "ready.pageType.other",
};

const staleNotes = computed(() => {
  const analyzed = Date.parse(props.audit.analyzedAt);
  const notes: string[] = [];
  const older = (iso: string | undefined) =>
    !!iso && Number.isFinite(analyzed) && Date.parse(iso) < analyzed;
  if (older(crawler.value?.checkedAt)) notes.push(t("ready.stale.access"));
  if (older(rendering.value?.checkedAt)) notes.push(t("ready.stale.rendering"));
  return notes;
});
</script>

<template>
  <div class="ax-panel">
    <section class="ax-console" :aria-label="t('ready.title')">
      <div>
        <strong translate="no">{{ host }}</strong>
        <p>{{ audit.page.title || audit.page.url }}</p>
        <p class="ax-small">{{ t("ready.local") }}</p>
      </div>
      <span v-if="report" class="sx-chip ghost">{{
        t("ready.pageType", { type: t(pageTypeKey[report.pageType]) })
      }}</span>
    </section>

    <section v-if="!report" class="ax-empty">
      <h2>{{ t(failed ? "ready.failed" : "ready.empty.title") }}</h2>
      <p>{{ t("ready.empty.body") }}</p>
    </section>

    <template v-else>
      <div class="sx-stats">
        <SxStat
          :label="t('ready.stat.completed')"
          :value="n(totals.completed)"
          :icon="CircleCheck"
          tone="brand"
        />
        <SxStat
          :label="t('ready.stat.opportunities')"
          :value="n(totals.opportunities)"
          :icon="Lightbulb"
          tone="warning"
        />
        <SxStat
          :label="t('ready.stat.notMeasured')"
          :value="n(totals.notMeasured)"
          :icon="CircleHelp"
          tone="neutral"
        />
        <SxStat
          :label="t('ready.stat.notApplicable')"
          :value="n(totals.notApplicable)"
          :icon="CircleSlash"
          tone="neutral"
        />
      </div>
      <ul v-if="staleNotes.length" class="ax-facts" role="list">
        <li v-for="note in staleNotes" :key="note">{{ note }}</li>
      </ul>

      <SxPanel
        v-for="group in groups"
        :key="group.id"
        :title="t(groupKey[group.id].title)"
        :text="t(groupKey[group.id].text)"
        :badge="t('ready.groupCount', { count: n(group.summary.opportunities) })"
        class="ax-section"
      >
        <FindingList :findings="group.findings">
          <template #actions="{ finding }">
            <button
              v-if="finding.id === 'READY_CRAWLER_ACCESS' && finding.status === 'UNAVAILABLE'"
              type="button"
              class="secondary"
              @click="emit('openAccess')"
            >
              {{ t("ready.action.access") }}
            </button>
            <button
              v-if="finding.id === 'READY_RENDERING' && finding.status === 'UNAVAILABLE'"
              type="button"
              class="secondary"
              @click="go('technical')"
            >
              {{ t("ready.action.rendering") }}
            </button>
            <button
              v-if="finding.reused"
              type="button"
              class="icon-text"
              @click="go('issues', { check: finding.id })"
            >
              {{ t("ready.reused") }}
            </button>
          </template>
        </FindingList>
      </SxPanel>
    </template>

    <p class="ax-disclaimer">{{ t("ready.disclaimer") }} {{ t("ready.llms") }}</p>
  </div>
</template>
