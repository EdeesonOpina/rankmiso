//! AIO/GEO content readiness: observable structure, clarity, attribution, and structured-data
//! consistency for the inspected page, grouped for AI-assisted discovery.
//!
//! Google states there are no additional requirements, special files, or special schema for AI
//! Overviews and AI Mode, and that optimizing for them is still SEO. So this module does not
//! invent AI requirements. It regroups existing checks by id (never re-implementing them), adds
//! a few page-level observations that existing checks do not cover, and reads M11.1 and M11.6
//! results only when the user already ran them. Nothing here predicts rankings or citations,
//! and no finding changes the page score.

use std::collections::BTreeSet;

use seo_core::{
    AnalyzeOptions, AuditResult, Category, CheckResult, CheckStatus, EngineError, PageSnapshot,
    MAX_STRUCTURED_BLOCKS,
};
use serde_json::Value;

use crate::support::{self, evidence, normalize_ws, reference};

pub const READINESS_SCHEMA_VERSION: u32 = 1;

const AI_FEATURES: &str = "https://developers.google.com/search/docs/appearance/ai-features";
const AI_GUIDE: &str =
    "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide";
const HELPFUL: &str =
    "https://developers.google.com/search/docs/fundamentals/creating-helpful-content";
const SD_POLICIES: &str =
    "https://developers.google.com/search/docs/appearance/structured-data/sd-policies";

/// Existing checks reused as-is, with the readiness group they are shown in.
const REUSED: [(&str, Group); 19] = [
    ("RULE_HTTP_STATUS", Group::Discoverability),
    ("RULE_NOINDEX_DETECTED", Group::Discoverability),
    ("RULE_ROBOTS_CONFLICT", Group::Discoverability),
    ("RULE_CANONICAL_MISSING", Group::Discoverability),
    ("RULE_CANONICAL_INVALID", Group::Discoverability),
    ("RULE_CANONICAL_MULTIPLE", Group::Discoverability),
    ("RULE_ROBOTS_TXT", Group::Discoverability),
    ("RULE_H1_MISSING", Group::Structure),
    ("RULE_MULTIPLE_H1", Group::Structure),
    ("RULE_HEADING_EMPTY", Group::Structure),
    ("RULE_HEADING_LEVEL_SKIP", Group::Structure),
    ("RULE_META_TITLE_MISSING", Group::Clarity),
    ("RULE_META_DESCRIPTION_MISSING", Group::Clarity),
    ("RULE_LINK_EMPTY_ANCHOR", Group::Clarity),
    ("RULE_JSONLD_SYNTAX", Group::StructuredData),
    ("RULE_IMAGE_ALT_MISSING", Group::Accessibility),
    ("RULE_BUTTON_NAME_MISSING", Group::Accessibility),
    ("RULE_FORM_LABEL_MISSING", Group::Accessibility),
    ("RULE_LANG_MISSING", Group::Accessibility),
];

