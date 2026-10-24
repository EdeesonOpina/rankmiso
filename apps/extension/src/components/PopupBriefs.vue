<script setup lang="ts">
import { computed } from "vue";
import { Braces, ChevronDown, Heading, ImageOff, Link2 } from "lucide-vue-next";
import { headingLevelCounts } from "../services/popup-summary";
import { resolveShareImage } from "../services/share-preview";
import type { AuditResult } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";
import EmptyState from "./EmptyState.vue";
import ImageThumb from "./ImageThumb.vue";
import JsonBlock from "./JsonBlock.vue";

const props = defineProps<{
  audit: AuditResult;
  kind: "jsonld" | "headings" | "links" | "images";
}>();
const { t, n } = useI18n();

const levels = computed(() => headingLevelCounts(props.audit.details.headings));
const outline = computed(() => props.audit.details.headings.slice(0, 8));
const linkGroups = computed(() => {
  const all = props.audit.details.links;
  const groups = [
    {
      id: "internal",
      label: t("links.internal"),
      links: all.filter((link) => link.classification === "internal"),
    },
    {
      id: "external",
      label: t("links.external"),
      links: all.filter((link) => link.classification === "external"),
    },
    { id: "nofollow", label: t("popup.nofollowLabel"), links: all.filter((link) => link.nofollow) },
  ];
  return groups.map((group) => ({
    ...group,
    count: group.links.length,
    sample: group.links.slice(0, 6),
    remaining: Math.max(0, group.links.length - 6),
  }));
});
const imageSample = computed(() => props.audit.details.images.slice(0, 8));
const extraImages = computed(() =>
  Math.max(0, props.audit.details.images.length - imageSample.value.length),
);

function imageAddress(src: string | null): string | null {
  return resolveShareImage(props.audit.page.url, src);
}

function linkAddress(link: AuditResult["details"]["links"][number]): string | null {
  return imageAddress(link.resolvedUrl || link.href);
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
    />
  </section>

  <section
    v-else-if="kind === 'headings'"
    class="space-y-4"
    aria-labelledby="popup-headings-heading"
  >
    <h2 id="popup-headings-heading" class="sr-only">{{ t("popup.headingOutline") }}</h2>
    <dl class="grid grid-cols-6 gap-2">
      <div
        v-for="(count, index) in levels"
        :key="index"
        class="rounded-panel border border-border bg-surface px-1 py-3 text-center"
      >
        <dt class="text-[11px] text-muted">H{{ index + 1 }}</dt>
        <dd class="m-0 text-[15px] font-semibold">{{ n(count) }}</dd>
      </div>
    </dl>
    <EmptyState
      v-if="outline.length === 0"
      :title="t('empty.headingsTitle')"
      :description="t('empty.headingsBody')"
    >
      <Heading class="h-4 w-4" />
    </EmptyState>
    <ol v-else class="m-0 list-none space-y-3 p-0">
      <li
        v-for="(heading, index) in outline"
        :key="`${heading.level}-${index}`"
        class="flex items-start gap-2 rounded-panel border border-border bg-surface px-4 py-3"
      >
        <div class="min-w-0 flex-1">
          <p class="m-0 text-[12px] text-muted">H{{ heading.level }}</p>
          <p class="mb-0 mt-2 break-words text-[13px] font-semibold leading-relaxed">
            {{ heading.text }}
          </p>
        </div>
        <CopyButton v-if="heading.text" :value="heading.text" />
      </li>
    </ol>
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
    <div v-else class="popup-link-groups">
      <details
        v-for="group in linkGroups"
        :key="group.id"
        class="popup-link-group"
        :open="group.id === 'internal' && group.count > 0"
      >
        <summary class="popup-link-summary">
          <span>{{ group.label }}</span>
          <span class="popup-link-count">{{ n(group.count) }}</span>
          <ChevronDown class="popup-link-chevron h-4 w-4" aria-hidden="true" />
        </summary>
        <ul v-if="group.count" class="popup-link-list">
          <li
            v-for="(link, index) in group.sample"
            :key="`${link.href}-${index}`"
            class="popup-link-row"
          >
            <div class="min-w-0 flex-1">
              <p class="m-0 text-[13px] leading-relaxed">
                {{ link.accessibleName || t("metadata.missing") }}
              </p>
              <a
                v-if="linkAddress(link)"
                :href="linkAddress(link) ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="mb-0 mt-2 block truncate text-[12px] leading-relaxed underline"
                :title="linkAddress(link) ?? undefined"
              >
                {{ linkAddress(link) }}
              </a>
              <p
                v-else
                class="mb-0 mt-2 truncate text-[12px] leading-relaxed text-muted"
                :title="link.href"
              >
                {{ link.href }}
              </p>
            </div>
            <CopyButton v-if="link.href" :value="link.resolvedUrl || link.href" />
          </li>
          <li v-if="group.remaining" class="popup-link-more">
            {{ t("popup.moreLinks", { count: group.remaining }) }}
          </li>
        </ul>
        <p v-else class="popup-link-empty">{{ t("popup.noLinksInGroup") }}</p>
      </details>
    </div>
  </section>

  <section v-else class="space-y-4" aria-labelledby="popup-images-heading">
    <h2 id="popup-images-heading" class="sr-only">{{ t("popup.imageSample") }}</h2>
    <dl class="grid grid-cols-3 gap-3">
      <div class="rounded-panel border border-border bg-surface px-3 py-3">
        <dt class="text-[12px] text-muted">{{ t("popup.images") }}</dt>
        <dd class="m-0 mt-1 text-[15px] font-semibold">{{ n(audit.metrics.counts.images) }}</dd>
      </div>
      <div class="rounded-panel border border-border bg-surface px-3 py-3">
        <dt class="text-[12px] text-muted">{{ t("popup.altMissing") }}</dt>
        <dd class="m-0 mt-1 text-[15px] font-semibold">
          {{ n(audit.metrics.counts.imagesMissingAlt) }}
        </dd>
      </div>
      <div class="rounded-panel border border-border bg-surface px-3 py-3">
        <dt class="text-[12px] text-muted">{{ t("popup.altEmpty") }}</dt>
        <dd class="m-0 mt-1 text-[15px] font-semibold">
          {{ n(audit.metrics.counts.imagesEmptyAlt) }}
        </dd>
      </div>
    </dl>
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
