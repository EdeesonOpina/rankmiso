<script setup lang="ts">
import { computed, ref } from "vue";
import { ExternalLink } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import { readableJson, schemaIdentity, type JsonNode } from "../../services/readable-json";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import JsonTree from "./JsonTree.vue";
import RelatedChecks from "./RelatedChecks.vue";

interface Entity {
  key: string;
  format: string;
  type: string;
  node: JsonNode | null;
  error: string | null;
  json: string;
}

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { copy } = useWorkbench();
const mode = ref<"structured" | "raw">("structured");
const blocks = computed(() => props.audit.details.structuredData);

function formatName(format: string): string {
  if (format.includes("micro")) return "Microdata";
  if (format.includes("rdf")) return "RDFa";
  return "JSON-LD";
}

/** Microdata and RDFa items keep values under `properties`; flatten them like a JSON-LD node. */
function flatten(item: unknown): unknown {
  const { properties, "@id": id, ...rest } = (item ?? {}) as Record<string, unknown>;
  const flat: Record<string, unknown> = { ...rest };
  if (id) flat["@id"] = id;
  for (const [key, values] of Object.entries((properties ?? {}) as Record<string, unknown>))
    flat[key] = Array.isArray(values) && values.length === 1 ? values[0] : values;
  return flat;
}

function typeName(node: JsonNode): string {
  const types = schemaIdentity(node)
    .types.filter(Boolean)
    .map((type) => type.replace(/^https?:\/\/schema\.org\//, ""));
  return types.length ? types.join(", ") : t("popup.noType");
}

const entities = computed<Entity[]>(() => {
  const list: Entity[] = [];
  blocks.value.forEach((block, blockIndex) => {
    const format = formatName(block.format);
    let value: unknown;
    try {
      value = JSON.parse(block.raw);
    } catch {
      list.push({
        key: `${blockIndex}`,
        format,
        type: t("popup.jsonInvalid"),
        node: null,
        error: block.error,
        json: block.raw,
      });
      return;
    }
    let items: unknown[];
    if (format !== "JSON-LD") {
      const raw = (value as { items?: unknown } | null)?.items;
      items = Array.isArray(raw) ? raw.map(flatten) : [];
    } else if (Array.isArray(value)) items = value;
    else if (
      value &&
      typeof value === "object" &&
      Array.isArray((value as { "@graph"?: unknown })["@graph"])
    )
      items = (value as { "@graph": unknown[] })["@graph"];
    else items = [value];
    items.forEach((item, itemIndex) => {
      const parsed = readableJson(JSON.stringify(item));
      if (!parsed.ok) return;
      list.push({
        key: `${blockIndex}-${itemIndex}`,
        format,
        type: typeName(parsed.node),
        node: parsed.node,
        error: null,
        json: parsed.copyText,
      });
    });
  });
  return list;
});
const counts = computed(() => {
  const result: Record<string, number> = { "JSON-LD": 0, Microdata: 0, RDFa: 0 };
  for (const block of blocks.value)
    result[formatName(block.format)] = (result[formatName(block.format)] ?? 0) + 1;
  return result;
});
</script>

<template>
  <PageHeading :overline="t('wb.sc.overline')" :title="t('wb.sc.title')" :text="t('wb.sc.text')" />
  <div class="compact-stats">
    <div class="kpi">
      <strong>{{ n(counts["JSON-LD"] ?? 0) }}</strong
      ><span>JSON-LD</span>
    </div>
    <div class="kpi">
      <strong>{{ n(counts.Microdata ?? 0) }}</strong
      ><span>Microdata</span>
    </div>
    <div class="kpi">
      <strong>{{ n(counts.RDFa ?? 0) }}</strong
      ><span>RDFa</span>
    </div>
  </div>
  <p v-if="!blocks.length" class="callout">{{ t("empty.schemaBody") }}</p>
  <template v-else>
    <div class="segmented" role="group" :aria-label="t('wb.sc.view')">
      <button
        type="button"
        :class="{ on: mode === 'structured' }"
        :aria-pressed="mode === 'structured'"
        @click="mode = 'structured'"
      >
        {{ t("wb.sc.structured") }}
      </button>
      <button
        type="button"
        :class="{ on: mode === 'raw' }"
        :aria-pressed="mode === 'raw'"
        @click="mode = 'raw'"
      >
        {{ t("pm.rawJson") }}
      </button>
    </div>
    <div class="schema-views">
      <div v-if="mode === 'structured'" data-sview="structured">
        <details
          v-for="(entity, index) in entities"
          :key="entity.key"
          class="disclosure"
          :open="index === 0"
        >
          <summary>
            <span>{{ entity.type }} · {{ entity.format }}</span
            ><span aria-hidden="true">⌄</span>
          </summary>
          <div class="details-body">
            <template v-if="entity.node && entity.node.kind === 'fields'">
              <JsonTree :fields="entity.node.fields" :hidden="entity.node.hidden" />
            </template>
            <template v-else>
              <p class="is-error">{{ entity.error || t("popup.jsonInvalid") }}</p>
              <pre class="raw-code">{{ entity.json }}</pre>
            </template>
            <button type="button" class="quiet" @click="copy(entity.json)">
              {{ t("pm.copyJson") }}
            </button>
          </div>
        </details>
      </div>
      <div v-else>
        <pre v-for="(block, index) in blocks" :key="index" class="raw-code">{{
          readableJson(block.raw).copyText
        }}</pre>
      </div>
    </div>
  </template>
  <p class="hint">{{ t("wb.sc.hint") }}</p>
  <div class="callout">
    <ExternalLink class="ic" aria-hidden="true" />
    <div>
      <strong>{{ t("schema.validatorTitle") }}</strong>
      <p>{{ t("schema.validatorDescription") }}</p>
      <a
        class="subtle-btn"
        href="https://search.google.com/test/rich-results"
        target="_blank"
        rel="noreferrer"
      >
        {{ t("schema.validator") }} ↗
      </a>
    </div>
  </div>
  <RelatedChecks :audit="audit" category="structuredData" />
</template>
