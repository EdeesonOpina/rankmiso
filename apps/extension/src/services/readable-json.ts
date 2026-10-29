export type JsonNode =
  | { kind: "value"; type: "string" | "number" | "boolean" | "null"; text: string }
  | { kind: "list"; items: JsonNode[]; hidden: number }
  | { kind: "fields"; fields: Array<{ key: string; value: JsonNode }>; hidden: number }
  | { kind: "limit"; text: string };

export type ReadableJson =
  { ok: true; node: JsonNode; copyText: string } | { ok: false; copyText: string };

const MAX_DEPTH = 8;
const MAX_ITEMS = 40;

function toNode(value: unknown, depth: number): JsonNode {
  if (value === null) return { kind: "value", type: "null", text: "null" };
  if (typeof value === "string") return { kind: "value", type: "string", text: value };
  if (typeof value === "number") return { kind: "value", type: "number", text: String(value) };
  if (typeof value === "boolean") {
    return { kind: "value", type: "boolean", text: value ? "true" : "false" };
  }
  if (depth >= MAX_DEPTH) return { kind: "limit", text: JSON.stringify(value) };
  if (Array.isArray(value)) {
    return {
      kind: "list",
      hidden: Math.max(0, value.length - MAX_ITEMS),
      items: value.slice(0, MAX_ITEMS).map((item) => toNode(item, depth + 1)),
    };
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      kind: "fields",
      hidden: Math.max(0, entries.length - MAX_ITEMS),
      fields: entries.slice(0, MAX_ITEMS).map(([key, child]) => ({
        key,
        value: toNode(child, depth + 1),
      })),
    };
  }
  return { kind: "value", type: "string", text: String(value) };
}

export function readableJson(raw: string): ReadableJson {
  try {
    const value = JSON.parse(raw) as unknown;
    return { ok: true, node: toNode(value, 0), copyText: JSON.stringify(value, null, 2) };
  } catch {
    return { ok: false, copyText: raw };
  }
}

export function schemaIdentity(node: JsonNode): {
  types: string[];
  id: string | null;
  graph: boolean;
} {
  if (node.kind !== "fields") return { types: [], id: null, graph: false };
  const typeField = node.fields.find((field) => field.key === "@type");
  const idField = node.fields.find((field) => field.key === "@id");
  const id = idField?.value.kind === "value" ? idField.value.text : null;
  return {
    types: valueTexts(typeField?.value),
    id,
    graph: node.fields.some((field) => field.key === "@graph"),
  };
}

export function valueTexts(node: JsonNode | undefined): string[] {
  if (!node) return [];
  if (node.kind === "value") return [node.text];
  if (node.kind === "list") return node.items.flatMap((item) => valueTexts(item));
  return [];
}

export function jsonCopy(node: JsonNode): string {
  if (node.kind === "value" || node.kind === "limit") return node.text;
  return JSON.stringify(reconstruct(node));
}

function reconstruct(node: JsonNode): unknown {
  if (node.kind === "value") {
    if (node.type === "null") return null;
    if (node.type === "number") return Number(node.text);
    if (node.type === "boolean") return node.text === "true";
    return node.text;
  }
  if (node.kind === "limit") return node.text;
  if (node.kind === "list") return node.items.map((item) => reconstruct(item));
  return Object.fromEntries(node.fields.map((field) => [field.key, reconstruct(field.value)]));
}

export function jsonPath(parent: string, key: string): string {
  if (!parent) return key;
  return key.startsWith("[") ? `${parent}${key}` : `${parent}.${key}`;
}
