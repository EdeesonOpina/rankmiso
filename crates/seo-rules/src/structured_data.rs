use seo_core::{Category, CheckResult, CheckStatus, StructuredDataBlock, StructuredDataView};

use crate::support::bounded_evidence;

pub fn interpret(blocks: &[StructuredDataBlock]) -> Vec<StructuredDataView> {
    blocks
        .iter()
        .map(|block| {
            if !block.format.eq_ignore_ascii_case("json-ld") {
                return StructuredDataView {
                    format: block.format.clone(),
                    valid_json: false,
                    error: Some("Only JSON-LD syntax is validated in this version.".to_string()),
                    types: Vec::new(),
                    raw: block.raw.clone(),
                };
            }
            match serde_json::from_str::<serde_json::Value>(&block.raw) {
                Ok(value) => StructuredDataView {
                    format: "json-ld".to_string(),
                    valid_json: true,
                    error: None,
                    types: collect_types(&value),
                    raw: block.raw.clone(),
                },
                Err(error) => StructuredDataView {
                    format: "json-ld".to_string(),
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
    vec![syntax(views), coverage()]
}

fn syntax(views: &[StructuredDataView]) -> CheckResult {
    if views.is_empty() {
        return crate::support::check(
            "RULE_JSONLD_SYNTAX",
            Category::StructuredData,
            CheckStatus::Info,
            1,
            "No JSON-LD scripts were found",
            "Microdata and RDFa are not extracted in this version. Absence of JSON-LD is not a statement that the page has no structured data, and it is not a ranking error.",
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

fn coverage() -> CheckResult {
    crate::support::check(
        "RULE_SCHEMA_RICH_RESULTS",
        Category::StructuredData,
        CheckStatus::Unavailable,
        1,
        "Rich-result eligibility was not tested",
        "This version checks JSON syntax and lists @type values. It does not apply search-engine rich-result rules, and a local pass would not guarantee eligibility.",
    )
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
