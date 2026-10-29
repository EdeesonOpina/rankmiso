import { collectMarkup } from "./structured-markup";

export interface HtmlSignals {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  googlebot: string;
  bingbot: string;
  language: string;
  hreflang: string;
  h1Count: string;
  h1: string;
  jsonLd: string;
  microdata: string;
  rdfa: string;
  internalLinks: string;
  externalLinks: string;
}

export type CompareState = "same" | "added" | "removed" | "changed";

export interface CompareRow {
  id: keyof HtmlSignals;
  fetched: string;
  rendered: string;
  state: CompareState;
  numeric: boolean;
}

const ORDER: Array<keyof HtmlSignals> = [
  "title",
  "description",
  "canonical",
  "robots",
  "googlebot",
  "bingbot",
  "language",
  "hreflang",
  "h1Count",
  "h1",
  "jsonLd",
  "microdata",
  "rdfa",
  "internalLinks",
  "externalLinks",
];

const NUMERIC = new Set<keyof HtmlSignals>([
  "h1Count",
  "internalLinks",
  "externalLinks",
  "jsonLd",
  "microdata",
  "rdfa",
]);

export function parseHtml(html: string, pageUrl: string): Document {
  const document = new DOMParser().parseFromString(html, "text/html");
  if (!document.querySelector("base[href]")) {
    const base = document.createElement("base");
    base.href = pageUrl;
    document.head.prepend(base);
  }
  return document;
}

export function signalsFromDocument(document: Document, pageUrl: string): HtmlSignals {
  const h1s = Array.from(document.querySelectorAll("h1"))
    .map((heading) => (heading.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 20);
  let internal = 0;
  let external = 0;
  const page = new URL(pageUrl);
  document.querySelectorAll("a[href]").forEach((link) => {
    try {
      const url = new URL(link.getAttribute("href") || "", pageUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.host === page.host) internal += 1;
      else external += 1;
    } catch {
      /* skip unreadable hrefs */
    }
  });
  const markup = collectMarkup(document);
  return {
    title: clean(document.title),
    description: meta(document, "description"),
    canonical: links(document, "canonical")
      .map((link) => link.href)
      .join(" | "),
    robots: meta(document, "robots"),
    googlebot: meta(document, "googlebot"),
    bingbot: meta(document, "bingbot"),
    language: document.documentElement.lang.trim(),
    hreflang: links(document, "alternate")
      .filter((link) => link.hreflang)
      .map((link) => `${link.hreflang} ${link.href}`)
      .sort()
      .join(" | "),
    h1Count: String(h1s.length),
    h1: h1s.join(" | "),
    jsonLd: jsonLdSummary(document),
    microdata: markupSummary(markup, "microdata"),
    rdfa: markupSummary(markup, "rdfa"),
    internalLinks: String(internal),
    externalLinks: String(external),
  };
}

export function signalsFromAudit(audit: {
  page: { url: string; title: string | null; language: string | null };
  details: {
    metadata: {
      description: string | null;
      canonicals: string[];
      robots: string[];
      googlebot: string[];
      bingbot: string[];
    };
    headings: Array<{ level: number; text: string }>;
    links: Array<{ classification: string }>;
    hreflang: Array<{ lang: string; href: string }>;
    structuredData: Array<{ format: string; types: string[]; raw: string }>;
  };
}): HtmlSignals {
  const h1s = audit.details.headings
    .filter((heading) => heading.level === 1)
    .map((heading) => heading.text);
  return {
    title: clean(audit.page.title || ""),
    description: clean(audit.details.metadata.description || ""),
    canonical: audit.details.metadata.canonicals.join(" | "),
    robots: audit.details.metadata.robots.join(", "),
    googlebot: audit.details.metadata.googlebot.join(", "),
    bingbot: audit.details.metadata.bingbot.join(", "),
    language: clean(audit.page.language || ""),
    hreflang: audit.details.hreflang
      .map((link) => `${link.lang} ${link.href}`)
      .sort()
      .join(" | "),
    h1Count: String(h1s.length),
    h1: h1s.join(" | "),
    jsonLd: formatSummary(audit.details.structuredData, "json-ld"),
    microdata: itemSummary(audit.details.structuredData, "microdata"),
    rdfa: itemSummary(audit.details.structuredData, "rdfa"),
    internalLinks: String(
      audit.details.links.filter((link) => link.classification === "internal").length,
    ),
    externalLinks: String(
      audit.details.links.filter((link) => link.classification === "external").length,
    ),
  };
}

export function compareSignals(fetched: HtmlSignals, rendered: HtmlSignals): CompareRow[] {
  return ORDER.map((id) => ({
    id,
    fetched: fetched[id],
    rendered: rendered[id],
    state: compareValue(fetched[id], rendered[id], NUMERIC.has(id)),
    numeric: NUMERIC.has(id),
  }));
}

export function compareHtml(html: string, pageUrl: string, rendered: HtmlSignals): CompareRow[] {
  return compareSignals(signalsFromDocument(parseHtml(html, pageUrl), pageUrl), rendered);
}

function compareValue(fetched: string, rendered: string, numeric: boolean): CompareState {
  const empty = (value: string) => value.trim() === "" || (numeric && value === "0");
  if (empty(fetched) && empty(rendered)) return "same";
  if (empty(fetched)) return "added";
  if (empty(rendered)) return "removed";
  return fetched === rendered ? "same" : "changed";
}

function jsonLdSummary(document: Document): string {
  const types: string[] = [];
  let count = 0;
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    count += 1;
    try {
      collectTypes(JSON.parse(script.textContent || "null"), types);
    } catch {
      types.push("invalid JSON");
    }
  });
  return summary(count, types);
}

