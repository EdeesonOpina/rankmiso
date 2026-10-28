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

export function headingLevelCounts(headings: readonly { level: number }[]): number[] {
  return [1, 2, 3, 4, 5, 6].map(
    (level) => headings.filter((heading) => heading.level === level).length,
  );
}

export function selectHeadings<T extends { level: number; text: string }>(
  headings: readonly T[],
  query: string,
  level: number,
): T[] {
  const needle = query.trim().toLowerCase();
  return headings.filter((heading) => {
    if (level && heading.level !== level) return false;
    if (!needle) return true;
    return heading.text.toLowerCase().includes(needle);
  });
}

export const linkGroupOrder = ["internal", "external", "other"] as const;
export type LinkGroupName = (typeof linkGroupOrder)[number];

export function linkGroupName(classification: string): LinkGroupName {
  if (classification === "internal" || classification === "external") return classification;
  return "other";
}

export function groupLinks<T extends { classification: string }>(
  links: readonly T[],
): Record<LinkGroupName, T[]> {
  const groups: Record<LinkGroupName, T[]> = { internal: [], external: [], other: [] };
  for (const link of links) groups[linkGroupName(link.classification)].push(link);
  return groups;
}

export function initialLinkGroups(
  groups: Record<LinkGroupName, { length: number }>,
): Record<LinkGroupName, boolean> {
  if (groups.internal.length) return { internal: true, external: false, other: false };
  if (groups.external.length) return { internal: false, external: true, other: false };
  return { internal: false, external: false, other: groups.other.length > 0 };
}

export function selectLinks<
  T extends {
    href: string;
    resolvedUrl: string | null;
    accessibleName: string;
    classification: string;
    nofollow: boolean;
  },
>(links: readonly T[], filter: string, query: string): T[] {
  const needle = query.trim().toLowerCase();
  return links.filter((link) => {
    if (filter === "nofollow" && !link.nofollow) return false;
    if ((filter === "internal" || filter === "external") && link.classification !== filter)
      return false;
    if (!needle) return true;
    return `${link.accessibleName} ${link.href} ${link.resolvedUrl ?? ""}`
      .toLowerCase()
      .includes(needle);
  });
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