const ARTICLE_TYPES: [&str; 7] = [
    "Article",
    "NewsArticle",
    "BlogPosting",
    "TechArticle",
    "ScholarlyArticle",
    "Report",
    "LiveBlogPosting",
];
const GENERIC_HEADINGS: [&str; 12] = [
    "untitled",
    "welcome",
    "home",
    "page",
    "new page",
    "heading",
    "title",
    "more",
    "read more",
    "click here",
    "learn more",
    "section",
];
const GENERIC_LINKS: [&str; 10] = [
    "click here",
    "here",
    "read more",
    "more",
    "learn more",
    "link",
    "this",
    "this link",
    "go",
    "details",
];
const MAX_SAMPLES: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Group {
    Discoverability,
    Structure,
    Clarity,
    Attribution,
    StructuredData,
    Accessibility,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessRequest {
    pub schema_version: u32,
    pub snapshot: PageSnapshot,
    /// M11.6 result, only when the user ran Check access for this page.
    #[serde(default)]
    pub crawler: Option<CrawlerSummary>,
    /// M11.1 result, only when the user ran an HTML comparison for this page.
    #[serde(default)]
    pub rendering: Option<RenderingSummary>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlerSummary {
    pub checked_at: String,
    pub robots_state: String,
    pub page_access: String,
    pub agents: Vec<AgentState>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentState {
    pub id: String,
    pub crawl: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderingSummary {
    pub source_origin: String,
    pub findings: Vec<RenderingFinding>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderingFinding {
    pub id: String,
    pub status: CheckStatus,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessReport {
    pub schema_version: u32,
    /// `article`, `product`, or `other`; decides which attribution checks apply.
    pub page_type: String,
    pub findings: Vec<ReadinessFinding>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessFinding {
    pub group: Group,
    /// True when the finding is an existing page check shown here, not a new rule.
    pub reused: bool,
    #[serde(flatten)]
    pub check: CheckResult,
}

pub fn analyze(request: &ReadinessRequest) -> Result<ReadinessReport, EngineError> {
    if request.schema_version != READINESS_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(request.schema_version));
    }
    let snapshot = &request.snapshot;
    let audit = crate::analyze(snapshot, &AnalyzeOptions::default())?;
    let page = Observed::read(snapshot);
    let mut findings: Vec<ReadinessFinding> = Vec::new();
    for (id, group) in REUSED {
        if let Some(check) = audit.checks.iter().find(|check| check.id == id) {
            findings.push(ReadinessFinding {
                group,
                reused: true,
                check: check.clone(),
            });
        }
    }
    let mut add = |group: Group, check: CheckResult| {
        findings.push(ReadinessFinding {
            group,
            reused: false,
            check,
        })
    };
    add(
        Group::Discoverability,
        crawler_access(request.crawler.as_ref()),
    );
    add(
        Group::Discoverability,
        rendering(request.rendering.as_ref()),
    );
    add(Group::Discoverability, snippet_controls(snapshot));
    add(Group::Structure, main_content(snapshot));
    add(Group::Structure, section_headings(snapshot));
    add(Group::Clarity, title_heading(&audit, snapshot));
    add(Group::Clarity, generic_headings(snapshot));
    add(Group::Clarity, generic_links(snapshot));
    add(Group::Clarity, questions(snapshot, &page));
    add(Group::Clarity, text_length(&audit));
    add(Group::Attribution, author(&page));
    add(Group::Attribution, publisher(&page));
    add(Group::Attribution, dates(&page));
    add(Group::Attribution, entity_consistency(&page));
    add(Group::StructuredData, headline_matches(snapshot, &page));
    add(Group::StructuredData, url_matches(&audit, &page));
    Ok(ReadinessReport {
        schema_version: READINESS_SCHEMA_VERSION,
        page_type: page.page_type.to_string(),
        findings,
    })
}

/// Observations read once from the snapshot: JSON-LD entities and the meta tags this module uses.
struct Observed {
    page_type: &'static str,
    entities: Vec<Value>,
    meta_author: Option<String>,
    site_name: Option<String>,
    published_meta: Option<String>,
    modified_meta: Option<String>,
}

impl Observed {
    fn read(snapshot: &PageSnapshot) -> Self {
        let mut entities = Vec::new();
        for block in snapshot
            .structured_data
            .iter()
            .filter(|block| block.format.eq_ignore_ascii_case("json-ld"))
            .take(MAX_STRUCTURED_BLOCKS)
        {
            if let Ok(value) = serde_json::from_str::<Value>(&block.raw) {
                flatten(value, &mut entities, 0);
            }
        }
        let meta = |name: &str| {
            support::first_meta(&snapshot.meta, name)
                .or_else(|| support::first_property(&snapshot.meta, name))
                .map(|value| normalize_ws(&value))
        };
        let og_type = meta("og:type").unwrap_or_default().to_ascii_lowercase();
        let published_meta = meta("article:published_time").or_else(|| {
            snapshot
                .content
                .published_time
                .clone()
                .filter(|value| !value.trim().is_empty())
        });
        let is_article = entities
            .iter()
            .any(|entity| has_type(entity, &ARTICLE_TYPES))
            || og_type == "article"
            || published_meta.is_some();
        let is_product =
            entities.iter().any(|entity| has_type(entity, &["Product"])) || og_type == "product";
        Self {
            page_type: if is_article {
                "article"
            } else if is_product {
                "product"
            } else {
                "other"
            },
            meta_author: meta("author").or_else(|| meta("article:author")),
            site_name: meta("og:site_name"),
            published_meta,
            modified_meta: meta("article:modified_time").or_else(|| {
                snapshot
                    .content
                    .modified_time
                    .clone()
                    .filter(|value| !value.trim().is_empty())
            }),
            entities,
        }
    }

    fn article(&self) -> Option<&Value> {
        self.entities
            .iter()
            .find(|entity| has_type(entity, &ARTICLE_TYPES))
    }

    fn main_entity(&self) -> Option<&Value> {
        self.article().or_else(|| {
            self.entities.iter().find(|entity| {
                has_type(
                    entity,
                    &["Product", "WebPage", "AboutPage", "FAQPage", "QAPage"],
                )
            })
        })
    }

    fn organization_names(&self) -> Vec<(String, String)> {
        let mut out = Vec::new();
        if let Some(name) = self
            .article()
            .and_then(|a| a.get("publisher"))
            .and_then(name_of)
        {
            out.push(("JSON-LD publisher".to_string(), name));
        }
        for entity in &self.entities {
            if has_type(
                entity,
                &["Organization", "NewsMediaOrganization", "Corporation"],
            ) {
                if let Some(name) = name_of(entity) {
                    out.push(("JSON-LD Organization".to_string(), name));
                }
            }
        }
        if let Some(name) = &self.site_name {
            out.push(("og:site_name".to_string(), name.clone()));
        }
        out
    }
}

/// Collects objects from a JSON-LD value, expanding arrays and `@graph`. Depth is bounded.
fn flatten(value: Value, out: &mut Vec<Value>, depth: u8) {
    if depth > 4 || out.len() >= 200 {
        return;
    }
    match value {
        Value::Array(items) => items
            .into_iter()
            .for_each(|item| flatten(item, out, depth + 1)),
        Value::Object(mut map) => {
            if let Some(graph) = map.remove("@graph") {
                flatten(graph, out, depth + 1);
            }
            if map.contains_key("@type") {
                out.push(Value::Object(map));
            }
        }
        _ => {}
    }
}

fn has_type(entity: &Value, wanted: &[&str]) -> bool {
    let matches = |value: &Value| {
        value.as_str().is_some_and(|text| {
            let short = text.rsplit(['/', '#']).next().unwrap_or(text);
            wanted.iter().any(|kind| kind.eq_ignore_ascii_case(short))
        })
    };
    match entity.get("@type") {
        Some(Value::Array(items)) => items.iter().any(matches),
        Some(value) => matches(value),
        None => false,
    }
}

/// A `name` from an object, or the value itself when it is a string.
fn name_of(value: &Value) -> Option<String> {
    let first = match value {
        Value::Array(items) => items.first()?,
        other => other,
    };
    let text = match first {
        Value::String(text) => text.clone(),
        Value::Object(map) => map.get("name")?.as_str()?.to_string(),
        _ => return None,
    };
    let text = normalize_ws(&text);
    (!text.is_empty()).then_some(text)
}

fn text_of(entity: &Value, key: &str) -> Option<String> {
    entity
        .get(key)
        .and_then(Value::as_str)
        .map(normalize_ws)
        .filter(|value| !value.is_empty())
}

fn same_text(left: &str, right: &str) -> bool {
    let fold = |value: &str| {
        value
            .chars()
            .filter(|ch| ch.is_alphanumeric() || ch.is_whitespace())
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase()
    };
    let (left, right) = (fold(left), fold(right));
    !left.is_empty() && (left == right || left.contains(&right) || right.contains(&left))
}

fn finding(id: &str, title: &str, status: CheckStatus, description: &str) -> CheckResult {
    support::check(id, Category::Content, status, 0, title, description)
}

fn advise(mut check: CheckResult, recommendation: &str, source: (&str, &str)) -> CheckResult {
    check.recommendation = Some(recommendation.to_string());
    check.references.push(reference(source.0, source.1));
    check
}

fn samples(check: &mut CheckResult, label: &str, items: &[String]) {
    for item in items.iter().take(MAX_SAMPLES) {
        check.evidence.push(evidence(label, item.clone()));
    }
    if items.len() > MAX_SAMPLES {
        check.evidence.push(evidence(
            "additional",
            format!("{} more", items.len() - MAX_SAMPLES),
        ));
    }
}

// ---- Group A: technical discoverability --------------------------------------------------

const SEARCH_CRAWLERS: [&str; 2] = ["googlebot", "bingbot"];
const AI_SEARCH_CRAWLERS: [&str; 4] = [
    "oai-searchbot",
    "claude-searchbot",
    "perplexitybot",
    "duckassistbot",
];

fn crawler_access(summary: Option<&CrawlerSummary>) -> CheckResult {
    let id = "READY_CRAWLER_ACCESS";
    let title = "Search and AI search crawler rules";
    let Some(summary) = summary else {
        return finding(
            id,
            title,
            CheckStatus::Unavailable,
            "Not measured. Run Check access under AI & Search to read robots.txt for this page.",
        );
    };
    let blocked = |ids: &[&str]| {
        summary
            .agents
            .iter()
            .filter(|agent| ids.contains(&agent.id.as_str()) && agent.crawl == "disallowed")
            .map(|agent| agent.id.clone())
            .collect::<Vec<_>>()
    };
    let search = blocked(&SEARCH_CRAWLERS);
    let ai = blocked(&AI_SEARCH_CRAWLERS);
    let mut check = if summary.robots_state == "not-read" {
        finding(
            id,
            title,
            CheckStatus::Unavailable,
            "robots.txt could not be read from this browser, so crawler rules are not measured.",
        )
    } else if summary.robots_state == "error" {
        advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "robots.txt returned a server error. Under RFC 9309 crawlers treat the site as fully disallowed until it recovers.",
            ),
            "Make robots.txt return 200 with your rules, or 404 if you have none.",
            ("Google: AI features and your website", AI_FEATURES),
        )
    } else if !search.is_empty() {
        advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "robots.txt disallows a search crawler for this path. Google's AI features use the Search index, so this also affects them.",
            ),
            "Confirm the block is intended. If not, allow the crawler for this path.",
            ("Google: AI features and your website", AI_FEATURES),
        )
    } else if !ai.is_empty() {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "robots.txt disallows at least one AI search crawler for this path. That is a site owner's choice, not a defect.",
            ),
            "Review whether these AI search services should read this page.",
            ("Google: AI features and your website", AI_FEATURES),
        )
    } else {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "No search or AI search crawler is disallowed for this path by the robots.txt rules read. This is a rule reading, not proof of crawling or indexing.",
        )
    };
    check
        .evidence
        .push(evidence("checked", summary.checked_at.clone()));
    check.evidence.push(evidence(
        "this browser's page access",
        summary.page_access.clone(),
    ));
    for id in search.iter().chain(ai.iter()) {
        check.evidence.push(evidence("disallowed", id.clone()));
    }
    check
}

