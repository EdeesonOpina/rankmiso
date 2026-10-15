<script setup lang="ts">
import { computed } from "vue";
import { brandConfig } from "../config/brand.config";
import { useTheme } from "../composables/useTheme";

const { resolved } = useTheme();
const src = computed(() =>
  resolved.value === "dark" ? brandConfig.assets.logoDark : brandConfig.assets.logoLight,
);
</script>

<template>
  <img
    :src="src"
    :alt="brandConfig.identity.name"
    class="h-6 w-6 shrink-0"
    width="24"
    height="24"
  />
</template>