function markupSummary(blocks: Array<{ format: string; raw: string }>, format: string): string {
  const block = blocks.find((item) => item.format === format);
  if (!block) return summary(0, []);
  try {
    const parsed = JSON.parse(block.raw) as { items?: unknown[] };
    const types: string[] = [];
    collectTypes(parsed, types);
    return summary(parsed.items?.length ?? 0, types);
  } catch {
    return "unreadable";
  }
}

function formatSummary(
  blocks: Array<{ format: string; types: string[]; raw: string }>,
  format: string,
): string {
  const matched = blocks.filter((block) => block.format === format);
  return summary(
    matched.length,
    matched.flatMap((block) => block.types),
  );
}

function itemSummary(
  blocks: Array<{ format: string; types: string[]; raw: string }>,
  format: string,
): string {
  const matched = blocks.filter((block) => block.format === format);
  if (!matched.length) return "0";
  let items = 0;
  const types: string[] = [];
  for (const block of matched) {
    try {
      const parsed = JSON.parse(block.raw) as { items?: unknown[] };
      items += parsed.items?.length ?? 0;
      collectTypes(parsed, types);
    } catch {
      items += 1;
      types.push(...block.types);
    }
  }
  return summary(items, types);
}

function summary(count: number, types: string[]): string {
  const unique = [
    ...new Set(types.map((type) => type.split(/[/#]/).pop() || type).filter(Boolean)),
  ];
  if (count === 0) return "0";
  return unique.length ? `${count} ${unique.slice(0, 8).join(", ")}` : String(count);
}

function collectTypes(value: unknown, types: string[]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectTypes(item, types));
    return;
  }
  const record = value as Record<string, unknown>;
  const kind = record["@type"];
  if (typeof kind === "string") types.push(kind);
  if (Array.isArray(kind)) kind.forEach((item) => typeof item === "string" && types.push(item));
  Object.values(record).forEach((item) => collectTypes(item, types));
}

function meta(document: Document, name: string): string {
  return clean(document.querySelector(`meta[name="${name}" i]`)?.getAttribute("content") || "");
}

function links(document: Document, rel: string): Array<{ href: string; hreflang: string }> {
  return Array.from(document.querySelectorAll("link[rel][href]"))
    .filter((link) => (link.getAttribute("rel") || "").toLowerCase().split(/\s+/).includes(rel))
    .map((link) => ({
      href: link.getAttribute("href") || "",
      hreflang: link.getAttribute("hreflang") || "",
    }));
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
