//! JavaScript SEO diagnostics: the initial HTML response compared with the rendered page.
//!
//! The browser collects both observations. This module decides what changed and why it can
//! matter. A difference is not automatically a problem: many sites change the page with
//! JavaScript on purpose. Nothing here claims how a search engine renders the page.

use std::collections::BTreeSet;

use seo_core::{Category, CheckResult, CheckStatus, EngineError, MAX_LINKS};
use url::Url;

use crate::support::{self, bounded_evidence, evidence, normalize_ws, reference};

pub const RENDERING_SCHEMA_VERSION: u32 = 1;

const NONE: &str = "(none)";
const JS_SEO_DOC: &str =
    "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics";

/// Rule ids and titles, one per compared signal. Ids stay stable for exports and title keys.
pub const RULES: [(&str, &str); 7] = [
    ("RENDER_TITLE", "Title before and after rendering"),
    (
        "RENDER_DESCRIPTION",
        "Meta description before and after rendering",
    ),
    ("RENDER_CANONICAL", "Canonical before and after rendering"),
    (
        "RENDER_ROBOTS",
        "Robots directives before and after rendering",
    ),
    ("RENDER_H1", "H1 before and after rendering"),
    (
        "RENDER_INTERNAL_LINKS",
        "Internal links before and after rendering",
    ),
    (
        "RENDER_STRUCTURED_DATA",
        "JSON-LD types before and after rendering",
    ),
];

fn rule_title(id: &str) -> &'static str {
    RULES
        .iter()
        .find(|(rule, _)| *rule == id)
        .map_or("", |(_, title)| title)
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderingComparison {
    pub schema_version: u32,
    pub page_url: String,
    pub source: SourceObservation,
    pub rendered: RenderSignals,
}

/// The initial HTML. `signals` is missing when it could not be read; `unavailable` says why.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceObservation {
    /// `fetch` (requested by RankMiso) or `file` (saved by the user).
    pub origin: String,
    #[serde(default)]
    pub unavailable: Option<String>,
    #[serde(default)]
    pub signals: Option<RenderSignals>,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RenderSignals {
    pub title: String,
    pub description: String,
    pub canonicals: Vec<String>,
    /// Contents of `robots` and `googlebot` meta tags.
    pub robots: Vec<String>,
    pub h1: Vec<String>,
    /// Absolute http(s) link targets. This module decides which are internal.
    pub links: Vec<String>,
    pub links_truncated: bool,
    pub json_ld_types: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderingReport {
    pub schema_version: u32,
    pub source_origin: String,
    pub findings: Vec<CheckResult>,
}

pub fn analyze(input: &RenderingComparison) -> Result<RenderingReport, EngineError> {
    if input.schema_version != RENDERING_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(input.schema_version));
    }
    let page = Url::parse(&input.page_url)
        .map_err(|_| EngineError::new("INVALID_URL", "The page URL could not be read."))?;
    let findings = match &input.source.signals {
        Some(source) => vec![
            title(source, &input.rendered),
            description(source, &input.rendered),
            canonical(source, &input.rendered, &page),
            robots(source, &input.rendered),
            h1(source, &input.rendered),
            internal_links(source, &input.rendered, &page),
            structured_data(source, &input.rendered),
        ],
        None => unavailable(input.source.unavailable.as_deref().unwrap_or("unknown")),
    };
    Ok(RenderingReport {
        schema_version: RENDERING_SCHEMA_VERSION,
        source_origin: input.source.origin.clone(),
        findings,
    })
}

fn finding(id: &str, title: &str, status: CheckStatus, description: &str) -> CheckResult {
    let mut check = support::check(id, Category::Technical, status, 0, title, description);
    check
        .references
        .push(reference("Google: JavaScript SEO basics", JS_SEO_DOC));
    check
}

fn with_values(mut check: CheckResult, source: &str, rendered: &str) -> CheckResult {
    let shown = |value: &str| {
        if value.is_empty() {
            NONE.to_string()
        } else {
            value.to_string()
        }
    };
    check.evidence.push(evidence("initial HTML", shown(source)));
    check.evidence.push(evidence("rendered", shown(rendered)));
    check
}

fn advise(mut check: CheckResult, recommendation: &str) -> CheckResult {
    check.recommendation = Some(recommendation.to_string());
    check
}

