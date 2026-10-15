<script setup lang="ts">
import { computed } from "vue";
import AnalysisApp from "../../src/components/AnalysisApp.vue";

const tabId = computed(() => {
  const value = Number(new URLSearchParams(location.search).get("tabId"));
  return Number.isInteger(value) && value > 0 ? value : undefined;
});

const initialSection = computed(
  () => new URLSearchParams(location.search).get("section") || "overview",
);
</script>

<template>
  <AnalysisApp layout="dashboard" :tab-id="tabId" :initial-section="initialSection" />
</template>
