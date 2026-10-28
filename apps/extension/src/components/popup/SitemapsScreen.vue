<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ report: [section?: string] }>();
const { t, n } = useI18n();

// Sitemaps are read only after the optional site check; the popup never starts discovery.
const site = computed(() => props.audit.details.site);
const ran = computed(() => site.value.requested);
const findings = computed(
  () =>
    props.audit.checks.filter(
      (check) => check.id.includes("sitemap") && (check.status === "ERROR" || check.status === "WARNING"),
    ).length,
);
const fileName = (url: string) => {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() || url;
  } catch {
    return url;
  }
};
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.sitemaps") }}</span><span class="minor">{{ t("pm.sameOrigin") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("pm.sitemapExplorer") }}</h2>
    <button type="button" class="button-sm" @click="emit('report', 'sitemaps')">
      {{ t("pm.discover") }} ↗
    </button>
  </div>
  <div class="grid3">
    <div class="mini-tile">
      <strong>{{ ran ? n(site.sitemapUrls.length) : "–" }}</strong><span>{{ t("pm.files") }}</span>
    </div>
    <div class="mini-tile">
      <strong>{{ ran && site.sitemapUrlCount != null ? n(site.sitemapUrlCount) : "–" }}</strong
      ><span>{{ t("pm.urls") }}</span>
    </div>
    <div class="mini-tile">
      <strong :class="{ 'status-amber': findings }">{{ ran ? n(findings) : "–" }}</strong
      ><span>{{ t("pm.findings") }}</span>
    </div>
  </div>
  <div class="soft" style="margin-top: 12px">
    <div class="pair">
      <span class="row-title">{{ t("pm.currentPage") }}</span>
      <span
        class="badge"
        :class="{ ok: site.sitemapContainsPage === true, warn: site.sitemapContainsPage === false }"
        >{{
          site.sitemapContainsPage == null
            ? t("technical.notChecked")
            : site.sitemapContainsPage
              ? t("pm.found")
              : t("pm.notFound")
        }}</span
      >
    </div>
    <p class="link-url" style="margin: 6px 0 0">{{ audit.page.url }}</p>
  </div>

  <div class="title-row">
    <h2>{{ t("pm.discoveredFiles") }}</h2>
    <span class="micro">{{ t("pm.sameOrigin") }}</span>
  </div>
  <div v-if="ran && site.sitemapUrls.length" class="surface" style="padding: 0 12px">
    <div v-for="url in site.sitemapUrls" :key="url" class="row">
      <span class="mark blue" aria-hidden="true">↳</span>
      <span class="row-content">
        <strong class="row-title">{{ fileName(url) }}</strong>
        <span class="row-sub link-url blk">{{ url }}</span>
      </span>
      <span class="badge ok">{{ t("pm.read") }}</span>
    </div>
  </div>
  <p v-else class="note">{{ t("pane.sitemapInReport") }}</p>

  <div class="title-row"><h2>{{ t("pm.urlsInFiles") }}</h2></div>
  <label class="field-label" for="sitemap-search">{{ t("pm.searchSitemapUrls") }}</label>
  <input id="sitemap-search" class="field" :placeholder="t('pm.findPath')" disabled />
  <p class="note" style="margin-top: 12px">{{ t("pm.sitemapUrlsInReport") }}</p>
  <p class="micro" style="margin-top: 13px">{{ t("pm.sitemapNote") }}</p>
</template>
