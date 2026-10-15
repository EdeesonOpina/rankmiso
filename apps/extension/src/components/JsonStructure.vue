<script setup lang="ts">
import type { JsonNode } from "../services/readable-json";

defineOptions({ name: "JsonStructure" });
defineProps<{ node: JsonNode }>();
</script>

<template>
  <dl v-if="node.kind === 'fields'" class="m-0 space-y-5">
    <div v-for="field in node.fields" :key="field.key">
      <dt class="text-[12px] text-muted">{{ field.key }}</dt>
      <dd class="m-0 mt-2 break-words text-[13px] leading-relaxed">
        <JsonStructure v-if="field.value.kind !== 'text'" :node="field.value" />
        <span v-else>{{ field.value.text }}</span>
      </dd>
    </div>
  </dl>
  <ol v-else-if="node.kind === 'list'" class="m-0 list-none space-y-3 p-0">
    <li v-for="(item, index) in node.items" :key="index" class="border-l border-border pl-3">
      <JsonStructure :node="item" />
    </li>
  </ol>
  <p v-else class="m-0 break-words leading-relaxed">{{ node.text }}</p>
</template>
