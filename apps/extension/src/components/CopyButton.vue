<script setup lang="ts">
import { ref } from "vue";
import { Check, Copy } from "lucide-vue-next";
import { useI18n } from "../composables/useI18n";

const props = defineProps<{ value: string }>();
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
    class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-panel text-muted hover:bg-background hover:text-foreground"
    :aria-label="copied ? t('action.copied') : t('action.copy')"
    @click="copy"
  >
    <Check v-if="copied" class="h-3.5 w-3.5" aria-hidden="true" />
    <Copy v-else class="h-3.5 w-3.5" aria-hidden="true" />
  </button>
</template>
