<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import { sharePreviews, type ShareFieldSource } from "../../services/share-preview";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const failed = ref<Record<string, boolean>>({});

const previews = computed(() => sharePreviews(props.audit));
const og = computed(() => previews.value.find((item) => item.id === "openGraph")!);
const x = computed(() => previews.value.find((item) => item.id === "x")!);
const social = computed(() => props.audit.details.social);

const sourceKey: Record<ShareFieldSource, MessageKey> = {
  declared: "pm.sourceDeclared",
  openGraph: "pm.sourceOpenGraph",
  page: "pm.sourcePage",
  none: "pm.sourceNone",
};
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.social") }}</span><span class="minor">{{ t("pm.localMetadata") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.shareAppearance") }}</h2>
    <span class="badge">{{ t("pm.approximation") }}</span>
  </div>
  <p class="helper">{{ t("pm.socialHelp") }}</p>

  <div class="surface">
    <div class="pair" style="margin-bottom: 12px">
      <div>
        <span class="tiny-label">{{ t("pm.facebookLabel") }}</span>
        <strong class="row-title" style="margin-top: 5px">{{ t("pm.linkAttachment") }}</strong>
      </div>
      <span class="badge" :class="social.ogTitle ? 'ok' : 'warn'">{{
        social.ogTitle ? t("pm.titleFound") : t("pm.titleMissing")
      }}</span>
    </div>
    <div class="social-preview">
      <img
        v-if="og.imageUrl && !failed.og"
        class="photo-hero"
        :src="og.imageUrl"
        :alt="t('social.imageAlt')"
        @error="failed.og = true"
      />
      <div v-else class="photo-empty">
        {{ og.imageUrl ? t("social.imageFailed") : t("social.noImage") }}
      </div>
      <div class="social-body">
        <span class="host">{{ og.host.toUpperCase() }}</span>
        <strong>{{ og.title || t("social.noTitle") }}</strong>
        <p>{{ og.description || t("social.noDescription") }}</p>
      </div>
    </div>
    <details class="disclosure" style="margin-top: 14px">
      <summary>
        <span>
          <strong class="disclosure-title">{{ t("pm.fullValues") }}</strong>
          <span class="disclosure-sub">{{ t("pm.ogValuesSub") }}</span>
        </span>
      </summary>
      <div class="inside">
        <dl style="margin: 0">
          <div class="property"><dt>og:title</dt><dd>{{ social.ogTitle || t("metadata.missing") }}</dd></div>
          <div class="property">
            <dt>og:description</dt><dd>{{ social.ogDescription || t("metadata.missing") }}</dd>
          </div>
          <div class="property">
            <dt>og:image</dt><dd class="code">{{ social.ogImage || t("metadata.missing") }}</dd>
          </div>
          <div class="property">
            <dt>og:url</dt><dd class="code">{{ social.ogUrl || t("metadata.missing") }}</dd>
          </div>
          <div class="property"><dt>og:type</dt><dd>{{ social.ogType || t("metadata.missing") }}</dd></div>
        </dl>
      </div>
    </details>
    <p class="social-note" style="margin-top: 15px">{{ t("pm.facebookNote") }}</p>
  </div>

  <div class="spacer" />
  <div class="surface">
    <div class="pair" style="margin-bottom: 12px">
      <div>
        <span class="tiny-label">{{ t("pm.xLabel") }}</span>
        <strong class="row-title" style="margin-top: 5px">{{
          x.layout === "compact" ? t("pm.summaryCard") : t("pm.largeCard")
        }}</strong>
      </div>
      <span class="badge">{{ x.cardType || t("pm.notDeclared") }}</span>
    </div>
    <div v-if="x.layout === 'compact'" class="social-x">
      <div class="row" style="padding: 10px; border: 0">
        <img
          v-if="x.imageUrl && !failed.x"
          class="img-thumb"
          :src="x.imageUrl"
          :alt="t('social.imageAlt')"
          @error="failed.x = true"
        />
        <span v-else class="img-thumb thumb-empty" aria-hidden="true">▧</span>
        <div class="row-content">
          <strong class="row-title">{{ x.title || t("social.noTitle") }}</strong>
          <p class="row-sub">{{ x.description || t("social.noDescription") }}</p>
          <span class="row-sub">{{ x.host }}</span>
        </div>
      </div>
    </div>
    <div v-else class="social-preview social-x">
      <img
        v-if="x.imageUrl && !failed.x"
        class="photo-hero"
        :src="x.imageUrl"
        :alt="t('social.imageAlt')"
        @error="failed.x = true"
      />
      <div v-else class="photo-empty">
        {{ x.imageUrl ? t("social.imageFailed") : t("social.noImage") }}
      </div>
      <div class="social-body">
        <strong>{{ x.title || t("social.noTitle") }}</strong>
        <p>{{ x.description || t("social.noDescription") }}</p>
        <span class="host">{{ x.host }}</span>
      </div>
    </div>
    <details class="disclosure" style="margin-top: 14px">
      <summary>
        <span>
          <strong class="disclosure-title">{{ t("pm.fullValues") }}</strong>
          <span class="disclosure-sub">{{ t("pm.xValuesSub") }}</span>
        </span>
      </summary>
      <div class="inside">
        <dl style="margin: 0">
          <div class="property">
            <dt>twitter:card</dt><dd>{{ social.twitterCard || t("pm.notDeclared") }}</dd>
          </div>
          <div class="property"><dt>{{ t("pm.titleSource") }}</dt><dd>{{ t(sourceKey[x.titleFrom]) }}</dd></div>
          <div class="property"><dt>{{ t("pm.imageSource") }}</dt><dd>{{ t(sourceKey[x.imageFrom]) }}</dd></div>
        </dl>
      </div>
    </details>
    <p class="social-note" style="margin-top: 15px">{{ t("pm.xNote") }}</p>
  </div>
</template>
