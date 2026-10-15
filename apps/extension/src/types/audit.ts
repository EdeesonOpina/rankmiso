export type CheckStatus = "PASS" | "WARNING" | "ERROR" | "INFO" | "NOT_APPLICABLE" | "UNAVAILABLE";

export type Category =
  | "metadata"
  | "content"
  | "headings"
  | "links"
  | "images"
  | "technical"
  | "structuredData"
  | "social"
  | "performance"
  | "international"
  | "accessibility";

export interface Evidence {
  label: string;
  value: string;
}

export interface CheckResult {
  id: string;
  category: Category;
  status: CheckStatus;
  weight: number;
  applicable: boolean;
  titleKey: string;
  title: string;
  description: string;
  evidence: Evidence[];
  recommendation: string | null;
  references: Array<{ title: string; url: string }>;
}

export interface ScoreSummary {
  available: boolean;
  value: number | null;
  disclaimer: string;
  applicableChecks: number;
  excludedChecks: number;
  errors: number;
  warnings: number;
  passed: number;
  info: number;
  unavailable: number;
  notApplicable: number;
  categories: Array<{
    category: Category;
    available: boolean;
    value: number | null;
    applicableChecks: number;
    errors: number;
    warnings: number;
    passed: number;
  }>;
}

export interface TermStat {
  term: string;
  count: number;
  density: number | null;
  inTitle: boolean;
  inHeadings: boolean;
  inDescription: boolean;
  prominence: number | null;
}

export interface AuditResult {
  schemaVersion: number;
  rulesetVersion: string;
  page: { url: string; title: string | null; language: string | null };
  score: ScoreSummary;
  checks: CheckResult[];
  recommendations: Array<{ ruleId: string; status: CheckStatus; text: string }>;
  metrics: {
    content: {
      wordCount: number | null;
      wordCountMethod: string;
      characterCount: number;
      nonWhitespaceCharacters: number;
      sentenceCount: number | null;
      paragraphCount: number;
      readingTimeMinutes: number | null;
      readingTimeBasis: string;
      textToHtmlRatio: number | null;
      readabilityValue: number | null;
      readabilityMethod: string | null;
      terms: {
        unigrams: TermStat[];
        bigrams: TermStat[];
        trigrams: TermStat[];
        fourgrams: TermStat[];
      };
    };
    counts: {
      headings: number;
      h1: number;
      links: number;
      internalLinks: number;
      externalLinks: number;
      images: number;
      imagesMissingAlt: number;
      imagesEmptyAlt: number;
    };
  };
  details: {
    metadata: {
      title: string | null;
      titleSource: string;
      titleLength: number;
      titlePixelEstimate: number;
      titlePixelBasis: string;
      description: string | null;
      descriptionLength: number;
      robots: string[];
      googlebot: string[];
      bingbot: string[];
      canonicals: string[];
      charset: string | null;
      viewport: string | null;
      generator: string | null;
      themeColor: string | null;
      referrerPolicy: string | null;
      refresh: string | null;
      language: string | null;
      contentLanguage: string | null;
      duplicateMeta: string[];
      rawTitles: string[];
      renderedTitle: string | null;
    };
    headings: Array<{ level: number; text: string; location: string }>;
    links: Array<{
      href: string;
      resolvedUrl: string | null;
      accessibleName: string;
      classification: string;
      rel: string[];
      nofollow: boolean;
      sponsored: boolean;
      ugc: boolean;
      target: string | null;
      emptyAnchor: boolean;
      location: string;
    }>;
    images: Array<{
      src: string | null;
      altPresent: boolean;
      altValue: string;
      widthAttr: number | null;
      heightAttr: number | null;
      renderedWidth: number | null;
      renderedHeight: number | null;
      naturalWidth: number | null;
      naturalHeight: number | null;
      loading: string | null;
      fetchPriority: string | null;
      srcset: string | null;
      inPicture: boolean;
      broken: boolean | null;
      location: string;
    }>;
    social: {
      ogTitle: string | null;
      ogDescription: string | null;
      ogImage: string | null;
      ogUrl: string | null;
      ogType: string | null;
      ogLocale: string | null;
      twitterCard: string | null;
      twitterTitle: string | null;
      twitterDescription: string | null;
      twitterImage: string | null;
    };
    hreflang: Array<{ lang: string; href: string; validSyntax: boolean }>;
    structuredData: Array<{
      format: string;
      validJson: boolean;
      error: string | null;
      types: string[];
      raw: string;
    }>;
    performance: {
      lcpMs: number | null;
      cls: number | null;
      inpMs: number | null;
      domContentLoadedMs: number | null;
      loadEventMs: number | null;
      transferSize: number | null;
      resourceCount: number | null;
      notes: string[];
    };
    response: {
      status: number | null;
      redirectCount: number | null;
      contentType: string | null;
      headersAvailable: boolean;
      headers: Array<{ name: string; value: string }>;
    };
  };
  source: {
    collectionMethod: string;
    limitations: string[];
    rulesetVersion: string;
    engine: string;
  };
  analyzedAt: string;
}

export interface PageSnapshot {
  schemaVersion: number;
  url: string;
  collectedAt: string;
  collection: { method: string; domGeneration: number; limitations: string[] };
}
