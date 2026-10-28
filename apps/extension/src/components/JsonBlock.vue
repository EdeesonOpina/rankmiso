<script setup lang="ts">
import { computed, ref } from "vue";
import { readableJson, schemaIdentity } from "../services/readable-json";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";
import JsonStructure from "./JsonStructure.vue";

const props = defineProps<{
  raw: string;
  valid: boolean;
  error: string | null;
  index: number;
  total: number;
  format?: string;
}>();
const { t } = useI18n();
const mode = ref<"structured" | "raw">("structured");
const parsed = computed(() => readableJson(props.raw));
const identity = computed(() => (parsed.value.ok ? schemaIdentity(parsed.value.node) : null));
const syntaxOk = computed(() => props.valid && parsed.value.ok);
</script>

<template>
  <article class="json-block">
    <header class="json-block-head">
      <p class="m-0 text-[13px] font-semibold">
        {{
          props.format === "microdata"
            ? t("schema.microdata")
            : props.format === "rdfa"
              ? t("schema.rdfa")
              : t("schema.jsonld")
        }}
        · {{ t("schema.block", { index: index + 1, total }) }}
      </p>
      <p v-if="identity && identity.types.length" class="m-0 text-[13px]">
        {{ identity.types.join(", ") }}
      </p>
      <p v-if="identity?.id" class="m-0 break-all text-[12px] text-muted">{{ identity.id }}</p>
      <p v-if="identity?.graph" class="m-0 text-[12px] text-muted">@graph</p>
      <p class="m-0 text-[12px]" :class="syntaxOk ? 'text-muted' : 'text-danger'">
        {{
          props.format === "microdata" || props.format === "rdfa"
            ? props.valid
              ? t("schema.extracted")
              : t("schema.unreadable")
            : syntaxOk
              ? t("popup.jsonValid")
              : t("popup.jsonInvalid")
        }}
      </p>
    </header>
    <div class="flex flex-wrap gap-2" role="group" :aria-label="t('schema.view')">
      <button
        type="button"
        class="inspector-action"
        :class="mode === 'structured' ? 'is-primary' : ''"
        :aria-pressed="mode === 'structured'"
        @click="mode = 'structured'"
      >
        {{ t("schema.structured") }}
      </button>
      <button
        type="button"
        class="inspector-action"
        :class="mode === 'raw' ? 'is-primary' : ''"
        :aria-pressed="mode === 'raw'"
        @click="mode = 'raw'"
      >
        {{ t("schema.raw") }}
      </button>
      <CopyButton :value="raw" :label="t('schema.copySource')" />
      <CopyButton
        v-if="parsed.ok && parsed.copyText !== raw"
        :value="parsed.copyText"
        :label="t('schema.copyFormatted')"
      />
    </div>
    <p v-if="parsed.ok && parsed.copyText !== raw" class="json-note">
      {{ t("schema.formattedNote") }}
    </p>
    <p v-if="error" class="m-0 text-[13px] leading-relaxed text-danger">{{ error }}</p>
    <p v-if="!raw" class="json-note">{{ t("schema.missingSource") }}</p>
    <div v-if="mode === 'raw'" class="json-raw">{{ parsed.ok ? parsed.copyText : raw }}</div>
    <div v-else-if="parsed.ok && parsed.node.kind === 'fields'" class="json-tree">
      <JsonStructure
        v-for="field in parsed.node.fields"
        :key="field.key"
        :node="field.value"
        :name="field.key"
        :path="field.key"
      />
      <p v-if="parsed.node.hidden" class="json-note">
        {{ t("schema.hidden", { count: parsed.node.hidden }) }}
      </p>
    </div>
    <div v-else-if="parsed.ok && parsed.node.kind === 'list'" class="json-tree">
      <JsonStructure
        v-for="(item, itemIndex) in parsed.node.items"
        :key="itemIndex"
        :node="item"
        :name="`[${itemIndex}]`"
        :path="`[${itemIndex}]`"
      />
    </div>
    <p v-else-if="mode === 'structured'" class="json-raw">{{ raw }}</p>
  </article>
</template>
