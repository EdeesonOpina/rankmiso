//! Weighted, applicability-aware scoring.
//!
//! A check contributes only when its status is PASS, WARNING, or ERROR.
//! INFO, NOT_APPLICABLE, and UNAVAILABLE are excluded from the denominator.
//! Points use integers so the same snapshot always yields the same score:
//! pass = 2, warning = 1, error = 0, multiplied by the check weight.
//! The category score is `earned * 100 / possible`, truncated toward zero.
//! The overall score is the category-weight average of available category
//! scores, also truncated toward zero.
//!
//! This is a local checklist score. It is not a search-engine ranking.

use std::collections::BTreeMap;

use seo_core::{Category, CategoryScore, CheckResult, CheckStatus, ScoreSummary};

pub const SCORE_DISCLAIMER: &str = "This score summarizes local checks that could be evaluated. It is not a Google ranking score, an indexation status, or a traffic estimate.";

#[derive(Debug, Clone)]
pub struct ScoringConfig {
    pub category_weights: BTreeMap<Category, u32>,
}

impl Default for ScoringConfig {
    fn default() -> Self {
        let mut category_weights = BTreeMap::new();
        category_weights.insert(Category::Metadata, 25);
        category_weights.insert(Category::Headings, 15);
        category_weights.insert(Category::Technical, 15);
        category_weights.insert(Category::Content, 10);
        category_weights.insert(Category::Images, 10);
        category_weights.insert(Category::Links, 10);
        category_weights.insert(Category::International, 5);
        category_weights.insert(Category::Accessibility, 5);
        category_weights.insert(Category::Social, 5);
        category_weights.insert(Category::StructuredData, 0);
        category_weights.insert(Category::Performance, 0);
        Self { category_weights }
    }
}

pub fn score(checks: &[CheckResult], config: &ScoringConfig) -> ScoreSummary {
    let mut errors = 0;
    let mut warnings = 0;
    let mut passed = 0;
    let mut info = 0;
    let mut unavailable = 0;
    let mut not_applicable = 0;

    for check in checks {
        match check.status {
            CheckStatus::Error => errors += 1,
            CheckStatus::Warning => warnings += 1,
            CheckStatus::Pass => passed += 1,
            CheckStatus::Info => info += 1,
            CheckStatus::Unavailable => unavailable += 1,
            CheckStatus::NotApplicable => not_applicable += 1,
        }
    }

    let categories = [
        Category::Metadata,
        Category::Content,
        Category::Headings,
        Category::Links,
        Category::Images,
        Category::Technical,
        Category::StructuredData,
        Category::Social,
        Category::Performance,
        Category::International,
        Category::Accessibility,
    ];

    let category_scores: Vec<CategoryScore> = categories
        .into_iter()
        .map(|category| category_score(category, checks))
        .collect();

    let mut weighted = 0_u32;
    let mut weight_total = 0_u32;
    for category in &category_scores {
        if !category.available {
            continue;
        }
        let weight = config
            .category_weights
            .get(&category.category)
            .copied()
            .unwrap_or(0);
        if weight == 0 {
            continue;
        }
        weighted += category.value.unwrap_or(0) * weight;
        weight_total += weight;
    }

    let value = weight_total
        .checked_div(weight_total)
        .and(weighted.checked_div(weight_total));

    ScoreSummary {
        available: value.is_some(),
        value,
        disclaimer: SCORE_DISCLAIMER.to_string(),
        applicable_checks: passed + warnings + errors,
        excluded_checks: info + unavailable + not_applicable,
        errors,
        warnings,
        passed,
        info,
        unavailable,
        not_applicable,
        categories: category_scores,
    }
}

fn category_score(category: Category, checks: &[CheckResult]) -> CategoryScore {
    let mut earned = 0_u32;
    let mut possible = 0_u32;
    let mut errors = 0;
    let mut warnings = 0;
    let mut passed = 0;
    let mut applicable = 0;

    for check in checks.iter().filter(|check| check.category == category) {
        if !check.status.is_scored() {
            continue;
        }
        let weight = check.weight.max(1);
        possible += weight * 2;
        earned += weight * points(check.status);
        applicable += 1;
        match check.status {
            CheckStatus::Error => errors += 1,
            CheckStatus::Warning => warnings += 1,
            CheckStatus::Pass => passed += 1,
            _ => {}
        }
    }

    CategoryScore {
        category,
        available: possible > 0,
        value: possible
            .checked_div(possible)
            .and((earned * 100).checked_div(possible)),
        applicable_checks: applicable,
        errors,
        warnings,
        passed,
    }
}

fn points(status: CheckStatus) -> u32 {
    match status {
        CheckStatus::Pass => 2,
        CheckStatus::Warning => 1,
        CheckStatus::Error => 0,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use seo_core::CheckStatus;

    fn sample(status: CheckStatus, category: Category, weight: u32) -> CheckResult {
        CheckResult {
            id: "RULE_TEST".to_string(),
            category,
            status,
            weight,
            applicable: status.is_applicable(),
            title_key: "rules.test.title".to_string(),
            title: "Test".to_string(),
            description: "Test".to_string(),
            evidence: Vec::new(),
            recommendation: None,
            references: Vec::new(),
        }
    }

    #[test]
    fn unavailable_checks_do_not_raise_the_score() {
        let checks = vec![
            sample(CheckStatus::Pass, Category::Metadata, 1),
            sample(CheckStatus::Unavailable, Category::Technical, 5),
            sample(CheckStatus::NotApplicable, Category::Images, 5),
        ];
        let summary = score(&checks, &ScoringConfig::default());
        assert_eq!(summary.value, Some(100));
        assert_eq!(summary.applicable_checks, 1);
        assert_eq!(summary.excluded_checks, 2);
    }

    #[test]
    fn errors_score_lower_than_warnings() {
        let error = score(
            &[sample(CheckStatus::Error, Category::Metadata, 1)],
            &ScoringConfig::default(),
        );
        let warning = score(
            &[sample(CheckStatus::Warning, Category::Metadata, 1)],
            &ScoringConfig::default(),
        );
        assert_eq!(error.value, Some(0));
        assert_eq!(warning.value, Some(50));
    }

    #[test]
    fn repeated_inputs_produce_the_same_score() {
        let checks = vec![
            sample(CheckStatus::Pass, Category::Metadata, 2),
            sample(CheckStatus::Warning, Category::Headings, 1),
            sample(CheckStatus::Error, Category::Images, 1),
        ];
        let config = ScoringConfig::default();
        assert_eq!(score(&checks, &config), score(&checks, &config));
    }
}