/// Title and description: plain text compared after whitespace is collapsed.
fn text_signal(
    id: &str,
    title: &str,
    noun: &str,
    source: &str,
    rendered: &str,
    js_only: CheckStatus,
) -> CheckResult {
    let (source, rendered) = (normalize_ws(source), normalize_ws(rendered));
    let check = match (source.is_empty(), rendered.is_empty()) {
        (true, true) => finding(
            id,
            title,
            CheckStatus::NotApplicable,
            &format!("Neither the initial HTML nor the rendered page has a {noun}."),
        ),
        (true, false) => advise(
            finding(
                id,
                title,
                js_only,
                &format!("The {noun} appears only after JavaScript runs. A crawler that reads the initial HTML without rendering sees no {noun}."),
            ),
            &format!("Put the {noun} in the server response if it should not depend on rendering."),
        ),
        (false, true) => advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                &format!("The initial HTML has a {noun}, and the rendered page does not. JavaScript removed it."),
            ),
            &format!("Check which script removes the {noun}."),
        ),
        _ if source == rendered => finding(
            id,
            title,
            CheckStatus::Pass,
            &format!("The {noun} is the same before and after rendering."),
        ),
        _ => advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                &format!("JavaScript changes the {noun}. Crawlers that do not render keep the initial value; those that render may use the new one."),
            ),
            &format!("Confirm the change is intended, and serve the final {noun} in the initial HTML when you can."),
        ),
    };
    with_values(check, &source, &rendered)
}

fn title(source: &RenderSignals, rendered: &RenderSignals) -> CheckResult {
    text_signal(
        "RENDER_TITLE",
        rule_title("RENDER_TITLE"),
        "title",
        &source.title,
        &rendered.title,
        CheckStatus::Warning,
    )
}

fn description(source: &RenderSignals, rendered: &RenderSignals) -> CheckResult {
    text_signal(
        "RENDER_DESCRIPTION",
        rule_title("RENDER_DESCRIPTION"),
        "meta description",
        &source.description,
        &rendered.description,
        CheckStatus::Info,
    )
}

/// Resolves against the page and drops the fragment, so `/a` and `https://host/a#x` match.
fn normalized_urls(values: &[String], page: &Url) -> BTreeSet<String> {
    values
        .iter()
        .take(MAX_LINKS)
        .filter_map(|value| support::resolve_http(value.trim(), page.as_str()))
        .map(|mut url| {
            url.set_fragment(None);
            url.to_string()
        })
        .collect()
}

fn joined(values: &BTreeSet<String>) -> String {
    values.iter().cloned().collect::<Vec<_>>().join(" | ")
}

fn canonical(source: &RenderSignals, rendered: &RenderSignals, page: &Url) -> CheckResult {
    let id = "RENDER_CANONICAL";
    let title = rule_title(id);
    let before = normalized_urls(&source.canonicals, page);
    let after = normalized_urls(&rendered.canonicals, page);
    let check = match (before.is_empty(), after.is_empty()) {
        (true, true) => finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "Neither the initial HTML nor the rendered page declares a canonical URL.",
        ),
        (true, false) => advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "A canonical URL appears only after JavaScript runs. Google says it may use a canonical added by JavaScript, and recommends declaring it in the HTML.",
            ),
            "Declare the canonical URL in the server response.",
        ),
        (false, true) => advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "JavaScript removes the canonical URL the initial HTML declares.",
            ),
            "Find the script that removes the canonical link and keep one canonical in both versions.",
        ),
        _ if before == after => finding(
            id,
            title,
            CheckStatus::Pass,
            "The canonical URL is the same before and after rendering.",
        ),
        _ => advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "JavaScript changes the canonical URL. The two versions send different signals about the preferred URL.",
            ),
            "Keep one canonical URL. Google recommends not changing the canonical with JavaScript.",
        ),
    };
    with_values(check, &joined(&before), &joined(&after))
}

