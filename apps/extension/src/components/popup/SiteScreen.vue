<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { CRAWL_LIMITS } from "../../services/site-crawl";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ report: [section?: string] }>();
const { t, n } = useI18n();

const host = computed(() => {
  try {
    return new URL(props.audit.page.url).hostname.replace(/^www\./, "");
  } catch {
    return props.audit.page.url;
  }
});
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.site") }}</span
    ><span class="minor">{{ t("pm.reportCrawl") }}</span>
  </div>
  <section class="navy">
    <div class="pair">
      <div>
        <span class="tiny-label">{{ t("site.title") }}</span>
        <strong class="row-title nv-strong" style="font-size: 17px; margin: 8px 0 4px">{{
          host
        }}</strong>
        <span class="nv" style="font-size: 10px">{{ t("pm.crawlReady") }}</span>
      </div>
      <span class="badge nv-badge">{{
        t("pm.pageLimit", { count: n(CRAWL_LIMITS.maxPages) })
      }}</span>
    </div>
    <div class="stat-grid divide">
      <div class="stat-item">
        <strong style="font-size: 20px">–</strong><span>{{ t("pm.fetched") }}</span>
      </div>
      <div class="stat-item">
        <strong style="font-size: 20px">–</strong><span>{{ t("pm.listed") }}</span>
      </div>
      <div class="stat-item">
        <strong style="font-size: 20px">–</strong><span>{{ t("pm.failed") }}</span>
      </div>
    </div>
    <div style="margin-top: 15px">
      <div class="pair nv" style="margin-bottom: 7px; font-size: 9px">
        <span>{{ t("pm.crawlBudget") }}</span>
        <span>{{ t("pm.pages", { count: n(CRAWL_LIMITS.maxPages) }) }}</span>
      </div>
      <div class="progress navy-track"><i style="width: 0%" /></div>
    </div>
    <div class="actions" style="margin-top: 15px">
      <button type="button" class="button-sm btn-light" @click="emit('report', 'site')">
        ▶ {{ t("pm.startInReport") }}
      </button>
      <button type="button" class="button-sm btn-ghost" disabled>■ {{ t("pm.stop") }}</button>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("pm.inspectedPages") }}</h2>
    <span class="badge">{{ t("pm.noneYet") }}</span>
  </div>
  <label for="site-search" class="field-label">{{ t("pm.findPage") }}</label>
  <input id="site-search" class="field" :placeholder="t('pm.searchPath')" disabled />
  <p class="note" style="margin-top: 12px">{{ t("pane.crawlInReport") }}</p>
  <p class="note" style="margin-top: 13px">{{ t("pm.crawlNote") }}</p>
</template>
