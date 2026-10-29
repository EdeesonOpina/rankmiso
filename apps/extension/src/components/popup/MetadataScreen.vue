<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ copy: [value: string] }>();
const { t, n } = useI18n();
const device = ref<"desktop" | "mobile">("desktop");

const meta = computed(() => props.audit.details.metadata);
const title = computed(() => meta.value.title?.trim() || "");
const description = computed(() => meta.value.description?.trim() || "");
const canonical = computed(() => meta.value.canonicals[0] ?? "");
const detected = computed(
  () => [title.value, description.value, canonical.value].filter(Boolean).length,
);
const host = computed(() => {
  try {
    return new URL(props.audit.page.url).hostname.replace(/^www\./, "");
  } catch {
    return props.audit.page.url;
  }
});
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.metadata") }}</span
    ><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.pageIdentity") }}</h2>
    <span class="badge" :class="detected === 3 ? 'ok' : 'warn'">{{
      t("pm.fieldsDetected", { count: detected })
    }}</span>
  </div>
  <section class="surface" style="padding: 0 13px">
    <div class="row">
      <div class="row-content">
        <span class="tiny-label">{{ t("pm.documentTitle") }}</span>
        <strong v-if="title" class="row-title" style="font-size: 15px; margin-top: 6px">{{
          title
        }}</strong>
        <strong v-else class="row-title muted" style="font-size: 15px; margin-top: 6px">{{
          t("metadata.missing")
        }}</strong>
        <p class="row-sub">
          {{
            t("pm.titleMeasure", {
              count: n(meta.titleLength),
              pixels: n(meta.titlePixelEstimate),
            })
          }}
        </p>
      </div>
      <button
        v-if="title"
        type="button"
        class="icon-btn"
        :aria-label="t('pm.copyTitle')"
        @click="emit('copy', title)"
      >
        ⧉
      </button>
    </div>
    <div class="row">
      <div class="row-content">
        <span class="tiny-label">{{ t("pm.metaDescription") }}</span>
        <p v-if="description" class="desc-text">{{ description }}</p>
        <p v-else class="desc-text muted">{{ t("metadata.noDescription") }}</p>
        <p class="row-sub">
          {{ t("popup.descriptionLength", { count: n(meta.descriptionLength) }) }}
        </p>
      </div>
      <button
        v-if="description"
        type="button"
        class="icon-btn"
        :aria-label="t('pm.copyDescription')"
        @click="emit('copy', description)"
      >
        ⧉
      </button>
    </div>
    <div class="row">
      <div class="row-content">
        <span class="tiny-label">{{ t("popup.canonical") }}</span>
        <p class="link-url" style="margin: 7px 0 4px">{{ canonical || t("metadata.none") }}</p>
        <span v-if="meta.canonicals.length > 1" class="badge warn">{{
          t("pm.anotherCanonical")
        }}</span>
        <span v-else-if="!canonical" class="badge warn">{{ t("metadata.missing") }}</span>
      </div>
      <button
        v-if="canonical"
        type="button"
        class="icon-btn"
        :aria-label="t('pm.copyCanonical')"
        @click="emit('copy', canonical)"
      >
        ⧉
      </button>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("popup.searchAppearance") }}</h2>
    <span class="badge">{{ t("pm.localPreview") }}</span>
  </div>
  <div class="soft">
    <div class="segmented" style="margin-bottom: 11px">
      <button
        type="button"
        class="segment"
        :aria-pressed="device === 'desktop'"
        @click="device = 'desktop'"
      >
        {{ t("popup.desktop") }}
      </button>
      <button
        type="button"
        class="segment"
        :aria-pressed="device === 'mobile'"
        @click="device = 'mobile'"
      >
        {{ t("popup.mobile") }}
      </button>
    </div>
    <div
      class="surface"
      :class="device === 'mobile' ? 'serp-mobile' : ''"
      :style="device === 'desktop' ? 'padding:12px' : ''"
    >
      <span class="serp-url">{{ host }}</span>
      <strong class="serp-title">{{ title || t("metadata.untitled") }}</strong>
      <p class="helper" :class="{ clamp2: device === 'mobile' }" style="margin: 0">
        {{ description || t("metadata.noDescription") }}
      </p>
    </div>
    <p class="micro" style="margin: 10px 0 0">{{ t("popup.previewNote") }}</p>
  </div>

  <div class="title-row">
    <h2>{{ t("pm.robotsIndexing") }}</h2>
  </div>
  <dl style="margin: 0">
    <div class="property">
      <dt>{{ t("popup.robots") }}</dt>
      <dd>
        <template v-if="meta.robots.length">{{ meta.robots.join(", ") }}</template>
        <span v-else class="muted">{{ t("pm.notDeclared") }}</span>
      </dd>
    </div>
    <div class="property">
      <dt>Googlebot</dt>
      <dd>
        <template v-if="meta.googlebot.length">{{ meta.googlebot.join(", ") }}</template>
        <span v-else class="muted">{{ t("pm.notDeclared") }}</span>
      </dd>
    </div>
    <div class="property">
      <dt>{{ t("popup.language") }}</dt>
      <dd>
        <template v-if="audit.page.language">{{ audit.page.language }}</template>
        <span v-else class="muted">{{ t("pm.notDeclared") }}</span>
      </dd>
    </div>
  </dl>
</template>
