<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import { useDiscoverabilitySummary } from "../../composables/useDiscoverabilitySummary";
import type { AuditResult } from "../../types/audit";
import { useWorkbench } from "./context";
import DataRow from "./DataRow.vue";

/** Overview summary of Discoverability. Reads local results only; the section has the detail. */
const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const { surface, go, snapshot } = useWorkbench();
const { lines } = useDiscoverabilitySummary(() => props.audit, snapshot);
const dotTone = { ok: "good", warn: "warn", gray: "gray" } as const;
</script>

<template>
  <component
    :is="surface === 'report' ? 'section' : 'div'"
    :class="surface === 'report' ? 'card disc-card' : 'disc-card'"
    :aria-label="t('nav.aiSearch')"
  >
    <div class="section-heading">
      <div>
        <h2>{{ t("nav.aiSearch") }}</h2>
        <p class="disc-sub">{{ t("disc.sub") }}</p>
      </div>
      <button type="button" class="subtle-btn" @click="go('ai-search')">
        {{ t(surface === "report" ? "disc.open" : "disc.openShort") }} →
      </button>
    </div>
    <div class="list">
      <DataRow
        v-for="line in lines"
        :key="line.title"
        link
        :title="line.title"
        :sub="line.sub"
        :tone="dotTone[line.tone]"
        :badge="line.badge"
        :badge-tone="line.tone"
        @open="go('ai-search')"
      />
    </div>
  </component>
</template>
