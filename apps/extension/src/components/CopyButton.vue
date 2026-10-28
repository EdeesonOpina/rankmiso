<script setup lang="ts">
import { ref } from "vue";
import { Check, Copy } from "lucide-vue-next";
import { useI18n } from "../composables/useI18n";

const props = defineProps<{ value: string; label?: string; accessibleName?: string }>();
const { t } = useI18n();
const copied = ref(false);
let timer = 0;

async function copy() {
  await navigator.clipboard.writeText(props.value);
  copied.value = true;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    copied.value = false;
  }, 1200);
}
</script>

<template>
  <button
    type="button"
    class="inline-flex shrink-0 items-center justify-center gap-1 text-muted hover:text-foreground"
    :class="label ? 'inspector-action' : 'h-7 w-7 rounded-panel hover:bg-background'"
    :aria-label="copied ? t('action.copied') : accessibleName || label || t('action.copy')"
    @click="copy"
  >
    <Check v-if="copied" class="h-3.5 w-3.5" aria-hidden="true" />
    <Copy v-else class="h-3.5 w-3.5" aria-hidden="true" />
    <span v-if="label">{{ label }}</span>
  </button>
</template>