fn robots(source: &RenderSignals, rendered: &RenderSignals) -> CheckResult {
    let id = "RENDER_ROBOTS";
    let title = rule_title(id);
    let tokens = |values: &[String]| {
        let refs = values.iter().map(String::as_str).collect::<Vec<_>>();
        support::directives(&refs)
    };
    let before = tokens(&source.robots);
    let after = tokens(&rendered.robots);
    let set = |list: &[String]| list.iter().cloned().collect::<BTreeSet<_>>();
    let (before_set, after_set) = (set(&before), set(&after));
    let noindex_before = support::has_noindex(&before);
    let noindex_after = support::has_noindex(&after);
    let check = if noindex_before && !noindex_after {
        advise(
            finding(
                id,
                title,
                CheckStatus::Error,
                "The initial HTML says noindex, and JavaScript removes it. Google may skip rendering a page whose initial HTML says noindex, so the removal may never be seen.",
            ),
            "If the page should be indexed, remove noindex from the server response.",
        )
    } else if !noindex_before && noindex_after {
        advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "JavaScript adds noindex. Crawlers that render may follow it; crawlers that read only the initial HTML do not see it.",
            ),
            "Confirm the page should not be indexed. If so, send noindex in the initial HTML or an X-Robots-Tag header.",
        )
    } else if before_set == after_set {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "Robots directives are the same before and after rendering.",
        )
    } else {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "JavaScript changes robots directives other than noindex.",
            ),
            "Confirm the change is intended, and serve the final directives in the initial HTML.",
        )
    };
    with_values(check, &before.join(", "), &after.join(", "))
}

fn h1(source: &RenderSignals, rendered: &RenderSignals) -> CheckResult {
    let id = "RENDER_H1";
    let title = rule_title(id);
    let clean = |values: &[String]| {
        values
            .iter()
            .map(|value| normalize_ws(value))
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
    };
    let (before, after) = (clean(&source.h1), clean(&rendered.h1));
    let check = match (before.is_empty(), after.is_empty()) {
        (true, true) => finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "Neither the initial HTML nor the rendered page has an H1.",
        ),
        (true, false) => advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "The H1 appears only after JavaScript runs.",
            ),
            "If the main heading matters for this page, include it in the server response.",
        ),
        (false, true) => advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "The initial HTML has an H1, and the rendered page does not.",
            ),
            "Check which script removes or replaces the heading.",
        ),
        _ if before == after => finding(
            id,
            title,
            CheckStatus::Pass,
            "The H1 is the same before and after rendering.",
        ),
        _ => advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "JavaScript changes the H1 text or count.",
            ),
            "Confirm the rendered heading is the one you want crawlers to see.",
        ),
    };
    with_values(check, &before.join(" | "), &after.join(" | "))
}

fn internal_links(source: &RenderSignals, rendered: &RenderSignals, page: &Url) -> CheckResult {
    let id = "RENDER_INTERNAL_LINKS";
    let title = rule_title(id);
    let host = support::hostname(page.as_str());
    let internal = |values: &[String]| {
        normalized_urls(values, page)
            .into_iter()
            .filter(|url| support::hostname(url) == host)
            .collect::<BTreeSet<_>>()
    };
    let (before, after) = (internal(&source.links), internal(&rendered.links));
    let added = after.difference(&before).cloned().collect::<Vec<_>>();
    let removed = before.difference(&after).cloned().collect::<Vec<_>>();
    let mut check = if before.is_empty() && after.is_empty() {
        finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "Neither the initial HTML nor the rendered page links to this site.",
        )
    } else if before.is_empty() {
        advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "Every internal link appears only after JavaScript runs. A crawler that does not render finds no path to other pages from here.",
            ),
            "Render the main navigation as plain <a href> links in the server response.",
        )
    } else if added.is_empty() && removed.is_empty() {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "The same internal link targets exist before and after rendering.",
        )
    } else {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "JavaScript adds or removes internal link targets.",
            ),
            "Make sure links you want crawled are in the initial HTML as <a href> elements.",
        )
    };
    check.evidence.push(evidence(
        "initial HTML",
        format!("{} targets", before.len()),
    ));
    check
        .evidence
        .push(evidence("rendered", format!("{} targets", after.len())));
    check
        .evidence
        .extend(bounded_evidence(&added, "only after rendering"));
    check
        .evidence
        .extend(bounded_evidence(&removed, "only in initial HTML"));
    if source.links_truncated || rendered.links_truncated {
        check.evidence.push(evidence(
            "limit",
            format!("Link lists stop at {MAX_LINKS}; differences past that are not counted."),
        ));
    }
    check
}

