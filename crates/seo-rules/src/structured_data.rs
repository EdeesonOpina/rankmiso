use seo_core::{Category, CheckResult, CheckStatus, StructuredDataBlock, StructuredDataView};

use crate::support::bounded_evidence;

pub fn interpret(blocks: &[StructuredDataBlock]) -> Vec<StructuredDataView> {
    blocks
        .iter()
        .map(|block| {
            let known = block.format.eq_ignore_ascii_case("json-ld")
                || block.format.eq_ignore_ascii_case("microdata")
                || block.format.eq_ignore_ascii_case("rdfa");
            if !known {
                return StructuredDataView {
                    format: block.format.clone(),
                    valid_json: false,
                    error: Some("This structured-data format is not read.".to_string()),
                    types: Vec::new(),
                    raw: block.raw.clone(),
                };
            }
            match serde_json::from_str::<serde_json::Value>(&block.raw) {
                Ok(value) => StructuredDataView {
                    format: block.format.to_ascii_lowercase(),
                    valid_json: true,
                    error: None,
                    types: collect_types(&value),
                    raw: block.raw.clone(),
                },
                Err(error) => StructuredDataView {
                    format: block.format.to_ascii_lowercase(),
                    valid_json: false,
                    error: Some(error.to_string()),
                    types: Vec::new(),
                    raw: block.raw.clone(),
                },
            }
        })
        .collect()
}

pub fn checks(views: &[StructuredDataView]) -> Vec<CheckResult> {
    let json_ld: Vec<StructuredDataView> = views
        .iter()
        .filter(|view| view.format == "json-ld")
        .cloned()
        .collect();
    let mut checks = vec![
        syntax(&json_ld),
        extracted(views, "microdata", "RULE_MICRODATA_EXTRACTED", "Microdata"),
        extracted(views, "rdfa", "RULE_RDFA_EXTRACTED", "RDFa"),
    ];
    let mut entity_checks = crate::sd_entities::checks(views);
    if views.is_empty() || views.iter().all(|view| !view.valid_json) {
        // Keep the earlier wording: without readable markup nothing was compared.
        entity_checks[0] = unread();
    }
    checks.splice(1..1, entity_checks);
    checks
}

fn unread() -> CheckResult {
    crate::support::check(
        "RULE_SCHEMA_RICH_RESULTS",
        Category::StructuredData,
        CheckStatus::Unavailable,
        1,
        "Required properties were not compared",
        "Structured data was missing or did not parse, so required properties were not checked. This is not an official rich-result test.",
    )
}

fn extracted(views: &[StructuredDataView], format: &str, id: &str, label: &str) -> CheckResult {
    let found: Vec<&StructuredDataView> =
        views.iter().filter(|view| view.format == format).collect();
    if found.is_empty() {
        return crate::support::check(
            id,
            Category::StructuredData,
            CheckStatus::NotApplicable,
            1,
            &format!("No {label} was extracted"),
            "Nothing in this format was collected from the rendered page. This is not a pass, and it is not rich-result eligibility.",
        );
    }
    if found.iter().any(|view| !view.valid_json) {
        return crate::support::check(
            id,
            Category::StructuredData,
            CheckStatus::Info,
            1,
            &format!("{label} could not be read"),
            "The extracted block was not usable JSON. This is a local extraction limit, not a search-engine eligibility result.",
        );
    }
    let mut check = crate::support::check(
        id,
        Category::StructuredData,
        CheckStatus::Info,
        1,
        &format!("{label} was extracted"),
        "Items were read from the rendered page with a bounded extractor. A successful read is not rich-result eligibility, and it does not validate the vocabulary.",
    );
    let types: Vec<String> = found.iter().flat_map(|view| view.types.clone()).collect();
    if !types.is_empty() {
        check.evidence = bounded_evidence(&types, "type");
    }
    check
}

