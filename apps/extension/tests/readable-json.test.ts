import { describe, expect, it } from "vitest";
import { readableJson } from "../src/services/readable-json";

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
      value: { kind: "text", text: "RealEstateListing" },
    });
    expect(parsed.node.fields[1]).toEqual({
      key: "name",
      value: { kind: "text", text: "Modern Duplex Living" },
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
});
