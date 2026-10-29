/** One click reaches every destination. Groups must not add a second step. */
export const flatNav: readonly {
  id: string;
  labelKey: string;
  shortLabelKey?: string;
  utility?: boolean;
}[] = [
  { id: "overview", labelKey: "nav.overview" },
  { id: "issues", labelKey: "nav.issues" },
  { id: "metadata", labelKey: "nav.metadata" },
  { id: "content", labelKey: "nav.content" },
  { id: "headings", labelKey: "nav.headings" },
  { id: "links", labelKey: "nav.links" },
  { id: "images", labelKey: "nav.images" },
  { id: "schema", labelKey: "nav.schemaShort" },
  { id: "social", labelKey: "nav.social" },
  { id: "technical", labelKey: "nav.technical" },
  { id: "performance", labelKey: "nav.performance", shortLabelKey: "nav.performanceShort" },
  { id: "international", labelKey: "nav.international", shortLabelKey: "nav.internationalShort" },
  { id: "accessibility", labelKey: "nav.accessibility", shortLabelKey: "nav.accessibilityShort" },
  { id: "site", labelKey: "nav.site" },
  { id: "sitemaps", labelKey: "nav.sitemaps" },
  { id: "reports", labelKey: "nav.history", utility: true },
  { id: "export", labelKey: "nav.export", utility: true },
  { id: "settings", labelKey: "nav.settings", utility: true },
];
