export type FeatureStatus = "available" | "partial" | "planned";

export interface FeatureDefinition {
  id: string;
  status: FeatureStatus;
  phase: number;
  summaryKey: string;
}

export const featuresConfig: FeatureDefinition[] = [
  { id: "overview", status: "available", phase: 2, summaryKey: "features.overview" },
  { id: "metadata", status: "available", phase: 2, summaryKey: "features.metadata" },
  { id: "content", status: "partial", phase: 2, summaryKey: "features.content" },
  { id: "headings", status: "available", phase: 2, summaryKey: "features.headings" },
  { id: "links", status: "partial", phase: 2, summaryKey: "features.links" },
  { id: "images", status: "partial", phase: 2, summaryKey: "features.images" },
  { id: "technical", status: "partial", phase: 2, summaryKey: "features.technical" },
  { id: "schema", status: "partial", phase: 3, summaryKey: "features.schema" },
  { id: "social", status: "partial", phase: 3, summaryKey: "features.social" },
  { id: "performance", status: "partial", phase: 5, summaryKey: "features.performance" },
  { id: "international", status: "partial", phase: 3, summaryKey: "features.international" },
  { id: "accessibility", status: "partial", phase: 4, summaryKey: "features.accessibility" },
  { id: "reports", status: "available", phase: 2, summaryKey: "features.reports" },
  { id: "settings", status: "available", phase: 1, summaryKey: "features.settings" },
  { id: "serp", status: "partial", phase: 4, summaryKey: "features.serp" },
  { id: "comparison", status: "partial", phase: 4, summaryKey: "features.comparison" },
  { id: "developer", status: "planned", phase: 4, summaryKey: "features.developer" },
];

export function availableNavigation() {
  const available = new Set(
    featuresConfig.filter((feature) => feature.status !== "planned").map((feature) => feature.id),
  );
  return available;
}
