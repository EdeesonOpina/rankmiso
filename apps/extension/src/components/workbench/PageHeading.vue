<script setup lang="ts">
defineProps<{ overline: string; title: string; text?: string }>();
</script>

<template>
  <div class="page-heading">
    <div class="overline">{{ overline }}</div>
    <h1>{{ title }}</h1>
    <p v-if="text">{{ text }}</p>
  </div>
</template>
