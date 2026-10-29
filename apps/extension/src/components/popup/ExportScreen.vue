<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import { exportAuditJson, exportChecksCsv, exportHtmlReport } from "../../services/export";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const pending = ref<string | null>(null);

const formats: Array<{
  id: string;
  mark: string;
  tone: string;
  title: MessageKey;
  sub: MessageKey;
  action: MessageKey;
  run: (audit: AuditResult) => void;
}> = [
  {
    id: "json",
    mark: "{ }",
    tone: "blue",
    title: "pm.fmtJson",
    sub: "pm.fmtJsonSub",
    action: "action.exportJson",
    run: exportAuditJson,
  },
  {
    id: "checks",
    mark: "≡",
    tone: "green",
    title: "pm.fmtChecks",
    sub: "pm.fmtChecksSub",
    action: "action.exportChecks",
    run: exportChecksCsv,
  },
  {
    id: "html",
    mark: "↗",
    tone: "blue",
    title: "pm.fmtHtml",
    sub: "pm.fmtHtmlSub",
    action: "action.exportHtml",
    run: exportHtmlReport,
  },
];

const score = computed(() => props.audit.score);

function confirm(format: (typeof formats)[number]) {
  pending.value = null;
  format.run(props.audit);
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.export") }}</span
    ><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("pm.yourData") }}</h2>
  </div>
  <p class="helper">{{ t("pm.exportHelp") }}</p>
  <section class="navy">
    <div class="kicker">{{ t("pm.preparedLocally") }}</div>
    <strong class="row-title nv-strong" style="font-size: 17px">{{
      audit.page.title || t("metadata.untitled")
    }}</strong>
    <p class="nv" style="font-size: 10px; margin: 9px 0 0">
      {{ t("score.measured", { count: score.applicableChecks }) }}
    </p>
    <div class="stat-grid divide">
      <div class="stat-item">
        <strong>{{ score.available && score.value != null ? n(score.value) : "–" }}</strong
        ><span>{{ t("pm.score") }}</span>
      </div>
      <div class="stat-item">
        <strong class="status-amber">{{ n(score.warnings) }}</strong
        ><span>{{ t("score.warningName") }}</span>
      </div>
      <div class="stat-item">
        <strong>{{ n(score.passed) }}</strong
        ><span>{{ t("score.passedName") }}</span>
      </div>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("popup.chooseFormat") }}</h2>
  </div>
  <div class="surface" style="padding: 0 12px">
    <div v-for="format in formats" :key="format.id" class="row" style="flex-wrap: wrap">
      <span class="mark" :class="format.tone" aria-hidden="true">{{ format.mark }}</span>
      <div class="row-content">
        <strong class="row-title">{{ t(format.title) }}</strong>
        <p class="row-sub">{{ t(format.sub) }}</p>
      </div>
      <button
        type="button"
        class="button-sm"
        :aria-label="t(format.action)"
        :aria-expanded="pending === format.id"
        @click="pending = pending === format.id ? null : format.id"
      >
        {{ t("pm.export") }}
      </button>
      <div v-if="pending === format.id" class="soft" style="flex-basis: 100%; padding: 10px">
        <p class="helper" style="margin: 0">{{ t("export.confirm") }}</p>
        <div class="actions">
          <button type="button" class="button-sm red" @click="confirm(format)">
            {{ t("export.confirmAction") }}
          </button>
          <button type="button" class="button-sm" @click="pending = null">
            {{ t("export.cancel") }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="title-row">
    <h2>{{ t("pm.privacyControls") }}</h2>
  </div>
  <div class="soft">
    <strong class="row-title">{{ t("pm.beforeExporting") }}</strong>
    <p class="helper" style="margin: 6px 0 10px">{{ t("pm.exportSafety") }}</p>
    <div class="pair">
      <span class="badge ok">{{ t("pm.localFirst") }}</span>
      <span class="badge">{{ t("pm.noTelemetry") }}</span>
    </div>
  </div>
</template>
