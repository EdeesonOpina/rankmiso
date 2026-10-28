<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ copy: [value: string] }>();
const { t, n } = useI18n();
const mode = ref<"tree" | "raw">("tree");

interface Entity {
  key: string;
  label: string;
  format: string;
  valid: boolean;
  error: string | null;
  type: string;
  entries: Array<{ key: string; value: string; nested: string[] | null; kind: "object" | "array" | "" }>;
  json: string;
}

function formatName(format: string): string {
  const value = format.toLowerCase();
  if (value.includes("micro")) return "Microdata";
  if (value.includes("rdf")) return "RDFa";
  return "JSON-LD";
}

function short(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Microdata and RDFa blocks hold { items, limitations }; each item keeps its
// values under `properties`. Flatten an item so it reads like a JSON-LD node.
function markupItems(parsed: unknown): unknown[] {
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const { properties, "@id": id, ...rest } = (item ?? {}) as Record<string, unknown>;
    const flat: Record<string, unknown> = { ...rest };
    if (id) flat["@id"] = id;
    for (const [key, values] of Object.entries((properties ?? {}) as Record<string, unknown>))
      flat[key] = Array.isArray(values) && values.length === 1 ? values[0] : values;
    return flat;
  });
}

function typeOf(value: Record<string, unknown>): string {
  const type = value["@type"] ?? value.type ?? value.itemtype ?? value.typeof;
  const names = (Array.isArray(type) ? type : [type])
    .filter((name) => name != null && name !== "")
    .map((name) => String(name).replace(/^https?:\/\/schema\.org\//, ""));
  return names.length ? names.join(", ") : t("popup.noType");
}

const entities = computed<Entity[]>(() => {
  const list: Entity[] = [];
  const counters: Record<string, number> = {};
  props.audit.details.structuredData.forEach((block, blockIndex) => {
    const format = formatName(block.format);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(block.raw);
    } catch {
      parsed = null;
    }
    const items: unknown[] = format !== "JSON-LD"
      ? markupItems(parsed)
      : Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { "@graph"?: unknown })["@graph"])
        ? ((parsed as { "@graph": unknown[] })["@graph"])
        : [parsed];
    items.forEach((item, itemIndex) => {
      counters[format] = (counters[format] ?? 0) + 1;
      const record = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : null;
      list.push({
        key: `${blockIndex}-${itemIndex}`,
        label: `${format} ${String(counters[format]).padStart(2, "0")}`,
        format,
        valid: block.validJson && record != null,
        error: block.error,
        type: record ? typeOf(record) : t("popup.jsonInvalid"),
        entries: record
          ? Object.entries(record).map(([key, value]) => {
              if (Array.isArray(value))
                return { key, value: t("pm.itemCount", { count: value.length }), nested: value.map(short), kind: "array" as const };
              if (value && typeof value === "object") {
                const nested = Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${short(v)}`);
                return { key, value: t("pm.propertyCount", { count: nested.length }), nested, kind: "object" as const };
              }
              return { key, value: short(value), nested: null, kind: "" as const };
            })
          : [],
        json: record ? JSON.stringify(record, null, 2) : block.raw,
      });
    });
  });
  return list;
});
const counts = computed(() => {
  const result = { "JSON-LD": 0, Microdata: 0, RDFa: 0 } as Record<string, number>;
  for (const block of props.audit.details.structuredData) result[formatName(block.format)] = (result[formatName(block.format)] ?? 0) + 1;
  return result;
});
const allValid = computed(() => props.audit.details.structuredData.every((block) => block.validJson));
function subtitle(entity: Entity): string {
  if (entity.format === "Microdata") return `Microdata · ${t("pm.extractedLower")}`;
  if (entity.format === "RDFa") return `RDFa · ${t("pm.boundedSubset")}`;
  return `${entity.label} · ${entity.valid ? t("pm.parsedLower") : t("popup.jsonInvalid")}`;
}
const first = computed(() => entities.value[0] ?? null);
const rest = computed(() => entities.value.slice(1));
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.schema") }}</span><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="pair" style="align-items: end">
    <div>
      <h2 class="sec-heading">{{ t("nav.schema") }}</h2>
      <p class="helper" style="margin: 5px 0 0">{{ t("pm.schemaHelp") }}</p>
    </div>
    <span v-if="audit.details.structuredData.length" class="badge" :class="allValid ? 'ok' : 'err'">{{
      allValid ? t("pm.jsonSyntax") : t("popup.jsonInvalid")
    }}</span>
  </div>
  <div class="grid3" style="margin: 14px 0">
    <div class="mini-tile"><strong>{{ n(counts["JSON-LD"] ?? 0) }}</strong><span>JSON-LD</span></div>
    <div class="mini-tile"><strong>{{ n(counts.Microdata ?? 0) }}</strong><span>Microdata</span></div>
    <div class="mini-tile"><strong>{{ n(counts.RDFa ?? 0) }}</strong><span>RDFa</span></div>
  </div>
  <p v-if="!first" class="note">{{ t("empty.schemaBody") }}</p>
  <template v-else>
    <div class="segmented" style="margin-bottom: 12px">
      <button type="button" class="segment" :aria-pressed="mode === 'tree'" @click="mode = 'tree'">
        {{ t("pm.explore") }}
      </button>
      <button type="button" class="segment" :aria-pressed="mode === 'raw'" @click="mode = 'raw'">
        {{ t("pm.rawJson") }}
      </button>
    </div>
    <div v-if="mode === 'tree'">
      <div class="surface">
        <div class="pair">
          <div>
            <span class="tiny-label">{{ first.label }}</span>
            <strong class="row-title" style="font-size: 14px; margin-top: 5px">{{ first.type }}</strong>
          </div>
          <span class="badge" :class="first.valid ? 'ok' : 'err'">{{
            first.valid ? t("pm.parsed") : t("popup.jsonInvalid")
          }}</span>
        </div>
        <div class="divider" />
        <p v-if="!first.valid" class="row-sub">{{ first.error }}</p>
        <ul class="tree">
          <li v-for="entry in first.entries" :key="entry.key">
            <template v-if="!entry.nested">
              <span class="key">{{ entry.key }}</span><br /><span class="value">{{ entry.value }}</span>
            </template>
            <details v-else>
              <summary class="code" style="cursor: pointer">
                {{ entry.key }} <span class="muted">{{ entry.value }}</span>
              </summary>
              <div class="nested code">
                <template v-for="(line, index) in entry.nested" :key="index">{{ line }}<br /></template>
              </div>
            </details>
          </li>
        </ul>
        <div class="actions">
          <button type="button" class="button-sm" @click="emit('copy', first.json)">
            {{ t("pm.copyJson") }} ↗
          </button>
        </div>
      </div>
      <details v-for="(entity, index) in rest" :key="entity.key" class="disclosure" :style="index === 0 ? 'margin-top:10px' : ''">
        <summary>
          <span>
            <strong class="disclosure-title">{{ entity.type }}</strong>
            <span class="disclosure-sub">{{ subtitle(entity) }}</span>
          </span>
        </summary>
        <div class="inside">
          <span class="code">
            <template v-for="entry in entity.entries" :key="entry.key">{{ entry.key }}: {{ entry.value }}<br /></template>
          </span>
        </div>
      </details>
    </div>
    <div v-else>
      <pre v-for="entity in entities" :key="entity.key" class="code-block">{{ entity.json }}</pre>
    </div>
  </template>
  <p class="micro" style="margin-top: 13px">{{ t("pm.schemaNote") }}</p>
</template>