fn rendering(summary: Option<&RenderingSummary>) -> CheckResult {
    let id = "READY_RENDERING";
    let title = "Content before and after JavaScript";
    let Some(summary) = summary else {
        return finding(
            id,
            title,
            CheckStatus::Unavailable,
            "Not measured. Run Compare HTML or Compare an HTML file in Technical to compare the initial HTML with the rendered page.",
        );
    };
    if summary
        .findings
        .iter()
        .all(|finding| finding.status == CheckStatus::Unavailable)
    {
        return finding(
            id,
            title,
            CheckStatus::Unavailable,
            "The last HTML comparison could not read the initial HTML, so nothing was compared.",
        );
    }
    let flagged = summary
        .findings
        .iter()
        .filter(|finding| matches!(finding.status, CheckStatus::Error | CheckStatus::Warning))
        .map(|finding| finding.id.clone())
        .collect::<Vec<_>>();
    let noted = summary
        .findings
        .iter()
        .filter(|finding| finding.status == CheckStatus::Info)
        .map(|finding| finding.id.clone())
        .collect::<Vec<_>>();
    let mut check = if flagged.is_empty() && noted.is_empty() {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "The last HTML comparison found the same SEO signals before and after JavaScript.",
        )
    } else if flagged.is_empty() {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "JavaScript changes some SEO signals, none flagged as a warning. Google renders pages, but not every crawler runs JavaScript.",
            ),
            "Open Technical, HTML comparison, and confirm the changes are intended.",
            ("Google: JavaScript SEO basics", "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics"),
        )
    } else {
        advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "The last HTML comparison found SEO signals that JavaScript adds, removes, or changes. Google renders pages, but not every crawler runs JavaScript.",
            ),
            "Open Technical, HTML comparison, and review the flagged rows.",
            ("Google: JavaScript SEO basics", "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics"),
        )
    };
    check
        .evidence
        .push(evidence("compared with", summary.source_origin.clone()));
    samples(&mut check, "flagged", &flagged);
    samples(&mut check, "changed", &noted);
    check
}

fn snippet_controls(snapshot: &PageSnapshot) -> CheckResult {
    let id = "READY_SNIPPET_CONTROLS";
    let title = "Snippet limits";
    let mut values: Vec<String> = Vec::new();
    for name in ["robots", "googlebot"] {
        values.extend(
            support::meta_by_name(&snapshot.meta, name)
                .into_iter()
                .map(str::to_string),
        );
    }
    if snapshot.response.headers_available {
        values.extend(
            snapshot
                .response
                .headers
                .iter()
                .filter(|header| header.name.eq_ignore_ascii_case("x-robots-tag"))
                .map(|header| header.value.clone()),
        );
    }
    let limits = values
        .iter()
        .flat_map(|value| value.split(','))
        .map(|part| part.trim().to_ascii_lowercase())
        .filter(|part| {
            part == "nosnippet"
                || part.ends_with("nosnippet")
                || part.replace(' ', "").ends_with("max-snippet:0")
        })
        .collect::<BTreeSet<_>>();
    let mut check = if limits.is_empty() {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "No nosnippet or max-snippet:0 directive was observed in the rendered meta tags or the response headers read.",
        )
    } else {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "A snippet limit was observed. Google says nosnippet and max-snippet limit what its AI features can show from the page.",
            ),
            "Keep it if intended. Otherwise remove it so search features can quote the page.",
            ("Google: AI features and your website", AI_FEATURES),
        )
    };
    for limit in limits {
        check.evidence.push(evidence("directive", limit));
    }
    if !snapshot.response.headers_available {
        check.evidence.push(evidence(
            "limit",
            "Response headers were not read; X-Robots-Tag is not included.",
        ));
    }
    check
}

