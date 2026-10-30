<script setup lang="ts">
import { browser } from "wxt/browser";
import type { AuditResult } from "../../types/audit";
import { brandConfig } from "../../config/brand.config";
import type { ThemePreference } from "../../config/theme.config";
import type { InspectionMode } from "../../adapters/storage";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";

defineOptions({ inheritAttrs: false });
defineProps<{
  audit: AuditResult;
  preference: ThemePreference;
  inspectionMode: InspectionMode | null;
  automaticAccessGranted: boolean;
}>();
const emit = defineEmits<{
  theme: [value: ThemePreference];
  automatic: [];
  inspectionMode: [value: InspectionMode];
  revokeAccess: [];
}>();
const { t } = useI18n();
const version = browser.runtime.getManifest().version;

const THEME_ORDER: ThemePreference[] = ["light", "dark", "system"];
const label: Record<ThemePreference, MessageKey> = {
  light: "settings.light",
  dark: "settings.dark",
  system: "settings.system",
};

function confirmRevoke() {
  if (window.confirm(t("permission.confirmRevoke"))) emit("revokeAccess");
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.settings") }}</span
    ><span class="minor">{{ t("pm.thisDevice") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.yourWorkspace") }}</h2>
  </div>
  <p class="helper">{{ t("settings.appearanceHelp") }}</p>
  <div class="surface">
    <div class="pair">
      <div>
        <strong class="row-title">{{ t("settings.theme") }}</strong>
        <p class="row-sub">{{ t("pm.themeSub") }}</p>
      </div>
      <span class="badge">{{ t("pm.local") }}</span>
    </div>
    <div class="segmented" style="margin-top: 14px" :aria-label="t('settings.theme')">
      <button
        v-for="option in THEME_ORDER"
        :key="option"
        type="button"
        class="segment"
        :aria-pressed="preference === option"
        @click="emit('theme', option as ThemePreference)"
      >
        {{ t(label[option as ThemePreference]) }}
      </button>
    </div>
  </div>

  <div class="title-row">
    <h2>{{ t("permission.modeTitle") }}</h2>
  </div>
  <div class="surface">
    <p class="row-sub">{{ t("permission.modeHelp") }}</p>
    <p class="micro">{{ t("permission.autoDisclosure", { name: brandConfig.identity.name }) }}</p>
    <div
      class="segmented inspection-mode-segmented"
      style="margin-top: 14px"
      :aria-label="t('permission.modeTitle')"
    >
      <button
        type="button"
        class="segment"
        :aria-pressed="inspectionMode === 'automatic'"
        @click="emit('automatic')"
      >
        {{ t("permission.modeAutomatic") }}
      </button>
      <button
        type="button"
        class="segment"
        :aria-pressed="inspectionMode === 'individual'"
        @click="emit('inspectionMode', 'individual')"
      >
        {{ t("permission.modeIndividual") }}
      </button>
    </div>
    <div class="pair" style="margin-top: 14px">
      <span class="row-sub">{{
        automaticAccessGranted ? t("permission.accessGranted") : t("permission.accessNotGranted")
      }}</span>
      <button
        v-if="automaticAccessGranted"
        type="button"
        class="button-sm danger permission-revoke"
        @click="confirmRevoke"
      >
        {{ t("permission.revokeAccess") }}
      </button>
    </div>
  </div>

  <div class="title-row">
    <h2>{{ t("pm.extensionBehavior") }}</h2>
  </div>
  <div class="surface" style="padding: 0 12px">
    <div class="row">
      <div class="row-content">
        <strong class="row-title">{{ t("pm.localHistory") }}</strong>
        <p class="row-sub">{{ t("settings.historyManual") }}</p>
      </div>
      <span class="badge ok">{{ t("pm.manual") }}</span>
    </div>
    <div class="row">
      <div class="row-content">
        <strong class="row-title">{{ t("pm.optionalNetwork") }}</strong>
        <p class="row-sub">{{ t("settings.networkOptIn") }}</p>
      </div>
      <span class="badge">{{ t("pm.optIn") }}</span>
    </div>
    <div class="row">
      <div class="row-content">
        <strong class="row-title">{{ t("pm.dataCollection") }}</strong>
        <p class="row-sub">{{ t("settings.noTelemetry") }}</p>
      </div>
      <span class="badge ok">{{ t("pm.none") }}</span>
    </div>
  </div>

  <div class="title-row">
    <h2>{{ t("pm.about", { name: brandConfig.identity.name }) }}</h2>
  </div>
  <div class="soft">
    <div class="pair">
      <span class="row-title">{{ t("pm.version") }}</span
      ><span class="badge">{{ version }}</span>
    </div>
    <div class="mini-divider" />
    <div class="pair">
      <span class="row-title">{{ t("pm.license") }}</span
      ><span class="row-sub">{{ t("pm.licenseValue") }}</span>
    </div>
    <p class="micro" style="margin: 11px 0 0">{{ brandConfig.identity.tagline }}</p>
  </div>
</template>
