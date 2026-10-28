<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Share2 } from "lucide-vue-next";
import type { SharePreview } from "../services/share-preview";
import { useI18n } from "../composables/useI18n";

const props = defineProps<{ preview: SharePreview }>();
const { t } = useI18n();
const imageFailed = ref(false);
const imageReady = ref(false);

watch(
  () => props.preview.imageUrl,
  () => {
    imageFailed.value = false;
    imageReady.value = false;
  },
);

const showImage = computed(
  () => Boolean(props.preview.imageUrl) && imageReady.value && !imageFailed.value,
);
const landscape = computed(
  () =>
    props.preview.presentation === "open-graph" ||
    props.preview.presentation === "summary-large" ||
    props.preview.presentation === "undeclared",
);

const notes = computed(() => {
  const lines: string[] = [];
  const preview = props.preview;
  if (preview.titleFrom === "page") lines.push(t("social.titleFromPage"));
  if (preview.titleFrom === "openGraph") lines.push(t("social.titleFromOpenGraph"));
  if (preview.descriptionFrom === "page") lines.push(t("social.descriptionFromPage"));
  if (preview.descriptionFrom === "openGraph") lines.push(t("social.descriptionFromOpenGraph"));
  if (preview.imageFrom === "openGraph") lines.push(t("social.imageFromOpenGraph"));
  if (preview.imageFrom === "declared" && preview.id === "x") lines.push(t("social.imageFromX"));
  if (preview.urlFrom === "declared") lines.push(t("social.urlFromOpenGraph"));
  if (preview.urlFrom === "page") lines.push(t("social.urlFromPage"));
  if (preview.presentation === "undeclared") lines.push(t("social.cardMissing"));
  if (preview.presentation === "unsupported") lines.push(t("social.cardUnsupported"));
  return lines;
});
</script>

<template>
  <article class="miso-card share-card">
    <header class="share-card-head">
      <span class="report-feature-icon" aria-hidden="true">
        <Share2 v-if="preview.id === 'openGraph'" class="h-4 w-4" />
        <span v-else class="share-mark">X</span>
      </span>
      <div class="min-w-0">
        <p class="report-feature-kicker">
          {{ preview.id === "openGraph" ? t("social.ogKicker") : t("social.xKicker") }}
        </p>
        <h3 class="m-0 text-[15px] font-semibold">
          {{ preview.id === "openGraph" ? t("social.openGraph") : t("social.x") }}
        </h3>
        <p class="report-feature-copy">
          {{ preview.id === "openGraph" ? t("social.ogHelp") : t("social.xHelp") }}
          <span v-if="preview.id === 'x' && preview.cardType">
            {{ t("social.cardDeclared", { type: preview.cardType }) }}
          </span>
        </p>
      </div>
    </header>

    <div
      class="platform-preview"
      :class="{
        'is-x': preview.id === 'x',
        'is-summary': preview.presentation === 'summary' || preview.presentation === 'unsupported',
      }"
    >
      <div
        v-if="preview.imageUrl && !imageFailed"
        class="platform-media"
        :class="showImage ? '' : 'is-pending'"
      >
        <img
          :src="preview.imageUrl"
          :alt="t('social.imageAlt')"
          :width="landscape ? 382 : 72"
          :height="landscape ? 200 : 72"
          referrerpolicy="no-referrer"
          @load="imageReady = true"
          @error="imageFailed = true"
        />
        <p v-if="!showImage" class="platform-missing">{{ t("social.imageLoading") }}</p>
      </div>
      <p v-else class="platform-missing">
        {{ imageFailed ? t("social.imageFailed") : t("social.noImage") }}
      </p>
      <div class="platform-copy">
        <p class="platform-host">{{ preview.host }}</p>
        <p class="platform-title" :title="preview.title || t('social.noTitle')">
          {{ preview.title || t("social.noTitle") }}
        </p>
        <p class="platform-desc" :title="preview.description || t('social.noDescription')">
          {{ preview.description || t("social.noDescription") }}
        </p>
      </div>
    </div>

    <details class="share-full">
      <summary>{{ t("social.fullValues") }}</summary>
      <dl>
        <div>
          <dt>{{ t("popup.title") }}</dt>
          <dd>{{ preview.title || t("social.noTitle") }}</dd>
        </div>
        <div>
          <dt>{{ t("popup.description") }}</dt>
          <dd>{{ preview.description || t("social.noDescription") }}</dd>
        </div>
        <div>
          <dt>{{ t("social.urlLabel") }}</dt>
          <dd>{{ preview.url }}</dd>
        </div>
        <div>
          <dt>{{ t("social.imageLabel") }}</dt>
          <dd>{{ preview.imageUrl || t("social.noImage") }}</dd>
        </div>
      </dl>
    </details>
    <ul v-if="notes.length" class="share-notes">
      <li v-for="note in notes" :key="note">{{ note }}</li>
    </ul>
    <p class="share-approx">{{ t("social.approx") }}</p>
  </article>
</template>
