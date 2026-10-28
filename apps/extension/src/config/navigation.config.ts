export interface NavItem {
  id: string;
  labelKey: string;
}

export const navigationConfig: NavItem[] = [
  { id: "overview", labelKey: "nav.overview" },
  { id: "issues", labelKey: "nav.issues" },
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
  { id: "sitemaps", labelKey: "nav.sitemaps" },
  { id: "export", labelKey: "nav.export" },
  { id: "settings", labelKey: "nav.settings" },
];

export interface WorkbenchGroup {
  id: string;
  labelKey: string;
  sections: readonly string[];
}

/** Report sections that exist today. */
export const workbenchGroups: readonly WorkbenchGroup[] = [
  { id: "overview", labelKey: "nav.overview", sections: ["overview"] },
  { id: "issues", labelKey: "nav.issues", sections: ["issues"] },
  {
    id: "onpage",
    labelKey: "nav.onPage",
    sections: ["metadata", "content", "headings", "links", "images", "schema", "social"],
  },
  {
    id: "technical",
    labelKey: "nav.technicalGroup",
    sections: ["technical", "performance", "international", "accessibility"],
  },
  { id: "history", labelKey: "nav.history", sections: ["reports"] },
  { id: "site", labelKey: "nav.site", sections: ["site"] },
  { id: "sitemaps", labelKey: "nav.sitemaps", sections: ["sitemaps"] },
  { id: "export", labelKey: "nav.export", sections: ["export"] },
];

export function workbenchGroupId(section: string): string {
  if (section === "settings") return "settings";
  return workbenchGroups.find((group) => group.sections.includes(section))?.id ?? "overview";
}

export function sectionLabelKey(section: string): string {
  return navigationConfig.find((item) => item.id === section)?.labelKey ?? "nav.overview";
}

/** One click reaches every destination. Groups must not add a second step. */
export const flatNav: readonly { id: string; labelKey: string; utility?: boolean }[] = [
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
  { id: "performance", labelKey: "nav.performance" },
  { id: "international", labelKey: "nav.international" },
  { id: "accessibility", labelKey: "nav.accessibility" },
  { id: "site", labelKey: "nav.site" },
  { id: "sitemaps", labelKey: "nav.sitemaps" },
  { id: "reports", labelKey: "nav.history", utility: true },
  { id: "export", labelKey: "nav.export", utility: true },
  { id: "settings", labelKey: "nav.settings", utility: true },
];

export const popupNav = [
  ...flatNav.filter((item) => !item.utility),
  { id: "reports", labelKey: "nav.history" },
];
