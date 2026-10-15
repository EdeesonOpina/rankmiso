use seo_core::{Category, CheckResult, CheckStatus, HeadingSnapshot, PageSnapshot};

use crate::support::{bounded_evidence, evidence, normalize_ws};

pub fn checks(snapshot: &PageSnapshot) -> Vec<CheckResult> {
    let headings = &snapshot.headings;
    vec![
        h1_missing(headings),
        multiple_h1(headings),
        empty(headings),
        skipped(headings),
        duplicates(headings),
    ]
}

fn h1_missing(headings: &[HeadingSnapshot]) -> CheckResult {
    let count = headings.iter().filter(|heading| heading.level == 1).count();
    if headings.is_empty() || count == 0 {
        let mut check = crate::support::check(
            "RULE_H1_MISSING",
            Category::Headings,
            CheckStatus::Error,
            2,
            "H1 is missing",
            "No H1 was found in the rendered document. A page can be valid without an H1, but a single descriptive H1 helps people and assistive technology understand the topic.",
        );
        check.recommendation = Some("Add one H1 that describes the page.".to_string());
        check
    } else {
        let mut check = crate::support::check(
            "RULE_H1_MISSING",
            Category::Headings,
            CheckStatus::Pass,
            2,
            "H1 is present",
            "At least one H1 was found.",
        );
        check.evidence.push(evidence("h1 count", count.to_string()));
        check
    }
}

fn multiple_h1(headings: &[HeadingSnapshot]) -> CheckResult {
    let h1s: Vec<String> = headings
        .iter()
        .filter(|heading| heading.level == 1)
        .map(|heading| normalize_ws(&heading.text))
        .collect();
    if h1s.len() > 1 {
        let mut check = crate::support::check(
            "RULE_MULTIPLE_H1",
            Category::Headings,
            CheckStatus::Warning,
            1,
            "Multiple H1 elements",
            "More than one H1 was found. HTML allows this, and it is not a confirmed ranking penalty. Many pages are still easier to scan with one H1.",
        );
        check.evidence = bounded_evidence(&h1s, "h1");
        check.recommendation =
            Some("Use one H1 for the page topic and lower levels for sections.".to_string());
        check
    } else if h1s.is_empty() {
        crate::support::check(
            "RULE_MULTIPLE_H1",
            Category::Headings,
            CheckStatus::NotApplicable,
            1,
            "Multiple H1s were not evaluated",
            "There is no H1 to compare.",
        )
    } else {
        crate::support::check(
            "RULE_MULTIPLE_H1",
            Category::Headings,
            CheckStatus::Pass,
            1,
            "One H1",
            "A single H1 was found.",
        )
    }
}

fn empty(headings: &[HeadingSnapshot]) -> CheckResult {
    let empty: Vec<String> = headings
        .iter()
        .filter(|heading| normalize_ws(&heading.text).is_empty())
        .map(|heading| format!("H{} at {}", heading.level, heading.location))
        .collect();
    if headings.is_empty() {
        return crate::support::check(
            "RULE_HEADING_EMPTY",
            Category::Headings,
            CheckStatus::NotApplicable,
            1,
            "Empty headings were not evaluated",
            "No headings were collected.",
        );
    }
    if empty.is_empty() {
        crate::support::check(
            "RULE_HEADING_EMPTY",
            Category::Headings,
            CheckStatus::Pass,
            1,
            "Headings have text",
            "Every collected heading has visible text.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_HEADING_EMPTY",
            Category::Headings,
            CheckStatus::Warning,
            1,
            "Empty headings",
            "Some heading elements have no text. They create gaps in the outline.",
        );
        check.evidence = bounded_evidence(&empty, "heading");
        check.recommendation =
            Some("Remove empty headings or give them descriptive text.".to_string());
        check
    }
}

fn skipped(headings: &[HeadingSnapshot]) -> CheckResult {
    let mut last = 0_u8;
    let mut skips = Vec::new();
    for heading in headings {
        if !(1..=6).contains(&heading.level) {
            continue;
        }
        if last > 0 && heading.level > last + 1 {
            skips.push(format!(
                "H{last} to H{} ({})",
                heading.level,
                normalize_ws(&heading.text)
            ));
        }
        last = heading.level;
    }
    if headings.is_empty() {
        crate::support::check(
            "RULE_HEADING_LEVEL_SKIP",
            Category::Headings,
            CheckStatus::NotApplicable,
            1,
            "Heading order was not evaluated",
            "No headings were collected.",
        )
    } else if skips.is_empty() {
        crate::support::check(
            "RULE_HEADING_LEVEL_SKIP",
            Category::Headings,
            CheckStatus::Pass,
            1,
            "Heading levels do not skip",
            "Each heading is at most one level deeper than the previous heading. Starting below H1 is reported separately.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_HEADING_LEVEL_SKIP",
            Category::Headings,
            CheckStatus::Warning,
            1,
            "Heading levels skip",
            "The outline jumps more than one level. People using heading navigation can miss the structure.",
        );
        check.evidence = bounded_evidence(&skips, "skip");
        check.recommendation =
            Some("Insert the missing heading level or change the heading rank.".to_string());
        check
    }
}

fn duplicates(headings: &[HeadingSnapshot]) -> CheckResult {
    use std::collections::BTreeMap;
    let mut counts: BTreeMap<(u8, String), u32> = BTreeMap::new();
    for heading in headings {
        let text = normalize_ws(&heading.text).to_lowercase();
        if text.is_empty() {
            continue;
        }
        *counts.entry((heading.level, text)).or_insert(0) += 1;
    }
    let dupes: Vec<String> = counts
        .into_iter()
        .filter_map(|((level, text), count)| {
            (count > 1).then_some(format!("H{level}: {text} ({count})"))
        })
        .collect();
    if dupes.is_empty() {
        crate::support::check(
            "RULE_HEADING_DUPLICATE",
            Category::Headings,
            CheckStatus::Pass,
            1,
            "No duplicate heading text",
            "Identical text was not repeated at the same heading level. Repeated section labels can still be legitimate.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_HEADING_DUPLICATE",
            Category::Headings,
            CheckStatus::Info,
            1,
            "Repeated heading text",
            "The same text appears more than once at the same level. This is informational, not an error.",
        );
        check.evidence = bounded_evidence(&dupes, "heading");
        check
    }
}
