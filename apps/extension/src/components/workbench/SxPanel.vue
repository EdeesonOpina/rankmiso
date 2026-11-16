<script setup lang="ts">
defineProps<{ title: string; text?: string; badge?: string }>();
</script>

<template>
  <section class="sx-panel" :aria-label="title">
    <div class="sx-panel-head">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="text">{{ text }}</p>
      </div>
      <slot name="aside">
        <span v-if="badge" class="sx-count">{{ badge }}</span>
      </slot>
    </div>
    <slot />
    <div v-if="$slots.foot" class="sx-panel-foot"><slot name="foot" /></div>
  </section>
</template>
