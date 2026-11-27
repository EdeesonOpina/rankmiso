//! Structured data intelligence: checks over the entities declared on a page, in JSON-LD,
//! Microdata, and (limited) RDFa. Only a documented subset is checked; this is not a Schema.org
//! validator and never claims rich-result eligibility.
//!
//! Required properties follow Google Search Central (read 2026-11-25): BreadcrumbList needs
//! `itemListElement` with ListItem `position`, `name`, and `item` (not for the last item);
//! Product needs `name` and one of `review`, `aggregateRating`, `offers`; LocalBusiness needs
//! `name` and `address`. Article and Organization have no required properties. FAQ rich results
//! are no longer shown in Google Search (Google changelog, 2026).

use std::collections::BTreeMap;

use seo_core::{Category, CheckResult, CheckStatus, StructuredDataView};
use serde_json::{Map, Value};

use crate::support::{self, bounded_evidence, reference};

const SD_DOC: &str =
    "https://developers.google.com/search/docs/appearance/structured-data/sd-policies";
const MAX_ENTITIES: usize = 300;

const ARTICLE: [&str; 3] = ["Article", "NewsArticle", "BlogPosting"];
const LOCAL_BUSINESS: [&str; 20] = [
    "LocalBusiness",
    "Restaurant",
    "CafeOrCoffeeShop",
    "Bakery",
    "BarOrPub",
    "FoodEstablishment",
    "Store",
    "AutoRepair",
    "AutomotiveBusiness",
    "Dentist",
    "MedicalClinic",
    "LegalService",
    "RealEstateAgent",
    "HomeAndConstructionBusiness",
    "LodgingBusiness",
    "Hotel",
    "ProfessionalService",
    "FinancialService",
    "HealthAndBeautyBusiness",
    "SportsActivityLocation",
];
const URL_PROPERTIES: [&str; 8] = [
    "url",
    "logo",
    "image",
    "sameAs",
    "item",
    "mainEntityOfPage",
    "contentUrl",
    "thumbnailUrl",
];
const DATE_PROPERTIES: [&str; 9] = [
    "datePublished",
    "dateModified",
    "dateCreated",
    "uploadDate",
    "priceValidUntil",
    "startDate",
    "endDate",
    "validFrom",
    "validThrough",
];
const NUMBER_PROPERTIES: [&str; 8] = [
    "price",
    "lowPrice",
    "highPrice",
    "ratingValue",
    "bestRating",
    "worstRating",
    "reviewCount",
    "ratingCount",
];
const IDENTITY_PROPERTIES: [&str; 5] = ["name", "url", "logo", "telephone", "email"];

/// One declared entity, whatever the syntax.
pub struct Entity {
    pub format: &'static str,
    pub types: Vec<String>,
    pub id: Option<String>,
    pub props: Map<String, Value>,
}

impl Entity {
    fn is(&self, wanted: &[&str]) -> bool {
        self.types
            .iter()
            .any(|kind| wanted.iter().any(|w| w.eq_ignore_ascii_case(kind)))
    }

    fn label(&self) -> String {
        let kind = self
            .types
            .first()
            .cloned()
            .unwrap_or_else(|| "Thing".into());
        match text(self.props.get("name")) {
            Some(name) => format!("{kind} \"{name}\" ({})", self.format),
            None => format!("{kind} ({})", self.format),
        }
    }
}

fn short(kind: &str) -> String {
    kind.rsplit(['/', '#']).next().unwrap_or(kind).to_string()
}

fn types_of(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::String(kind)) => vec![short(kind)],
        Some(Value::Array(items)) => items.iter().filter_map(Value::as_str).map(short).collect(),
        _ => Vec::new(),
    }
}

fn text(value: Option<&Value>) -> Option<String> {
    let value = match value? {
        Value::Array(items) => items.first()?,
        other => other,
    };
    match value {
        Value::String(text) => Some(support::normalize_ws(text)).filter(|t| !t.is_empty()),
        Value::Number(number) => Some(number.to_string()),
        Value::Object(map) => text(map.get("name")).or_else(|| text(map.get("@id"))),
        _ => None,
    }
}

