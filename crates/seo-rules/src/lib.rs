//! SEO rule evaluation. The engine accepts a serializable page snapshot and
//! returns a versioned audit. It does not read the DOM or the network.

mod accessibility;
mod content;
mod headings;
mod images;
mod international;
mod links;
mod metadata;
mod performance;
mod social;
mod structured_data;
mod support;
mod technical;

use seo_core::{
    AnalyzeOptions, AuditDetails, AuditMetrics, AuditResult, CheckResult, CheckStatus,
    CountMetrics, EngineError, LinkClass, PageSnapshot, PageSummary, Recommendation,
    SourceMetadata, AUDIT_SCHEMA_VERSION, ENGINE_NAME, MAX_HEADINGS, MAX_IMAGES, MAX_LINKS,
    MAX_META_TAGS, MAX_STRUCTURED_BLOCKS, MAX_STRUCTURED_CHARS, MAX_TEXT_CHARS, RULESET_VERSION,
    SNAPSHOT_SCHEMA_VERSION,
};
use seo_scoring::{score, ScoringConfig};

pub fn analyze(
    snapshot: &PageSnapshot,
    options: &AnalyzeOptions,
) -> Result<AuditResult, EngineError> {
    if snapshot.schema_version != SNAPSHOT_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(snapshot.schema_version));
    }

    let (snapshot, limitations) = normalize(snapshot);
    let metadata = metadata::interpret(&snapshot);
    let mut content_metrics = content::metrics(&snapshot, &metadata, options);
    let heading_text = snapshot
        .headings
        .iter()
        .map(|heading| heading.text.clone())
        .collect::<Vec<_>>()
        .join(" ");
    content::with_headings(&mut content_metrics, &heading_text);
    let normalized_links = links::classify(&snapshot);
    let social = social::interpret(&snapshot);
    let hreflang = international::interpret(&snapshot);
    let structured = structured_data::interpret(&snapshot.structured_data);

    let mut checks = Vec::new();
    checks.extend(metadata::checks(&snapshot, &metadata));
    checks.extend(content::checks(&content_metrics));
    checks.extend(headings::checks(&snapshot));
    checks.extend(links::checks(&snapshot, &normalized_links));
    checks.extend(images::checks(&snapshot.images));
    checks.extend(technical::checks(&snapshot));
    checks.extend(social::checks(&metadata, &social));
    checks.extend(international::checks(&snapshot, &metadata, &hreflang));
    checks.extend(accessibility::checks(&snapshot.accessibility));
    checks.extend(structured_data::checks(&structured));
    checks.extend(performance::checks(&snapshot.performance));

    let score = score(&checks, &ScoringConfig::default());
    let recommendations = recommendations_from(&checks);
    let counts = CountMetrics {
        headings: snapshot.headings.len() as u32,
        h1: snapshot
            .headings
            .iter()
            .filter(|heading| heading.level == 1)
            .count() as u32,
        links: normalized_links.len() as u32,
        internal_links: normalized_links
            .iter()
            .filter(|link| link.classification == LinkClass::Internal)
            .count() as u32,
        external_links: normalized_links
            .iter()
            .filter(|link| link.classification == LinkClass::External)
            .count() as u32,
        images: snapshot.images.len() as u32,
        images_missing_alt: snapshot
            .images
            .iter()
            .filter(|image| !image.alt_present)
            .count() as u32,
        images_empty_alt: snapshot
            .images
            .iter()
            .filter(|image| image.alt_present && image.alt_value.trim().is_empty())
            .count() as u32,
    };

    Ok(AuditResult {
        schema_version: AUDIT_SCHEMA_VERSION,
        ruleset_version: RULESET_VERSION.to_string(),
        page: PageSummary {
            url: snapshot.url.clone(),
            title: metadata.title.clone(),
            language: metadata.language.clone(),
        },
        score,
        recommendations,
        metrics: AuditMetrics {
            content: content_metrics,
            counts,
        },
        details: AuditDetails {
            metadata,
            headings: snapshot.headings.clone(),
            links: normalized_links,
            images: snapshot.images.clone(),
            social,
            hreflang,
            structured_data: structured,
            performance: snapshot.performance.clone(),
            response: snapshot.response.clone(),
            site: snapshot.site.clone(),
        },
        source: SourceMetadata {
            collection_method: snapshot.collection.method.clone(),
            limitations,
            ruleset_version: RULESET_VERSION.to_string(),
            engine: ENGINE_NAME.to_string(),
        },
        checks,
        analyzed_at: snapshot.collected_at.clone(),
    })
}