fn structured_data(source: &RenderSignals, rendered: &RenderSignals) -> CheckResult {
    let id = "RENDER_STRUCTURED_DATA";
    let title = rule_title(id);
    let set = |values: &[String]| {
        values
            .iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<BTreeSet<_>>()
    };
    let (before, after) = (set(&source.json_ld_types), set(&rendered.json_ld_types));
    let added = after.difference(&before).cloned().collect::<Vec<_>>();
    let removed = before.difference(&after).cloned().collect::<Vec<_>>();
    let check = if before.is_empty() && after.is_empty() {
        finding(
            id,
            title,
            CheckStatus::NotApplicable,
            "Neither the initial HTML nor the rendered page has JSON-LD types.",
        )
    } else if !removed.is_empty() {
        advise(
            finding(
                id,
                title,
                CheckStatus::Warning,
                "JSON-LD types in the initial HTML are missing after rendering.",
            ),
            "Check which script removes or replaces the structured data.",
        )
    } else if !added.is_empty() {
        advise(
            finding(
                id,
                title,
                CheckStatus::Info,
                "Some JSON-LD types appear only after JavaScript runs. Google can read JSON-LD added by JavaScript; other consumers may not.",
            ),
            "Test the rendered page with the Rich Results Test if these types matter to you.",
        )
    } else {
        finding(
            id,
            title,
            CheckStatus::Pass,
            "The same JSON-LD types exist before and after rendering.",
        )
    };
    with_values(check, &joined(&before), &joined(&after))
}

