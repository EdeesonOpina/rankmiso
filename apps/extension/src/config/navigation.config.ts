export interface NavItem {
  id: string;
  labelKey: string;
}

export const navigationConfig: NavItem[] = [
  { id: "overview", labelKey: "nav.overview" },
  { id: "metadata", labelKey: "nav.metadata" },
  { id: "content", labelKey: "nav.content" },
  { id: "headings", labelKey: "nav.headings" },
  { id: "links", labelKey: "nav.links" },
  { id: "images", labelKey: "nav.images" },
  { id: "technical", labelKey: "nav.technical" },
  { id: "schema", labelKey: "nav.schema" },
  { id: "social", labelKey: "nav.social" },
  { id: "performance", labelKey: "nav.performance" },
  { id: "international", labelKey: "nav.international" },
  { id: "accessibility", labelKey: "nav.accessibility" },
  { id: "reports", labelKey: "nav.reports" },
  { id: "settings", labelKey: "nav.settings" },
];