// ---- Group B: content structure ----------------------------------------------------------

/// Locations are short CSS paths (up to six parts), so a deep element may not show its region.
fn main_content(snapshot: &PageSnapshot) -> CheckResult {
    let id = "READY_MAIN_CONTENT";
    let title = "Main content region";
    let locations = snapshot
        .headings
        .iter()
        .map(|heading| heading.location.as_str())
        .chain(snapshot.links.iter().map(|link| link.location.as_str()))
        .collect::<Vec<_>>();
    let in_region = |path: &&str| {
        path.split(" > ")
            .any(|part| part.starts_with("main") || part.starts_with("article"))
    };
    if locations.iter().any(in_region) {
        return finding(
            id,
            title,
            CheckStatus::Pass,
            "Headings or links were observed inside a main or article element.",
        );
    }
    let complete = !locations.is_empty() && locations.iter().all(|path| path.starts_with("body"));
    if complete {
        return advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "No main or article element was observed around headings or links. Semantic HTML is recommended by Google but not required.",
            ),
            "If the page has a primary content area, consider wrapping it in <main>.",
            ("Google: optimizing for generative AI features", AI_GUIDE),
        );
    }
    finding(
        id,
        title,
        CheckStatus::Unavailable,
        "Element paths were too deep or too few to tell whether a main region exists.",
    )
}

fn section_headings(snapshot: &PageSnapshot) -> CheckResult {
    let id = "READY_SECTION_HEADINGS";
    let title = "Section headings";
    let sections = snapshot
        .headings
        .iter()
        .filter(|heading| heading.level >= 2 && !heading.text.trim().is_empty())
        .count();
    let paragraphs = snapshot.content.paragraph_count;
    let mut check = if sections > 0 {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "Section headings below the H1 were observed.",
        )
    } else if paragraphs >= 6 {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "Several paragraphs were observed with no section headings. Google recommends headings that give the content a clear structure.",
            ),
            "Consider descriptive H2 headings for the main sections.",
            ("Google: optimizing for generative AI features", AI_GUIDE),
        )
    } else {
        finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "The page has little running text, so section headings are not expected.",
        )
    };
    check
        .evidence
        .push(evidence("H2–H6 with text", sections.to_string()));
    check
        .evidence
        .push(evidence("paragraphs", paragraphs.to_string()));
    check
}

// ---- Group C: content clarity ------------------------------------------------------------

fn words(value: &str) -> BTreeSet<String> {
    value
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|word| word.chars().count() >= 3)
        .map(str::to_lowercase)
        .collect()
}

fn title_heading(audit: &AuditResult, snapshot: &PageSnapshot) -> CheckResult {
    let id = "READY_TITLE_H1";
    let title = "Title and main heading describe the same topic";
    let page_title = audit.page.title.clone().unwrap_or_default();
    let h1 = snapshot
        .headings
        .iter()
        .find(|heading| heading.level == 1 && !heading.text.trim().is_empty())
        .map(|heading| normalize_ws(&heading.text));
    let Some(h1) = h1.filter(|_| !page_title.trim().is_empty()) else {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "A title or an H1 is missing; that is reported by its own check.",
        );
    };
    let shared = words(&page_title).intersection(&words(&h1)).count();
    let mut check = if shared > 0 || same_text(&page_title, &h1) {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "The title and the first H1 share words, so they point to the same topic.",
        )
    } else {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "The title and the first H1 share no words. Google asks whether the main heading or title gives a descriptive summary of the content.",
            ),
            "Check that both describe this page. This needs human review; a brand-only title can be fine.",
            ("Google: creating helpful content", HELPFUL),
        )
    };
    check.evidence.push(evidence("title", page_title));
    check.evidence.push(evidence("H1", h1));
    check
}

fn generic_headings(snapshot: &PageSnapshot) -> CheckResult {
    let id = "READY_GENERIC_HEADINGS";
    let title = "Descriptive headings";
    let generic = snapshot
        .headings
        .iter()
        .map(|heading| normalize_ws(&heading.text))
        .filter(|text| {
            let folded = text.trim_end_matches([':', '.', '!']).to_lowercase();
            GENERIC_HEADINGS.contains(&folded.as_str())
        })
        .collect::<Vec<_>>();
    if snapshot.headings.is_empty() {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "No headings were observed.",
        );
    }
    if generic.is_empty() {
        return finding(
            id,
            title,
            CheckStatus::Pass,
            "No generic heading text such as \"Welcome\" or \"Read more\" was observed.",
        );
    }
    let mut check = advise(
        finding(
            id,
            title,
            CheckStatus::Info,
            "Some headings use generic text that does not say what the section covers.",
        ),
        "Rename these headings to describe their section.",
        ("Google: creating helpful content", HELPFUL),
    );
    samples(&mut check, "heading", &generic);
    check
}

fn generic_links(snapshot: &PageSnapshot) -> CheckResult {
    let id = "READY_GENERIC_LINK_TEXT";
    let title = "Descriptive link text";
    let generic = snapshot
        .links
        .iter()
        .filter(|link| {
            let name = normalize_ws(&link.accessible_name).to_lowercase();
            GENERIC_LINKS.contains(&name.trim_end_matches(['.', '›', '»', '→']).trim())
        })
        .map(|link| {
            format!(
                "\"{}\" → {}",
                normalize_ws(&link.accessible_name),
                link.href
            )
        })
        .collect::<Vec<_>>();
    if snapshot.links.is_empty() {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "No links were observed.",
        );
    }
    if generic.is_empty() {
        return finding(
            id,
            title,
            CheckStatus::Pass,
            "No link text such as \"click here\" or \"read more\" was observed.",
        );
    }
    let mut check = advise(
        finding(
            id,
            title,
            CheckStatus::Info,
            "Some links use text that does not say where they lead, out of context.",
        ),
        "Use link text that names the destination.",
        (
            "Google: link best practices",
            "https://developers.google.com/search/docs/crawling-indexing/links-crawlable",
        ),
    );
    samples(&mut check, "link", &generic);
    check
}

