<script setup lang="ts">
import WorkbenchApp from "../../src/components/workbench/WorkbenchApp.vue";

const params = new URLSearchParams(location.search);
const value = Number(params.get("tabId"));
const tabId = Number.isInteger(value) && value > 0 ? value : undefined;
const initialSection = params.get("section") || "overview";
</script>

<template>
  <WorkbenchApp surface="report" :tab-id="tabId" :initial-section="initialSection" />
</template>
