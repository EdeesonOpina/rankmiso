import type { AuditResult } from "../types/audit";

export interface PopupOverviewModel {
  host: string;
  title: string | null;
  description: string | null;
  titleLength: number;
  descriptionLength: number;
  titlePixels: number;
  h1: string | null;
  extraH1: number;
  canonical: string | null;
  extraCanonicals: number;
  robots: string | null;
  language: string | null;
  words: number | null;
  headings: number;
  h1Count: number;
  links: number;
  internalLinks: number;
  externalLinks: number;
  images: number;
  imagesMissingAlt: number;
  schemaTypes: string[];
}

type PopupSource = Pick<AuditResult, "page" | "metrics" | "details">;

export function headingLevelCounts(headings: Array<{ level: number }>): number[] {
  return [1, 2, 3, 4, 5, 6].map(
    (level) => headings.filter((heading) => heading.level === level).length,
  );
}

export function pageHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function popupOverview(audit: PopupSource): PopupOverviewModel {
  const metadata = audit.details.metadata;
  const h1s = audit.details.headings.filter((heading) => heading.level === 1);
  const schemaTypes = [...new Set(audit.details.structuredData.flatMap((block) => block.types))];
  return {
    host: pageHost(audit.page.url),
    title: metadata.title,
    description: metadata.description,
    titleLength: metadata.titleLength,
    descriptionLength: metadata.descriptionLength,
    titlePixels: metadata.titlePixelEstimate,
    h1: h1s[0]?.text ?? null,
    extraH1: Math.max(0, h1s.length - 1),
    canonical: metadata.canonicals[0] ?? null,
    extraCanonicals: Math.max(0, metadata.canonicals.length - 1),
    robots: metadata.robots.length > 0 ? metadata.robots.join(", ") : null,
    language: metadata.language,
    words: audit.metrics.content.wordCount,
    headings: audit.metrics.counts.headings,
    h1Count: audit.metrics.counts.h1,
    links: audit.metrics.counts.links,
    internalLinks: audit.metrics.counts.internalLinks,
    externalLinks: audit.metrics.counts.externalLinks,
    images: audit.metrics.counts.images,
    imagesMissingAlt: audit.metrics.counts.imagesMissingAlt,
    schemaTypes,
  };
}
