<script setup lang="ts">
import { computed, ref } from "vue";
import { Braces, ImageOff, Link2 } from "lucide-vue-next";
import { selectLinks } from "../services/popup-summary";
import HeadingOutline from "./HeadingOutline.vue";
import LinkGroups from "./LinkGroups.vue";
import { resolveShareImage } from "../services/share-preview";
import type { AuditResult } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import EmptyState from "./EmptyState.vue";
import ImageThumb from "./ImageThumb.vue";
import JsonBlock from "./JsonBlock.vue";

const props = defineProps<{
  audit: AuditResult;
  kind: "jsonld" | "headings" | "links" | "images";
}>();
const { t, n } = useI18n();

const linkQuery = ref("");
const matchedLinks = computed(() => selectLinks(props.audit.details.links, "all", linkQuery.value));
const imageSample = computed(() => props.audit.details.images.slice(0, 8));
const extraImages = computed(() =>
  Math.max(0, props.audit.details.images.length - imageSample.value.length),
);

function imageAddress(src: string | null): string | null {
  return resolveShareImage(props.audit.page.url, src);
}

function altLabel(image: AuditResult["details"]["images"][number]): string {
  if (!image.altPresent) return t("popup.altMissing");
  if (!image.altValue.trim()) return t("popup.altEmpty");
  return image.altValue;
}
</script>

<template>
  <section v-if="kind === 'jsonld'" class="space-y-6" aria-labelledby="popup-jsonld-heading">
    <h2 id="popup-jsonld-heading" class="sr-only">{{ t("popup.jsonld") }}</h2>
    <p class="jsonld-popup-note m-0 text-[13px] leading-relaxed text-muted">
      {{ t("schema.note") }}
    </p>
    <EmptyState
      v-if="audit.details.structuredData.length === 0"
      :title="t('empty.schemaTitle')"
      :description="t('empty.schemaBody')"
    >
      <Braces class="h-4 w-4" />
    </EmptyState>
    <JsonBlock
      v-for="(block, index) in audit.details.structuredData"
      :key="index"
      :raw="block.raw"
      :valid="block.validJson"
      :error="block.error"
      :index="index"
      :total="audit.details.structuredData.length"
    />
  </section>

  <section
    v-else-if="kind === 'headings'"
    class="inspector"
    aria-labelledby="popup-headings-heading"
  >
    <h2 id="popup-headings-heading" class="sr-only">{{ t("popup.headingOutline") }}</h2>
    <HeadingOutline :headings="audit.details.headings" />
  </section>

  <section v-else-if="kind === 'links'" class="space-y-4" aria-labelledby="popup-links-heading">
    <h2 id="popup-links-heading" class="sr-only">{{ t("popup.linkSample") }}</h2>
    <EmptyState
      v-if="audit.details.links.length === 0"
      :title="t('empty.linksTitle')"
      :description="t('empty.linksBody')"
    >
      <Link2 class="h-4 w-4" />
    </EmptyState>
    <div v-else class="inspector">
      <p class="metric-line">
        <span>{{ t("popup.links") }} {{ n(audit.metrics.counts.links) }}</span>
        <span>{{ t("links.internal") }} {{ n(audit.metrics.counts.internalLinks) }}</span>
        <span>{{ t("links.external") }} {{ n(audit.metrics.counts.externalLinks) }}</span>
        <span
          >{{ t("links.nofollow") }}
          {{ n(audit.details.links.filter((link) => link.nofollow).length) }}</span
        >
      </p>
      <label class="check-search">
        {{ t("links.search") }}
        <input v-model="linkQuery" type="search" />
      </label>
      <LinkGroups
        :links="matchedLinks"
        :page-url="audit.page.url"
        :limit="40"
        :searching="linkQuery.trim().length > 0"
        :truncated="audit.source.limitations.includes('LINKS_TRUNCATED')"
      />
    </div>
  </section>

  <section v-else class="space-y-4" aria-labelledby="popup-images-heading">
    <h2 id="popup-images-heading" class="sr-only">{{ t("popup.imageSample") }}</h2>
    <p class="metric-line">
      <span>{{ t("popup.images") }} {{ n(audit.metrics.counts.images) }}</span>
      <span>{{ t("popup.altMissing") }} {{ n(audit.metrics.counts.imagesMissingAlt) }}</span>
      <span>{{ t("popup.altEmpty") }} {{ n(audit.metrics.counts.imagesEmptyAlt) }}</span>
    </p>
    <EmptyState
      v-if="imageSample.length === 0"
      :title="t('empty.imagesTitle')"
      :description="t('empty.imagesBody')"
    >
      <ImageOff class="h-4 w-4" />
    </EmptyState>
    <div v-else>
      <div class="space-y-3">
        <ImageThumb
          v-for="(image, index) in imageSample"
          :key="`${image.src}-${index}`"
          :src="imageAddress(image.src)"
          :alt="altLabel(image)"
        />
      </div>
      <p
        v-if="extraImages > 0"
        class="mb-0 mt-5 text-center text-[13px] leading-relaxed text-muted"
      >
        {{ t("popup.moreImages", { count: extraImages }) }}
      </p>
    </div>
  </section>
</template>
