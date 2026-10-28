<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from "vue";
import { browser } from "wxt/browser";
import type { AuditResult } from "../../types/audit";
import { supportsOptionalExternalChecks } from "../../config/features.config";
import { readPageSpeedApiKey, savePageSpeedApiKey } from "../../adapters/storage";
import { requestPageSpeedInsights, type PageSpeedResult } from "../../services/pagespeed";
import {
  readInpCapture,
  startInpCapture,
  stopInpCapture,
  type InpCaptureSnapshot,
} from "../../services/inspect";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";
import DataRow from "./DataRow.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { tabId, refresh } = useWorkbench();
const keyId = useId();
const perf = computed(() => props.audit.details.performance);
const capture = ref<InpCaptureSnapshot | null>(null);
const captureMessage = ref("");
const apiKey = ref("");
const psi = ref<PageSpeedResult | null>(null);
const psiStatus = ref<"idle" | "loading" | "error">("idle");
const psiMessage = ref("");

function seconds(ms: number | null): string {
  return ms == null ? "–" : `${n(Math.round(ms / 10) / 100)}s`;
}

watch(
  tabId,
  (id) => {
    capture.value = null;
    captureMessage.value = "";
    if (id)
      void readInpCapture(id)
        .then((value) => (capture.value = value))
        .catch(() => undefined);
  },
  { immediate: true },
);

onMounted(() => {
  if (supportsOptionalExternalChecks)
    void readPageSpeedApiKey()
      .then((key) => (apiKey.value = key))
      .catch(() => undefined);
});

async function toggleCapture() {
  const id = tabId.value;
  if (!id) return;
  try {
    const next = capture.value?.active ? await stopInpCapture(id) : await startInpCapture(id);
    capture.value = next;
    if (!next.supported) captureMessage.value = t("performance.captureUnsupported");
    else if (next.active) captureMessage.value = t("performance.captureStarted");
    else {
      captureMessage.value = t("performance.captureStopped");
      await refresh();
    }
  } catch {
    captureMessage.value = t("performance.captureFailed");
  }
}

async function saveKey() {
  try {
    await savePageSpeedApiKey(apiKey.value);
    psiMessage.value = t("performance.psiSaved");
  } catch {
    psiMessage.value = t("performance.psiFailed");
  }
}

async function runPsi() {
  if (!supportsOptionalExternalChecks || psiStatus.value === "loading") return;
  psiMessage.value = "";
  psi.value = null;
  if (!apiKey.value.trim()) {
    psiStatus.value = "error";
    psiMessage.value = t("performance.psiNeedsKey");
    return;
  }
  try {
    const granted = await browser.permissions.request({
      origins: ["https://www.googleapis.com/*"],
    });
    if (!granted) {
      psiStatus.value = "error";
      psiMessage.value = t("performance.psiPermission");
      return;
    }
    psiStatus.value = "loading";
    psi.value = await requestPageSpeedInsights(props.audit.page.url, apiKey.value.trim());
  } catch {
    psiStatus.value = "error";
    psiMessage.value = t("performance.psiFailed");
  } finally {
    if (psiStatus.value === "loading") psiStatus.value = "idle";
  }
}
</script>