/// All entities on the page. JSON-LD objects with `@type` at any depth; Microdata and RDFa
/// items (`{"@type", "@id", "properties"}`) with their nested items. Bounded.
pub fn entities(views: &[StructuredDataView]) -> Vec<Entity> {
    let mut out = Vec::new();
    for view in views.iter().filter(|view| view.valid_json) {
        let Ok(value) = serde_json::from_str::<Value>(&view.raw) else {
            continue;
        };
        match view.format.as_str() {
            "json-ld" => collect_json_ld(&value, &mut out, 0),
            "microdata" => collect_items(&value, "microdata", &mut out, 0),
            "rdfa" => collect_items(&value, "rdfa", &mut out, 0),
            _ => {}
        }
    }
    out
}

fn collect_json_ld(value: &Value, out: &mut Vec<Entity>, depth: u8) {
    if depth > 8 || out.len() >= MAX_ENTITIES {
        return;
    }
    match value {
        Value::Array(items) => items
            .iter()
            .for_each(|item| collect_json_ld(item, out, depth + 1)),
        Value::Object(map) => {
            let types = types_of(map.get("@type"));
            if !types.is_empty() {
                out.push(Entity {
                    format: "json-ld",
                    types,
                    id: map.get("@id").and_then(Value::as_str).map(str::to_string),
                    props: map.clone(),
                });
            }
            for (key, item) in map {
                if key != "@context" {
                    collect_json_ld(item, out, depth + 1);
                }
            }
        }
        _ => {}
    }
}

/// Microdata/RDFa items keep property values in arrays; single values are unwrapped so the
/// checks read them like JSON-LD.
fn collect_items(value: &Value, format: &'static str, out: &mut Vec<Entity>, depth: u8) {
    if depth > 8 || out.len() >= MAX_ENTITIES {
        return;
    }
    match value {
        Value::Array(items) => items
            .iter()
            .for_each(|item| collect_items(item, format, out, depth + 1)),
        Value::Object(map) => {
            if let Some(items) = map.get("items") {
                collect_items(items, format, out, depth + 1);
            }
            let Some(Value::Object(properties)) = map.get("properties") else {
                return;
            };
            let mut props = Map::new();
            for (key, values) in properties {
                let value = match values {
                    Value::Array(list) if list.len() == 1 => list[0].clone(),
                    other => other.clone(),
                };
                props.insert(key.clone(), value);
                collect_items(values, format, out, depth + 1);
            }
            let types = types_of(map.get("@type"));
            if !types.is_empty() {
                out.push(Entity {
                    format,
                    types,
                    id: map
                        .get("@id")
                        .and_then(Value::as_str)
                        .filter(|id| !id.is_empty())
                        .map(str::to_string),
                    props,
                });
            }
        }
        _ => {}
    }
}

fn check(id: &str, status: CheckStatus, title: &str, description: &str) -> CheckResult {
    let mut check = support::check(id, Category::StructuredData, status, 1, title, description);
    check
        .references
        .push(reference("Google: structured data guidelines", SD_DOC));
    check
}

fn listing(
    id: &str,
    title: &str,
    problems: Vec<String>,
    checked: usize,
    found: (CheckStatus, &str, &str),
    clear: &str,
) -> CheckResult {
    if checked == 0 {
        return check(
            id,
            CheckStatus::NotApplicable,
            title,
            "No structured data entity on this page has these properties.",
        );
    }
    if problems.is_empty() {
        return check(id, CheckStatus::Pass, title, clear);
    }
    let mut finding = check(id, found.0, title, found.1);
    finding.recommendation = Some(found.2.to_string());
    finding.evidence = bounded_evidence(&problems, "case");
    finding
}

fn present(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::String(text)) => !text.trim().is_empty(),
        Some(Value::Array(items)) => items.iter().any(|item| present(Some(item))),
        Some(_) => true,
    }
}

fn values(value: &Value) -> Vec<&Value> {
    match value {
        Value::Array(items) => items.iter().collect(),
        other => vec![other],
    }
}

