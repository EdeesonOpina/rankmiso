<script setup lang="ts">
import { ref } from "vue";
import { ArrowDownToLine, ShieldCheck } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import {
  exportAuditJson,
  exportChecksCsv,
  exportHeadingsCsv,
  exportHtmlReport,
  exportImagesCsv,
  exportLinksCsv,
} from "../../services/export";
import type { MessageKey } from "../../locales/en";
import { useI18n } from "../../composables/useI18n";
import PageHeading from "./PageHeading.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const pending = ref<string | null>(null);

const formats: Array<{
  id: string;
  glyph: string;
  title: MessageKey;
  sub: MessageKey;
  action: MessageKey;
  run: (audit: AuditResult) => void;
}> = [
  {
    id: "html",
    glyph: "HTML",
    title: "wb.ex.html",
    sub: "wb.ex.htmlSub",
    action: "action.exportHtml",
    run: exportHtmlReport,
  },
  {
    id: "json",
    glyph: "JSON",
    title: "wb.ex.json",
    sub: "wb.ex.jsonSub",
    action: "action.exportJson",
    run: exportAuditJson,
  },
  {
    id: "checks",
    glyph: "CSV",
    title: "wb.ex.checks",
    sub: "wb.ex.checksSub",
    action: "action.exportChecks",
    run: exportChecksCsv,
  },
  {
    id: "links",
    glyph: "CSV",
    title: "wb.ex.links",
    sub: "wb.ex.linksSub",
    action: "action.exportLinks",
    run: exportLinksCsv,
  },
  {
    id: "headings",
    glyph: "CSV",
    title: "wb.ex.headings",
    sub: "wb.ex.headingsSub",
    action: "action.exportHeadings",
    run: exportHeadingsCsv,
  },
  {
    id: "images",
    glyph: "CSV",
    title: "wb.ex.images",
    sub: "wb.ex.imagesSub",
    action: "action.exportImages",
    run: exportImagesCsv,
  },
];

function confirm() {
  const format = formats.find((item) => item.id === pending.value);
  pending.value = null;
  format?.run(props.audit);
}
</script>

<template>
  <PageHeading :overline="t('wb.ex.overline')" :title="t('wb.ex.title')" :text="t('wb.ex.text')" />
  <div class="formats">
    <button
      v-for="format in formats"
      :key="format.id"
      type="button"
      class="format-button"
      :class="{ 'is-pending': pending === format.id }"
      :aria-label="t(format.action)"
      :aria-expanded="pending === format.id"
      @click="pending = pending === format.id ? null : format.id"
    >
      <span class="file-glyph" aria-hidden="true">{{ format.glyph }}</span>
      <span>
        <strong>{{ t(format.title) }}</strong>
        <small>{{ t(format.sub) }}</small>
      </span>
      <ArrowDownToLine class="ic" aria-hidden="true" />
    </button>
  </div>
  <div v-if="pending" class="confirm-box" role="group" :aria-label="t('export.confirm')">
    <p>{{ t("export.confirm") }}</p>
    <div class="actions-row">
      <button type="button" class="primary" @click="confirm">
        {{ t("export.confirmAction") }}
      </button>
      <button type="button" class="secondary" @click="pending = null">
        {{ t("export.cancel") }}
      </button>
    </div>
  </div>
  <div class="callout">
    <ShieldCheck class="ic" aria-hidden="true" />
    <div>
      <strong>{{ t("wb.ex.privacy") }}</strong>
      <p>{{ t("wb.ex.privacyText") }}</p>
    </div>
  </div>
</template>
