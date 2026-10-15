<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SharePreview } from "../services/share-preview";
import { useI18n } from "../composables/useI18n";

const props = defineProps<{ preview: SharePreview }>();
const { t } = useI18n();
const imageFailed = ref(false);

watch(
  () => props.preview.imageUrl,
  () => {
    imageFailed.value = false;
  },
);

const notes = computed(() => {
  const lines: string[] = [];
  const preview = props.preview;
  if (preview.titleFrom === "page") lines.push(t("social.titleFromPage"));
  if (preview.titleFrom === "openGraph") lines.push(t("social.titleFromOpenGraph"));
  if (preview.descriptionFrom === "page") lines.push(t("social.descriptionFromPage"));
  if (preview.descriptionFrom === "openGraph") lines.push(t("social.descriptionFromOpenGraph"));
  if (preview.imageFrom === "openGraph") lines.push(t("social.imageFromOpenGraph"));
  if (preview.id === "x" && !preview.cardType) lines.push(t("social.cardMissing"));
  return lines;
});
</script>

<template>
  <article class="overflow-hidden rounded-panel border border-border bg-surface">
    <header class="flex items-center justify-between gap-3 px-4 pb-6 pt-4">
      <h3 class="m-0 text-[13px] font-semibold">
        {{ preview.id === "openGraph" ? t("social.openGraph") : t("social.x") }}
      </h3>
      <p class="m-0 text-[12px] text-muted">
        {{ preview.layout === "compact" ? t("social.compact") : t("social.large") }}
      </p>
    </header>

    <div :class="preview.layout === 'compact' ? 'flex items-start gap-3 p-3' : ''">
      <div
        class="grid place-items-center overflow-hidden bg-background"
        :class="
          preview.layout === 'compact' ? 'h-24 w-24 shrink-0 rounded-panel' : 'aspect-[1.91/1]'
        "
      >
        <img
          v-if="preview.imageUrl && !imageFailed"
          :src="preview.imageUrl"
          :alt="t('social.imageAlt')"
          class="h-full w-full object-cover"
          referrerpolicy="no-referrer"
          @error="imageFailed = true"
        />
        <p v-else class="m-0 px-3 text-center text-[12px] text-muted">
          {{ imageFailed ? t("social.imageFailed") : t("social.noImage") }}
        </p>
      </div>
      <div :class="preview.layout === 'compact' ? 'min-w-0' : 'space-y-2 px-4 py-4'">
        <p class="m-0 truncate text-[12px] text-muted">{{ preview.host }}</p>
        <p class="m-0 line-clamp-2 text-[15px] font-semibold leading-snug">
          {{ preview.title || t("social.noTitle") }}
        </p>
        <p class="m-0 line-clamp-3 text-[13px] leading-relaxed text-muted">
          {{ preview.description || t("social.noDescription") }}
        </p>
      </div>
    </div>

    <p v-if="preview.imageUrl" class="mb-0 break-all px-4 pb-4 pt-3 text-[12px] text-muted">
      {{ preview.imageUrl }}
    </p>
    <ul v-if="notes.length" class="mb-0 mt-0 list-disc px-8 pb-3 text-[12px] text-muted">
      <li v-for="note in notes" :key="note">{{ note }}</li>
    </ul>
  </article>
</template>