/// The documented required properties, per entity.
pub fn required(entities: &[Entity]) -> CheckResult {
    let mut missing = Vec::new();
    let mut notes = Vec::new();
    let mut checked = 0_usize;
    for entity in entities {
        if entity.is(&["BreadcrumbList"]) {
            checked += 1;
            let items = entity
                .props
                .get("itemListElement")
                .map(values)
                .unwrap_or_default();
            if items.is_empty() {
                missing.push(format!("{} is missing itemListElement", entity.label()));
            }
            let last = items.len().saturating_sub(1);
            for (index, item) in items.iter().enumerate() {
                let Value::Object(list_item) = item else {
                    continue;
                };
                let props = list_item
                    .get("properties")
                    .and_then(Value::as_object)
                    .unwrap_or(list_item);
                let position = (index + 1).to_string();
                if !present(props.get("position")) {
                    missing.push(format!("ListItem {position} is missing position"));
                }
                let named = present(props.get("name"))
                    || props
                        .get("item")
                        .and_then(|item| text(Some(item)))
                        .is_some();
                if !named {
                    missing.push(format!("ListItem {position} is missing name"));
                }
                if index != last && !present(props.get("item")) {
                    missing.push(format!("ListItem {position} is missing item"));
                }
            }
        } else if entity.is(&["Product"]) {
            checked += 1;
            if !present(entity.props.get("name")) {
                missing.push(format!("{} is missing name", entity.label()));
            }
            if !["review", "aggregateRating", "offers"]
                .iter()
                .any(|key| present(entity.props.get(*key)))
            {
                missing.push(format!(
                    "{} needs one of review, aggregateRating, or offers",
                    entity.label()
                ));
            }
        } else if entity.is(&LOCAL_BUSINESS) {
            checked += 1;
            for key in ["name", "address"] {
                if !present(entity.props.get(key)) {
                    missing.push(format!("{} is missing {key}", entity.label()));
                }
            }
        } else if entity.is(&ARTICLE) || entity.is(&["Organization"]) {
            checked += 1;
            notes.push(format!(
                "{}: Google lists no required properties for this type",
                entity.label()
            ));
        } else if entity.is(&["FAQPage"]) {
            checked += 1;
            notes.push(format!(
                "{}: Google no longer shows FAQ rich results in Search (2026)",
                entity.label()
            ));
        }
    }
    let mut finding = if checked == 0 {
        check(
            "RULE_SCHEMA_RICH_RESULTS",
            CheckStatus::Info,
            "No type with Google-listed required properties",
            "RankMiso checks required properties for BreadcrumbList, Product, and LocalBusiness only. Other types are shown but not checked.",
        )
    } else if missing.is_empty() {
        // Info, not Pass: a complete checklist must not read as rich-result approval.
        check(
            "RULE_SCHEMA_RICH_RESULTS",
            CheckStatus::Info,
            "Google-listed required properties are present",
            "Checked types have the properties Google lists as required. That does not mean a rich result will be shown.",
        )
    } else {
        let mut finding = check(
            "RULE_SCHEMA_RICH_RESULTS",
            CheckStatus::Warning,
            "A Google-listed required property is missing",
            "Some entities lack a property Google lists as required for that type. Google does not guarantee rich results even when everything is present.",
        );
        finding.recommendation = Some("Add the listed properties to the markup.".into());
        finding
    };
    finding.evidence = bounded_evidence(&missing, "missing");
    finding.evidence.extend(bounded_evidence(&notes, "note"));
    finding
}

fn is_date(value: &str) -> bool {
    let bytes = value.trim().as_bytes();
    let digits = |range: std::ops::Range<usize>| {
        range
            .clone()
            .all(|i| bytes.get(i).is_some_and(u8::is_ascii_digit))
    };
    bytes.len() >= 10
        && digits(0..4)
        && bytes[4] == b'-'
        && digits(5..7)
        && bytes[7] == b'-'
        && digits(8..10)
        && (bytes.len() == 10 || bytes[10] == b'T' || bytes[10] == b' ')
}