fn syntax(views: &[StructuredDataView]) -> CheckResult {
    if views.is_empty() {
        return crate::support::check(
            "RULE_JSONLD_SYNTAX",
            Category::StructuredData,
            CheckStatus::Info,
            1,
            "No JSON-LD scripts were found",
            "No JSON-LD script was collected. Microdata and RDFa are reported separately when present. Absence of JSON-LD is not a ranking error, and extraction is not rich-result eligibility.",
        );
    }
    let invalid: Vec<String> = views
        .iter()
        .filter(|view| !view.valid_json)
        .map(|view| {
            view.error
                .clone()
                .unwrap_or_else(|| "Invalid JSON".to_string())
        })
        .collect();
    if invalid.is_empty() {
        let types: Vec<String> = views.iter().flat_map(|view| view.types.clone()).collect();
        let mut check = crate::support::check(
            "RULE_JSONLD_SYNTAX",
            Category::StructuredData,
            CheckStatus::Pass,
            1,
            "JSON-LD parses",
            "Every collected JSON-LD script is valid JSON. Valid JSON is not the same as eligibility for a search rich result.",
        );
        if !types.is_empty() {
            check.evidence = bounded_evidence(&types, "@type");
        }
        check.references.push(crate::support::reference(
            "Structured data introduction",
            "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
        ));
        check
    } else {
        let mut check = crate::support::check(
            "RULE_JSONLD_SYNTAX",
            Category::StructuredData,
            CheckStatus::Error,
            1,
            "JSON-LD syntax error",
            "At least one JSON-LD script could not be parsed. Crawlers ignore structured data they cannot parse.",
        );
        check.evidence = bounded_evidence(&invalid, "parser");
        check.recommendation = Some("Fix the JSON syntax. Then validate the type with an official rich-result tool if you are targeting a search feature.".to_string());
        check
    }
}

fn collect_types(value: &serde_json::Value) -> Vec<String> {
    let mut types = Vec::new();
    walk(value, &mut types);
    types.sort();
    types.dedup();
    types.truncate(20);
    types
}

fn walk(value: &serde_json::Value, types: &mut Vec<String>) {
    match value {
        serde_json::Value::Object(map) => {
            if let Some(kind) = map.get("@type") {
                push_type(kind, types);
            }
            for child in map.values() {
                walk(child, types);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                walk(item, types);
            }
        }
        _ => {}
    }
}

fn push_type(value: &serde_json::Value, types: &mut Vec<String>) {
    match value {
        serde_json::Value::String(kind) => types.push(kind.clone()),
        serde_json::Value::Array(items) => {
            for item in items {
                push_type(item, types);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod field_tests {
    use super::*;
    use seo_core::{CheckStatus, StructuredDataBlock};

    fn rich_status(raw: &str) -> CheckStatus {
        let views = interpret(&[StructuredDataBlock {
            format: "json-ld".to_string(),
            raw: raw.to_string(),
        }]);
        checks(&views)
            .into_iter()
            .find(|check| check.id == "RULE_SCHEMA_RICH_RESULTS")
            .unwrap()
            .status
    }

    #[test]
    fn a_missing_required_property_is_a_warning() {
        // Article has no Google-required properties; Product requires one of three.
        assert_eq!(
            rich_status(r#"{"@type":"Article","image":"https://example.com/a.jpg"}"#),
            CheckStatus::Info
        );
        assert_eq!(
            rich_status(r#"{"@type":"Product","name":"Miso"}"#),
            CheckStatus::Warning
        );
    }

    #[test]
    fn microdata_does_not_become_a_json_ld_error() {
        let views = interpret(&[StructuredDataBlock {
            format: "microdata".to_string(),
            raw: r#"{"items":[{"@type":"Article","properties":{"name":["Ada"]}}],"limitations":["An itemscope has no itemtype."]}"#.to_string(),
        }]);
        let results = checks(&views);
        let syntax = results
            .iter()
            .find(|check| check.id == "RULE_JSONLD_SYNTAX")
            .unwrap();
        let rich = results
            .iter()
            .find(|check| check.id == "RULE_SCHEMA_RICH_RESULTS")
            .unwrap();
        let micro = results
            .iter()
            .find(|check| check.id == "RULE_MICRODATA_EXTRACTED")
            .unwrap();
        assert_eq!(syntax.status, CheckStatus::Info);
        // Since v0.7.1 Microdata is checked too; Article has no Google-required properties.
        assert_eq!(rich.status, CheckStatus::Info);
        assert_eq!(micro.status, CheckStatus::Info);
        assert!(micro
            .evidence
            .iter()
            .any(|item| item.value.contains("Article")));
    }

    #[test]
    fn a_complete_article_stays_informational() {
        assert_eq!(
            rich_status(
                r#"{"@type":"https://schema.org/Article","headline":"Guide","image":"https://example.com/a.jpg","datePublished":"2026-01-01","author":{"name":"Ada"}}"#
            ),
            CheckStatus::Info
        );
    }
}
