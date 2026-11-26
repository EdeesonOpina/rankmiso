import { describe, expect, it } from "vitest";
import { questionTemplates, siteFacts } from "../src/services/visibility-templates";
import type { AuditResult, TermStat } from "../src/types/audit";

const term = (value: string, count: number, inTitle = true): TermStat => ({
  term: value,
  count,
  density: null,
  inTitle,
  inHeadings: false,
  inDescription: false,
  prominence: null,
});

function audit(options: {
  url?: string;
  title?: string | null;
  headings?: Array<{ level: number; text: string }>;
  jsonLd?: unknown[];
  trigrams?: TermStat[];
  bigrams?: TermStat[];
}): AuditResult {
  return {
    page: { url: options.url ?? "https://www.tncproperties.com.ph/", title: options.title ?? null },
    metrics: {
      content: {
        terms: {
          unigrams: [],
          bigrams: options.bigrams ?? [],
          trigrams: options.trigrams ?? [],
          fourgrams: [],
        },
      },
    },
    details: {
      metadata: { title: options.title ?? null },
      headings: (options.headings ?? []).map((item) => ({ ...item, location: "main" })),
      structuredData: (options.jsonLd ?? []).map((value) => ({
        format: "json-ld",
        validJson: true,
        error: null,
        types: [],
        raw: JSON.stringify(value),
      })),
    },
  } as unknown as AuditResult;
}

describe("visibility question templates", () => {
  it("builds questions from the organization, phrase, locality, and page headings", () => {
    const page = audit({
      title: "House and lot for sale | TNC Properties",
      headings: [
        { level: 1, text: "Affordable house and lot in Cavite" },
        { level: 2, text: "Do you offer Deca Homes units?" },
        { level: 2, text: "Our projects" },
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "RealEstateAgent",
              name: "TNC Properties",
              address: { "@type": "PostalAddress", addressLocality: "Dasmariñas" },
            },
          ],
        },
      ],
      trigrams: [term("house and lot", 6)],
    });
    expect(siteFacts(page)).toMatchObject({
      brand: "TNC Properties",
      brandSource: "structuredData",
      topic: "Affordable house and lot in Cavite",
      phrase: "house and lot",
      locality: "Dasmariñas",
      questions: ["Do you offer Deca Homes units?"],
    });
    const texts = questionTemplates(page).map((item) => item.text);
    expect(texts).toEqual([
      "What is TNC Properties?",
      "Best house and lot in Dasmariñas",
      "What are the best options for house and lot?",
      "Is TNC Properties a good choice for house and lot?",
      "Do you offer Deca Homes units?",
      "Affordable house and lot in Cavite",
    ]);
    expect(questionTemplates(page)[1]).toMatchObject({
      source: "structuredData",
      value: "Dasmariñas",
    });
  });

  it("falls back to the title suffix, then the domain, and leaves out what was not found", () => {
    const titled = audit({ title: "Barley miso guide – Miso Shop" });
    expect(siteFacts(titled)).toMatchObject({
      brand: "Miso Shop",
      brandSource: "title",
      topic: "Barley miso guide",
      topicSource: "title",
      locality: "",
    });
    expect(questionTemplates(titled).some((item) => item.text.includes(" in "))).toBe(false);

    const bare = audit({ title: null });
    expect(siteFacts(bare)).toMatchObject({ brand: "Tncproperties", brandSource: "domain" });
    expect(questionTemplates(bare).map((item) => item.text)).toEqual([
      "What is Tncproperties?",
      "Tncproperties reviews",
    ]);
  });

  it("gives nothing for an address with no usable values", () => {
    const empty = audit({ url: "http://127.0.0.1:8471/", title: null });
    expect(questionTemplates(empty)).toEqual([]);
  });

  it("ignores phrases that appear once or only in body text, and invalid JSON-LD", () => {
    const page = audit({
      title: "Guide",
      bigrams: [term("rare phrase", 1), term("body only", 5, false)],
    });
    page.details.structuredData.push({
      format: "json-ld",
      validJson: true,
      error: null,
      types: [],
      raw: "{not json",
    });
    expect(siteFacts(page).phrase).toBe("");
    expect(() => questionTemplates(page)).not.toThrow();
  });
});