fn is_number(value: &Value) -> bool {
    match value {
        Value::Number(_) => true,
        Value::String(text) => {
            let text = text.trim();
            !text.is_empty() && text.parse::<f64>().is_ok()
        }
        _ => false,
    }
}

pub fn value_types(entities: &[Entity]) -> CheckResult {
    let mut problems = Vec::new();
    let mut checked = 0_usize;
    for entity in entities {
        for key in DATE_PROPERTIES {
            for value in entity.props.get(key).map(values).unwrap_or_default() {
                checked += 1;
                if !value.as_str().is_some_and(is_date) {
                    problems.push(format!(
                        "{} {key} is not an ISO 8601 date: {value}",
                        entity.label()
                    ));
                }
            }
        }
        for key in NUMBER_PROPERTIES {
            for value in entity.props.get(key).map(values).unwrap_or_default() {
                checked += 1;
                if !is_number(value) {
                    problems.push(format!("{} {key} is not a number: {value}", entity.label()));
                }
            }
        }
        if entity.is(&["ListItem"]) {
            if let Some(position) = entity.props.get("position") {
                checked += 1;
                let whole = match position {
                    Value::Number(number) => number.as_u64().is_some(),
                    Value::String(text) => text.trim().parse::<u64>().is_ok(),
                    _ => false,
                };
                if !whole {
                    problems.push(format!(
                        "ListItem position is not a whole number: {position}"
                    ));
                }
            }
        }
    }
    listing(
        "RULE_SD_VALUE_TYPES",
        "Structured data value types",
        problems,
        checked,
        (
            CheckStatus::Warning,
            "Some date or number properties are in a form search engines may not read.",
            "Use ISO 8601 dates (2026-11-25 or 2026-11-25T09:00:00Z) and plain numbers without currency symbols or thousands separators.",
        ),
        "Dates use ISO 8601 and numeric properties are numbers.",
    )
}

pub fn url_values(entities: &[Entity]) -> CheckResult {
    let mut problems = Vec::new();
    let mut checked = 0_usize;
    for entity in entities {
        for key in URL_PROPERTIES {
            for value in entity.props.get(key).map(values).unwrap_or_default() {
                let Some(raw) = value.as_str() else {
                    continue;
                };
                checked += 1;
                let raw = raw.trim();
                let lower = raw.to_ascii_lowercase();
                let scheme = lower.split_once(':').map(|(scheme, _)| scheme);
                let bad = raw.is_empty()
                    || raw.contains(char::is_whitespace)
                    || lower.starts_with("www.")
                    || matches!(scheme, Some(s) if s != "http" && s != "https" && !s.contains('/'));
                if bad {
                    problems.push(format!("{} {key}: {raw}", entity.label()));
                }
            }
        }
    }
    listing(
        "RULE_SD_URL_VALUES",
        "Structured data URLs",
        problems,
        checked,
        (
            CheckStatus::Warning,
            "Some URL properties are empty, contain spaces, lack a scheme, or use a non-web scheme.",
            "Use absolute https:// URLs (or relative paths) for url, image, logo, sameAs, and item.",
        ),
        "URL properties are usable web addresses.",
    )
}