fn questions(snapshot: &PageSnapshot, page: &Observed) -> CheckResult {
    let id = "READY_QUESTIONS";
    let title = "Questions and answers";
    let asked = snapshot
        .headings
        .iter()
        .map(|heading| normalize_ws(&heading.text))
        .filter(|text| text.ends_with('?'))
        .collect::<Vec<_>>();
    let marked = page
        .entities
        .iter()
        .any(|entity| has_type(entity, &["FAQPage", "QAPage"]));
    if asked.is_empty() && !marked {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "No question headings or FAQ markup were observed. Pages do not need them.",
        );
    }
    let mut check = finding(
        id,
        title,
        CheckStatus::Info,
        "Question-and-answer content was observed. This is an observation; Q&A formatting does not guarantee appearing in AI answers.",
    );
    check
        .evidence
        .push(evidence("question headings", asked.len().to_string()));
    check.evidence.push(evidence(
        "FAQPage or QAPage markup",
        if marked { "present" } else { "absent" },
    ));
    samples(&mut check, "question", &asked);
    check
}

fn text_length(audit: &AuditResult) -> CheckResult {
    let content = &audit.metrics.content;
    let mut check = finding(
        "READY_TEXT_LENGTH",
        "Visible text",
        CheckStatus::Info,
        "Shown for reference only. Google says it does not prefer a particular word count; length is not a quality measure.",
    );
    check.evidence.push(evidence(
        "words",
        content
            .word_count
            .map_or_else(|| "not counted".to_string(), |count| count.to_string()),
    ));
    check
        .evidence
        .push(evidence("paragraphs", content.paragraph_count.to_string()));
    check
        .references
        .push(reference("Google: creating helpful content", HELPFUL));
    check
}

// ---- Group D: entity and attribution -----------------------------------------------------

fn author(page: &Observed) -> CheckResult {
    let id = "READY_AUTHOR";
    let title = "Author";
    if page.page_type != "article" {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "Not an article-like page, so an author is not expected.",
        );
    }
    let structured = page
        .article()
        .and_then(|article| article.get("author"))
        .and_then(name_of);
    let mut check = match (&structured, &page.meta_author) {
        (None, None) => advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "This looks like an article, and no machine-readable author was found. A visible byline may still exist; RankMiso cannot read it reliably.",
            ),
            "Where readers expect a byline, show the author and consider adding author to the Article markup.",
            ("Google: creating helpful content", HELPFUL),
        ),
        _ => finding(id, title, CheckStatus::Pass, "A machine-readable author was found."),
    };
    if let Some(name) = structured {
        check.evidence.push(evidence("JSON-LD author", name));
    }
    if let Some(name) = &page.meta_author {
        check.evidence.push(evidence("meta author", name.clone()));
    }
    check
}

fn publisher(page: &Observed) -> CheckResult {
    let id = "READY_PUBLISHER";
    let title = "Publisher or site identity";
    let names = page.organization_names();
    if names.is_empty() {
        return advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "No organization name, publisher, or og:site_name was declared. The visible page may still name the publisher.",
            ),
            "Consider declaring the site or organization name, for example with og:site_name or Organization markup.",
            ("Google: creating helpful content", HELPFUL),
        );
    }
    let mut check = finding(
        id,
        title,
        CheckStatus::Pass,
        "A publisher or site name was declared.",
    );
    for (source, name) in names.into_iter().take(MAX_SAMPLES) {
        check.evidence.push(evidence(&source, name));
    }
    check
}

/// Calendar date from an ISO 8601 value: `2026-11-25T…` → `2026-11-25`.
fn day(value: &str) -> Option<String> {
    let day = value.trim().get(..10)?;
    let bytes = day.as_bytes();
    let ok = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && day
            .chars()
            .enumerate()
            .all(|(i, ch)| i == 4 || i == 7 || ch.is_ascii_digit());
    ok.then(|| day.to_string())
}

fn dates(page: &Observed) -> CheckResult {
    let id = "READY_DATES";
    let title = "Published and modified dates";
    let article = page.article();
    let sd_published = article.and_then(|a| text_of(a, "datePublished"));
    let sd_modified = article.and_then(|a| text_of(a, "dateModified"));
    let found = [
        ("JSON-LD datePublished", &sd_published),
        ("JSON-LD dateModified", &sd_modified),
        ("article:published_time", &page.published_meta),
        ("article:modified_time", &page.modified_meta),
    ];
    let present = found
        .iter()
        .filter_map(|(label, value)| value.as_ref().map(|v| (*label, v.clone())))
        .collect::<Vec<_>>();
    if present.is_empty() {
        return if page.page_type == "article" {
            advise(
                finding(
                    id,
                    title,
                    CheckStatus::Info,
                    "This looks like an article, and no machine-readable date was found.",
                ),
                "If the date matters to readers, show it and add datePublished to the Article markup.",
                ("Google: structured data guidelines", SD_POLICIES),
            )
        } else {
            finding(
                id,
                title,
                CheckStatus::NotApplicable,
                "No machine-readable dates, and none are expected for this page type.",
            )
        };
    }
    let mut problems: Vec<String> = Vec::new();
    for (label, value) in &present {
        if day(value).is_none() {
            problems.push(format!("{label} is not an ISO 8601 date: {value}"));
        }
    }
    let published = sd_published
        .as_deref()
        .or(page.published_meta.as_deref())
        .and_then(day);
    let modified = sd_modified
        .as_deref()
        .or(page.modified_meta.as_deref())
        .and_then(day);
    if let (Some(p), Some(m)) = (&published, &modified) {
        if m < p {
            problems.push(format!("modified {m} is earlier than published {p}"));
        }
    }
    if let (Some(a), Some(b)) = (
        sd_published.as_deref().and_then(day),
        page.published_meta.as_deref().and_then(day),
    ) {
        if a != b {
            problems.push(format!(
                "JSON-LD datePublished {a} differs from article:published_time {b}"
            ));
        }
    }
    let mut check = if problems.is_empty() {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "Machine-readable dates were found and do not contradict each other. Age alone says nothing about quality.",
        )
    } else {
        let mut check = advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "Machine-readable dates contradict each other or cannot be read.",
            ),
            "Make the dates agree with each other and with the visible page.",
            ("Google: structured data guidelines", SD_POLICIES),
        );
        samples(&mut check, "problem", &problems);
        check
    };
    for (label, value) in present {
        check.evidence.push(evidence(label, value));
    }
    check
}

