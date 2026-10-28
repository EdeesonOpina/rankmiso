<script setup lang="ts">
import { computed } from "vue";
import { popupOverview } from "../services/popup-summary";
import type { AuditResult } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";

const props = withDefaults(
  defineProps<{ audit: AuditResult; mode?: "all" | "counts" | "details" | "essentials" }>(),
  {
    mode: "all",
  },
);
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
  <section class="miso-card stack" aria-labelledby="popup-overview-heading">
    <h2 id="popup-overview-heading" class="sr-only">{{ t("popup.overview") }}</h2>
    <dl v-if="mode === 'essentials'" class="essentials">
      <div>
        <dt>{{ t("popup.h1") }}</dt>
        <dd>
          {{ overview.h1 || t("metadata.missing") }}
          <span v-if="overview.extraH1 > 0" class="text-muted">
            {{ t("popup.more", { count: overview.extraH1 }) }}
          </span>
        </dd>
      </div>
      <div>
        <dt>{{ t("popup.title") }}</dt>
        <dd>{{ overview.title || t("metadata.untitled") }}</dd>
      </div>
      <div>
        <dt>{{ t("popup.description") }}</dt>
        <dd>{{ overview.description || t("metadata.noDescription") }}</dd>
      </div>
      <div>
        <dt>{{ t("popup.canonical") }}</dt>
        <dd>{{ overview.canonical || t("metadata.none") }}</dd>
      </div>
      <div>
        <dt>{{ t("popup.robots") }}</dt>
        <dd>{{ overview.robots || t("metadata.none") }}</dd>
      </div>
    </dl>
    <template v-else>
      <div v-if="mode !== 'counts'" class="preview-sheet">
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
          <p class="mb-0 min-w-0 text-[13px] leading-relaxed text-muted">
            {{ overview.description || t("metadata.noDescription") }}
          </p>
          <CopyButton v-if="overview.description" :value="overview.description" />
        </div>
        <p class="mb-0 mt-3 text-[12px] text-muted">
          {{
            t("popup.titleLength", { count: overview.titleLength, pixels: overview.titlePixels })
          }}
          ·
          {{ t("popup.descriptionLength", { count: overview.descriptionLength }) }}
        </p>
      </div>

      <p v-if="mode !== 'details'" class="metric-line">
        <span
          >{{ t("popup.words") }}
          {{ overview.words == null ? t("popup.notAvailable") : n(overview.words) }}</span
        >
        <span
          >{{ t("popup.headings") }} {{ n(overview.headings) }} ·
          {{ t("popup.h1Count", { count: overview.h1Count }) }}</span
        >
        <span
          >{{ t("popup.links") }} {{ n(overview.links) }} ·
          {{
            t("popup.linkSplit", {
              internal: overview.internalLinks,
              external: overview.externalLinks,
            })
          }}</span
        >
        <span :class="overview.imagesMissingAlt > 0 ? 'text-danger' : ''"
          >{{ t("popup.images") }} {{ n(overview.images) }} ·
          {{ t("popup.missingAlt", { count: overview.imagesMissingAlt }) }}</span
        >
      </p>

      <dl v-if="mode !== 'counts'" class="essentials">
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
    </template>
  </section>
</template>
