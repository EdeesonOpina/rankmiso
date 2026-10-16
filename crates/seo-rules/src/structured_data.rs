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
    vec![syntax(views), coverage(views)]
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

fn coverage(views: &[StructuredDataView]) -> CheckResult {
    if views.is_empty() || views.iter().all(|view| !view.valid_json) {
        return crate::support::check(
            "RULE_SCHEMA_RICH_RESULTS",
            Category::StructuredData,
            CheckStatus::Unavailable,
            1,
            "Rich-result fields were not compared",
            "JSON-LD was missing or did not parse, so the local field list was not applied. This is not an official rich-result test.",
        );
    }
    let mut missing = Vec::new();
    let mut recognized = 0_u32;
    for view in views.iter().filter(|view| view.valid_json) {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&view.raw) else {
            continue;
        };
        walk_objects(&value, &mut |object| {
            for kind in type_names(object) {
                let Some(fields) = required_fields(&kind) else {
                    continue;
                };
                recognized += 1;
                for field in fields {
                    if !has_field(object, field) {
                        missing.push(format!("{kind} is missing {field}"));
                    }
                }
            }
        });
    }
    if recognized == 0 {
        return crate::support::check(
            "RULE_SCHEMA_RICH_RESULTS",
            Category::StructuredData,
            CheckStatus::Info,
            1,
            "No listed rich-result type was found",
            "None of the JSON-LD types are in the local field list. This is not an official rich-result test.",
        );
    }
    if missing.is_empty() {
        crate::support::check(
            "RULE_SCHEMA_RICH_RESULTS",
            Category::StructuredData,
            CheckStatus::Info,
            1,
            "The local field list is complete",
            "The listed types include the fields this checklist looks for. This is not an official rich-result test.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_SCHEMA_RICH_RESULTS",
            Category::StructuredData,
            CheckStatus::Warning,
            1,
            "A listed type is missing a field",
            "Missing fields are listed below. This is a local checklist, not an official rich-result test.",
        );
        check.evidence = bounded_evidence(&missing, "missing");
        check
    }
}

fn required_fields(kind: &str) -> Option<&'static [&'static str]> {
    match kind.to_ascii_lowercase().as_str() {
        "article" | "newsarticle" | "blogposting" => {
            Some(&["headline", "image", "datepublished", "author"])
        }
        "product" => Some(&["name", "image"]),
        "organization" => Some(&["name", "url"]),
        "breadcrumblist" => Some(&["itemlistelement"]),
        "faqpage" => Some(&["mainentity"]),
        "website" => Some(&["name", "url"]),
        _ => None,
    }
}

fn walk_objects(
    value: &serde_json::Value,
    visit: &mut dyn FnMut(&serde_json::Map<String, serde_json::Value>),
) {
    match value {
        serde_json::Value::Object(map) => {
            visit(map);
            for child in map.values() {
                walk_objects(child, visit);
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                walk_objects(item, visit);
            }
        }
        _ => {}
    }
}

fn type_names(map: &serde_json::Map<String, serde_json::Value>) -> Vec<String> {
    let Some(kind) = map
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case("@type"))
        .map(|(_, value)| value)
    else {
        return Vec::new();
    };
    let mut names = Vec::new();
    push_type_names(kind, &mut names);
    names
}

fn push_type_names(value: &serde_json::Value, names: &mut Vec<String>) {
    match value {
        serde_json::Value::String(kind) => {
            if let Some(short) = kind.rsplit(['/', '#']).next() {
                if !short.is_empty() {
                    names.push(short.to_string());
                }
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                push_type_names(item, names);
            }
        }
        _ => {}
    }
}

fn has_field(object: &serde_json::Map<String, serde_json::Value>, field: &str) -> bool {
    object
        .iter()
        .any(|(key, value)| key.eq_ignore_ascii_case(field) && present(value))
}

fn present(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Null => false,
        serde_json::Value::String(text) => !text.trim().is_empty(),
        serde_json::Value::Array(items) => items.iter().any(present),
        serde_json::Value::Object(map) => !map.is_empty(),
        _ => true,
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
    fn a_missing_article_field_is_a_warning() {
        assert_eq!(
            rich_status(
                r#"{"@type":"Article","image":"https://example.com/a.jpg","datePublished":"2026-01-01","author":"Ada"}"#
            ),
            CheckStatus::Warning
        );
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
