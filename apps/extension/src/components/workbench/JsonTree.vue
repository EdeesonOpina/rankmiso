<script setup lang="ts">
import type { JsonNode } from "../../services/readable-json";
import { useI18n } from "../../composables/useI18n";

defineOptions({ name: "JsonTree" });
defineProps<{ fields: Array<{ key: string; value: JsonNode }>; hidden?: number }>();
const { t, n } = useI18n();

function hint(node: JsonNode): string {
  if (node.kind === "list") return t("wb.sc.array", { count: n(node.items.length + node.hidden) });
  return t("schema.object");
}

function entries(node: JsonNode): Array<{ key: string; value: JsonNode }> {
  if (node.kind === "fields") return node.fields;
  if (node.kind === "list") return node.items.map((value, index) => ({ key: `[${index}]`, value }));
  return [];
}
</script>

<template>
  <div class="json-tree">
    <template v-for="field in fields" :key="field.key">
      <details
        v-if="field.value.kind === 'fields' || field.value.kind === 'list'"
        class="disclosure"
      >
        <summary>
          {{ field.key }} · {{ hint(field.value) }}<span aria-hidden="true">⌄</span>
        </summary>
        <div class="details-body">
          <JsonTree :fields="entries(field.value)" :hidden="field.value.hidden" />
        </div>
      </details>
      <div v-else>
        <span>{{ field.key }}</span>
        <code>{{ field.value.text }}</code>
      </div>
    </template>
    <p v-if="hidden" class="hint">{{ t("schema.hidden", { count: hidden }) }}</p>
  </div>
</template>
