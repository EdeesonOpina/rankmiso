use seo_core::{Category, CheckResult, CheckStatus, HreflangLink, MetadataView, PageSnapshot};

use crate::support::{bounded_evidence, rel_links};

pub fn interpret(snapshot: &PageSnapshot) -> Vec<HreflangLink> {
    rel_links(&snapshot.links_rel, "alternate")
        .into_iter()
        .filter_map(|link| {
            let lang = link.hreflang.as_deref()?.trim();
            if lang.is_empty() {
                return None;
            }
            Some(HreflangLink {
                valid_syntax: valid_lang(lang),
                lang: lang.to_string(),
                href: link.href.clone(),
            })
        })
        .collect()
}

pub fn checks(
    snapshot: &PageSnapshot,
    metadata: &MetadataView,
    hreflang: &[HreflangLink],
) -> Vec<CheckResult> {
    vec![
        language(metadata),
        hreflang_syntax(hreflang),
        hreflang_duplicates(hreflang),
        reciprocal(snapshot, hreflang),
        self_reference(snapshot, hreflang),
    ]
}

fn language(metadata: &MetadataView) -> CheckResult {
    match &metadata.language {
        Some(lang) if valid_lang(lang) => {
            let mut check = crate::support::check(
                "RULE_LANG_MISSING",
                Category::International,
                CheckStatus::Pass,
                2,
                "Document language is declared",
                "The html lang attribute uses a recognizable language tag. This also helps assistive technology.",
            );
            check
                .evidence
                .push(crate::support::evidence("lang", lang.clone()));
            check
        }
        Some(lang) => {
            let mut check = crate::support::check(
                "RULE_LANG_MISSING",
                Category::International,
                CheckStatus::Warning,
                2,
                "Document language tag looks invalid",
                "The html lang value does not match a basic BCP 47 pattern. This check does not consult the full IANA registry.",
            );
            check
                .evidence
                .push(crate::support::evidence("lang", lang.clone()));
            check.recommendation = Some("Use a language tag such as en or en-US.".to_string());
            check
        }
        None => {
            let mut check = crate::support::check(
                "RULE_LANG_MISSING",
                Category::International,
                CheckStatus::Warning,
                2,
                "Document language is missing",
                "The html element has no lang attribute. Screen readers and language detection then have to guess.",
            );
            check.recommendation =
                Some("Set the html lang attribute to the language of the page.".to_string());
            check
        }
    }
}

fn hreflang_syntax(links: &[HreflangLink]) -> CheckResult {
    if links.is_empty() {
        return crate::support::check(
            "RULE_HREFLANG_INVALID",
            Category::International,
            CheckStatus::NotApplicable,
            1,
            "Hreflang syntax was not evaluated",
            "No alternate links with hreflang were collected. This does not prove the page lacks translations.",
        );
    }
    let invalid: Vec<String> = links
        .iter()
        .filter(|link| !link.valid_syntax)
        .map(|link| format!("{} {}", link.lang, link.href))
        .collect();
    if invalid.is_empty() {
        crate::support::check(
            "RULE_HREFLANG_INVALID",
            Category::International,
            CheckStatus::Pass,
            1,
            "Hreflang values use a recognizable tag",
            "Each collected hreflang is x-default or matches a basic language-region pattern. This is not a registry lookup.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_HREFLANG_INVALID",
            Category::International,
            CheckStatus::Error,
            1,
            "Invalid hreflang values",
            "Some hreflang values are empty of a valid language shape. Search engines may ignore those alternates.",
        );
        check.evidence = bounded_evidence(&invalid, "hreflang");
        check.recommendation =
            Some("Use ISO language codes, optional region subtags, or x-default.".to_string());
        check.references.push(crate::support::reference(
            "Localized versions",
            "https://developers.google.com/search/docs/specialty/international/localized-versions",
        ));
        check
    }
}

fn hreflang_duplicates(links: &[HreflangLink]) -> CheckResult {
    use std::collections::BTreeMap;
    if links.is_empty() {
        return crate::support::check(
            "RULE_HREFLANG_DUPLICATE",
            Category::International,
            CheckStatus::NotApplicable,
            1,
            "Duplicate hreflang was not evaluated",
            "No hreflang links were collected.",
        );
    }
    let mut counts: BTreeMap<String, u32> = BTreeMap::new();
    for link in links {
        *counts.entry(link.lang.to_ascii_lowercase()).or_insert(0) += 1;
    }
    let dupes: Vec<String> = counts
        .into_iter()
        .filter_map(|(lang, count)| (count > 1).then_some(format!("{lang} ({count})")))
        .collect();
    if dupes.is_empty() {
        crate::support::check(
            "RULE_HREFLANG_DUPLICATE",
            Category::International,
            CheckStatus::Pass,
            1,
            "Hreflang languages are unique",
            "Each language tag appears once on this page.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_HREFLANG_DUPLICATE",
            Category::International,
            CheckStatus::Warning,
            1,
            "Duplicate hreflang languages",
            "The same language tag points at more than one URL on this page.",
        );
        check.evidence = bounded_evidence(&dupes, "language");
        check
    }
}