pub fn conflicts(entities: &[Entity]) -> CheckResult {
    let mut by_id: BTreeMap<&str, Vec<&Entity>> = BTreeMap::new();
    for entity in entities {
        if let Some(id) = entity.id.as_deref() {
            by_id.entry(id).or_default().push(entity);
        }
    }
    let mut problems = Vec::new();
    for (id, group) in by_id.iter().filter(|(_, group)| group.len() > 1) {
        for key in IDENTITY_PROPERTIES {
            let found: std::collections::BTreeSet<String> = group
                .iter()
                .filter_map(|entity| text(entity.props.get(key)))
                .collect();
            if found.len() > 1 {
                problems.push(format!(
                    "{id} {key}: {}",
                    found.into_iter().collect::<Vec<_>>().join(" | ")
                ));
            }
        }
    }
    let mut duplicates: BTreeMap<String, usize> = BTreeMap::new();
    for entity in entities.iter().filter(|entity| entity.id.is_none()) {
        let (Some(name), Some(kind)) = (text(entity.props.get("name")), entity.types.first())
        else {
            continue;
        };
        if entity.is(&["ListItem", "Person", "Thing"]) {
            continue;
        }
        let url = text(entity.props.get("url")).unwrap_or_default();
        *duplicates
            .entry(format!("{kind} \"{name}\" {url}"))
            .or_default() += 1;
    }
    for (label, count) in duplicates.into_iter().filter(|(_, count)| *count > 1) {
        problems.push(format!(
            "{} declared {count} times without @id",
            label.trim()
        ));
    }
    listing(
        "RULE_SD_CONFLICTS",
        "Duplicate and conflicting entities",
        problems,
        entities.len(),
        (
            CheckStatus::Warning,
            "The same entity is declared more than once, or one @id carries different names or URLs.",
            "Declare each entity once, or give repeated declarations the same @id and the same values.",
        ),
        "No entity is declared twice with different values.",
    )
}

/// Same-page `@id` references (`#org`, `https://this-page/#org`) that no entity defines.
pub fn references(views: &[StructuredDataView], entities: &[Entity]) -> CheckResult {
    let defined: std::collections::BTreeSet<&str> = entities
        .iter()
        .filter_map(|entity| entity.id.as_deref())
        .collect();
    let mut refs = Vec::new();
    for view in views
        .iter()
        .filter(|view| view.valid_json && view.format == "json-ld")
    {
        if let Ok(value) = serde_json::from_str::<Value>(&view.raw) {
            node_refs(&value, &mut refs, 0);
        }
    }
    let unresolved = refs
        .iter()
        .filter(|id| id.contains('#') && !defined.contains(id.as_str()))
        .cloned()
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let checked = refs.iter().filter(|id| id.contains('#')).count();
    listing(
        "RULE_SD_REFERENCES",
        "Entity references",
        unresolved,
        checked,
        (
            CheckStatus::Info,
            "Some @id references point to an identifier on this page that no entity declares.",
            "Declare the referenced entity with that @id, or reference one that exists.",
        ),
        "Every same-page @id reference resolves to a declared entity.",
    )
}

fn node_refs(value: &Value, out: &mut Vec<String>, depth: u8) {
    if depth > 8 || out.len() > 200 {
        return;
    }
    match value {
        Value::Array(items) => items
            .iter()
            .for_each(|item| node_refs(item, out, depth + 1)),
        Value::Object(map) => {
            if map.len() == 1 {
                if let Some(Value::String(id)) = map.get("@id") {
                    out.push(id.clone());
                    return;
                }
            }
            for (key, item) in map {
                if key != "@context" {
                    node_refs(item, out, depth + 1);
                }
            }
        }
        _ => {}
    }
}

/// Author and publisher on articles: a name or a resolvable reference.
pub fn attribution(entities: &[Entity]) -> CheckResult {
    let defined: BTreeMap<&str, &Entity> = entities
        .iter()
        .filter_map(|entity| entity.id.as_deref().map(|id| (id, entity)))
        .collect();
    let mut problems = Vec::new();
    let mut checked = 0_usize;
    for entity in entities.iter().filter(|entity| entity.is(&ARTICLE)) {
        for key in ["author", "publisher"] {
            for value in entity.props.get(key).map(values).unwrap_or_default() {
                checked += 1;
                let named = match value {
                    Value::String(name) => !name.trim().is_empty(),
                    Value::Object(map) => {
                        present(map.get("name"))
                            || map
                                .get("@id")
                                .and_then(Value::as_str)
                                .and_then(|id| defined.get(id))
                                .is_some_and(|target| present(target.props.get("name")))
                    }
                    _ => false,
                };
                if !named {
                    problems.push(format!("{} {key} has no name", entity.label()));
                }
            }
        }
    }
    listing(
        "RULE_SD_ATTRIBUTION",
        "Article author and publisher",
        problems,
        checked,
        (
            CheckStatus::Info,
            "An article names an author or publisher without a name. Google recommends author.name for articles.",
            "Give each author and publisher a name, or reference an entity that has one.",
        ),
        "Article authors and publishers have names.",
    )
}