<template>
  <PageHeading
    :overline="t('wb.pf.overline')"
    :title="t('nav.performance')"
    :text="t('wb.pf.text')"
  />
  <div class="perf-grid">
    <div class="kpi">
      <strong>{{ seconds(perf.lcpMs) }}</strong
      ><span>LCP</span>
      <small>{{ perf.lcpMs == null ? t("status.unavailable") : t("wb.pf.sample") }}</small>
    </div>
    <div class="kpi">
      <strong>{{ perf.cls == null ? "–" : n(perf.cls) }}</strong
      ><span>CLS</span>
      <small>{{ perf.cls == null ? t("status.unavailable") : t("wb.pf.sample") }}</small>
    </div>
    <div class="kpi">
      <strong>{{ perf.inpMs == null ? "–" : `${n(perf.inpMs)}ms` }}</strong
      ><span>INP</span>
      <small>{{ perf.inpMs == null ? t("status.unavailable") : t("wb.observed") }}</small>
    </div>
    <div class="kpi">
      <strong>{{ seconds(perf.domContentLoadedMs) }}</strong
      ><span>DCL</span>
      <small>{{
        perf.domContentLoadedMs == null ? t("status.unavailable") : t("wb.observed")
      }}</small>
    </div>
  </div>
  <div class="section-heading">
    <div>
      <h2>{{ t("wb.pf.coverage") }}</h2>
    </div>
  </div>
  <DataRow
    :title="t('wb.pf.lcp')"
    :sub="t('wb.pf.local')"
    :tone="perf.lcpMs == null ? 'gray' : 'good'"
    :badge="perf.lcpMs == null ? t('status.unavailable') : t('wb.measured')"
    :badge-tone="perf.lcpMs == null ? 'gray' : 'ok'"
  />
  <DataRow
    :title="t('wb.pf.inp')"
    :sub="perf.inpMs == null ? t('wb.pf.noInteraction') : t('wb.pf.local')"
    :tone="perf.inpMs == null ? 'gray' : 'good'"
    :badge="perf.inpMs == null ? t('status.unavailable') : t('wb.measured')"
    :badge-tone="perf.inpMs == null ? 'gray' : 'ok'"
  />
  <DataRow
    :title="t('wb.pf.field')"
    :sub="t('wb.pf.fieldSub')"
    tone="gray"
    :badge="t('wb.pf.unavailable')"
  />
  <DataRow
    :title="t('performance.psiTitle')"
    :sub="psi ? t('wb.pf.psiDone') : t('wb.pf.psiSub')"
    :tone="psi ? 'good' : 'gray'"
    :badge="psi ? t('wb.measured') : t('technical.notChecked')"
    :badge-tone="psi ? 'ok' : 'gray'"
  />
  <p v-for="note in perf.notes" :key="note" class="hint">{{ note }}</p>

  <WbCard :title="t('performance.captureTitle')" class="spaced">
    <p class="hint first">{{ t("performance.captureHelp") }}</p>
    <div class="actions-row">
      <button
        type="button"
        class="quiet"
        :disabled="capture?.supported === false"
        @click="toggleCapture"
      >
        {{ capture?.active ? t("performance.captureStop") : t("performance.captureStart") }}
      </button>
    </div>
    <p v-if="captureMessage" class="hint" role="status">{{ captureMessage }}</p>
    <p v-else-if="capture?.active" class="hint" role="status">
      {{ t("performance.captureRunning") }}
    </p>
  </WbCard>

  <WbCard v-if="supportsOptionalExternalChecks" :title="t('performance.psiTitle')">
    <p class="hint first">{{ t("performance.psiPrivacy") }}</p>
    <div class="form-stack">
      <label :for="keyId">{{ t("performance.psiKey") }}</label>
      <input :id="keyId" v-model="apiKey" class="field" type="password" autocomplete="off" />
      <a
        class="subtle-btn"
        href="https://developers.google.com/speed/docs/insights/v5/get-started"
        target="_blank"
        rel="noreferrer"
      >
        {{ t("performance.psiKeyHelp") }} ↗
      </a>
    </div>
    <div class="actions-row">
      <button type="button" class="quiet" @click="saveKey">
        {{ t("performance.psiSaveKey") }}
      </button>
      <button type="button" class="quiet" :disabled="psiStatus === 'loading'" @click="runPsi">
        {{ psiStatus === "loading" ? t("performance.psiRunning") : t("performance.psiRun") }}
      </button>
    </div>
    <p v-if="psiMessage" class="hint" role="status">{{ psiMessage }}</p>
    <div v-if="psi" class="properties">
      <div class="property">
        <span>{{ t("performance.psiScore") }}</span
        ><strong>{{ psi.performanceScore ?? t("value.unavailable") }}</strong>
      </div>
      <div class="property">
        <span>{{ t("performance.psiLcp") }}</span>
        <strong>{{
          psi.lcpMs == null
            ? t("value.unavailable")
            : `${n(psi.lcpMs)} ${t("performance.milliseconds")}`
        }}</strong>
      </div>
      <div class="property">
        <span>{{ t("performance.psiCls") }}</span
        ><strong>{{ psi.cls ?? t("value.unavailable") }}</strong>
      </div>
      <p class="hint">{{ t("performance.psiAttribution") }}</p>
    </div>
  </WbCard>
  <p v-else class="callout" role="note">{{ t("performance.firefoxPsiDisabled") }}</p>
  <RelatedChecks :audit="audit" category="performance" />
</template>