fn unavailable(reason: &str) -> Vec<CheckResult> {
    let why = match reason {
        "denied" => "Website access was not granted, so the initial HTML could not be read.",
        "timeout" => "The request for the initial HTML timed out.",
        "redirect" => "The initial HTML request redirected somewhere RankMiso does not follow.",
        "size" => "The initial HTML was larger than the 512 KB limit.",
        "type" => "The response was not HTML.",
        "status" => "The server answered with an error status.",
        "aborted" => "The request was cancelled.",
        _ => "The initial HTML could not be read.",
    };
    RULES
        .iter()
        .map(|(id, title)| {
            let mut check = finding(
                id,
                title,
                CheckStatus::Unavailable,
                &format!("{why} This signal was not compared, and it is not counted as passing."),
            );
            check.evidence.push(evidence("reason", reason.to_string()));
            check
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signals() -> RenderSignals {
        RenderSignals {
            title: "Guide".into(),
            description: "A guide".into(),
            canonicals: vec!["https://example.com/guide".into()],
            robots: vec!["index, follow".into()],
            h1: vec!["Guide".into()],
            links: vec!["https://example.com/a".into(), "https://other.org/".into()],
            links_truncated: false,
            json_ld_types: vec!["Article".into()],
        }
    }

    fn run(source: Option<RenderSignals>, rendered: RenderSignals) -> Vec<CheckResult> {
        let input = RenderingComparison {
            schema_version: RENDERING_SCHEMA_VERSION,
            page_url: "https://example.com/guide".into(),
            source: SourceObservation {
                origin: "fetch".into(),
                unavailable: source.is_none().then(|| "denied".into()),
                signals: source,
            },
            rendered,
        };
        analyze(&input).unwrap().findings
    }

    fn status(findings: &[CheckResult], id: &str) -> CheckStatus {
        findings.iter().find(|check| check.id == id).unwrap().status
    }

    #[test]
    fn static_page_passes_every_signal() {
        let findings = run(Some(signals()), signals());
        assert_eq!(findings.len(), RULES.len());
        assert!(findings
            .iter()
            .all(|check| check.status == CheckStatus::Pass));
        assert!(findings.iter().all(|check| check.weight == 0));
    }

    #[test]
    fn client_rendered_metadata_is_reported() {
        let source = RenderSignals {
            title: String::new(),
            description: String::new(),
            ..signals()
        };
        let findings = run(Some(source), signals());
        assert_eq!(status(&findings, "RENDER_TITLE"), CheckStatus::Warning);
        assert_eq!(status(&findings, "RENDER_DESCRIPTION"), CheckStatus::Info);
        let title = findings.iter().find(|c| c.id == "RENDER_TITLE").unwrap();
        assert_eq!(title.evidence[0].value, NONE);
        assert_eq!(title.evidence[1].value, "Guide");
    }

    #[test]
    fn client_rendered_links_are_listed() {
        let source = RenderSignals {
            links: vec![],
            ..signals()
        };
        let findings = run(Some(source.clone()), signals());
        assert_eq!(
            status(&findings, "RENDER_INTERNAL_LINKS"),
            CheckStatus::Warning
        );

        let mut rendered = signals();
        rendered.links.push("/b#top".into());
        let findings = run(Some(signals()), rendered);
        let links = findings
            .iter()
            .find(|c| c.id == "RENDER_INTERNAL_LINKS")
            .unwrap();
        assert_eq!(links.status, CheckStatus::Info);
        assert!(links
            .evidence
            .iter()
            .any(|e| e.label == "only after rendering" && e.value == "https://example.com/b"));
        // The external link never counts as internal.
        assert!(links
            .evidence
            .iter()
            .all(|e| !e.value.contains("other.org")));
    }

    #[test]
    fn changed_canonical_is_a_warning() {
        let mut rendered = signals();
        rendered.canonicals = vec!["https://example.com/other".into()];
        assert_eq!(
            status(&run(Some(signals()), rendered), "RENDER_CANONICAL"),
            CheckStatus::Warning
        );
    }

    #[test]
    fn relative_canonical_and_fragment_normalize() {
        let mut source = signals();
        source.canonicals = vec!["/guide#intro".into()];
        source.title = "  Guide \n".into();
        let findings = run(Some(source), signals());
        assert_eq!(status(&findings, "RENDER_CANONICAL"), CheckStatus::Pass);
        assert_eq!(status(&findings, "RENDER_TITLE"), CheckStatus::Pass);
    }

    #[test]
    fn robots_changes_are_graded() {
        let mut source = signals();
        source.robots = vec!["noindex".into()];
        assert_eq!(
            status(&run(Some(source), signals()), "RENDER_ROBOTS"),
            CheckStatus::Error
        );
        let mut rendered = signals();
        rendered.robots = vec!["noindex, nofollow".into()];
        assert_eq!(
            status(&run(Some(signals()), rendered), "RENDER_ROBOTS"),
            CheckStatus::Warning
        );
        let mut rendered = signals();
        rendered.robots = vec!["index, follow, max-snippet:50".into()];
        assert_eq!(
            status(&run(Some(signals()), rendered), "RENDER_ROBOTS"),
            CheckStatus::Info
        );
    }

    #[test]
    fn unavailable_source_is_never_a_pass() {
        let findings = run(None, signals());
        assert_eq!(findings.len(), RULES.len());
        assert!(findings
            .iter()
            .all(|check| check.status == CheckStatus::Unavailable && !check.applicable));
        assert!(findings[0].description.contains("access was not granted"));
        assert_eq!(findings[0].title, "Title before and after rendering");
    }

    #[test]
    fn reads_the_browser_json_contract() {
        let json = r#"{"schemaVersion":1,"pageUrl":"https://example.com/guide",
            "source":{"origin":"file","signals":{"title":"","description":"","canonicals":[],
              "robots":[],"h1":[],"links":[],"linksTruncated":false,"jsonLdTypes":[]}},
            "rendered":{"title":"Guide","description":"","canonicals":["/guide"],
              "robots":["noindex"],"h1":["Guide"],"links":["https://example.com/a"],
              "linksTruncated":true,"jsonLdTypes":["Article"]}}"#;
        let input: RenderingComparison = serde_json::from_str(json).unwrap();
        let report = analyze(&input).unwrap();
        assert_eq!(report.source_origin, "file");
        let out = serde_json::to_value(&report).unwrap();
        assert_eq!(out["schemaVersion"], 1);
        assert_eq!(out["findings"][0]["titleKey"], "rules.renderTitle.title");
        assert_eq!(
            status(&report.findings, "RENDER_ROBOTS"),
            CheckStatus::Warning
        );
        assert_eq!(
            status(&report.findings, "RENDER_INTERNAL_LINKS"),
            CheckStatus::Warning
        );
        let unavailable: RenderingComparison = serde_json::from_str(
            r#"{"schemaVersion":1,"pageUrl":"https://example.com/","source":{"origin":"fetch","unavailable":"timeout"},"rendered":{}}"#,
        )
        .unwrap();
        let findings = analyze(&unavailable).unwrap().findings;
        assert!(findings[0].description.contains("timed out"));
    }

    #[test]
    fn rejects_other_schema_versions() {
        let input = RenderingComparison {
            schema_version: 2,
            page_url: "https://example.com/".into(),
            source: SourceObservation {
                origin: "file".into(),
                unavailable: None,
                signals: None,
            },
            rendered: RenderSignals::default(),
        };
        assert!(analyze(&input).is_err());
    }

    #[test]
    fn removed_structured_data_and_h1_warn() {
        let rendered = RenderSignals {
            h1: vec![],
            json_ld_types: vec![],
            ..signals()
        };
        let findings = run(Some(signals()), rendered);
        assert_eq!(status(&findings, "RENDER_H1"), CheckStatus::Warning);
        assert_eq!(
            status(&findings, "RENDER_STRUCTURED_DATA"),
            CheckStatus::Warning
        );
    }
}
