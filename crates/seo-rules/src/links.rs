use seo_core::{
    Category, CheckResult, CheckStatus, LinkClass, LinkSnapshot, NormalizedLink, PageSnapshot,
};

use crate::support::{bounded_evidence, evidence, hostname, is_https};

pub fn classify(snapshot: &PageSnapshot) -> Vec<NormalizedLink> {
    let page_host = hostname(&snapshot.url);
    snapshot
        .links
        .iter()
        .map(|link| normalize(link, page_host.as_deref(), is_https(&snapshot.url)))
        .collect()
}

pub fn checks(snapshot: &PageSnapshot, links: &[NormalizedLink]) -> Vec<CheckResult> {
    vec![
        empty_anchor(links),
        mixed_content(snapshot, links),
        javascript_links(links),
    ]
}

fn normalize(link: &LinkSnapshot, page_host: Option<&str>, _page_https: bool) -> NormalizedLink {
    let rel: Vec<String> = link
        .rel
        .iter()
        .map(|value| value.to_ascii_lowercase())
        .collect();
    let href = link.href.trim();
    let classification = classify_href(href, link.resolved_url.as_deref(), page_host);
    NormalizedLink {
        href: link.href.clone(),
        resolved_url: link.resolved_url.clone(),
        accessible_name: link.accessible_name.clone(),
        classification,
        nofollow: rel.iter().any(|token| token == "nofollow"),
        sponsored: rel.iter().any(|token| token == "sponsored"),
        ugc: rel.iter().any(|token| token == "ugc"),
        rel,
        target: link.target.clone(),
        empty_anchor: link.accessible_name.trim().is_empty(),
        location: link.location.clone(),
    }
}

fn classify_href(href: &str, resolved: Option<&str>, page_host: Option<&str>) -> LinkClass {
    let lower = href.to_ascii_lowercase();
    if lower.starts_with("javascript:") {
        return LinkClass::Javascript;
    }
    if lower.starts_with("mailto:") {
        return LinkClass::Mailto;
    }
    if lower.starts_with("tel:") {
        return LinkClass::Tel;
    }
    if href.starts_with('#') {
        return LinkClass::Anchor;
    }
    let Some(resolved) = resolved else {
        return LinkClass::Other;
    };
    if let Ok(url) = url::Url::parse(resolved) {
        if url.scheme() != "http" && url.scheme() != "https" {
            return LinkClass::Other;
        }
        if url.fragment().is_some() && url.path() == "/" && href.starts_with('#') {
            return LinkClass::Anchor;
        }
        let host = url
            .host_str()
            .map(|host| host.trim_start_matches("www.").to_ascii_lowercase());
        if host.is_some() && host.as_deref() == page_host {
            LinkClass::Internal
        } else {
            LinkClass::External
        }
    } else {
        LinkClass::Other
    }
}

fn empty_anchor(links: &[NormalizedLink]) -> CheckResult {
    if links.is_empty() {
        return crate::support::check(
            "RULE_LINK_EMPTY_ANCHOR",
            Category::Links,
            CheckStatus::NotApplicable,
            1,
            "Anchor text was not evaluated",
            "No links were collected.",
        );
    }
    let empty: Vec<String> = links
        .iter()
        .filter(|link| link.empty_anchor)
        .map(|link| {
            link.resolved_url
                .clone()
                .unwrap_or_else(|| link.href.clone())
        })
        .collect();
    if empty.is_empty() {
        crate::support::check(
            "RULE_LINK_EMPTY_ANCHOR",
            Category::Links,
            CheckStatus::Pass,
            1,
            "Links have accessible names",
            "Every collected link has text, an image alternative, or another accessible name.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_LINK_EMPTY_ANCHOR",
            Category::Links,
            CheckStatus::Warning,
            1,
            "Links without accessible names",
            "Some links have no text, image alternative, or aria-label. People and crawlers then have little context for the destination.",
        );
        check.evidence = bounded_evidence(&empty, "link");
        check.recommendation =
            Some("Give each link a name that describes its destination.".to_string());
        check
    }
}

fn mixed_content(snapshot: &PageSnapshot, links: &[NormalizedLink]) -> CheckResult {
    if !is_https(&snapshot.url) {
        return crate::support::check(
            "RULE_LINK_MIXED_CONTENT",
            Category::Links,
            CheckStatus::NotApplicable,
            1,
            "Mixed content was not evaluated",
            "The page URL is not HTTPS, so HTTP links are not mixed content on this page.",
        );
    }
    let insecure: Vec<String> = links
        .iter()
        .filter_map(|link| link.resolved_url.as_deref())
        .filter(|url| url.starts_with("http://"))
        .map(str::to_string)
        .collect();
    if insecure.is_empty() {
        crate::support::check(
            "RULE_LINK_MIXED_CONTENT",
            Category::Links,
            CheckStatus::Pass,
            1,
            "No HTTP links on this HTTPS page",
            "Collected links that resolved to HTTP were not found. Resources other than links can still be insecure.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_LINK_MIXED_CONTENT",
            Category::Links,
            CheckStatus::Warning,
            1,
            "HTTPS page links to HTTP URLs",
            "These destinations use http://. Browsers may warn people, and the destinations are not encrypted.",
        );
        check.evidence = bounded_evidence(&insecure, "url");
        check.evidence.push(evidence(
            "scope",
            "Only links collected from the rendered page. Stylesheet and script requests are not included.",
        ));
        check
    }
}

fn javascript_links(links: &[NormalizedLink]) -> CheckResult {
    let count = links
        .iter()
        .filter(|link| link.classification == LinkClass::Javascript)
        .count();
    if count == 0 {
        crate::support::check(
            "RULE_LINK_JAVASCRIPT",
            Category::Links,
            CheckStatus::NotApplicable,
            1,
            "No JavaScript links",
            "No javascript: links were collected.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_LINK_JAVASCRIPT",
            Category::Links,
            CheckStatus::Info,
            1,
            "JavaScript links",
            "Some href values use the javascript: scheme. Crawlers may not treat them as destinations.",
        );
        check.evidence.push(evidence("count", count.to_string()));
        check
    }
}
