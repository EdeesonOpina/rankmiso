<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "../../composables/useI18n";
import type { AuditResult } from "../../types/audit";
import ContentReadinessPanel from "./ContentReadinessPanel.vue";
import CrawlerAccessPanel from "./CrawlerAccessPanel.vue";
import PageHeading from "./PageHeading.vue";

defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const tabs = ["access", "readiness"] as const;
type Tab = (typeof tabs)[number];
const active = ref<Tab>("access");
</script>

<template>
  <div class="ax">
    <PageHeading
      :overline="t('access.overline')"
      :title="t('aiSearch.title')"
      :text="t('aiSearch.intro')"
    />
    <nav class="sx-tabs ax-tabs" :aria-label="t('aiSearch.views')">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        :class="{ active: active === tab }"
        :aria-current="active === tab ? 'page' : undefined"
        @click="active = tab"
      >
        {{ t(tab === "access" ? "aiSearch.tab.access" : "aiSearch.tab.readiness") }}
      </button>
    </nav>
    <CrawlerAccessPanel v-if="active === 'access'" :audit="audit" />
    <ContentReadinessPanel v-else :audit="audit" @open-access="active = 'access'" />
  </div>
</template>
