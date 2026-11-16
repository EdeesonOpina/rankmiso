import type { Component } from "vue";
import {
  Braces,
  FileText,
  Gauge,
  Globe,
  Heading,
  Image,
  Link,
  PersonStanding,
  Share2,
  SlidersHorizontal,
  TextAlignStart,
  TriangleAlert,
} from "lucide-vue-next";

const icons: Record<string, Component> = {
  metadata: FileText,
  content: TextAlignStart,
  headings: Heading,
  links: Link,
  images: Image,
  structuredData: Braces,
  social: Share2,
  technical: SlidersHorizontal,
  performance: Gauge,
  international: Globe,
  accessibility: PersonStanding,
};

/** Icon for a rule category in Site Explorer rows. Unknown categories get the alert icon. */
export function categoryIcon(category: string): Component {
  return icons[category] ?? TriangleAlert;
}
