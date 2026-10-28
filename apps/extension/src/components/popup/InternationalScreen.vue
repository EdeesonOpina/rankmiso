<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ report: [section?: string] }>();
const { t, n } = useI18n();

const entries = computed(() => props.audit.details.hreflang);
const invalid = computed(() => entries.value.filter((entry) => !entry.validSyntax).length);
const pageLanguage = computed(() => props.audit.page.language?.trim() || "");

function languageName(tag: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

function markText(tag: string): string {
  if (tag.toLowerCase() === "x-default") return "↗";
  const parts = tag.split("-");
  return (parts[1] ?? parts[0] ?? "").slice(0, 2).toUpperCase();
}

function sameLanguage(tag: string): boolean {
  const page = pageLanguage.value.toLowerCase().split("-")[0];
  return Boolean(page) && tag.toLowerCase().split("-")[0] === page;
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.international") }}</span><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.languageTargeting") }}</h2>
    <span class="badge">{{ t(entries.length === 1 ? "pm.alternate" : "pm.alternates", { count: n(entries.length) }) }}</span>
  </div>
  <section class="surface">
    <div class="pair">
      <div>
        <span class="tiny-label">{{ t("pm.primaryLanguage") }}</span>
        <strong class="metric-2" style="display: block; margin-top: 8px; font-size: 31px">{{
          pageLanguage || "–"
        }}</strong>
        <span class="micro">{{
          pageLanguage ? languageName(pageLanguage) : t("international.notDeclared")
        }}</span>
      </div>
      <div class="mini-tile tile-plain">
        <strong>{{ n(entries.length) }}</strong><span>{{ t("pm.hreflangEntries") }}</span>
      </div>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("pm.alternatePages") }}</h2>
    <span class="micro">{{ t("pm.returnSeparate") }}</span>
  </div>
  <div v-if="entries.length" class="surface" style="padding: 0 12px">
    <div v-for="entry in entries" :key="`${entry.lang}-${entry.href}`" class="row">
      <span
        class="mark"
        :class="!entry.validSyntax ? 'error' : sameLanguage(entry.lang) ? 'green' : 'blue'"
        aria-hidden="true"
        >{{ markText(entry.lang) }}</span
      >
      <div class="row-content">
        <strong class="row-title">{{
          entry.lang.toLowerCase() === "x-default"
            ? t("pm.defaultLanguage")
            : `${languageName(entry.lang)} · ${entry.lang}`
        }}</strong>
        <p class="link-url">{{ entry.href }}</p>
        <span v-if="!entry.validSyntax" class="badge err" style="margin-top: 5px">{{
          t("value.invalid")
        }}</span>
        <span v-else-if="entry.lang.toLowerCase() === 'x-default'" class="badge" style="margin-top: 5px"
          >x-default</span
        >
        <span v-else class="badge" style="margin-top: 5px">{{ t("pm.returnNotChecked") }}</span>
      </div>
    </div>
  </div>
  <p v-else class="note">{{ t("empty.hreflangBody") }}</p>
  <div class="note" style="margin-top: 13px">{{ t("pm.returnNote") }}</div>

  <div class="title-row"><h2>{{ t("pm.validationNotes") }}</h2></div>
  <div class="row">
    <span class="mark" :class="{ green: !invalid, error: invalid }" aria-hidden="true">{{
      invalid ? "!" : "✓"
    }}</span>
    <div class="row-content">
      <strong class="row-title">{{ t("pm.syntaxTitle") }}</strong>
      <p class="row-sub">{{
        !entries.length
          ? t("pm.noHreflang")
          : invalid
            ? t("pm.invalidTags", { count: n(invalid) })
            : t("pm.validTags", { count: n(entries.length) })
      }}</p>
    </div>
  </div>
  <button type="button" class="button-sm" @click="emit('report', 'international')">
    {{ t("pm.inspectReciprocal") }} ↗
  </button>
</template>
