<script setup lang="ts">
import { computed, ref } from "vue";
import { BarChart3, CircleCheck, Globe, ShieldCheck, Sparkles } from "lucide-vue-next";
import { platforms } from "../../config/crawlers.config";
import { useI18n } from "../../composables/useI18n";
import { sitePermission } from "../../services/page-access";
import type { AuditResult } from "../../types/audit";
import ContentReadinessPanel from "./ContentReadinessPanel.vue";
import CrawlerAccessPanel from "./CrawlerAccessPanel.vue";
import PageHeading from "./PageHeading.vue";
import VisibilityPanel from "./VisibilityPanel.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const tabs = [
  { id: "access", key: "aiSearch.tab.access", short: "pa.tab.access", icon: Globe },
  { id: "readiness", key: "aiSearch.tab.readiness", short: "pa.tab.readiness", icon: CircleCheck },
  { id: "visibility", key: "aiSearch.tab.visibility", short: "pa.tab.visibility", icon: BarChart3 },
] as const;
type Tab = (typeof tabs)[number]["id"];
const active = ref<Tab>("access");
const host = computed(
  () => sitePermission(props.audit.page.url)?.hostname.replace(/^www\./, "") ?? "",
);
</script>

<template>
  <div class="ax">
    <PageHeading
      :overline="t('access.overline')"
      :title="t('aiSearch.title')"
      :text="t('aiSearch.intro')"
    />
    <section class="ax-hero" :aria-label="t('aiSearch.hero.kicker')">
      <div class="ax-hero-copy">
        <p class="ax-hero-kicker">
          <span aria-hidden="true"></span>{{ t("aiSearch.hero.kicker") }}
        </p>
        <h2>
          {{ t("aiSearch.hero.lead") }} <em>{{ t("aiSearch.hero.em") }}</em>
          {{ t("aiSearch.hero.tail") }}
        </h2>
        <p>{{ t("aiSearch.hero.text") }}</p>
        <div class="ax-hero-chips">
          <span v-if="host" class="ax-hero-chip" translate="no">
            <Globe class="ic" aria-hidden="true" />{{ host }}
          </span>
          <span class="ax-hero-chip muted">
            <ShieldCheck class="ic" aria-hidden="true" />{{ t("aiSearch.hero.local") }}
          </span>
        </div>
      </div>
      <div class="ax-hero-art" aria-hidden="true">
        <div class="ax-orbit">
          <div class="ax-orbit-core">
            <Sparkles class="ic" />
            <strong>AI</strong>
            <span>{{ t("aiSearch.hero.ring") }}</span>
          </div>
          <span class="ax-orbit-tag one">{{ t("aiSearch.hero.rules") }}</span>
          <span class="ax-orbit-tag two">{{ t("aiSearch.hero.signals") }}</span>
        </div>
      </div>
    </section>
    <nav class="sx-tabs ax-tabs" :aria-label="t('aiSearch.views')">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="{ active: active === tab.id }"
        :aria-current="active === tab.id ? 'page' : undefined"
        :aria-label="t(tab.key)"
        @click="active = tab.id"
      >
        <component :is="tab.icon" class="ic" aria-hidden="true" />
        <span class="ax-tab-full">{{ t(tab.key) }}</span>
        <span class="ax-tab-short" aria-hidden="true">{{ t(tab.short) }}</span>
        <span v-if="tab.id === 'access'" class="count" aria-hidden="true">{{
          n(platforms.length)
        }}</span>
      </button>
    </nav>
    <CrawlerAccessPanel v-if="active === 'access'" :audit="audit" />
    <ContentReadinessPanel
      v-else-if="active === 'readiness'"
      :audit="audit"
      @open-access="active = 'access'"
    />
    <VisibilityPanel v-else :audit="audit" />
  </div>
</template>
