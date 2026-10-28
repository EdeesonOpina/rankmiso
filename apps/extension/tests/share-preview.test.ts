import { describe, expect, it } from "vitest";
import { resolveShareImage, sharePreviews } from "../src/services/share-preview";
import type { AuditResult } from "../src/types/audit";

function previews(input: {
  url?: string;
  title?: string | null;
  description?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogUrl?: string | null;
  ogType?: string | null;
  twitterCard?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
}) {
  const audit = {
    page: { url: input.url ?? "https://www.example.com/guide" },
    details: {
      metadata: {
        title: input.title ?? null,
        description: input.description ?? null,
      },
      social: {
        ogTitle: input.ogTitle ?? null,
        ogDescription: input.ogDescription ?? null,
        ogImage: input.ogImage ?? null,
        ogUrl: input.ogUrl ?? null,
        ogType: input.ogType ?? null,
        twitterCard: input.twitterCard ?? null,
        twitterTitle: input.twitterTitle ?? null,
        twitterDescription: input.twitterDescription ?? null,
        twitterImage: input.twitterImage ?? null,
      },
    },
  } as Pick<AuditResult, "page" | "details">;
  return sharePreviews(audit);
}

describe("share previews", () => {
  it("resolves a relative image and rejects a non-http address", () => {
    expect(resolveShareImage("https://example.com/docs/page", "/cover.png")).toBe(
      "https://example.com/cover.png",
    );
    expect(resolveShareImage("https://example.com/docs/page", "javascript:alert(1)")).toBeNull();
  });

  it("shows the Open Graph image on both cards and labels the X fallback", () => {
    const [link, x] = previews({
      title: "Page title",
      description: "Page description",
      ogImage: "//cdn.example/share.jpg",
      ogUrl: "https://example.com/guide",
    });
    expect(link?.imageUrl).toBe("https://cdn.example/share.jpg");
    expect(link?.titleFrom).toBe("page");
    expect(link?.host).toBe("example.com");
    expect(x?.imageUrl).toBe("https://cdn.example/share.jpg");
    expect(x?.imageFrom).toBe("openGraph");
    expect(x?.layout).toBe("large");
    expect(x?.cardType).toBeNull();
  });

  it("uses a compact X card when the page declares summary", () => {
    const [, x] = previews({
      twitterCard: "summary",
      twitterTitle: "Post",
      twitterImage: "https://cdn.example/small.png",
      ogTitle: "Graph",
    });
    expect(x?.layout).toBe("compact");
    expect(x?.presentation).toBe("summary");
    expect(x?.title).toBe("Post");
    expect(x?.titleFrom).toBe("declared");
    expect(x?.imageFrom).toBe("declared");
  });

  it("keeps a large X card only when that type is declared", () => {
    const [link, large] = previews({
      ogTitle: "Graph title",
      ogImage: "https://cdn.example/wide.png",
      twitterCard: "summary_large_image",
    });
    expect(link?.presentation).toBe("open-graph");
    expect(link?.imageUrl).toBe("https://cdn.example/wide.png");
    expect(large?.presentation).toBe("summary-large");
    expect(large?.imageFrom).toBe("openGraph");
    expect(large?.titleFrom).toBe("openGraph");
  });

  it("does not treat a missing image or an app card as a large image card", () => {
    const [link, app] = previews({
      title: "Only a title",
      twitterCard: "app",
      twitterTitle: "Install",
    });
    expect(link?.imageUrl).toBeNull();
    expect(link?.imageFrom).toBe("none");
    expect(link?.urlFrom).toBe("page");
    expect(app?.presentation).toBe("unsupported");
    expect(app?.title).toBe("Install");
    expect(app?.titleFrom).toBe("declared");
  });
});
