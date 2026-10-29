import type { MessageKey } from "../locales/en";
import type { Category } from "../types/audit";

export const categoryLabelKey: Record<Category, MessageKey> = {
  metadata: "nav.metadata",
  content: "nav.content",
  headings: "nav.headings",
  links: "nav.links",
  images: "nav.images",
  technical: "nav.technical",
  structuredData: "nav.schema",
  social: "nav.social",
  performance: "nav.performance",
  international: "nav.international",
  accessibility: "nav.accessibility",
};
