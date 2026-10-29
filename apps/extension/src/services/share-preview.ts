import type { AuditResult } from "../types/audit";

export type ShareFieldSource = "declared" | "openGraph" | "page" | "none";

export type SharePresentation =
  "open-graph" | "summary" | "summary-large" | "undeclared" | "unsupported";

export interface SharePreview {
  id: "openGraph" | "x";
  layout: "large" | "compact";
  presentation: SharePresentation;
  title: string | null;
  titleFrom: ShareFieldSource;
  description: string | null;
  descriptionFrom: ShareFieldSource;
  imageUrl: string | null;
  imageFrom: ShareFieldSource;
  url: string;
  urlFrom: ShareFieldSource;
  host: string;
  cardType: string | null;
}

type ShareSource = Pick<AuditResult, "page" | "details">;

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveShareImage(pageUrl: string, value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function shareHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function chosen(
  declared: string | null,
  openGraph: string | null,
  page: string | null,
): { value: string | null; from: ShareFieldSource } {
  if (declared) return { value: declared, from: "declared" };
  if (openGraph) return { value: openGraph, from: "openGraph" };
  if (page) return { value: page, from: "page" };
  return { value: null, from: "none" };
}

export function sharePreviews(audit: ShareSource): SharePreview[] {
  const social = audit.details.social;
  const metadata = audit.details.metadata;
  const pageTitle = present(metadata.title);
  const pageDescription = present(metadata.description);
  const ogTitle = present(social.ogTitle);
  const ogDescription = present(social.ogDescription);
  const ogImage = resolveShareImage(audit.page.url, present(social.ogImage));
  const twitterTitle = present(social.twitterTitle);
  const twitterDescription = present(social.twitterDescription);
  const twitterImage = resolveShareImage(audit.page.url, present(social.twitterImage));
  const cardType = present(social.twitterCard)?.toLowerCase() ?? null;
  const declaredUrl = resolveShareImage(audit.page.url, present(social.ogUrl));
  const url = declaredUrl ?? audit.page.url;
  const host = shareHost(url);
  const linkTitle = chosen(ogTitle, null, pageTitle);
  const linkDescription = chosen(ogDescription, null, pageDescription);
  const xTitle = chosen(twitterTitle, ogTitle, pageTitle);
  const xDescription = chosen(twitterDescription, ogDescription, pageDescription);
  const xImage = chosen(twitterImage, ogImage, null);

  return [
    {
      id: "openGraph",
      layout: "large",
      title: linkTitle.value,
      titleFrom: linkTitle.from,
      description: linkDescription.value,
      descriptionFrom: linkDescription.from,
      imageUrl: ogImage,
      imageFrom: ogImage ? "declared" : "none",
      url,
      urlFrom: declaredUrl ? "declared" : "page",
      host,
      cardType: present(social.ogType),
      presentation: "open-graph",
    },
    {
      id: "x",
      layout: cardType === "summary" ? "compact" : "large",
      presentation: xPresentation(cardType),
      title: xTitle.value,
      titleFrom: xTitle.from,
      description: xDescription.value,
      descriptionFrom: xDescription.from,
      imageUrl: xImage.value,
      imageFrom: xImage.from,
      url,
      urlFrom: declaredUrl ? "declared" : "page",
      host,
      cardType,
    },
  ];
}

function xPresentation(cardType: string | null): SharePreview["presentation"] {
  if (cardType === "summary") return "summary";
  if (cardType === "summary_large_image") return "summary-large";
  if (!cardType) return "undeclared";
  return "unsupported";
}
