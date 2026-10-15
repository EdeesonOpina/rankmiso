import { describe, expect, it } from "vitest";
import {
  headingLevelCounts,
  popupOverview,
  type PopupOverviewModel,
} from "../src/services/popup-summary";
import type { AuditResult } from "../src/types/audit";

function overview(patch: {
  url?: string;
  title?: string | null;
  description?: string | null;
  headings?: AuditResult["details"]["headings"];
  canonicals?: string[];
  robots?: string[];
  language?: string | null;
  words?: number | null;
  types?: string[];
  counts?: Partial<AuditResult["metrics"]["counts"]>;
}): PopupOverviewModel {
  const audit = {
    page: { url: patch.url ?? "https://example.com/guide" },
    details: {
      metadata: {
        title: patch.title ?? null,
        description: patch.description ?? null,
        titleLength: patch.title?.length ?? 0,
        descriptionLength: patch.description?.length ?? 0,
        titlePixelEstimate: 120,
        canonicals: patch.canonicals ?? [],
        robots: patch.robots ?? [],
        language: patch.language ?? null,
      },
      headings: patch.headings ?? [],
      structuredData: (patch.types ?? []).map((type) => ({ types: [type] })),
    },
    metrics: {
      content: { wordCount: patch.words ?? null },
      counts: {
        headings: 0,
        h1: 0,
        links: 0,
        internalLinks: 0,
        externalLinks: 0,
        images: 0,
        imagesMissingAlt: 0,
        imagesEmptyAlt: 0,
        ...patch.counts,
      },
    },
  } as Pick<AuditResult, "page" | "metrics" | "details">;
  return popupOverview(audit);
}

describe("heading level counts", () => {
  it("counts H1 through H6 and leaves unused levels at zero", () => {
    expect(headingLevelCounts([{ level: 1 }, { level: 2 }, { level: 2 }, { level: 4 }])).toEqual([
      1, 2, 0, 1, 0, 0,
    ]);
  });
});

describe("popup overview", () => {
  it("keeps missing page facts empty instead of inventing them", () => {
    const result = overview({});
    expect(result.host).toBe("example.com");
    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
    expect(result.h1).toBeNull();
    expect(result.canonical).toBeNull();
    expect(result.robots).toBeNull();
    expect(result.language).toBeNull();
    expect(result.words).toBeNull();
    expect(result.schemaTypes).toEqual([]);
  });

  it("summarizes the first H1, canonical, and schema types", () => {
    const result = overview({
      title: "Guide",
      description: "How the page is described.",
      headings: [
        { level: 1, text: "First heading", location: "main" },
        { level: 1, text: "Second heading", location: "main" },
        { level: 2, text: "Section", location: "main" },
      ],
      canonicals: ["https://example.com/guide", "https://example.com/other"],
      robots: ["noindex", "nofollow"],
      language: "en",
      words: 240,
      types: ["Article", "Article", "FAQPage"],
      counts: {
        headings: 3,
        h1: 2,
        links: 5,
        internalLinks: 4,
        externalLinks: 1,
        images: 2,
        imagesMissingAlt: 1,
      },
    });
    expect(result.h1).toBe("First heading");
    expect(result.extraH1).toBe(1);
    expect(result.canonical).toBe("https://example.com/guide");
    expect(result.extraCanonicals).toBe(1);
    expect(result.robots).toBe("noindex, nofollow");
    expect(result.schemaTypes).toEqual(["Article", "FAQPage"]);
    expect(result.words).toBe(240);
    expect(result.imagesMissingAlt).toBe(1);
  });
});