fn entity_consistency(page: &Observed) -> CheckResult {
    let id = "READY_ENTITY_NAMES";
    let title = "Organization names agree";
    let names = page.organization_names();
    if names.len() < 2 {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "Fewer than two declared organization names, so there is nothing to compare.",
        );
    }
    let first = &names[0].1;
    let differs = names
        .iter()
        .skip(1)
        .any(|(_, name)| !same_text(first, name));
    let mut check = if differs {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "Declared organization names differ. That can be fine (a brand and a legal name), but it can also be a leftover.",
            ),
            "Review the names and keep them consistent where they mean the same organization.",
            ("Google: structured data guidelines", SD_POLICIES),
        )
    } else {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "Declared organization names agree.",
        )
    };
    for (source, name) in names.into_iter().take(MAX_SAMPLES) {
        check.evidence.push(evidence(&source, name));
    }
    check
}

// ---- Group E: structured data consistency ------------------------------------------------

fn headline_matches(snapshot: &PageSnapshot, page: &Observed) -> CheckResult {
    let id = "READY_SD_HEADLINE";
    let title = "Structured data headline matches the page";
    let Some(entity) = page.main_entity() else {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "No supported JSON-LD entity (Article, Product, WebPage, FAQPage, QAPage) was found.",
        );
    };
    let Some(headline) = text_of(entity, "headline").or_else(|| text_of(entity, "name")) else {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "The JSON-LD entity has no headline or name to compare.",
        );
    };
    let visible = snapshot
        .headings
        .iter()
        .filter(|heading| heading.level <= 2)
        .map(|heading| normalize_ws(&heading.text))
        .chain(support::displayed_title(snapshot))
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>();
    let mut check = if visible.iter().any(|text| same_text(text, &headline)) {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "The JSON-LD headline or name appears in the title or a main heading.",
        )
    } else {
        advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "The JSON-LD headline or name does not match the title or an H1/H2. Google asks that structured data match the visible content.",
            ),
            "Make the markup describe what the page shows.",
            ("Google: structured data guidelines", SD_POLICIES),
        )
    };
    check.evidence.push(evidence("JSON-LD", headline));
    samples(&mut check, "visible", &visible);
    check
}

fn comparable(url: &str, base: &str) -> Option<String> {
    let mut parsed = support::resolve_http(url, base)?;
    parsed.set_fragment(None);
    let host = parsed
        .host_str()?
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    let path = parsed.path().trim_end_matches('/').to_string();
    Some(format!("{host}{path}"))
}

fn url_matches(audit: &AuditResult, page: &Observed) -> CheckResult {
    let id = "READY_SD_URL";
    let title = "Structured data URL matches the canonical";
    let base = audit.page.url.as_str();
    let Some(canonical) = audit.details.metadata.canonicals.first() else {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "No canonical URL is declared; the canonical checks report that.",
        );
    };
    let Some(declared) = page
        .main_entity()
        .and_then(|entity| text_of(entity, "url").or_else(|| text_of(entity, "mainEntityOfPage")))
    else {
        return finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "The main JSON-LD entity declares no url to compare.",
        );
    };
    let same = comparable(&declared, base).is_some()
        && comparable(&declared, base) == comparable(canonical, base);
    let mut check = if same {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "The JSON-LD url and the canonical point to the same page.",
        )
    } else {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "The JSON-LD url and the canonical point to different addresses.",
            ),
            "Check which URL is the page's identity and use it in both.",
            ("Google: structured data guidelines", SD_POLICIES),
        )
    };
    check.evidence.push(evidence("JSON-LD url", declared));
    check
        .evidence
        .push(evidence("canonical", canonical.clone()));
    check
}

#[cfg(test)]
mod tests {
    use super::*;
    use seo_core::{HeadingSnapshot, LinkSnapshot, MetaTag, StructuredDataBlock};

    fn heading(level: u8, text: &str, location: &str) -> HeadingSnapshot {
        HeadingSnapshot {
            level,
            text: text.into(),
            location: location.into(),
        }
    }

    fn meta(name: &str, content: &str) -> MetaTag {
        MetaTag {
            name: Some(name.into()),
            content: Some(content.into()),
            ..MetaTag::default()
        }
    }

    fn property(name: &str, content: &str) -> MetaTag {
        MetaTag {
            property: Some(name.into()),
            content: Some(content.into()),
            ..MetaTag::default()
        }
    }

    fn json_ld(raw: &str) -> StructuredDataBlock {
        StructuredDataBlock {
            format: "json-ld".into(),
            raw: raw.into(),
        }
    }

    fn base() -> PageSnapshot {
        let mut snapshot = PageSnapshot {
            url: "https://example.com/guide".into(),
            ..PageSnapshot::default()
        };
        snapshot.titles.rendered = Some("Brewing miso at home".into());
        snapshot.headings = vec![
            heading(
                1,
                "Brewing miso at home",
                "body > main:nth-of-type(1) > h1:nth-of-type(1)",
            ),
            heading(
                2,
                "What you need",
                "body > main:nth-of-type(1) > h2:nth-of-type(1)",
            ),
        ];
        snapshot.meta = vec![meta("description", "How to brew miso.")];
        snapshot.content.paragraph_count = 8;
        snapshot
    }

