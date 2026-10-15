//! Versioned data contracts shared by the Rust engine and the browser layer.
//!
//! Field names serialize as camelCase. Check statuses serialize as
//! SCREAMING_SNAKE_CASE (`NOT_APPLICABLE`, `UNAVAILABLE`). Rule identifiers
//! stay stable English tokens such as `RULE_META_TITLE_MISSING`.

use serde::{Deserialize, Serialize};

pub const SNAPSHOT_SCHEMA_VERSION: u32 = 1;
pub const AUDIT_SCHEMA_VERSION: u32 = 1;
pub const RULESET_VERSION: &str = "1.0.0";
pub const ENGINE_NAME: &str = "seo-toolkit";

pub const MAX_TEXT_CHARS: usize = 200_000;
pub const MAX_LINKS: usize = 2_000;
pub const MAX_IMAGES: usize = 500;
pub const MAX_HEADINGS: usize = 500;
pub const MAX_STRUCTURED_BLOCKS: usize = 40;
pub const MAX_STRUCTURED_CHARS: usize = 100_000;
pub const MAX_META_TAGS: usize = 400;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineError {
    pub code: String,
    pub message: String,
}

impl EngineError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn unsupported_schema(found: u32) -> Self {
        Self::new(
            "SCHEMA_UNSUPPORTED",
            format!(
                "This engine reads page snapshots at schema version {SNAPSHOT_SCHEMA_VERSION}. The snapshot used version {found}."
            ),
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CheckStatus {
    Pass,
    Warning,
    Error,
    Info,
    NotApplicable,
    Unavailable,
}

impl CheckStatus {
    pub fn is_scored(self) -> bool {
        matches!(self, Self::Pass | Self::Warning | Self::Error)
    }

    pub fn is_applicable(self) -> bool {
        !matches!(self, Self::NotApplicable | Self::Unavailable)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Category {
    Metadata,
    Content,
    Headings,
    Links,
    Images,
    Technical,
    StructuredData,
    Social,
    Performance,
    International,
    Accessibility,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LinkClass {
    Internal,
    External,
    Anchor,
    Mailto,
    Tel,
    Javascript,
    Other,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSnapshot {
    pub schema_version: u32,
    pub url: String,
    pub collected_at: String,
    pub titles: TitleSnapshot,
    pub meta: Vec<MetaTag>,
    pub links_rel: Vec<LinkRel>,
    pub headings: Vec<HeadingSnapshot>,
    pub links: Vec<LinkSnapshot>,
    pub images: Vec<ImageSnapshot>,
    pub content: ContentSnapshot,
    pub structured_data: Vec<StructuredDataBlock>,
    pub accessibility: AccessibilitySnapshot,
    pub performance: PerformanceSnapshot,
    pub response: ResponseMetadata,
    pub collection: CollectionInfo,
}

impl Default for PageSnapshot {
    fn default() -> Self {
        Self {
            schema_version: SNAPSHOT_SCHEMA_VERSION,
            url: "https://example.com/".to_string(),
            collected_at: "2026-01-01T00:00:00.000Z".to_string(),
            titles: TitleSnapshot::default(),
            meta: Vec::new(),
            links_rel: Vec::new(),
            headings: Vec::new(),
            links: Vec::new(),
            images: Vec::new(),
            content: ContentSnapshot::default(),
            structured_data: Vec::new(),
            accessibility: AccessibilitySnapshot::default(),
            performance: PerformanceSnapshot::default(),
            response: ResponseMetadata::default(),
            collection: CollectionInfo::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TitleSnapshot {
    pub rendered: Option<String>,
    pub elements: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MetaTag {
    pub name: Option<String>,
    pub property: Option<String>,
    pub http_equiv: Option<String>,
    pub content: Option<String>,
    pub charset: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LinkRel {
    pub rel: String,
    pub href: String,
    pub hreflang: Option<String>,
    pub media: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadingSnapshot {
    pub level: u8,
    pub text: String,
    pub location: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LinkSnapshot {
    pub href: String,
    pub resolved_url: Option<String>,
    pub accessible_name: String,
    pub rel: Vec<String>,
    pub target: Option<String>,
    pub title: Option<String>,
    pub location: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageSnapshot {
    pub src: Option<String>,
    pub alt_present: bool,
    pub alt_value: String,
    pub width_attr: Option<u32>,
    pub height_attr: Option<u32>,
    pub rendered_width: Option<u32>,
    pub rendered_height: Option<u32>,
    pub natural_width: Option<u32>,
    pub natural_height: Option<u32>,
    pub loading: Option<String>,
    pub fetch_priority: Option<String>,
    pub srcset: Option<String>,
    pub in_picture: bool,
    pub broken: Option<bool>,
    pub location: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ContentSnapshot {
    pub visible_text: String,
    pub text_truncated: bool,
    pub html_length: u32,
    pub paragraph_count: u32,
    pub html_lang: Option<String>,
    pub published_time: Option<String>,
    pub modified_time: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredDataBlock {
    pub format: String,
    pub raw: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AccessibilitySnapshot {
    pub unlabeled_form_controls: u32,
    pub nameless_buttons: u32,
    pub duplicate_ids: u32,
    pub sampled: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceSnapshot {
    pub lcp_ms: Option<f64>,
    pub cls: Option<f64>,
    pub inp_ms: Option<f64>,
    pub dom_content_loaded_ms: Option<f64>,
    pub load_event_ms: Option<f64>,
    pub transfer_size: Option<u64>,
    pub resource_count: Option<u32>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResponseMetadata {
    pub status: Option<u16>,
    pub redirect_count: Option<u32>,
    pub content_type: Option<String>,
    pub headers_available: bool,
    pub headers: Vec<HeaderPair>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderPair {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionInfo {
    pub method: String,
    pub dom_generation: u32,
    pub limitations: Vec<String>,
}

impl Default for CollectionInfo {
    fn default() -> Self {
        Self {
            method: "rendered-dom".to_string(),
            dom_generation: 0,
            limitations: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeOptions {
    pub extra_stop_words: Vec<String>,
    pub max_terms: usize,
}

impl Default for AnalyzeOptions {
    fn default() -> Self {
        Self {
            extra_stop_words: Vec::new(),
            max_terms: 12,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditResult {
    pub schema_version: u32,
    pub ruleset_version: String,
    pub page: PageSummary,
    pub score: ScoreSummary,
    pub checks: Vec<CheckResult>,
    pub recommendations: Vec<Recommendation>,
    pub metrics: AuditMetrics,
    pub details: AuditDetails,
    pub source: SourceMetadata,
    pub analyzed_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSummary {
    pub url: String,
    pub title: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreSummary {
    pub available: bool,
    pub value: Option<u32>,
    pub disclaimer: String,
    pub applicable_checks: u32,
    pub excluded_checks: u32,
    pub errors: u32,
    pub warnings: u32,
    pub passed: u32,
    pub info: u32,
    pub unavailable: u32,
    pub not_applicable: u32,
    pub categories: Vec<CategoryScore>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryScore {
    pub category: Category,
    pub available: bool,
    pub value: Option<u32>,
    pub applicable_checks: u32,
    pub errors: u32,
    pub warnings: u32,
    pub passed: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub id: String,
    pub category: Category,
    pub status: CheckStatus,
    pub weight: u32,
    pub applicable: bool,
    pub title_key: String,
    pub title: String,
    pub description: String,
    pub evidence: Vec<Evidence>,
    pub recommendation: Option<String>,
    pub references: Vec<Reference>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reference {
    pub title: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub rule_id: String,
    pub status: CheckStatus,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditMetrics {
    pub content: ContentMetrics,
    pub counts: CountMetrics,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentMetrics {
    pub word_count: Option<u32>,
    pub word_count_method: String,
    pub character_count: u32,
    pub non_whitespace_characters: u32,
    pub sentence_count: Option<u32>,
    pub paragraph_count: u32,
    pub reading_time_minutes: Option<f64>,
    pub reading_time_basis: String,
    pub text_to_html_ratio: Option<f64>,
    pub readability_value: Option<f64>,
    pub readability_method: Option<String>,
    pub terms: TermGroups,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TermGroups {
    pub unigrams: Vec<TermStat>,
    pub bigrams: Vec<TermStat>,
    pub trigrams: Vec<TermStat>,
    pub fourgrams: Vec<TermStat>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TermStat {
    pub term: String,
    pub count: u32,
    pub density: Option<f64>,
    pub in_title: bool,
    pub in_headings: bool,
    pub in_description: bool,
    pub prominence: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CountMetrics {
    pub headings: u32,
    pub h1: u32,
    pub links: u32,
    pub internal_links: u32,
    pub external_links: u32,
    pub images: u32,
    pub images_missing_alt: u32,
    pub images_empty_alt: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditDetails {
    pub metadata: MetadataView,
    pub headings: Vec<HeadingSnapshot>,
    pub links: Vec<NormalizedLink>,
    pub images: Vec<ImageSnapshot>,
    pub social: SocialView,
    pub hreflang: Vec<HreflangLink>,
    pub structured_data: Vec<StructuredDataView>,
    pub performance: PerformanceSnapshot,
    pub response: ResponseMetadata,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MetadataView {
    pub title: Option<String>,
    pub title_source: String,
    pub title_length: u32,
    pub title_pixel_estimate: u32,
    pub title_pixel_basis: String,
    pub description: Option<String>,
    pub description_length: u32,
    pub robots: Vec<String>,
    pub googlebot: Vec<String>,
    pub bingbot: Vec<String>,
    pub canonicals: Vec<String>,
    pub charset: Option<String>,
    pub viewport: Option<String>,
    pub generator: Option<String>,
    pub theme_color: Option<String>,
    pub referrer_policy: Option<String>,
    pub refresh: Option<String>,
    pub language: Option<String>,
    pub content_language: Option<String>,
    pub duplicate_meta: Vec<String>,
    pub raw_titles: Vec<String>,
    pub rendered_title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedLink {
    pub href: String,
    pub resolved_url: Option<String>,
    pub accessible_name: String,
    pub classification: LinkClass,
    pub rel: Vec<String>,
    pub nofollow: bool,
    pub sponsored: bool,
    pub ugc: bool,
    pub target: Option<String>,
    pub empty_anchor: bool,
    pub location: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SocialView {
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image: Option<String>,
    pub og_url: Option<String>,
    pub og_type: Option<String>,
    pub og_locale: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HreflangLink {
    pub lang: String,
    pub href: String,
    pub valid_syntax: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredDataView {
    pub format: String,
    pub valid_json: bool,
    pub error: Option<String>,
    pub types: Vec<String>,
    pub raw: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMetadata {
    pub collection_method: String,
    pub limitations: Vec<String>,
    pub ruleset_version: String,
    pub engine: String,
}
