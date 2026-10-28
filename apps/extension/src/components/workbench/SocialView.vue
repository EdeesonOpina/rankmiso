<script setup lang="ts">
import { computed, reactive } from "vue";
import type { AuditResult } from "../../types/audit";
import { sharePreviews, type SharePreview } from "../../services/share-preview";
import { useI18n } from "../../composables/useI18n";
import PageHeading from "./PageHeading.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const previews = computed(() => sharePreviews(props.audit));
const failed = reactive<Record<string, boolean>>({});

function compact(preview: SharePreview): boolean {
  return preview.presentation === "summary" || preview.presentation === "unsupported";
}

function notes(preview: SharePreview): string[] {
  const lines: string[] = [];
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
}
</script>

<template>
  <PageHeading :overline="t('wb.so.overline')" :title="t('wb.so.title')" :text="t('wb.so.text')" />
  <div class="social-grid">
    <article v-for="preview in previews" :key="preview.id" class="social-card">
      <div class="social-head">
        <span
          class="platform-symbol"
          :class="{ 'dark-symbol': preview.id === 'x' }"
          aria-hidden="true"
        >
          {{ preview.id === "x" ? "𝕏" : "f" }}
        </span>
        <div>
          <strong>{{ preview.id === "x" ? t("wb.so.x") : t("wb.so.facebook") }}</strong>
          <small>{{
            preview.id === "x" ? preview.cardType || t("wb.so.noCard") : t("wb.so.attachment")
          }}</small>
        </div>
      </div>
      <div class="social-attachment" :class="{ 'is-summary': compact(preview) }">
        <img
          v-if="preview.imageUrl && !failed[preview.id]"
          :src="preview.imageUrl"
          :alt="t('social.imageAlt')"
          referrerpolicy="no-referrer"
          @error="failed[preview.id] = true"
        />
        <p v-else class="no-image">
          {{ failed[preview.id] ? t("social.imageFailed") : t("social.noImage") }}
        </p>
        <div>
          <small>{{ preview.host }}</small>
          <strong :class="{ 'is-empty': !preview.title }">{{
            preview.title || t("social.noTitle")
          }}</strong>
          <p>{{ preview.description || t("social.noDescription") }}</p>
        </div>
      </div>
      <details class="disclosure">
        <summary>{{ t("wb.so.full") }}<span aria-hidden="true">⌄</span></summary>
        <div class="details-body">
          <dl class="evidence">
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
            <div v-if="preview.id === 'x'">
              <dt>twitter:card</dt>
              <dd>{{ preview.cardType || t("wb.so.noCard") }}</dd>
            </div>
          </dl>
          <p v-for="note in notes(preview)" :key="note">{{ note }}</p>
        </div>
      </details>
    </article>
  </div>
  <p class="hint">{{ t("social.note") }}</p>
  <RelatedChecks :audit="audit" category="social" />
</template>
