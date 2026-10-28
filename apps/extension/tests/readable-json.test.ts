import { describe, expect, it } from "vitest";
import { readableJson, schemaIdentity } from "../src/services/readable-json";

describe("readable JSON-LD", () => {
  it("turns an object into labeled fields and keeps words intact", () => {
    const parsed = readableJson(
      '{"@type":"RealEstateListing","name":"Modern Duplex Living","offers":{"price":"12000000"}}',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.node.kind).toBe("fields");
    if (parsed.node.kind !== "fields") return;
    expect(parsed.node.fields[0]).toEqual({
      key: "@type",
      value: { kind: "value", type: "string", text: "RealEstateListing" },
    });
    expect(parsed.node.fields[1]).toEqual({
      key: "name",
      value: { kind: "value", type: "string", text: "Modern Duplex Living" },
    });
    expect(parsed.node.fields[2]?.value.kind).toBe("fields");
    expect(parsed.copyText).toContain("\n");
    expect(parsed.copyText).toContain("Modern Duplex Living");
  });

  it("keeps invalid JSON as copyable source text", () => {
    const parsed = readableJson("{not json");
    expect(parsed.ok).toBe(false);
    expect(parsed.copyText).toBe("{not json");
  });

  it("keeps graphs, arrays, multiple types, and null without inventing fields", () => {
    const parsed = readableJson(
      '{"@graph":[{"@type":["Organization","LocalBusiness"],"@id":"https://example.com/#org","name":null,"sameAs":["https://example.com/a"]}]}',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.node.kind !== "fields") return;
    expect(schemaIdentity(parsed.node).graph).toBe(true);
    const graph = parsed.node.fields[0]?.value;
    expect(graph?.kind).toBe("list");
    if (graph?.kind !== "list" || graph.items[0]?.kind !== "fields") return;
    expect(schemaIdentity(graph.items[0]).types).toEqual(["Organization", "LocalBusiness"]);
    expect(graph.items[0].fields.find((field) => field.key === "name")?.value).toEqual({
      kind: "value",
      type: "null",
      text: "null",
    });
    const sameAs = graph.items[0].fields.find((field) => field.key === "sameAs")?.value;
    expect(sameAs?.kind).toBe("list");
    if (sameAs?.kind === "list") expect(sameAs.items).toHaveLength(1);
  });

  it("stops at the nesting bound and keeps a copyable remainder", () => {
    let value = "1";
    for (let depth = 0; depth < 12; depth += 1) value = `{"next":${value}}`;
    const parsed = readableJson(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const flat = JSON.stringify(parsed.node);
    expect(flat).toContain('"kind":"limit"');
  });

  it("labels formatted JSON separately from the source", () => {
    const raw = '{"name":"Example Company"}';
    const parsed = readableJson(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.copyText).not.toBe(raw);
    expect(parsed.copyText).toContain("Example Company");
  });
});
