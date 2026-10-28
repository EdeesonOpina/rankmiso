<script setup lang="ts">
import { computed } from "vue";
import { brandConfig } from "../config/brand.config";
import { useTheme } from "../composables/useTheme";

defineProps<{ large?: boolean }>();
const { resolved } = useTheme();
const src = computed(() =>
  resolved.value === "dark" ? brandConfig.assets.logoDark : brandConfig.assets.logoLight,
);
</script>

<template>
  <img
    :src="src"
    alt=""
    class="shrink-0 object-contain"
    :class="large ? 'h-8 w-8' : 'h-6 w-6'"
    :width="large ? 32 : 24"
    :height="large ? 32 : 24"
  />
</template>
