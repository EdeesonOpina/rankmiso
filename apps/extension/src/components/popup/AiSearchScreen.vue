<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { crawlerById, platforms, visibilityPlatforms } from "../../config/crawlers.config";
import { useI18n } from "../../composables/useI18n";
import { useCrawlerAccess } from "../../composables/useCrawlerAccess";
import type { MessageKey } from "../../locales/en";
import {
  analyzeReadiness,
  readinessGroups,
  summarize,
  type ReadinessGroup,
  type ReadinessReport,
} from "../../services/readiness";
import { loadStore, type VisibilityStatus } from "../../services/visibility";
import type { AuditResult, PageSnapshot } from "../../types/audit";
import PlatformMark from "../PlatformMark.vue";

/** Compact AI & Search: real results only. The report holds the full evidence and the journal. */
defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult; snapshot?: PageSnapshot | null }>();
const emit = defineEmits<{ report: [section?: string] }>();
const { t, n } = useI18n();

const tabs = [
  { id: "access", key: "pa.tab.access" },
  { id: "readiness", key: "pa.tab.readiness" },
  { id: "visibility", key: "pa.tab.visibility" },
] as const;
const tab = ref<(typeof tabs)[number]["id"]>("access");

const { result, busy, message, host, verdicts, counts, check, label, tone, lead, isPreference } =
  useCrawlerAccess(() => props.audit.page.url);
const shortHost = computed(() => host.value.replace(/^www\./, ""));
const other = computed(() =>
  n(
    (result.value?.report.agents ?? []).filter(
      (agent) => agent.crawl !== "allowed" && agent.crawl !== "disallowed",
    ).length,
  ),
);

// Readiness runs locally on the collected snapshot, and reuses a crawler check made here.
const report = ref<ReadinessReport | null>(null);
let run = 0;
watch(
  [() => props.snapshot, result],
  async ([page, access]) => {
    const current = ++run;
    if (!page || page.url !== props.audit.page.url) {
      report.value = null;
      return;
    }
    try {
      const next = await analyzeReadiness(page, access ?? undefined);
      if (current === run) report.value = next;
    } catch {
      if (current === run) report.value = null;
    }
  },
  { immediate: true },
);
const totals = computed(() => summarize(report.value?.findings ?? []));
const groupKey: Record<ReadinessGroup, MessageKey> = {
  discoverability: "ready.group.discoverability",
  structure: "ready.group.structure",
  clarity: "ready.group.clarity",
  attribution: "ready.group.attribution",
  structuredData: "ready.group.structuredData",
  accessibility: "ready.group.accessibility",
};
const groups = computed(() =>
  readinessGroups.map((id) => {
    const summary = summarize((report.value?.findings ?? []).filter((f) => f.group === id));
    const state: "review" | "observed" | "none" =
      summary.opportunities > 0 ? "review" : summary.completed > 0 ? "observed" : "none";
    return { id, summary, state };
  }),
);

// Visibility is read from this browser's journal; nothing is queried.
const journal = loadStore().store;
const statusKey: Record<VisibilityStatus, MessageKey> = {
  cited: "visibility.status.cited",
  mentioned: "visibility.status.mentioned",
  "not-observed": "visibility.status.notObserved",
  unknown: "visibility.status.unknown",
  "not-measured": "visibility.status.notMeasured",
};
const recent = computed(() =>
  [...journal.observations]
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 4)
    .map((item) => ({
      item,
      query: journal.queries.find((query) => query.id === item.queryId)?.text ?? "",
      platform: visibilityPlatforms.find((platform) => platform.id === item.platformId),
    })),
);
</script>