    fn run(snapshot: PageSnapshot) -> ReadinessReport {
        analyze(&ReadinessRequest {
            schema_version: READINESS_SCHEMA_VERSION,
            snapshot,
            crawler: None,
            rendering: None,
        })
        .unwrap()
    }

    fn status(report: &ReadinessReport, id: &str) -> CheckStatus {
        report
            .findings
            .iter()
            .find(|f| f.check.id == id)
            .unwrap_or_else(|| panic!("missing {id}"))
            .check
            .status
    }

    #[test]
    fn ids_are_stable_unique_and_unscored() {
        let report = run(base());
        let ids = report
            .findings
            .iter()
            .map(|f| f.check.id.clone())
            .collect::<Vec<_>>();
        let unique = ids.iter().collect::<BTreeSet<_>>();
        assert_eq!(unique.len(), ids.len(), "duplicate finding ids: {ids:?}");
        for f in report.findings.iter().filter(|f| !f.reused) {
            assert!(f.check.id.starts_with("READY_"));
            assert_eq!(f.check.weight, 0);
        }
        // Reused checks are the page's own results, not copies with new logic.
        let audit = crate::analyze(&base(), &AnalyzeOptions::default()).unwrap();
        for f in report.findings.iter().filter(|f| f.reused) {
            let original = audit.checks.iter().find(|c| c.id == f.check.id).unwrap();
            assert_eq!(original, &f.check);
        }
    }

    #[test]
    fn the_page_score_is_not_changed() {
        let before = crate::analyze(&base(), &AnalyzeOptions::default())
            .unwrap()
            .score;
        run(base());
        let after = crate::analyze(&base(), &AnalyzeOptions::default())
            .unwrap()
            .score;
        assert_eq!(before, after);
    }

    #[test]
    fn well_structured_page() {
        let report = run(base());
        assert_eq!(report.page_type, "other");
        assert_eq!(status(&report, "READY_MAIN_CONTENT"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_SECTION_HEADINGS"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_TITLE_H1"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_GENERIC_HEADINGS"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_SNIPPET_CONTROLS"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_TEXT_LENGTH"), CheckStatus::Info);
        // Not an article: no author or date expected.
        assert_eq!(status(&report, "READY_AUTHOR"), CheckStatus::NotApplicable);
        assert_eq!(status(&report, "READY_DATES"), CheckStatus::NotApplicable);
    }

    #[test]
    fn missing_metadata_reuses_existing_checks() {
        let mut snapshot = base();
        snapshot.titles.rendered = None;
        snapshot.meta.clear();
        snapshot.headings.clear();
        let report = run(snapshot);
        let reused = |id: &str| report.findings.iter().find(|f| f.check.id == id).unwrap();
        assert!(reused("RULE_META_TITLE_MISSING").reused);
        assert_eq!(reused("RULE_META_TITLE_MISSING").group, Group::Clarity);
        assert!(reused("RULE_H1_MISSING").reused);
        assert_eq!(
            status(&report, "READY_TITLE_H1"),
            CheckStatus::NotApplicable
        );
        assert_eq!(
            status(&report, "READY_MAIN_CONTENT"),
            CheckStatus::Unavailable
        );
    }

    #[test]
    fn article_attribution_and_dates() {
        let mut snapshot = base();
        snapshot.structured_data = vec![json_ld(
            r#"{"@context":"https://schema.org","@graph":[
              {"@type":"BlogPosting","headline":"Brewing miso at home","author":{"@type":"Person","name":"Aiko"},
               "publisher":{"@type":"Organization","name":"Miso Lab"},
               "datePublished":"2026-03-01T08:00:00Z","dateModified":"2026-04-02","url":"https://example.com/guide"},
              {"@type":"Organization","name":"Miso Lab"}]}"#,
        )];
        snapshot.links_rel.push(seo_core::LinkRel {
            rel: "canonical".into(),
            href: "https://www.example.com/guide/".into(),
            ..Default::default()
        });
        snapshot.meta.push(property("og:site_name", "Miso Lab"));
        let report = run(snapshot);
        assert_eq!(report.page_type, "article");
        assert_eq!(status(&report, "READY_AUTHOR"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_PUBLISHER"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_DATES"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_ENTITY_NAMES"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_SD_HEADLINE"), CheckStatus::Pass);
        assert_eq!(status(&report, "READY_SD_URL"), CheckStatus::Pass);
    }

    #[test]
    fn article_without_attribution_is_an_opportunity_not_an_error() {
        let mut snapshot = base();
        snapshot.meta.push(property("og:type", "article"));
        let report = run(snapshot);
        assert_eq!(report.page_type, "article");
        assert_eq!(status(&report, "READY_AUTHOR"), CheckStatus::Info);
        assert_eq!(status(&report, "READY_DATES"), CheckStatus::Info);
        assert_eq!(status(&report, "READY_PUBLISHER"), CheckStatus::Info);
    }

    #[test]
    fn product_page_gets_no_article_requirements() {
        let mut snapshot = base();
        snapshot.structured_data = vec![json_ld(
            r#"{"@type":"Product","name":"Barley miso 500 g","url":"https://example.com/shop/barley"}"#,
        )];
        snapshot.headings = vec![heading(
            1,
            "Barley miso 500 g",
            "body > main:nth-of-type(1) > h1:nth-of-type(1)",
        )];
        snapshot.content.paragraph_count = 2;
        let report = run(snapshot);
        assert_eq!(report.page_type, "product");
        assert_eq!(status(&report, "READY_AUTHOR"), CheckStatus::NotApplicable);
        assert_eq!(status(&report, "READY_DATES"), CheckStatus::NotApplicable);
        assert_eq!(status(&report, "READY_SD_HEADLINE"), CheckStatus::Pass);
        assert_eq!(
            status(&report, "READY_SECTION_HEADINGS"),
            CheckStatus::NotApplicable
        );
        // No canonical declared: the URL comparison does not apply.
        assert_eq!(status(&report, "READY_SD_URL"), CheckStatus::NotApplicable);
    }