fn reciprocal(snapshot: &PageSnapshot, links: &[HreflangLink]) -> CheckResult {
    if links.is_empty() {
        return crate::support::check(
            "RULE_HREFLANG_RECIPROCAL",
            Category::International,
            CheckStatus::NotApplicable,
            1,
            "Reciprocal hreflang was not evaluated",
            "No hreflang links were collected.",
        );
    }
    if !snapshot.site.requested {
        return crate::support::check(
            "RULE_HREFLANG_RECIPROCAL",
            Category::International,
            CheckStatus::Unavailable,
            1,
            "Reciprocal hreflang was not checked",
            "Confirming that alternate pages point back runs with the optional site check. Until then this is not a pass.",
        );
    }
    if snapshot.site.hreflang_checked == 0 {
        return crate::support::check(
            "RULE_HREFLANG_RECIPROCAL",
            Category::International,
            CheckStatus::Unavailable,
            1,
            "Alternate pages were not fetched",
            "Hreflang links were collected, but the optional fetch did not return a page to compare. This is not a pass.",
        );
    }
    if snapshot.site.hreflang_missing > 0 {
        let mut check = crate::support::check(
            "RULE_HREFLANG_RECIPROCAL",
            Category::International,
            CheckStatus::Warning,
            1,
            "An alternate does not point back",
            format!(
                "{} of {} fetched alternates did not link back to this URL. At most eight alternates are requested.",
                snapshot.site.hreflang_missing, snapshot.site.hreflang_checked
            ),
        );
        check.evidence.push(crate::support::evidence(
            "missing return links",
            snapshot.site.hreflang_missing.to_string(),
        ));
        check
    } else {
        crate::support::check(
            "RULE_HREFLANG_RECIPROCAL",
            Category::International,
            CheckStatus::Pass,
            1,
            "The fetched alternates point back",
            "Each fetched alternate included a link back to this page. At most eight alternates are requested.",
        )
    }
}

fn self_reference(snapshot: &PageSnapshot, links: &[HreflangLink]) -> CheckResult {
    if links.is_empty() {
        return crate::support::check(
            "RULE_HREFLANG_SELF",
            Category::International,
            CheckStatus::NotApplicable,
            1,
            "Hreflang self-reference was not evaluated",
            "No hreflang links were collected.",
        );
    }
    let self_link = links.iter().any(|link| same_url(&link.href, &snapshot.url));
    if self_link {
        crate::support::check(
            "RULE_HREFLANG_SELF",
            Category::International,
            CheckStatus::Pass,
            1,
            "Hreflang includes this URL",
            "One alternate href matches the collected page URL, ignoring a trailing slash and fragment.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_HREFLANG_SELF",
            Category::International,
            CheckStatus::Info,
            1,
            "Hreflang does not list this URL",
            "None of the alternate hrefs match this page. A self-reference is recommended when a page declares alternates. Relative URLs were resolved only when they were absolute http(s) URLs.",
        );
        check.recommendation = Some(
            "Include an alternate that points at this page with its own language tag.".to_string(),
        );
        check
    }
}

pub fn valid_lang(value: &str) -> bool {
    if value.eq_ignore_ascii_case("x-default") {
        return true;
    }
    let mut parts = value.split('-');
    let Some(primary) = parts.next() else {
        return false;
    };
    if !(2..=3).contains(&primary.len()) || !primary.chars().all(|ch| ch.is_ascii_alphabetic()) {
        return false;
    }
    parts.all(|part| {
        (2..=8).contains(&part.len()) && part.chars().all(|ch| ch.is_ascii_alphanumeric())
    })
}

fn same_url(href: &str, page: &str) -> bool {
    let Ok(href) = url::Url::parse(href) else {
        return false;
    };
    let Ok(page) = url::Url::parse(page) else {
        return false;
    };
    href.host_str() == page.host_str()
        && href.path().trim_end_matches('/') == page.path().trim_end_matches('/')
        && href.query() == page.query()
}

#[cfg(test)]
mod tests {
    use super::*;
    use seo_core::{AnalyzeOptions, CheckStatus, LinkRel};

    #[test]
    fn a_missing_return_link_is_a_warning_after_the_site_check() {
        let mut snapshot = PageSnapshot::default();
        snapshot.links_rel.push(LinkRel {
            rel: "alternate".to_string(),
            href: "https://example.com/fr".to_string(),
            hreflang: Some("fr".to_string()),
            media: None,
        });
        snapshot.site.requested = true;
        snapshot.site.hreflang_checked = 1;
        snapshot.site.hreflang_missing = 1;
        let audit = crate::analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        let status = audit
            .checks
            .iter()
            .find(|check| check.id == "RULE_HREFLANG_RECIPROCAL")
            .unwrap()
            .status;
        assert_eq!(status, CheckStatus::Warning);
    }
}
