<script setup lang="ts">
import { ref } from "vue";
import { jsonCopy, jsonPath, schemaIdentity, type JsonNode } from "../services/readable-json";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";

defineOptions({ name: "JsonStructure" });
defineProps<{ node: JsonNode; name: string; path: string }>();
const { t } = useI18n();
const opened = ref(false);

function onToggle(event: Event) {
  opened.value = (event.target as HTMLDetailsElement).open;
}

function hint(node: JsonNode): string {
  if (node.kind === "list") return `[${node.items.length + node.hidden}]`;
  if (node.kind === "fields") {
    const identity = schemaIdentity(node);
    if (identity.types.length) return identity.types.join(", ");
    return t("schema.object");
  }
  return "";
}
</script>

<template>
  <details
    v-if="node.kind === 'fields' || node.kind === 'list'"
    class="json-branch"
    @toggle="onToggle"
  >
    <summary>
      <span class="json-key">{{ name }}</span>
      <span class="json-hint">{{ hint(node) }}</span>
      <span class="json-copies" @click.stop>
        <CopyButton :value="jsonCopy(node)" :accessible-name="t('schema.copyValue')" />
        <CopyButton :value="path" :accessible-name="t('schema.copyPath')" />
      </span>
    </summary>
    <div v-if="opened" class="json-nest">
      <template v-if="node.kind === 'fields'">
        <JsonStructure
          v-for="field in node.fields"
          :key="field.key"
          :node="field.value"
          :name="field.key"
          :path="jsonPath(path, field.key)"
        />
        <p v-if="node.hidden" class="json-note">{{ t("schema.hidden", { count: node.hidden }) }}</p>
      </template>
      <template v-else>
        <JsonStructure
          v-for="(item, index) in node.items"
          :key="index"
          :node="item"
          :name="`[${index}]`"
          :path="jsonPath(path, `[${index}]`)"
        />
        <p v-if="node.hidden" class="json-note">{{ t("schema.hidden", { count: node.hidden }) }}</p>
      </template>
    </div>
  </details>
  <div v-else class="json-leaf">
    <span class="json-key">{{ name }}</span>
    <span v-if="node.kind === 'value'" class="json-hint">{{ node.type }}</span>
    <span class="json-text">{{ node.text }}</span>
    <span class="json-copies">
      <CopyButton :value="node.text" :accessible-name="t('schema.copyValue')" />
      <CopyButton :value="path" :accessible-name="t('schema.copyPath')" />
    </span>
    <p v-if="node.kind === 'limit'" class="json-note">{{ t("schema.depth") }}</p>
  </div>
</template>