    #[test]
    fn contradictions_are_reported() {
        let mut snapshot = base();
        snapshot.structured_data = vec![json_ld(
            r#"{"@type":"Article","headline":"Completely different","datePublished":"2026-05-01","dateModified":"2026-01-01",
               "publisher":{"name":"Miso Lab"}}"#,
        )];
        snapshot
            .meta
            .push(property("article:published_time", "2026-04-30"));
        snapshot.meta.push(property("og:site_name", "Other Brand"));
        let report = run(snapshot);
        assert_eq!(status(&report, "READY_SD_HEADLINE"), CheckStatus::Warning);
        assert_eq!(status(&report, "READY_DATES"), CheckStatus::Warning);
        assert_eq!(status(&report, "READY_ENTITY_NAMES"), CheckStatus::Info);
        let dates = report
            .findings
            .iter()
            .find(|f| f.check.id == "READY_DATES")
            .unwrap();
        assert!(dates
            .check
            .evidence
            .iter()
            .any(|e| e.value.contains("earlier than published")));
        assert!(dates
            .check
            .evidence
            .iter()
            .any(|e| e.value.contains("differs from")));
    }

    #[test]
    fn generic_text_questions_and_snippets() {
        let mut snapshot = base();
        snapshot.headings.push(heading(
            2,
            "Read more",
            "body > main:nth-of-type(1) > h2:nth-of-type(2)",
        ));
        snapshot.headings.push(heading(
            2,
            "How long does miso ferment?",
            "body > main:nth-of-type(1) > h2:nth-of-type(3)",
        ));
        snapshot.links.push(LinkSnapshot {
            href: "/recipes".into(),
            accessible_name: "Click here".into(),
            location: "body > main:nth-of-type(1) > a:nth-of-type(1)".into(),
            ..LinkSnapshot::default()
        });
        snapshot.meta.push(meta("googlebot", "max-snippet:0"));
        let report = run(snapshot);
        assert_eq!(status(&report, "READY_GENERIC_HEADINGS"), CheckStatus::Info);
        assert_eq!(
            status(&report, "READY_GENERIC_LINK_TEXT"),
            CheckStatus::Info
        );
        assert_eq!(status(&report, "READY_QUESTIONS"), CheckStatus::Info);
        assert_eq!(status(&report, "READY_SNIPPET_CONTROLS"), CheckStatus::Info);
    }

    #[test]
    fn no_main_region_is_info_only_when_paths_are_complete() {
        let mut snapshot = base();
        snapshot.headings = vec![heading(
            1,
            "Brewing miso at home",
            "body > div:nth-of-type(1) > h1:nth-of-type(1)",
        )];
        assert_eq!(
            status(&run(snapshot.clone()), "READY_MAIN_CONTENT"),
            CheckStatus::Info
        );
        snapshot.headings[0].location =
            "div:nth-of-type(3) > div:nth-of-type(1) > h1:nth-of-type(1)".into();
        assert_eq!(
            status(&run(snapshot), "READY_MAIN_CONTENT"),
            CheckStatus::Unavailable
        );
    }

    #[test]
    fn discoverability_inputs_are_not_measured_until_run() {
        let report = run(base());
        assert_eq!(
            status(&report, "READY_CRAWLER_ACCESS"),
            CheckStatus::Unavailable
        );
        assert_eq!(status(&report, "READY_RENDERING"), CheckStatus::Unavailable);

        let agents = |crawl: &str, id: &str| {
            vec![AgentState {
                id: id.into(),
                crawl: crawl.into(),
            }]
        };
        let with = |crawler: CrawlerSummary| {
            analyze(&ReadinessRequest {
                schema_version: 1,
                snapshot: base(),
                crawler: Some(crawler),
                rendering: Some(RenderingSummary {
                    source_origin: "fetch".into(),
                    findings: vec![RenderingFinding {
                        id: "RENDER_CANONICAL".into(),
                        status: CheckStatus::Warning,
                    }],
                }),
            })
            .unwrap()
        };
        let summary = |state: &str, list| CrawlerSummary {
            checked_at: "2026-11-25T10:00:00Z".into(),
            robots_state: state.into(),
            page_access: "ok".into(),
            agents: list,
        };
        let blocked = with(summary("read", agents("disallowed", "googlebot")));
        assert_eq!(
            status(&blocked, "READY_CRAWLER_ACCESS"),
            CheckStatus::Warning
        );
        assert_eq!(status(&blocked, "READY_RENDERING"), CheckStatus::Warning);
        let ai_only = with(summary("read", agents("disallowed", "oai-searchbot")));
        assert_eq!(status(&ai_only, "READY_CRAWLER_ACCESS"), CheckStatus::Info);
        let fine = with(summary("read", agents("allowed", "googlebot")));
        assert_eq!(status(&fine, "READY_CRAWLER_ACCESS"), CheckStatus::Pass);
        let noted = analyze(&ReadinessRequest {
            schema_version: 1,
            snapshot: base(),
            crawler: None,
            rendering: Some(RenderingSummary {
                source_origin: "file".into(),
                findings: vec![
                    RenderingFinding {
                        id: "RENDER_TITLE".into(),
                        status: CheckStatus::Info,
                    },
                    RenderingFinding {
                        id: "RENDER_ROBOTS".into(),
                        status: CheckStatus::Pass,
                    },
                ],
            }),
        })
        .unwrap();
        assert_eq!(status(&noted, "READY_RENDERING"), CheckStatus::Info);
        let unread = with(summary("not-read", vec![]));
        assert_eq!(
            status(&unread, "READY_CRAWLER_ACCESS"),
            CheckStatus::Unavailable
        );
    }

    #[test]
    fn reads_the_browser_json_contract_and_rejects_other_versions() {
        let snapshot = serde_json::to_value(base()).unwrap();
        let json = serde_json::json!({ "schemaVersion": 1, "snapshot": snapshot }).to_string();
        let request: ReadinessRequest = serde_json::from_str(&json).unwrap();
        let out = serde_json::to_value(analyze(&request).unwrap()).unwrap();
        let first = &out["findings"][0];
        assert!(
            first["id"].is_string() && first["group"].is_string() && first["titleKey"].is_string()
        );
        assert!(analyze(&ReadinessRequest {
            schema_version: 2,
            ..request
        })
        .is_err());
    }
}