fn recommendations_from(checks: &[CheckResult]) -> Vec<Recommendation> {
    let mut ranked: Vec<&CheckResult> = checks
        .iter()
        .filter(|check| check.recommendation.is_some())
        .filter(|check| {
            matches!(
                check.status,
                CheckStatus::Error | CheckStatus::Warning | CheckStatus::Info
            )
        })
        .collect();
    ranked.sort_by_key(|check| match check.status {
        CheckStatus::Error => 0,
        CheckStatus::Warning => 1,
        _ => 2,
    });
    ranked
        .into_iter()
        .map(|check| Recommendation {
            rule_id: check.id.clone(),
            status: check.status,
            text: check.recommendation.clone().unwrap_or_default(),
        })
        .collect()
}

fn normalize(snapshot: &PageSnapshot) -> (PageSnapshot, Vec<String>) {
    let mut snapshot = snapshot.clone();
    let mut limitations = snapshot.collection.limitations.clone();
    if snapshot.content.visible_text.chars().count() > MAX_TEXT_CHARS {
        snapshot.content.visible_text = snapshot
            .content
            .visible_text
            .chars()
            .take(MAX_TEXT_CHARS)
            .collect();
        snapshot.content.text_truncated = true;
        limitations.push("TEXT_TRUNCATED".to_string());
    }
    truncate(
        &mut snapshot.headings,
        MAX_HEADINGS,
        "HEADINGS_TRUNCATED",
        &mut limitations,
    );
    truncate(
        &mut snapshot.links,
        MAX_LINKS,
        "LINKS_TRUNCATED",
        &mut limitations,
    );
    truncate(
        &mut snapshot.images,
        MAX_IMAGES,
        "IMAGES_TRUNCATED",
        &mut limitations,
    );
    truncate(
        &mut snapshot.meta,
        MAX_META_TAGS,
        "META_TRUNCATED",
        &mut limitations,
    );
    truncate(
        &mut snapshot.structured_data,
        MAX_STRUCTURED_BLOCKS,
        "STRUCTURED_DATA_TRUNCATED",
        &mut limitations,
    );
    for block in &mut snapshot.structured_data {
        if block.raw.chars().count() > MAX_STRUCTURED_CHARS {
            block.raw = block.raw.chars().take(MAX_STRUCTURED_CHARS).collect();
            limitations.push("STRUCTURED_DATA_BLOCK_TRUNCATED".to_string());
        }
    }
    if snapshot.site.robots_body.chars().count() > 80_000 {
        snapshot.site.robots_body = snapshot.site.robots_body.chars().take(80_000).collect();
        limitations.push("ROBOTS_TRUNCATED".to_string());
    }
    snapshot.site.notes.truncate(12);
    snapshot.site.sitemap_urls.truncate(8);
    snapshot.site.redirect_hops.truncate(5);
    for hop in &mut snapshot.site.redirect_hops {
        *hop = hop.chars().take(300).collect();
    }
    snapshot.response.headers.truncate(40);
    for header in &mut snapshot.response.headers {
        header.name = header.name.chars().take(80).collect();
        header.value = header.value.chars().take(500).collect();
    }
    limitations.sort();
    limitations.dedup();
    (snapshot, limitations)
}

