<script setup lang="ts">
import type { Component } from "vue";

defineProps<{
  label: string;
  value: string;
  note?: string;
  tone?: "brand" | "danger" | "success" | "warning" | "neutral";
  icon?: Component;
}>();
</script>

<template>
  <article class="sx-stat" :data-tone="tone">
    <div class="sx-stat-top">
      <span>{{ label }}</span>
      <span v-if="icon" class="sx-stat-icon">
        <component :is="icon" class="ic" aria-hidden="true" />
      </span>
    </div>
    <strong>{{ value }}</strong>
    <p v-if="note">{{ note }}</p>
  </article>
</template>
