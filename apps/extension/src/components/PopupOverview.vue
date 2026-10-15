<script setup lang="ts">
import { computed } from "vue";
import { popupOverview } from "../services/popup-summary";
import type { AuditResult } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const overview = computed(() => popupOverview(props.audit));

const schemaLabel = computed(() => {
  const types = overview.value.schemaTypes;
  if (types.length === 0) return t("metadata.none");
  if (types.length <= 2) return types.join(", ");
  return `${types.slice(0, 2).join(", ")} ${t("popup.more", { count: types.length - 2 })}`;
});
</script>

<template>
  <section class="space-y-4" aria-labelledby="popup-overview-heading">
    <h2 id="popup-overview-heading" class="sr-only">{{ t("popup.overview") }}</h2>

    <div class="rounded-panel border border-border bg-surface p-4">
      <div class="flex items-start justify-between gap-2">
        <p class="m-0 min-w-0 truncate text-[12px] text-success">{{ overview.host }}</p>
        <CopyButton :value="audit.page.url" />
      </div>
      <div class="mt-2 flex items-start justify-between gap-2">
        <p class="m-0 min-w-0 text-[15px] font-semibold leading-snug">
          {{ overview.title || t("metadata.untitled") }}
        </p>
        <CopyButton v-if="overview.title" :value="overview.title" />
      </div>
      <div class="mt-2 flex items-start justify-between gap-2">
        <p class="mb-0 min-w-0 line-clamp-3 text-[13px] leading-relaxed text-muted">
          {{ overview.description || t("metadata.noDescription") }}
        </p>
        <CopyButton v-if="overview.description" :value="overview.description" />
      </div>
      <p class="mb-0 mt-3 text-[12px] text-muted">
        {{ t("popup.titleLength", { count: overview.titleLength, pixels: overview.titlePixels }) }}
        ·
        {{ t("popup.descriptionLength", { count: overview.descriptionLength }) }}
      </p>
    </div>

    <dl class="grid grid-cols-2 gap-3">
      <div class="rounded-panel border border-border bg-surface px-3 py-3">
        <dt class="text-[12px] text-muted">{{ t("popup.words") }}</dt>
        <dd class="m-0 text-[15px] font-semibold">
          {{ overview.words == null ? t("popup.notAvailable") : n(overview.words) }}
        </dd>
      </div>
      <div class="rounded-panel border border-border bg-surface px-3 py-3">
        <dt class="text-[12px] text-muted">{{ t("popup.headings") }}</dt>
        <dd class="m-0 text-[15px] font-semibold">{{ n(overview.headings) }}</dd>
        <dd class="m-0 text-[12px] text-muted">
          {{ t("popup.h1Count", { count: overview.h1Count }) }}
        </dd>
      </div>
      <div class="rounded-panel border border-border bg-surface px-3 py-3">
        <dt class="text-[12px] text-muted">{{ t("popup.links") }}</dt>
        <dd class="m-0 text-[15px] font-semibold">{{ n(overview.links) }}</dd>
        <dd class="m-0 text-[12px] text-muted">
          {{
            t("popup.linkSplit", {
              internal: overview.internalLinks,
              external: overview.externalLinks,
            })
          }}
        </dd>
      </div>
      <div class="rounded-panel border border-border bg-surface px-3 py-3">
        <dt class="text-[12px] text-muted">{{ t("popup.images") }}</dt>
        <dd class="m-0 text-[15px] font-semibold">{{ n(overview.images) }}</dd>
        <dd
          class="m-0 text-[12px]"
          :class="overview.imagesMissingAlt > 0 ? 'text-danger' : 'text-muted'"
        >
          {{ t("popup.missingAlt", { count: overview.imagesMissingAlt }) }}
        </dd>
      </div>
    </dl>

    <dl class="overflow-hidden rounded-panel border border-border bg-surface text-[13px]">
      <div class="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-border px-4 py-3">
        <dt class="text-muted">{{ t("popup.h1") }}</dt>
        <dd class="m-0 break-words">
          {{ overview.h1 || t("metadata.missing") }}
          <span v-if="overview.extraH1 > 0" class="text-muted">
            {{ t("popup.more", { count: overview.extraH1 }) }}
          </span>
        </dd>
      </div>
      <div class="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-border px-4 py-3">
        <dt class="text-muted">{{ t("popup.canonical") }}</dt>
        <dd class="m-0 flex items-start justify-between gap-2">
          <span class="min-w-0 break-words">
            {{ overview.canonical || t("metadata.none") }}
            <span v-if="overview.extraCanonicals > 0" class="text-muted">
              {{ t("popup.more", { count: overview.extraCanonicals }) }}
            </span>
          </span>
          <CopyButton v-if="overview.canonical" :value="overview.canonical" />
        </dd>
      </div>
      <div class="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-border px-4 py-3">
        <dt class="text-muted">{{ t("popup.robots") }}</dt>
        <dd class="m-0 break-words">{{ overview.robots || t("metadata.none") }}</dd>
      </div>
      <div class="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-border px-4 py-3">
        <dt class="text-muted">{{ t("popup.language") }}</dt>
        <dd class="m-0">{{ overview.language || t("international.notDeclared") }}</dd>
      </div>
      <div class="grid grid-cols-[5.5rem_1fr] gap-3 px-4 py-3">
        <dt class="text-muted">{{ t("popup.schema") }}</dt>
        <dd class="m-0 break-words">{{ schemaLabel }}</dd>
      </div>
    </dl>
  </section>
</template>
