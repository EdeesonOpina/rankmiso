<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ report: [section?: string] }>();
const { t, n } = useI18n();

const meta = computed(() => props.audit.details.metadata);
const response = computed(() => props.audit.details.response);
const xRobots = computed(() =>
  response.value.headersAvailable
    ? (response.value.headers.find((header) => header.name.toLowerCase() === "x-robots-tag")?.value ?? "")
    : null,
);
const hops = computed(() => props.audit.details.site.redirectHops);
const titlesDiffer = computed(() => {
  const raw = meta.value.rawTitles[0]?.trim();
  const rendered = meta.value.renderedTitle?.trim();
  return Boolean(raw && rendered && raw !== rendered);
});
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.technical") }}</span><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.technicalSignals") }}</h2>
    <span class="badge">{{ t("pane.evidence") }}</span>
  </div>
  <div class="surface" style="padding: 0 13px">
    <div class="row">
      <span class="mark" :class="{ green: meta.robots.length }" aria-hidden="true">{{
        meta.robots.length ? "✓" : "i"
      }}</span>
      <span class="row-content">
        <strong class="row-title">{{ t("pm.robotsDirectives") }}</strong>
        <span class="row-sub">{{
          meta.robots.length ? t("pm.observedInMeta", { value: meta.robots.join(", ") }) : t("pm.notDeclared")
        }}</span>
      </span>
      <span class="badge" :class="{ ok: meta.robots.length }">{{
        meta.robots.length ? t("pm.seen") : t("pm.notDeclared")
      }}</span>
    </div>
    <div class="row">
      <span class="mark" :class="{ green: meta.canonicals.length === 1 }" aria-hidden="true">{{
        meta.canonicals.length === 1 ? "✓" : "!"
      }}</span>
      <span class="row-content">
        <strong class="row-title">{{ t("pm.canonicalDeclarations") }}</strong>
        <span class="row-sub">{{ t("pm.canonicalCount", { count: n(meta.canonicals.length) }) }}</span>
      </span>
      <span class="badge" :class="meta.canonicals.length === 1 ? 'ok' : 'warn'">{{
        meta.canonicals.length === 1 ? t("pm.seen") : t("pm.review")
      }}</span>
    </div>
    <div class="row">
      <span class="mark blue" aria-hidden="true">i</span>
      <span class="row-content">
        <strong class="row-title">{{ t("pm.indexStatus") }}</strong>
        <span class="row-sub">{{ t("pm.indexStatusSub") }}</span>
      </span>
      <span class="badge">{{ t("pm.unknown") }}</span>
    </div>
    <div class="row">
      <span class="mark blue" aria-hidden="true">i</span>
      <span class="row-content">
        <strong class="row-title">X-Robots-Tag</strong>
        <span class="row-sub">{{
          xRobots == null ? t("pm.responseNotRun") : xRobots || t("pm.notDeclared")
        }}</span>
      </span>
      <span class="badge" :class="{ ok: xRobots }">{{
        xRobots == null ? t("technical.notChecked") : xRobots ? t("pm.seen") : t("pm.notDeclared")
      }}</span>
    </div>
  </div>

  <div class="title-row">
    <h2>{{ t("pm.htmlComparison") }}</h2>
    <button type="button" class="button-sm" @click="emit('report', 'technical')">
      {{ t("pm.compare") }} ↗
    </button>
  </div>
  <p class="helper">{{ t("pm.compareHelp") }}</p>
  <div class="surface">
    <div class="pair">
      <div>
        <span class="tiny-label">{{ t("pm.documentTitle") }}</span>
        <strong class="row-title" style="margin-top: 4px">{{
          titlesDiffer ? t("pm.changed") : t("pm.notCompared")
        }}</strong>
      </div>
      <span class="badge" :class="{ warn: titlesDiffer }">{{
        titlesDiffer ? t("pm.difference") : t("pm.inReport")
      }}</span>
    </div>
    <div class="mini-divider" />
    <div class="soft">
      <span class="tiny-label">{{ t("pm.titleElement") }}</span>
      <p style="font-size: 11px; margin: 6px 0 10px; line-height: 1.45">
        {{ meta.rawTitles[0] || t("metadata.missing") }}
      </p>
      <span class="tiny-label">{{ t("pm.renderedDom") }}</span>
      <p style="font-size: 11px; margin: 6px 0 0; line-height: 1.45">
        {{ meta.renderedTitle || t("metadata.missing") }}
      </p>
    </div>
    <div class="pair" style="margin-top: 12px">
      <span class="row-sub">{{ t("pm.moreProperties") }}</span>
      <button type="button" class="text-btn" @click="emit('report', 'technical')">
        {{ t("pm.explore") }} ↗
      </button>
    </div>
  </div>

  <div class="title-row"><h2>{{ t("pm.redirectTrace") }}</h2></div>
  <div v-if="hops.length || response.status != null" class="timeline">
    <div v-for="(hop, index) in hops" :key="`${hop}-${index}`" class="t-row">
      <div class="t-code ok">↪</div>
      <div class="t-content"><strong>{{ hop }}</strong><small>{{ t("pm.observedRedirect") }}</small></div>
    </div>
    <div v-if="response.status != null" class="t-row">
      <div class="t-code ok">{{ response.status }}</div>
      <div class="t-content">
        <strong>{{ audit.page.url }}</strong><small>{{ t("pm.finalResponse") }}</small>
      </div>
    </div>
  </div>
  <p v-else class="note">{{ t("pm.noRedirectData") }}</p>
</template>
