use seo_core::{
    Category, CheckResult, CheckStatus, Evidence, LinkRel, MetaTag, PageSnapshot, Reference,
};

pub const TITLE_PIXEL_BASIS: &str = "Estimated at 7.5px per ASCII character and 14px per other character. This is not a browser text measurement.";

pub fn check(
    id: &str,
    category: Category,
    status: CheckStatus,
    weight: u32,
    title: &str,
    description: impl Into<String>,
) -> CheckResult {
    CheckResult {
        id: id.to_string(),
        category,
        status,
        weight,
        applicable: status.is_applicable(),
        title_key: title_key(id),
        title: title.to_string(),
        description: description.into(),
        evidence: Vec::new(),
        recommendation: None,
        references: Vec::new(),
    }
}

pub fn title_key(id: &str) -> String {
    let raw = id.strip_prefix("RULE_").unwrap_or(id).to_ascii_lowercase();
    let mut out = String::new();
    let mut upper = false;
    for ch in raw.chars() {
        if ch == '_' {
            upper = true;
            continue;
        }
        if upper {
            out.extend(ch.to_uppercase());
            upper = false;
        } else {
            out.push(ch);
        }
    }
    format!("rules.{out}.title")
}

pub fn evidence(label: &str, value: impl Into<String>) -> Evidence {
    Evidence {
        label: label.to_string(),
        value: value.into(),
    }
}

pub fn reference(title: &str, url: &str) -> Reference {
    Reference {
        title: title.to_string(),
        url: url.to_string(),
    }
}

pub fn meta_by_name<'a>(tags: &'a [MetaTag], name: &str) -> Vec<&'a str> {
    tags.iter()
        .filter(|tag| {
            tag.name
                .as_deref()
                .is_some_and(|value| value.eq_ignore_ascii_case(name))
        })
        .filter_map(|tag| tag.content.as_deref())
        .collect()
}

pub fn meta_by_property<'a>(tags: &'a [MetaTag], property: &str) -> Vec<&'a str> {
    tags.iter()
        .filter(|tag| {
            tag.property
                .as_deref()
                .is_some_and(|value| value.eq_ignore_ascii_case(property))
                || tag
                    .name
                    .as_deref()
                    .is_some_and(|value| value.eq_ignore_ascii_case(property))
        })
        .filter_map(|tag| tag.content.as_deref())
        .collect()
}

pub fn first_meta(tags: &[MetaTag], name: &str) -> Option<String> {
    meta_by_name(tags, name)
        .into_iter()
        .find(|value| !value.trim().is_empty())
        .map(str::to_string)
}

pub fn first_property(tags: &[MetaTag], property: &str) -> Option<String> {
    meta_by_property(tags, property)
        .into_iter()
        .find(|value| !value.trim().is_empty())
        .map(str::to_string)
}

pub fn directives(values: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for value in values {
        for part in value.split(',') {
            let token = part
                .split(':')
                .next()
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase();
            if !token.is_empty() && !out.iter().any(|existing| existing == &token) {
                out.push(token);
            }
        }
    }
    out
}

pub fn has_noindex(directives: &[String]) -> bool {
    directives
        .iter()
        .any(|token| token == "noindex" || token == "none")
}

pub fn rel_links<'a>(links: &'a [LinkRel], rel: &str) -> Vec<&'a LinkRel> {
    links
        .iter()
        .filter(|link| {
            link.rel
                .split_whitespace()
                .any(|token| token.eq_ignore_ascii_case(rel))
        })
        .collect()
}

pub fn hostname(url: &str) -> Option<String> {
    url::Url::parse(url).ok().and_then(|parsed| {
        parsed
            .host_str()
            .map(|host| host.trim_start_matches("www.").to_ascii_lowercase())
    })
}

pub fn is_https(url: &str) -> bool {
    url::Url::parse(url)
        .ok()
        .is_some_and(|parsed| parsed.scheme() == "https")
}

pub fn resolve_http(value: &str, base: &str) -> Option<url::Url> {
    let base = url::Url::parse(base).ok();
    let parsed = match base {
        Some(base) => base.join(value).ok(),
        None => url::Url::parse(value).ok(),
    }?;
    if parsed.scheme() == "http" || parsed.scheme() == "https" {
        Some(parsed)
    } else {
        None
    }
}

pub fn estimate_pixels(text: &str) -> u32 {
    let px: f64 = text
        .chars()
        .map(|ch| if ch.is_ascii() { 7.5 } else { 14.0 })
        .sum();
    px.round() as u32
}

pub fn bounded_evidence(items: &[String], label: &str) -> Vec<Evidence> {
    let mut evidence_items = items
        .iter()
        .take(5)
        .map(|item| evidence(label, item.clone()))
        .collect::<Vec<_>>();
    if items.len() > 5 {
        evidence_items.push(evidence("additional", format!("{} more", items.len() - 5)));
    }
    evidence_items
}

pub fn displayed_title(snapshot: &PageSnapshot) -> Option<String> {
    snapshot
        .titles
        .rendered
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            snapshot
                .titles
                .elements
                .iter()
                .map(|value| value.trim())
                .find(|value| !value.is_empty())
                .map(str::to_string)
        })
}

pub fn normalize_ws(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_keys_stay_stable() {
        assert_eq!(
            title_key("RULE_META_TITLE_MISSING"),
            "rules.metaTitleMissing.title"
        );
    }
}
