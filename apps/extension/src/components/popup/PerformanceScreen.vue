<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ report: [section?: string] }>();
const { t, n } = useI18n();

const perf = computed(() => props.audit.details.performance);

function seconds(ms: number | null): string {
  return ms == null ? "–" : n(Math.round(ms / 10) / 100);
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.performance") }}</span
    ><span class="minor">{{ t("pm.thisLoad") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("pm.browserObservations") }}</h2>
    <span class="badge">{{ t("pane.notField") }}</span>
  </div>
  <section class="navy">
    <span class="tiny-label">{{ t("pm.observedLcp") }}</span>
    <div class="metric-line" style="margin-top: 11px">
      <strong class="nv-strong" style="font-size: 48px"
        >{{ seconds(perf.lcpMs) }}<span v-if="perf.lcpMs != null" class="unit">s</span></strong
      >
      <span class="nv">{{
        perf.lcpMs == null ? t("status.unavailable") : t("pm.thisLoadLower")
      }}</span>
    </div>
    <p class="nv" style="font-size: 10px; line-height: 1.6; margin-bottom: 0">
      {{ t("pm.perfNote") }}
    </p>
    <div class="stat-grid divide">
      <div class="stat-item">
        <strong style="font-size: 18px">{{
          perf.cls == null ? "–" : n(Math.round(perf.cls * 100) / 100)
        }}</strong
        ><span>CLS</span>
      </div>
      <div class="stat-item">
        <strong style="font-size: 18px">{{
          perf.inpMs == null ? "–" : `${n(Math.round(perf.inpMs))} ms`
        }}</strong
        ><span>INP</span>
      </div>
      <div class="stat-item">
        <strong style="font-size: 18px">{{
          perf.domContentLoadedMs == null ? "–" : `${seconds(perf.domContentLoadedMs)}s`
        }}</strong
        ><span>DCL</span>
      </div>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("pm.measurementAvailability") }}</h2>
  </div>
  <div class="surface" style="padding: 0 13px">
    <div class="row">
      <span
        class="mark"
        :class="perf.domContentLoadedMs != null ? 'green' : 'blue'"
        aria-hidden="true"
        >{{ perf.domContentLoadedMs != null ? "✓" : "i" }}</span
      >
      <div class="row-content">
        <strong class="row-title">{{ t("pm.navigationTiming") }}</strong>
        <p class="row-sub">
          {{ perf.domContentLoadedMs != null ? t("pm.availableHere") : t("pm.noTimingEntries") }}
        </p>
      </div>
      <span class="badge" :class="{ ok: perf.domContentLoadedMs != null }">{{
        perf.domContentLoadedMs != null ? t("pm.observed") : t("status.unavailable")
      }}</span>
    </div>
    <div class="row">
      <span class="mark" :class="perf.inpMs != null ? 'green' : 'blue'" aria-hidden="true">{{
        perf.inpMs != null ? "✓" : "i"
      }}</span>
      <div class="row-content">
        <strong class="row-title">{{ t("pm.interaction") }}</strong>
        <p class="row-sub">
          {{ perf.inpMs != null ? t("pm.availableHere") : t("pm.noInteraction") }}
        </p>
      </div>
      <span class="badge" :class="{ ok: perf.inpMs != null }">{{
        perf.inpMs != null ? t("pm.observed") : t("status.unavailable")
      }}</span>
    </div>
    <div class="row">
      <span class="mark blue" aria-hidden="true">i</span>
      <div class="row-content">
        <strong class="row-title">{{ t("pm.fieldVitals") }}</strong>
        <p class="row-sub">{{ t("pm.fieldVitalsSub") }}</p>
      </div>
      <span class="badge">{{ t("pm.unavailable") }}</span>
    </div>
  </div>

  <div class="title-row">
    <h2>{{ t("pm.optionalDiagnostics") }}</h2>
  </div>
  <div class="soft">
    <strong class="row-title">PageSpeed Insights</strong>
    <p class="helper" style="margin: 5px 0 11px">{{ t("pm.pagespeedHelp") }}</p>
    <button type="button" class="button-sm" @click="emit('report', 'performance')">
      {{ t("pm.setUpCheck") }} ↗
    </button>
  </div>
</template>
