<script setup lang="ts">
import { computed } from "vue";
import type { CheckStatus } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import type { MessageKey } from "../locales/en";

const props = defineProps<{ status: CheckStatus }>();
const { t } = useI18n();

const labels: Record<CheckStatus, MessageKey> = {
  PASS: "status.pass",
  WARNING: "status.warning",
  ERROR: "status.error",
  INFO: "status.info",
  NOT_APPLICABLE: "status.notApplicable",
  UNAVAILABLE: "status.unavailable",
};

const label = computed(() => t(labels[props.status]));
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium"
    :class="{
      'bg-success-bg text-success': status === 'PASS',
      'bg-warning-bg text-warning': status === 'WARNING',
      'bg-danger-bg text-danger': status === 'ERROR',
      'bg-info-bg text-info': status === 'INFO',
      'bg-surface text-muted': status === 'NOT_APPLICABLE' || status === 'UNAVAILABLE',
    }"
  >
    {{ label }}
  </span>
</template>