pub fn checks(views: &[StructuredDataView]) -> Vec<CheckResult> {
    let entities = entities(views);
    vec![
        required(&entities),
        value_types(&entities),
        url_values(&entities),
        conflicts(&entities),
        references(views, &entities),
        attribution(&entities),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use seo_core::StructuredDataBlock;

    fn run(blocks: &[(&str, &str)]) -> Vec<CheckResult> {
        let blocks = blocks
            .iter()
            .map(|(format, raw)| StructuredDataBlock {
                format: format.to_string(),
                raw: raw.to_string(),
            })
            .collect::<Vec<_>>();
        checks(&crate::structured_data::interpret(&blocks))
    }

    fn status(checks: &[CheckResult], id: &str) -> CheckStatus {
        checks.iter().find(|c| c.id == id).unwrap().status
    }

    #[test]
    fn article_has_no_required_properties_per_google() {
        let checks = run(&[("json-ld", r#"{"@type":"Article","headline":"H"}"#)]);
        assert_eq!(
            status(&checks, "RULE_SCHEMA_RICH_RESULTS"),
            CheckStatus::Info
        );
        assert!(checks[0]
            .evidence
            .iter()
            .any(|e| e.value.contains("no required properties")));
    }

    #[test]
    fn breadcrumb_requirements() {
        let ok = r#"{"@type":"BreadcrumbList","itemListElement":[
            {"@type":"ListItem","position":1,"name":"Home","item":"https://example.com/"},
            {"@type":"ListItem","position":2,"name":"Guide"}]}"#;
        assert_eq!(
            status(&run(&[("json-ld", ok)]), "RULE_SCHEMA_RICH_RESULTS"),
            CheckStatus::Info
        );
        let bad = r#"{"@type":"BreadcrumbList","itemListElement":[
            {"@type":"ListItem","name":"Home"},{"@type":"ListItem","position":"2.5","name":"Guide"}]}"#;
        let checks = run(&[("json-ld", bad)]);
        assert_eq!(
            status(&checks, "RULE_SCHEMA_RICH_RESULTS"),
            CheckStatus::Warning
        );
        let missing = &checks[0].evidence;
        assert!(missing
            .iter()
            .any(|e| e.value == "ListItem 1 is missing position"));
        assert!(missing
            .iter()
            .any(|e| e.value == "ListItem 1 is missing item"));
        assert_eq!(status(&checks, "RULE_SD_VALUE_TYPES"), CheckStatus::Warning);
    }

    #[test]
    fn product_needs_name_and_one_of_three() {
        let checks = run(&[(
            "json-ld",
            r#"{"@type":"Product","name":"Miso","image":"x.jpg"}"#,
        )]);
        assert_eq!(
            status(&checks, "RULE_SCHEMA_RICH_RESULTS"),
            CheckStatus::Warning
        );
        let ok = run(&[(
            "json-ld",
            r#"{"@type":"Product","name":"Miso","offers":{"@type":"Offer","price":"12.50","priceCurrency":"EUR"}}"#,
        )]);
        assert_eq!(status(&ok, "RULE_SCHEMA_RICH_RESULTS"), CheckStatus::Info);
        assert_eq!(status(&ok, "RULE_SD_VALUE_TYPES"), CheckStatus::Pass);
    }

    #[test]
    fn local_business_from_microdata() {
        let raw = r#"{"items":[{"@type":"https://schema.org/Restaurant","@id":"","properties":{"name":["Miso Bar"]}}]}"#;
        let checks = run(&[("microdata", raw)]);
        assert_eq!(
            status(&checks, "RULE_SCHEMA_RICH_RESULTS"),
            CheckStatus::Warning
        );
        assert!(checks[0].evidence[0].value.contains("missing address"));
        assert!(checks[0].evidence[0].value.contains("(microdata)"));
    }

    #[test]
    fn faq_is_noted_as_retired_and_unsupported_types_are_not_checked() {
        let checks = run(&[("json-ld", r#"{"@type":"FAQPage","mainEntity":[]}"#)]);
        assert!(checks[0]
            .evidence
            .iter()
            .any(|e| e.value.contains("no longer shows FAQ")));
        let other = run(&[("json-ld", r#"{"@type":"Recipe","name":"Soup"}"#)]);
        assert_eq!(
            status(&other, "RULE_SCHEMA_RICH_RESULTS"),
            CheckStatus::Info
        );
    }

    #[test]
    fn dates_numbers_and_urls() {
        let raw = r#"{"@type":"Article","datePublished":"25/11/2026","dateModified":"2026-11-25T09:00:00Z",
            "image":"www.example.com/a.jpg","url":"/guide","sameAs":["javascript:alert(1)","https://x.org/a"],
            "aggregateRating":{"@type":"AggregateRating","ratingValue":"4,5"}}"#;
        let checks = run(&[("json-ld", raw)]);
        let types = checks
            .iter()
            .find(|c| c.id == "RULE_SD_VALUE_TYPES")
            .unwrap();
        assert_eq!(types.status, CheckStatus::Warning);
        assert_eq!(types.evidence.len(), 2, "{:?}", types.evidence);
        let urls = checks
            .iter()
            .find(|c| c.id == "RULE_SD_URL_VALUES")
            .unwrap();
        assert_eq!(urls.status, CheckStatus::Warning);
        assert_eq!(urls.evidence.len(), 2, "{:?}", urls.evidence);
    }

    #[test]
    fn duplicates_conflicts_and_references() {
        let a = r##"{"@type":"Organization","@id":"#org","name":"Miso Lab","url":"https://miso.example"}"##;
        let b = r##"{"@type":"Organization","@id":"#org","name":"Miso Labs Ltd"}"##;
        let c = r##"{"@type":"Article","headline":"H","publisher":{"@id":"#publisher"},"author":{"@id":"#org"}}"##;
        let d = r#"{"@type":"WebSite","name":"Miso","url":"https://miso.example"}"#;
        let checks = run(&[
            ("json-ld", a),
            ("json-ld", b),
            ("json-ld", c),
            ("json-ld", d),
            ("json-ld", d),
        ]);
        let conflicts = checks.iter().find(|c| c.id == "RULE_SD_CONFLICTS").unwrap();
        assert_eq!(conflicts.status, CheckStatus::Warning);
        assert!(conflicts
            .evidence
            .iter()
            .any(|e| e.value.contains("#org name")));
        assert!(conflicts
            .evidence
            .iter()
            .any(|e| e.value.contains("declared 2 times")));
        let refs = checks
            .iter()
            .find(|c| c.id == "RULE_SD_REFERENCES")
            .unwrap();
        assert_eq!(refs.status, CheckStatus::Info);
        assert_eq!(refs.evidence[0].value, "#publisher");
        let attribution = checks
            .iter()
            .find(|c| c.id == "RULE_SD_ATTRIBUTION")
            .unwrap();
        // The author resolves to #org (named); the publisher reference does not resolve.
        assert_eq!(attribution.status, CheckStatus::Info);
        assert_eq!(attribution.evidence.len(), 1);
    }

    #[test]
    fn clean_and_empty_pages() {
        let none = run(&[]);
        assert_eq!(
            status(&none, "RULE_SD_VALUE_TYPES"),
            CheckStatus::NotApplicable
        );
        assert_eq!(
            status(&none, "RULE_SD_CONFLICTS"),
            CheckStatus::NotApplicable
        );
        let clean = run(&[(
            "json-ld",
            r#"{"@context":"https://schema.org","@type":"Article","headline":"H","datePublished":"2026-03-01","author":{"@type":"Person","name":"Aiko"}}"#,
        )]);
        for id in [
            "RULE_SD_VALUE_TYPES",
            "RULE_SD_ATTRIBUTION",
            "RULE_SD_CONFLICTS",
        ] {
            assert_eq!(status(&clean, id), CheckStatus::Pass, "{id}");
        }
    }
}
