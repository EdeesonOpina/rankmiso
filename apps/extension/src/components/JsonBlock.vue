<script setup lang="ts">
import { computed } from "vue";
import { readableJson } from "../services/readable-json";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";
import JsonStructure from "./JsonStructure.vue";

const props = defineProps<{ raw: string; valid: boolean; error: string | null }>();
const { t } = useI18n();
const parsed = computed(() => readableJson(props.raw));
</script>

<template>
  <article class="space-y-6 rounded-panel border border-border bg-surface px-5 pb-6 pt-5">
    <div class="flex items-start justify-between gap-3">
      <p class="m-0 text-[13px] font-semibold">
        {{ valid ? t("popup.jsonValid") : t("popup.jsonInvalid") }}
      </p>
      <CopyButton :value="parsed.copyText" />
    </div>
    <p v-if="error" class="m-0 text-[13px] leading-relaxed text-danger">{{ error }}</p>
    <JsonStructure v-if="parsed.ok" :node="parsed.node" />
    <p v-else class="m-0 break-words text-[13px] leading-relaxed text-muted">{{ raw }}</p>
  </article>
</template>
