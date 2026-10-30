<script setup lang="ts">
import { ref } from "vue";
import { browser } from "wxt/browser";
import type { AuditResult } from "../../types/audit";
import { brandConfig } from "../../config/brand.config";
import { themeConfig, type ThemePreference } from "../../config/theme.config";
import { clearStoredSettings } from "../../adapters/storage";
import type { MessageKey } from "../../locales/en";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";

defineProps<{ audit: AuditResult | null }>();
const { t } = useI18n();
const {
  preference,
  setPreference,
  inspectionMode,
  automaticAccessGranted,
  setInspectionMode,
  enableAutomaticChecks,
  revokeAutomaticAccess,
} = useWorkbench();
const version = browser.runtime.getManifest().version;
const note = ref("");
const order: ThemePreference[] = ["light", "dark", "system"];
const labels: Record<ThemePreference, MessageKey> = {
  light: "settings.light",
  dark: "settings.dark",
  system: "settings.system",
};

async function reset() {
  await clearStoredSettings();
  await setPreference(themeConfig.defaultPreference);
  await setInspectionMode("individual");
  note.value = t("settings.cleared");
}

function revokeAccess() {
  if (window.confirm(t("permission.confirmRevoke"))) {
    void revokeAutomaticAccess().then((removed) => {
      note.value = t(removed ? "permission.accessRevoked" : "permission.revokeError");
    });
  }
}
</script>

<template>
  <PageHeading :overline="t('wb.st.overline')" :title="t('nav.settings')" :text="t('wb.st.text')" />
  <div class="section-heading">
    <div>
      <h2>{{ t("settings.theme") }}</h2>
    </div>
  </div>
  <div class="settings-choices segmented" role="group" :aria-label="t('settings.theme')">
    <button
      v-for="option in order"
      :key="option"
      type="button"
      :class="{ on: preference === option }"
      :aria-pressed="preference === option"
      @click="setPreference(option)"
    >
      {{ t(labels[option]) }}
    </button>
  </div>
  <div class="section-heading">
    <div>
      <h2>{{ t("permission.modeTitle") }}</h2>
      <p class="inspection-mode-help">{{ t("permission.modeHelp") }}</p>
    </div>
  </div>
  <div class="settings-choices segmented" role="group" :aria-label="t('permission.modeTitle')">
    <button
      type="button"
      :class="{ on: inspectionMode === 'automatic' }"
      :aria-pressed="inspectionMode === 'automatic'"
      @click="enableAutomaticChecks"
    >
      {{ t("permission.modeAutomatic") }}
    </button>
    <button
      type="button"
      :class="{ on: inspectionMode === 'individual' }"
      :aria-pressed="inspectionMode === 'individual'"
      @click="setInspectionMode('individual')"
    >
      {{ t("permission.modeIndividual") }}
    </button>
  </div>
  <div class="setting-row">
    <div>
      <strong>{{ t("permission.modeTitle") }}</strong>
      <small>{{
        automaticAccessGranted ? t("permission.accessGranted") : t("permission.accessNotGranted")
      }}</small>
      <small>{{ t("permission.manageAccess") }}</small>
    </div>
    <button v-if="automaticAccessGranted" type="button" class="quiet" @click="revokeAccess">
      {{ t("permission.revokeAccess") }}
    </button>
  </div>
  <div class="section-heading">
    <div>
      <h2>{{ t("pm.extensionBehavior") }}</h2>
    </div>
  </div>
  <div class="setting-row">
    <div>
      <strong>{{ t("pm.localHistory") }}</strong
      ><small>{{ t("settings.historyManual") }}</small>
    </div>
    <span class="badge ok">{{ t("pm.manual") }}</span>
  </div>
  <div class="setting-row">
    <div>
      <strong>{{ t("pm.optionalNetwork") }}</strong
      ><small>{{ t("settings.networkOptIn") }}</small>
    </div>
    <span class="badge gray">{{ t("pm.optIn") }}</span>
  </div>
  <div class="setting-row">
    <div>
      <strong>{{ t("pm.dataCollection") }}</strong
      ><small>{{ t("settings.noTelemetry") }}</small>
    </div>
    <span class="badge ok">{{ t("pm.none") }}</span>
  </div>
  <div class="setting-row">
    <div>
      <strong>{{ t("settings.clear") }}</strong
      ><small>{{ t("settings.privacy") }}</small>
    </div>
    <button type="button" class="quiet" @click="reset">{{ t("settings.clear") }}</button>
  </div>
  <p v-if="note" class="hint" role="status">{{ note }}</p>
  <div class="section-heading">
    <div>
      <h2>{{ t("pm.about", { name: brandConfig.identity.name }) }}</h2>
    </div>
  </div>
  <div class="properties">
    <div class="property">
      <span>{{ t("pm.version") }}</span
      ><strong>{{ version }}</strong>
    </div>
    <div class="property">
      <span>{{ t("wb.st.rules") }}</span
      ><strong>{{ audit?.rulesetVersion ?? "–" }}</strong>
    </div>
    <div class="property">
      <span>{{ t("pm.license") }}</span
      ><strong>{{ t("pm.licenseValue") }}</strong>
    </div>
    <div class="property">
      <span>{{ t("wb.st.analytics") }}</span
      ><strong>{{ t("pm.noTelemetry") }}</strong>
    </div>
    <div class="property">
      <span>{{ brandConfig.identity.ecosystem }}</span>
      <strong>{{ t("settings.ecosystem", { ecosystem: brandConfig.identity.ecosystem }) }}</strong>
    </div>
  </div>
</template>
