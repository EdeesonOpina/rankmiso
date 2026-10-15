export type JsonNode =
  | { kind: "text"; text: string }
  | { kind: "list"; items: JsonNode[] }
  | { kind: "fields"; fields: Array<{ key: string; value: JsonNode }> };

export type ReadableJson =
  { ok: true; node: JsonNode; copyText: string } | { ok: false; copyText: string };

const MAX_DEPTH = 8;

function textNode(value: string): JsonNode {
  return { kind: "text", text: value };
}

function toNode(value: unknown, depth: number): JsonNode {
  if (value == null) return textNode("—");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return textNode(String(value));
  }
  if (depth >= MAX_DEPTH) return textNode(JSON.stringify(value));
  if (Array.isArray(value)) {
    if (value.length === 0) return textNode("—");
    const scalars = value.every((item) => item == null || typeof item !== "object");
    if (scalars)
      return textNode(value.map((item) => (item == null ? "—" : String(item))).join(", "));
    return { kind: "list", items: value.map((item) => toNode(item, depth + 1)) };
  }
  if (typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>).map(([key, child]) => ({
      key,
      value: toNode(child, depth + 1),
    }));
    if (fields.length === 0) return textNode("—");
    return { kind: "fields", fields };
  }
  return textNode(String(value));
}

export function readableJson(raw: string): ReadableJson {
  try {
    const value = JSON.parse(raw) as unknown;
    return { ok: true, node: toNode(value, 0), copyText: JSON.stringify(value, null, 2) };
  } catch {
    return { ok: false, copyText: raw };
  }
}
