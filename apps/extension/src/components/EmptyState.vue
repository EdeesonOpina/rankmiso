<script setup lang="ts">
defineProps<{ title: string; description: string }>();
</script>

<template>
  <div class="flex items-start gap-3 border-b border-border py-3">
    <div
      class="grid h-9 w-9 shrink-0 place-items-center rounded-panel bg-background text-muted"
      aria-hidden="true"
    >
      <slot />
    </div>
    <div class="min-w-0 pt-0.5">
      <p class="m-0 text-[13px] font-medium">{{ title }}</p>
      <p class="mb-0 mt-1 text-[13px] leading-relaxed text-muted">{{ description }}</p>
    </div>
  </div>
</template>
