<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { Copy } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";
import { hostOf, useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { surface, copy } = useWorkbench();
const report = surface === "report";
const titleId = useId();
const descriptionId = useId();
const meta = computed(() => props.audit.details.metadata);
const h1 = computed(() =>
  props.audit.details.headings
    .filter((heading) => heading.level === 1)
    .map((heading) => heading.text),
);
const mode = ref<"desktop" | "mobile">("desktop");
const previewTitle = ref("");
const previewDescription = ref("");
watch(
  meta,
  (value) => {
    previewTitle.value = value.title || "";
    previewDescription.value = value.description || "";
  },
  { immediate: true },
);
const edited = computed(
  () =>
    previewTitle.value !== (meta.value.title || "") ||
    previewDescription.value !== (meta.value.description || ""),
);
const identity = computed(() => [
  {
    label: "H1",
    value: h1.value[0] || "",
    empty: t("metadata.missing"),
    extra: h1.value.length > 1 ? t("wb.md.moreH1", { count: n(h1.value.length - 1) }) : "",
  },
  {
    label: t("popup.title"),
    value: meta.value.title || "",
    empty: t("metadata.untitled"),
    extra: t("content.titleLengthDetail", {
      count: meta.value.titleLength,
      pixels: meta.value.titlePixelEstimate,
    }),
  },
  {
    label: t("popup.description"),
    value: meta.value.description || "",
    empty: t("metadata.noDescription"),
    extra: `${n(meta.value.descriptionLength)} ${t("content.charactersUnit")}`,
  },
  {
    label: t("popup.canonical"),
    value: meta.value.canonicals.join(" "),
    empty: t("value.none"),
    extra:
      meta.value.canonicals.length > 1
        ? t("wb.md.canonicals", { count: n(meta.value.canonicals.length) })
        : "",
  },
]);
</script>

<template>
  <PageHeading
    :overline="t('wb.md.overline')"
    :title="t('wb.md.title')"
    :text="report ? t('wb.md.text') : t('wb.md.textShort')"
  />
  <div :class="report ? 'split-60' : ''">
    <div>
      <WbCard :title="report ? t('wb.md.identity') : ''" flat>
        <div :class="report ? '' : 'metadata-stack'">
          <div v-for="item in identity" :key="item.label" class="metadata-item">
            <div class="meta-top">
              <span>{{ item.label }}</span>
              <button
                v-if="item.value"
                type="button"
                class="icon-ghost"
                :aria-label="t('wb.md.copy', { field: item.label })"
                @click="copy(item.value)"
              >
                <Copy class="ic" aria-hidden="true" />
              </button>
            </div>
            <strong :class="{ 'is-empty': !item.value }">{{ item.value || item.empty }}</strong>
            <small v-if="item.extra" class="meta-extra">{{ item.extra }}</small>
          </div>
        </div>
      </WbCard>
      <WbCard v-if="report" :title="t('metadata.measurements')">
        <div class="properties">
          <div class="property">
            <span>{{ t("field.pixelEstimate") }}</span
            ><strong>{{ meta.titlePixelBasis }}</strong>
          </div>
          <div class="property">
            <span>{{ t("field.charset") }}</span
            ><strong>{{ meta.charset || t("value.charsetMissing") }}</strong>
          </div>
          <div class="property">
            <span>{{ t("field.viewport") }}</span
            ><strong>{{ meta.viewport || t("metadata.missing") }}</strong>
          </div>
        </div>
      </WbCard>
    </div>
    <div>
      <WbCard :title="t('popup.searchAppearance')" flat>
        <div class="segmented" role="group" :aria-label="t('popup.searchAppearance')">
          <button
            type="button"
            :class="{ on: mode === 'desktop' }"
            :aria-pressed="mode === 'desktop'"
            @click="mode = 'desktop'"
          >
            {{ t("serp.desktop") }}
          </button>
          <button
            type="button"
            :class="{ on: mode === 'mobile' }"
            :aria-pressed="mode === 'mobile'"
            @click="mode = 'mobile'"
          >
            {{ t("serp.mobile") }}
          </button>
        </div>
        <div class="serp-card" :style="mode === 'mobile' ? { maxWidth: '245px' } : undefined">
          <small>{{ hostOf(audit.page.url) }}</small>
          <strong>{{ previewTitle || t("metadata.untitled") }}</strong>
          <p>{{ previewDescription || t("metadata.noDescription") }}</p>
        </div>
        <p class="hint">{{ t("wb.md.rewrite") }}</p>
        <details class="disclosure" :open="edited">
          <summary>{{ t("wb.md.edit") }}<span aria-hidden="true">⌄</span></summary>
          <div class="details-body form-stack">
            <label :for="titleId">{{ t("serp.editTitle") }}</label>
            <input
              :id="titleId"
              v-model="previewTitle"
              class="field"
              name="preview-title"
              autocomplete="off"
            />
            <label :for="descriptionId">{{ t("serp.editDescription") }}</label>
            <textarea
              :id="descriptionId"
              v-model="previewDescription"
              class="field"
              rows="3"
              name="preview-description"
              autocomplete="off"
            />
            <div>
              <button
                type="button"
                class="quiet"
                :disabled="!edited"
                @click="
                  previewTitle = meta.title || '';
                  previewDescription = meta.description || '';
                "
              >
                {{ t("serp.resetPreview") }}
              </button>
            </div>
            <p>{{ t("serp.disclaimer") }}</p>
          </div>
        </details>
      </WbCard>
      <WbCard :title="report ? t('wb.md.directives') : t('wb.md.indexDirectives')" flat>
        <div class="properties">
          <div class="property">
            <span>{{ t("field.robots") }}</span
            ><strong>{{ meta.robots.join(", ") || t("technical.notDeclared") }}</strong>
          </div>
          <div class="property">
            <span>{{ t("field.googlebot") }}</span
            ><strong>{{ meta.googlebot.join(", ") || t("technical.notDeclared") }}</strong>
          </div>
          <div class="property">
            <span>{{ t("field.language") }}</span
            ><strong>{{ meta.language || t("international.notDeclared") }}</strong>
          </div>
        </div>
      </WbCard>
    </div>
  </div>
  <RelatedChecks :audit="audit" category="metadata" />
</template>