fn truncate<T>(items: &mut Vec<T>, max: usize, code: &str, limitations: &mut Vec<String>) {
    if items.len() > max {
        items.truncate(max);
        limitations.push(code.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use seo_core::{
        AccessibilitySnapshot, ContentSnapshot, HeadingSnapshot, ImageSnapshot, LinkRel,
        LinkSnapshot, MetaTag, StructuredDataBlock, TitleSnapshot,
    };

    fn healthy() -> PageSnapshot {
        let mut snapshot = PageSnapshot::default();
        snapshot.titles.rendered = Some("Example guide to local audits".to_string());
        snapshot.titles.elements = vec!["Example guide to local audits".to_string()];
        snapshot.meta = vec![
            meta_name(
                "description",
                "A clear summary of a local SEO audit example page for testing.",
            ),
            meta_name("viewport", "width=device-width, initial-scale=1"),
            meta_name("robots", "index,follow"),
            MetaTag {
                charset: Some("utf-8".to_string()),
                ..MetaTag::default()
            },
        ];
        snapshot.links_rel = vec![LinkRel {
            rel: "canonical".to_string(),
            href: "https://example.com/".to_string(),
            hreflang: None,
            media: None,
        }];
        snapshot.content = ContentSnapshot {
            visible_text: "Example guide explains local audits in enough detail for a visitor. The fox studies the page and the guide stays useful. This paragraph adds the words needed to pass the short-text observation.".to_string(),
            text_truncated: false,
            html_length: 400,
            paragraph_count: 2,
            html_lang: Some("en".to_string()),
            published_time: None,
            modified_time: None,
        };
        snapshot.headings = vec![
            HeadingSnapshot {
                level: 1,
                text: "Example guide".to_string(),
                location: "h1".to_string(),
            },
            HeadingSnapshot {
                level: 2,
                text: "Details".to_string(),
                location: "h2".to_string(),
            },
        ];
        snapshot.links = vec![LinkSnapshot {
            href: "https://example.com/about".to_string(),
            resolved_url: Some("https://example.com/about".to_string()),
            accessible_name: "About".to_string(),
            rel: Vec::new(),
            target: None,
            title: None,
            location: "a".to_string(),
        }];
        snapshot.images = vec![ImageSnapshot {
            src: Some("https://example.com/cover.png".to_string()),
            alt_present: true,
            alt_value: "Cover illustration".to_string(),
            width_attr: Some(800),
            height_attr: Some(400),
            rendered_width: Some(800),
            rendered_height: Some(400),
            natural_width: Some(800),
            natural_height: Some(400),
            loading: Some("lazy".to_string()),
            fetch_priority: None,
            srcset: None,
            in_picture: false,
            broken: Some(false),
            location: "img".to_string(),
        }];
        snapshot.accessibility = AccessibilitySnapshot {
            unlabeled_form_controls: 0,
            nameless_buttons: 0,
            duplicate_ids: 0,
            sampled: true,
        };
        snapshot.response.status = Some(200);
        snapshot.response.redirect_count = Some(0);
        snapshot
    }

    fn meta_name(name: &str, content: &str) -> MetaTag {
        MetaTag {
            name: Some(name.to_string()),
            content: Some(content.to_string()),
            ..MetaTag::default()
        }
    }

    fn status_of(audit: &AuditResult, id: &str) -> CheckStatus {
        audit
            .checks
            .iter()
            .find(|check| check.id == id)
            .unwrap_or_else(|| panic!("missing {id}"))
            .status
    }

    #[test]
    fn healthy_page_has_no_errors_and_a_score() {
        let audit = analyze(&healthy(), &AnalyzeOptions::default()).unwrap();
        assert!(audit
            .checks
            .iter()
            .all(|check| check.status != CheckStatus::Error));
        assert!(audit.score.value.unwrap() > 80);
        assert_eq!(audit.analyzed_at, healthy().collected_at);
        assert!(audit.score.disclaimer.contains("not a Google ranking"));
    }

    #[test]
    fn missing_title_is_an_error_and_repeatable() {
        let mut snapshot = healthy();
        snapshot.titles = TitleSnapshot::default();
        let first = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        let second = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert_eq!(
            status_of(&first, "RULE_META_TITLE_MISSING"),
            CheckStatus::Error
        );
        assert_eq!(first.score, second.score);
    }

    #[test]
    fn empty_alt_is_not_an_error_and_missing_alt_is() {
        let mut empty = healthy();
        empty.images[0].alt_value.clear();
        let empty_audit = analyze(&empty, &AnalyzeOptions::default()).unwrap();
        assert_eq!(
            status_of(&empty_audit, "RULE_IMAGE_ALT_MISSING"),
            CheckStatus::Pass
        );
        assert_eq!(
            status_of(&empty_audit, "RULE_IMAGE_ALT_EMPTY"),
            CheckStatus::Info
        );

        let mut missing = healthy();
        missing.images[0].alt_present = false;
        let missing_audit = analyze(&missing, &AnalyzeOptions::default()).unwrap();
        assert_eq!(
            status_of(&missing_audit, "RULE_IMAGE_ALT_MISSING"),
            CheckStatus::Error
        );
    }

    #[test]
    fn noindex_is_a_warning_not_an_index_claim() {
        let mut snapshot = healthy();
        snapshot.meta.push(meta_name("robots", "noindex"));
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        let check = audit
            .checks
            .iter()
            .find(|check| check.id == "RULE_NOINDEX_DETECTED")
            .unwrap();
        assert_eq!(check.status, CheckStatus::Warning);
        assert!(check.description.contains("not a statement"));
        assert_eq!(
            status_of(&audit, "RULE_INDEXING_STATUS"),
            CheckStatus::Unavailable
        );
    }

    #[test]
    fn invalid_canonical_and_heading_skip_are_reported() {
        let mut snapshot = healthy();
        snapshot.links_rel[0].href = "javascript:void(0)".to_string();
        snapshot.headings.push(HeadingSnapshot {
            level: 4,
            text: "Skipped".to_string(),
            location: "h4".to_string(),
        });
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert_eq!(
            status_of(&audit, "RULE_CANONICAL_INVALID"),
            CheckStatus::Error
        );
        assert_eq!(
            status_of(&audit, "RULE_HEADING_LEVEL_SKIP"),
            CheckStatus::Warning
        );
        assert_eq!(status_of(&audit, "RULE_MULTIPLE_H1"), CheckStatus::Pass);
    }

    #[test]
    fn multiple_h1_is_a_warning() {
        let mut snapshot = healthy();
        snapshot.headings.insert(
            0,
            HeadingSnapshot {
                level: 1,
                text: "Second topic".to_string(),
                location: "h1:nth-of-type(2)".to_string(),
            },
        );
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert_eq!(status_of(&audit, "RULE_MULTIPLE_H1"), CheckStatus::Warning);
    }

    #[test]
    fn cjk_pages_do_not_invent_word_counts() {
        let mut snapshot = healthy();
        snapshot.content.html_lang = Some("ja".to_string());
        snapshot.content.visible_text = "これはテストです".to_string();
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert!(audit.metrics.content.word_count.is_none());
        assert_eq!(
            status_of(&audit, "RULE_CONTENT_THIN"),
            CheckStatus::Unavailable
        );
        assert!(audit.metrics.content.readability_value.is_none());
    }

    #[test]
    fn english_terms_skip_stop_words() {
        let audit = analyze(&healthy(), &AnalyzeOptions::default()).unwrap();
        assert!(audit.metrics.content.word_count.unwrap() > 20);
        assert!(audit.metrics.content.readability_value.is_some());
        assert!(audit
            .metrics
            .content
            .terms
            .unigrams
            .iter()
            .all(|term| term.term != "the"));
    }

    #[test]
    fn broken_json_ld_is_an_error_without_rich_result_claim() {
        let mut snapshot = healthy();
        snapshot.structured_data.push(StructuredDataBlock {
            format: "json-ld".to_string(),
            raw: "{\"@type\":".to_string(),
        });
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert_eq!(status_of(&audit, "RULE_JSONLD_SYNTAX"), CheckStatus::Error);
        assert_eq!(
            status_of(&audit, "RULE_SCHEMA_RICH_RESULTS"),
            CheckStatus::Unavailable
        );
    }

    #[test]
    fn unsupported_schema_is_rejected() {
        let mut snapshot = healthy();
        snapshot.schema_version = 99;
        let error = analyze(&snapshot, &AnalyzeOptions::default()).unwrap_err();
        assert_eq!(error.code, "SCHEMA_UNSUPPORTED");
    }

    #[test]
    fn oversized_text_is_truncated_and_marked() {
        let mut snapshot = healthy();
        snapshot.content.visible_text = "word ".repeat(MAX_TEXT_CHARS);
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert!(audit
            .source
            .limitations
            .iter()
            .any(|item| item == "TEXT_TRUNCATED"));
        assert!(audit.metrics.content.character_count <= MAX_TEXT_CHARS as u32);
    }

    #[test]
    fn unavailable_status_is_excluded_from_the_score_denominator() {
        let audit = analyze(&healthy(), &AnalyzeOptions::default()).unwrap();
        let performance = audit
            .score
            .categories
            .iter()
            .find(|category| category.category == seo_core::Category::Performance)
            .unwrap();
        assert!(!performance.available);
        assert!(audit.score.excluded_checks > 0);
    }

    #[test]
    fn internal_and_external_links_are_classified() {
        let mut snapshot = healthy();
        snapshot.links.push(LinkSnapshot {
            href: "https://other.example/docs".to_string(),
            resolved_url: Some("https://other.example/docs".to_string()),
            accessible_name: "Docs".to_string(),
            rel: vec!["nofollow".to_string()],
            target: Some("_blank".to_string()),
            title: None,
            location: "a.external".to_string(),
        });
        snapshot.links.push(LinkSnapshot {
            href: "#section".to_string(),
            resolved_url: Some("https://example.com/#section".to_string()),
            accessible_name: "Section".to_string(),
            rel: Vec::new(),
            target: None,
            title: None,
            location: "a.anchor".to_string(),
        });
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert_eq!(audit.metrics.counts.external_links, 1);
        assert_eq!(audit.metrics.counts.internal_links, 1);
        assert!(audit.details.links.iter().any(|link| link.nofollow));
    }

    #[test]
    fn http_page_warns_and_does_not_claim_headers() {
        let mut snapshot = healthy();
        snapshot.url = "http://example.com/".to_string();
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert_eq!(
            status_of(&audit, "RULE_HTTPS_MISSING"),
            CheckStatus::Warning
        );
        assert_eq!(
            status_of(&audit, "RULE_HTTP_HEADERS"),
            CheckStatus::Unavailable
        );
        assert_eq!(
            status_of(&audit, "RULE_ROBOTS_TXT"),
            CheckStatus::Unavailable
        );
        assert_eq!(
            status_of(&audit, "RULE_BROKEN_LINKS"),
            CheckStatus::Unavailable
        );
        assert_eq!(
            status_of(&audit, "RULE_PAGESPEED"),
            CheckStatus::Unavailable
        );
    }

    #[test]
    fn snapshot_without_site_probe_still_parses() {
        let mut value = serde_json::to_value(PageSnapshot::default()).unwrap();
        value.as_object_mut().unwrap().remove("site");
        let snapshot: PageSnapshot = serde_json::from_value(value).unwrap();
        assert!(!snapshot.site.requested);
        let audit = analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        assert_eq!(
            status_of(&audit, "RULE_ROBOTS_TXT"),
            CheckStatus::Unavailable
        );
    }
}
