<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ChevronDown, ImageOff } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import { resolveShareImage } from "../../services/share-preview";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import RelatedChecks from "./RelatedChecks.vue";

type PageImage = AuditResult["details"]["images"][number];

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { copy, highlight, clearMarks } = useWorkbench();
const filter = ref<"all" | "missing" | "alt" | "broken">("all");
const limit = ref(60);
const failed = reactive<Record<number, boolean>>({});
const expanded = reactive<Record<number, boolean>>({});
const images = computed(() => props.audit.details.images.map((image, index) => ({ image, index })));
const totals = computed(() => {
  const rows = props.audit.details.images;
  return {
    total: rows.length,
    missing: rows.filter((image) => !image.altPresent).length,
    empty: rows.filter((image) => image.altPresent && !image.altValue.trim()).length,
    withAlt: rows.filter((image) => image.altPresent && image.altValue.trim()).length,
    broken: rows.filter((image) => image.broken === true).length,
  };
});
const visible = computed(() =>
  images.value.filter(({ image }) => {
    if (filter.value === "missing") return !image.altPresent;
    if (filter.value === "alt") return image.altPresent && image.altValue.trim().length > 0;
    if (filter.value === "broken") return image.broken === true;
    return true;
  }),
);

function address(image: PageImage): string | null {
  return resolveShareImage(props.audit.page.url, image.src);
}

function fileName(src: string | null): string {
  if (!src) return t("pm.noSource");
  if (src.startsWith("data:")) return t("pm.inlineImage");
  try {
    return decodeURIComponent(
      new URL(src, props.audit.page.url).pathname.split("/").filter(Boolean).pop() || src,
    );
  } catch {
    return src;
  }
}

function altLine(image: PageImage): string {
  if (!image.altPresent) return t("wb.im.altMissing");
  if (!image.altValue.trim()) return t("wb.im.altEmpty");
  return t("wb.im.alt", { alt: image.altValue });
}

function dims(image: PageImage): string {
  const width = image.naturalWidth ?? image.widthAttr;
  const height = image.naturalHeight ?? image.heightAttr;
  return width != null && height != null ? `${n(width)}×${n(height)}` : t("wb.im.noSize");
}

function details(image: PageImage): string[] {
  const lines = [
    image.naturalWidth && image.naturalHeight
      ? t("images.intrinsic", { width: image.naturalWidth, height: image.naturalHeight })
      : t("images.intrinsicMissing"),
    image.renderedWidth && image.renderedHeight
      ? t("images.displayed", { width: image.renderedWidth, height: image.renderedHeight })
      : t("images.displayedMissing"),
  ];
  if (image.loading) lines.push(`loading="${image.loading}"`);
  if (image.decoding) lines.push(`decoding="${image.decoding}"`);
  if (image.sizes) lines.push(`sizes="${image.sizes}"`);
  if (image.broken === true) lines.push(t("images.failed"));
  else if (image.broken == null && image.src) lines.push(t("images.loadingUnknown"));
  return lines;
}
</script>

<template>
  <PageHeading
    :overline="t('wb.im.overline')"
    :title="t('popup.imageInspector')"
    :text="t('wb.im.text')"
  />
  <div class="compact-stats">
    <div class="kpi">
      <strong>{{ n(totals.total) }}</strong
      ><span>{{ t("popup.images") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(totals.missing) }}</strong
      ><span>{{ t("popup.altMissing") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(totals.empty) }}</strong
      ><span>{{ t("images.emptyAltCount") }}</span>
    </div>
  </div>
  <div class="pill-set" role="group" :aria-label="t('wb.im.filter')">
    <button
      type="button"
      class="pill"
      :class="{ active: filter === 'all' }"
      :aria-pressed="filter === 'all'"
      @click="filter = 'all'"
    >
      {{ t("filter.all") }}
    </button>
    <button
      type="button"
      class="pill"
      :class="{ active: filter === 'missing' }"
      :aria-pressed="filter === 'missing'"
      @click="filter = 'missing'"
    >
      {{ t("popup.altMissing") }} · {{ n(totals.missing) }}
    </button>
    <button
      type="button"
      class="pill"
      :class="{ active: filter === 'alt' }"
      :aria-pressed="filter === 'alt'"
      @click="filter = 'alt'"
    >
      {{ t("images.withAlt") }} · {{ n(totals.withAlt) }}
    </button>
    <button
      type="button"
      class="pill"
      :class="{ active: filter === 'broken' }"
      :aria-pressed="filter === 'broken'"
      @click="filter = 'broken'"
    >
      {{ t("images.failed") }} · {{ n(totals.broken) }}
    </button>
  </div>
  <p v-if="!visible.length" class="callout">
    {{ filter === "all" ? t("empty.imagesBody") : t("images.noMatch") }}
  </p>
  <div v-else class="image-list">
    <div
      v-for="{ image, index } in visible.slice(0, limit)"
      :key="`${image.location}-${index}`"
      class="asset-row"
    >
      <div class="asset-thumb">
        <img
          v-if="address(image) && !failed[index]"
          :src="address(image) ?? undefined"
          alt=""
          loading="lazy"
          @error="failed[index] = true"
        />
        <span v-else class="thumb-missing" :title="t('pm.thumbFailed')"
          ><ImageOff class="ic" aria-hidden="true"
        /></span>
      </div>
      <div class="asset-info">
        <strong :title="image.src || undefined">{{ fileName(image.src) }}</strong>
        <small>{{ altLine(image) }}</small>
        <div>
          <span class="badge gray">{{ dims(image) }}</span>
          <span v-if="!image.altPresent" class="badge warn">{{ t("popup.altMissing") }}</span>
          <span v-else-if="!image.altValue.trim()" class="badge gray">{{
            t("value.emptyAlt")
          }}</span>
          <span v-else class="badge ok">{{ t("popup.altPresent") }}</span>
          <span v-if="image.broken === true" class="badge err">{{ t("images.failed") }}</span>
        </div>
      </div>
      <button
        type="button"
        class="icon-ghost"
        :aria-expanded="Boolean(expanded[index])"
        :aria-label="t('wb.im.details', { name: fileName(image.src) })"
        @click="expanded[index] = !expanded[index]"
      >
        <ChevronDown class="ic" :class="{ flip: expanded[index] }" aria-hidden="true" />
      </button>
      <div v-if="expanded[index]" class="asset-more">
        <p class="url-line">{{ image.src || t("value.noSource") }}</p>
        <p v-for="line in details(image)" :key="line">{{ line }}</p>
        <button v-if="image.src" type="button" class="quiet" @click="copy(image.src)">
          {{ t("wb.im.copySource") }}
        </button>
      </div>
    </div>
  </div>
  <button
    v-if="visible.length > limit"
    type="button"
    class="subtle-btn more-btn"
    @click="limit += 60"
  >
    {{ t("wb.showMore", { count: n(visible.length - limit) }) }} →
  </button>
  <p class="hint">{{ t("pm.imagesNote") }}</p>
  <div class="actions-row" role="group" :aria-label="t('wb.im.highlight')">
    <button type="button" class="quiet" @click="highlight('missing-alt')">
      {{ t("action.missingAlt") }}
    </button>
    <button type="button" class="quiet" @click="highlight('broken-images')">
      {{ t("action.broken") }}
    </button>
    <button type="button" class="quiet" @click="clearMarks">
      {{ t("action.clearHighlights") }}
    </button>
  </div>
  <RelatedChecks :audit="audit" category="images" />
</template>
