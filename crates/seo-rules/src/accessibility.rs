use seo_core::{AccessibilitySnapshot, Category, CheckResult, CheckStatus};

use crate::support::evidence;

pub fn checks(accessibility: &AccessibilitySnapshot) -> Vec<CheckResult> {
    if !accessibility.sampled {
        return vec![crate::support::check(
            "RULE_A11Y_SAMPLE",
            Category::Accessibility,
            CheckStatus::Unavailable,
            1,
            "Accessibility sample was not collected",
            "The page snapshot did not include the accessibility sample. No accessibility result is treated as a pass. Automated checks cannot prove WCAG conformance even when they run.",
        )];
    }
    vec![
        count_check(
            "RULE_FORM_LABEL_MISSING",
            accessibility.unlabeled_form_controls,
            "Form controls without a detectable label",
            "Some inputs, selects, or textareas have no associated label, aria-label, or aria-labelledby.",
            "Every sampled form control has a detectable label.",
            "Add a label element or an accessible name. This heuristic misses some valid patterns and is not a WCAG audit.",
        ),
        count_check(
            "RULE_BUTTON_NAME_MISSING",
            accessibility.nameless_buttons,
            "Buttons without a detectable name",
            "Some buttons have no text, aria-label, aria-labelledby, or title.",
            "Every sampled button has a detectable name.",
            "Give the button visible text or an accessible name.",
        ),
        count_check(
            "RULE_DUPLICATE_ID",
            accessibility.duplicate_ids,
            "Duplicate id attributes",
            "The same id is used on more than one element. Labels and in-page links can point at the wrong element.",
            "No duplicate ids were found in the sample.",
            "Make each id unique in the document.",
        ),
    ]
}

fn count_check(
    id: &str,
    count: u32,
    title: &str,
    problem: &str,
    ok: &str,
    recommendation: &str,
) -> CheckResult {
    if count == 0 {
        crate::support::check(
            id,
            Category::Accessibility,
            CheckStatus::Pass,
            1,
            ok,
            format!("{ok} Automated checks still cannot guarantee WCAG conformance."),
        )
    } else {
        let mut check = crate::support::check(
            id,
            Category::Accessibility,
            CheckStatus::Warning,
            1,
            title,
            format!("{problem} {count} occurrence(s) were counted. This is a limited heuristic, not a complete WCAG audit."),
        );
        check.evidence.push(evidence("count", count.to_string()));
        check.recommendation = Some(recommendation.to_string());
        check
    }
}
