import type { AuditResult } from "../types/audit";

/**
 * Starter questions for the AI visibility journal, built only from what this audit read on
 * the page: structured data, the title, the H1, question headings, and repeated phrases.
 * Nothing is fetched or guessed; a template is left out when its value was not found.
 */
export type TemplateSource = "structuredData" | "title" | "domain" | "h1" | "heading" | "terms";

export interface SiteFacts {
  brand: string;
  brandSource: TemplateSource | null;
  topic: string;
  topicSource: TemplateSource | null;
  phrase: string;
  locality: string;
  questions: string[];
}

export interface QuestionTemplate {
  text: string;
  /** Where the site-specific value came from. */
  source: TemplateSource;
  /** The value taken from the page, shown so the user can see the link. */
  value: string;
}

const MAX_VALUE = 70;
const MAX_TEXT = 140;
const ORG_TYPE =
  /^(Organization|Corporation|LocalBusiness|Brand|WebSite|OnlineStore|Store|NGO)$|(Business|Agent|Store|Organization|Service)$/;
const SEPARATORS = /\s+[|–—·:-]\s+|\s*[|–—·]\s*/;

const clean = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.,;:!]+$/, "");

const usable = (value: string) => value.length >= 2 && value.length <= MAX_VALUE;

function jsonLdNodes(audit: AuditResult): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 4 || nodes.length > 200 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const node = value as Record<string, unknown>;
    nodes.push(node);
    if (node["@graph"]) visit(node["@graph"], depth + 1);
  };
  for (const block of audit.details?.structuredData ?? []) {
    if (block.format.toLowerCase() !== "json-ld" || !block.validJson) continue;
    try {
      visit(JSON.parse(block.raw), 0);
    } catch {
      // Invalid JSON-LD is reported by the structured data checks; it gives no facts here.
    }
  }
  return nodes;
}

function types(node: Record<string, unknown>): string[] {
  const value = node["@type"];
  return (Array.isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === "string",
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? clean(value) : "";
}

function domainLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/^[\d.]+$/.test(host) || !host.includes(".")) return "";
    const label = host.split(".")[0] ?? "";
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
  } catch {
    return "";
  }
}

export function siteFacts(audit: AuditResult): SiteFacts {
  const nodes = jsonLdNodes(audit);
  const titleParts = clean(audit.page.title ?? audit.details?.metadata?.title)
    .split(SEPARATORS)
    .map(clean)
    .filter(Boolean);

  let brand = "";
  let brandSource: TemplateSource | null = null;
  const org = nodes.find(
    (node) => types(node).some((type) => ORG_TYPE.test(type)) && text(node.name),
  );
  if (org && usable(text(org.name))) {
    brand = text(org.name);
    brandSource = "structuredData";
  } else if (
    titleParts.length > 1 &&
    usable(titleParts.at(-1)!) &&
    titleParts.at(-1)!.length <= 40
  ) {
    brand = titleParts.at(-1)!;
    brandSource = "title";
  } else if (domainLabel(audit.page.url)) {
    brand = domainLabel(audit.page.url);
    brandSource = "domain";
  }

  let topic = "";
  let topicSource: TemplateSource | null = null;
  const h1 = clean((audit.details?.headings ?? []).find((heading) => heading.level === 1)?.text);
  if (usable(h1) && h1.toLowerCase() !== brand.toLowerCase()) {
    topic = h1;
    topicSource = "h1";
  } else if (titleParts[0] && usable(titleParts[0]) && titleParts[0] !== brand) {
    topic = titleParts[0];
    topicSource = "title";
  }

  const terms = audit.metrics?.content?.terms ?? { trigrams: [], bigrams: [] };
  const phrase =
    [...terms.trigrams, ...terms.bigrams]
      .filter((term) => term.count >= 2 && (term.inTitle || term.inHeadings || term.inDescription))
      .sort((a, b) => b.count - a.count)[0]?.term ?? "";

  let locality = "";
  for (const node of nodes) {
    const address = node.address;
    const value =
      address && typeof address === "object"
        ? text((address as Record<string, unknown>).addressLocality)
        : "";
    if (usable(value)) {
      locality = value;
      break;
    }
  }

  const questions = (audit.details?.headings ?? [])
    .map((heading) => heading.text.replace(/\s+/g, " ").trim())
    .filter((value) => value.endsWith("?") && value.length >= 8 && value.length <= MAX_TEXT)
    .slice(0, 2);

  return { brand, brandSource, topic, topicSource, phrase, locality, questions };
}

export function questionTemplates(audit: AuditResult, max = 6): QuestionTemplate[] {
  const facts = siteFacts(audit);
  const subject = facts.phrase || facts.topic.toLowerCase();
  const subjectSource: TemplateSource | null = facts.phrase ? "terms" : facts.topicSource;
  const out: QuestionTemplate[] = [];
  const add = (text: string, source: TemplateSource | null, value: string) => {
    if (!source || !value.trim() || text.length > MAX_TEXT) return;
    if (out.some((item) => item.text.toLowerCase() === text.toLowerCase())) return;
    out.push({ text, source, value: value.trim() });
  };

  if (facts.brand) add(`What is ${facts.brand}?`, facts.brandSource, facts.brand);
  if (subject && facts.locality)
    add(`Best ${subject} in ${facts.locality}`, "structuredData", facts.locality);
  if (subject) add(`What are the best options for ${subject}?`, subjectSource, subject);
  if (facts.brand && subject)
    add(`Is ${facts.brand} a good choice for ${subject}?`, facts.brandSource, facts.brand);
  for (const question of facts.questions) add(question, "heading", question);
  if (facts.topic) add(facts.topic, facts.topicSource, facts.topic);
  if (facts.brand) add(`${facts.brand} reviews`, facts.brandSource, facts.brand);
  return out.slice(0, max);
}
