<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "../../composables/useI18n";
import type { AuditResult } from "../../types/audit";
import ContentReadinessPanel from "./ContentReadinessPanel.vue";
import CrawlerAccessPanel from "./CrawlerAccessPanel.vue";
import PageHeading from "./PageHeading.vue";
import VisibilityPanel from "./VisibilityPanel.vue";

defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const tabs = ["access", "readiness", "visibility"] as const;
const tabKey = {
  access: "aiSearch.tab.access",
  readiness: "aiSearch.tab.readiness",
  visibility: "aiSearch.tab.visibility",
} as const;
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
        {{ t(tabKey[tab]) }}
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
