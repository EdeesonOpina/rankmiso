<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import { resolveShareImage } from "../../services/share-preview";
import { useI18n } from "../../composables/useI18n";

type PageImage = AuditResult["details"]["images"][number];

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const filter = ref<"all" | "missing">("all");
const limit = ref(8);
const failed = ref<Record<string, boolean>>({});

const images = computed(() => props.audit.details.images.map((image, index) => ({ image, key: `${index}` })));
const failedLoads = computed(() => props.audit.details.images.filter((image) => image.broken === true).length);
const rows = computed(() =>
  filter.value === "missing" ? images.value.filter((row) => !row.image.altPresent) : images.value,
);

function address(image: PageImage): string | null {
  return resolveShareImage(props.audit.page.url, image.src);
}

function fileName(src: string | null): string {
  if (!src) return t("pm.noSource");
  if (src.startsWith("data:")) return t("pm.inlineImage");
  try {
    return new URL(src, props.audit.page.url).pathname.split("/").filter(Boolean).pop() || src;
  } catch {
    return src;
  }
}

function size(image: PageImage): string {
  const width = image.naturalWidth ?? image.widthAttr;
  const height = image.naturalHeight ?? image.heightAttr;
  const dims = width != null && height != null ? `${n(width)} × ${n(height)}` : t("popup.notAvailable");
  return image.loading ? `${dims} · loading="${image.loading}"` : dims;
}

function altText(image: PageImage): string {
  if (!image.altPresent) return t("pm.altAbsent");
  if (!image.altValue.trim()) return t("pm.altEmptyNote");
  return image.altValue;
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.images") }}</span><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.imageInspector") }}</h2>
    <span class="badge">{{ t(audit.metrics.counts.images === 1 ? "pm.asset" : "pm.assets", { count: n(audit.metrics.counts.images) }) }}</span>
  </div>
  <div class="grid3" style="margin-bottom: 14px">
    <div class="mini-tile">
      <strong>{{ n(audit.metrics.counts.images) }}</strong><span>{{ t("popup.images") }}</span>
    </div>
    <div class="mini-tile">
      <strong :class="{ 'status-amber': audit.metrics.counts.imagesMissingAlt > 0 }">{{
        n(audit.metrics.counts.imagesMissingAlt)
      }}</strong
      ><span>{{ t("images.missingAltFilter") }}</span>
    </div>
    <div class="mini-tile">
      <strong>{{ n(failedLoads) }}</strong><span>{{ t("pm.failedLoads") }}</span>
    </div>
  </div>
  <div class="segmented">
    <button type="button" class="segment" :aria-pressed="filter === 'all'" @click="filter = 'all'">
      {{ t("filter.all") }}
    </button>
    <button
      type="button"
      class="segment"
      :aria-pressed="filter === 'missing'"
      @click="filter = 'missing'"
    >
      {{ t("images.missingAltFilter") }}
    </button>
  </div>
  <p v-if="!rows.length" class="note" style="margin-top: 12px">
    {{ images.length ? t("images.noMatch") : t("empty.imagesBody") }}
  </p>
  <div v-for="row in rows.slice(0, limit)" :key="row.key" class="row">
    <img
      v-if="address(row.image) && !failed[row.key]"
      class="img-thumb"
      :src="address(row.image) ?? undefined"
      :alt="row.image.altValue"
      loading="lazy"
      @error="failed[row.key] = true"
    />
    <span v-else class="img-thumb thumb-empty" aria-hidden="true">▧</span>
    <div class="row-content">
      <strong class="row-title">{{ fileName(row.image.src) }}</strong>
      <p class="row-sub">{{ failed[row.key] ? t("pm.thumbFailed") : altText(row.image) }}</p>
      <span v-if="failed[row.key]" class="badge" style="margin-top: 6px">{{
        t("pm.previewUnavailable")
      }}</span>
      <span v-else-if="!row.image.altPresent" class="badge warn" style="margin-top: 6px">{{
        t("images.missingAltFilter")
      }}</span>
      <span v-else-if="!row.image.altValue.trim()" class="badge" style="margin-top: 6px">{{
        t("value.emptyAlt")
      }}</span>
      <span v-else class="badge ok" style="margin-top: 6px">{{ t("popup.altPresent") }}</span>
      <details v-if="!failed[row.key]" class="disclosure" style="margin-top: 5px">
        <summary class="tiny">{{ t("popup.imageDetails") }}</summary>
        <div class="inside">
          <p class="link-url">{{ row.image.src || t("metadata.none") }}</p>
          <p class="micro">{{ size(row.image) }}</p>
        </div>
      </details>
    </div>
  </div>
  <button
    v-if="rows.length > limit"
    type="button"
    class="text-btn"
    style="margin-top: 7px"
    @click="limit += 20"
  >
    {{ t("popup.moreImages", { count: n(rows.length - limit) }) }} ↗
  </button>
  <p class="micro" style="margin-top: 13px">{{ t("pm.imagesNote") }}</p>
</template>
