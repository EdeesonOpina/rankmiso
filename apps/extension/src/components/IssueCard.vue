<script setup lang="ts">
import { computed } from "vue";
import type { CheckResult } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import { findingGuide } from "../locales/findings.en";
import StatusBadge from "./StatusBadge.vue";

const props = withDefaults(defineProps<{ check: CheckResult; compact?: boolean }>(), {
  compact: false,
});
const { t } = useI18n();
const guide = computed(() => findingGuide(props.check.id));
</script>

<template>
  <article class="issue-card">
    <div class="flex items-start justify-between gap-3">
      <h3 class="m-0 text-[14px] font-semibold leading-snug text-pretty">{{ check.title }}</h3>
      <StatusBadge :status="check.status" />
    </div>
    <p class="issue-copy">{{ check.description }}</p>
    <p v-if="check.recommendation" class="mb-0 mt-2 text-[13px] leading-relaxed">
      <span class="font-medium">{{ t("check.fix") }}:</span>
      {{ check.recommendation }}
    </p>
    <details v-if="!compact" class="issue-details">
      <summary>{{ t("check.details") }}</summary>
      <dl v-if="check.evidence.length" class="mt-2 space-y-1 text-[12px] text-muted">
        <div v-for="item in check.evidence" :key="`${check.id}-${item.label}-${item.value}`">
          <dt class="inline font-medium">{{ item.label }}:</dt>
          <dd class="inline break-all">{{ item.value }}</dd>
        </div>
      </dl>
      <p v-if="guide" class="mb-0 mt-2 text-[13px] leading-relaxed">
        <span class="font-medium">{{ t("check.verify") }}:</span>
        {{ guide.verify }}
      </p>
      <p v-if="guide?.example" class="issue-example">
        <span class="font-medium">{{ t("check.example") }}.</span>
        {{ t("check.exampleNote") }}
        <code>{{ guide.example }}</code>
      </p>
      <p class="mb-0 mt-2 font-mono text-[11px] text-muted">{{ check.id }}</p>
    </details>
  </article>
</template>