<template>
  <section class="navy pa-site">
    <div class="kicker">
      <span>✦ {{ t("pa.kicker") }}</span>
    </div>
    <h2 class="pa-site-title">{{ t("pa.title") }}</h2>
    <p class="pa-site-text">{{ t("pa.text") }}</p>
    <div class="pa-site-meta">
      <span class="pa-domain" translate="no">{{ shortHost || t("access.noOrigin") }}</span>
      <span class="pa-pill">{{ t("pa.local") }}</span>
    </div>
  </section>

  <div class="segmented pa-tabs" role="group" :aria-label="t('aiSearch.views')">
    <button
      v-for="item in tabs"
      :key="item.id"
      type="button"
      class="segment"
      :aria-pressed="tab === item.id"
      @click="tab = item.id"
    >
      {{ t(item.key) }}
    </button>
  </div>

  <template v-if="tab === 'access'">
    <div class="title-row">
      <h2>{{ t("access.headTitle") }}</h2>
      <small>{{ t("pa.platforms", { count: n(platforms.length) }) }}</small>
    </div>
    <div v-if="result" class="grid3">
      <div class="mini-tile">
        <strong class="status-green">{{ counts.allowed }}</strong
        ><span>{{ t("pa.allowed") }}</span>
      </div>
      <div class="mini-tile">
        <strong :class="{ 'status-amber': counts.disallowed !== '0' }">{{
          counts.disallowed
        }}</strong
        ><span>{{ t("access.stat.disallowed") }}</span>
      </div>
      <div class="mini-tile">
        <strong>{{ other }}</strong
        ><span>{{ t("pa.other") }}</span>
      </div>
    </div>
    <p v-else class="note">{{ t("access.empty.body") }}</p>
    <div class="actions">
      <button
        type="button"
        class="button-sm red"
        :disabled="busy || !host"
        :aria-busy="busy"
        @click="check"
      >
        {{ busy ? t("access.checking") : t("access.check") }}
      </button>
    </div>
    <p v-if="message" class="note pa-gap" role="status">{{ message }}</p>

    <template v-if="result">
      <div class="title-row">
        <h2>{{ t("pa.snapshots") }}</h2>
        <small>{{ t("pa.tapEvidence") }}</small>
      </div>
      <div class="surface pa-list">
        <details v-for="item in platforms" :key="item.id" class="disclosure">
          <summary>
            <PlatformMark :platform-id="item.id" :name="item.name" />
            <span class="pa-name">
              <span class="disclosure-title">{{ item.name }}</span>
              <span class="disclosure-sub" translate="no">{{
                crawlerById(item.crawlerIds[0] ?? "")?.token ?? t("access.state.unsupported")
              }}</span>
            </span>
            <span v-if="item.supportLevel === 'unsupported'" class="badge">{{
              t("access.state.unsupported")
            }}</span>
            <span
              v-else
              class="badge"
              :class="tone(lead(item), isPreference(item.crawlerIds[0]))"
              >{{ label(lead(item), isPreference(item.crawlerIds[0])) }}</span
            >
          </summary>
          <div class="inside pa-evidence">
            <p v-for="id in item.crawlerIds" :key="id">
              <strong translate="no">{{ crawlerById(id)?.token }}</strong>
              {{ label(verdicts.get(id), isPreference(id)) }}
              <code v-if="verdicts.get(id)?.rule">{{ verdicts.get(id)?.rule }}</code>
            </p>
            <p v-if="!item.crawlerIds.length">{{ t("access.note.yahoo") }}</p>
          </div>
        </details>
      </div>
    </template>
    <p class="note pa-gap">
      <strong>{{ t("pa.accessNoteTitle") }}</strong> {{ t("pa.accessNote") }}
    </p>
  </template>

  <template v-else-if="tab === 'readiness'">
    <div class="title-row">
      <h2>{{ t("ready.title") }}</h2>
      <small>{{ t("pa.localObservations") }}</small>
    </div>
    <template v-if="report">
      <div class="grid3">
        <div class="mini-tile">
          <strong class="status-green">{{ n(totals.completed) }}</strong
          ><span>{{ t("pa.checked") }}</span>
        </div>
        <div class="mini-tile">
          <strong :class="{ 'status-amber': totals.opportunities }">{{
            n(totals.opportunities)
          }}</strong
          ><span>{{ t("pa.review") }}</span>
        </div>
        <div class="mini-tile">
          <strong>{{ n(totals.notMeasured) }}</strong
          ><span>{{ t("ready.stat.notMeasured") }}</span>
        </div>
      </div>
      <div class="title-row">
        <h2>{{ t("pa.areas") }}</h2>
        <small>{{ t("pa.noScore") }}</small>
      </div>
      <div class="surface pa-list">
        <div v-for="group in groups" :key="group.id" class="row pa-row">
          <span class="row-title">{{ t(groupKey[group.id]) }}</span>
          <span
            class="badge"
            :class="{ warn: group.state === 'review', ok: group.state === 'observed' }"
            >{{
              group.state === "review"
                ? t("pa.reviewCount", { count: n(group.summary.opportunities) })
                : group.state === "observed"
                  ? t("pa.observed")
                  : t("ready.stat.notMeasured")
            }}</span
          >
        </div>
      </div>
    </template>
    <p v-else class="note" role="status">{{ t("ready.empty.body") }}</p>
    <p class="note pa-gap">{{ t("pa.readyNote") }}</p>
  </template>

  <template v-else>
    <div class="title-row">
      <h2>{{ t("pa.journal") }}</h2>
      <small>{{ t("pa.manual") }}</small>
    </div>
    <div class="pa-callout">
      <strong>{{ t("pa.visTitle") }}</strong>
      <span>{{ t("pa.visText") }}</span>
    </div>
    <div class="title-row">
      <h2>{{ t("pa.recent") }}</h2>
      <small>{{ t("pa.entries", { count: n(journal.observations.length) }) }}</small>
    </div>
    <div v-if="recent.length" class="surface pa-list">
      <div v-for="entry in recent" :key="entry.item.id" class="row pa-row">
        <PlatformMark
          :platform-id="entry.platform?.platformId ?? ''"
          :name="entry.platform?.name ?? entry.item.platformId"
        />
        <span class="row-content">
          <span class="row-title">{{ entry.platform?.name ?? entry.item.platformId }}</span>
          <span class="row-sub">“{{ entry.query }}” · {{ entry.item.observedOn }}</span>
        </span>
        <span class="badge" :class="{ ok: entry.item.status === 'cited' }">{{
          t(statusKey[entry.item.status])
        }}</span>
      </div>
    </div>
    <p v-else class="note">{{ t("visibility.empty.body") }}</p>
    <div class="actions">
      <button type="button" class="button-sm" @click="emit('report', 'ai-search')">
        {{ t("pa.record") }} ↗
      </button>
    </div>
    <p class="note pa-gap">{{ t("pa.visNote") }}</p>
  </template>
</template>
