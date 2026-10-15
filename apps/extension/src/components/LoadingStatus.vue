<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";

defineProps<{ label: string }>();
</script>

<template>
  <p role="status" aria-live="polite" class="m-0 flex items-center gap-2 text-[13px] text-muted">
    <LoaderCircle class="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
    <span>{{ label }}</span>
  </p>
</template>
