use seo_core::{Category, CheckResult, CheckStatus, PerformanceSnapshot};

use crate::support::evidence;

pub fn checks(performance: &PerformanceSnapshot) -> Vec<CheckResult> {
    vec![
        metric(
            "RULE_PERF_LCP",
            "Largest Contentful Paint",
            performance.lcp_ms,
            "ms",
            "Browser-observed LCP from the current page load. This is not Chrome UX Report field data.",
        ),
        metric(
            "RULE_PERF_CLS",
            "Cumulative Layout Shift",
            performance.cls,
            "",
            "Browser-observed layout-shift total for this page load, when the browser exposed the entries. This is not field data.",
        ),
        metric(
            "RULE_PERF_INP",
            "Interaction to Next Paint",
            performance.inp_ms,
            "ms",
            "INP needs interaction entries. If the browser did not expose a value, the metric is unavailable and is not treated as a pass.",
        ),
    ]
}

fn metric(id: &str, label: &str, value: Option<f64>, unit: &str, explanation: &str) -> CheckResult {
    let Some(value) = value else {
        return crate::support::check(
            id,
            Category::Performance,
            CheckStatus::Unavailable,
            1,
            &format!("{label} is unavailable"),
            explanation,
        );
    };
    let rendered = if unit.is_empty() {
        format!("{value:.3}")
    } else {
        format!("{value:.0} {unit}")
    };
    let mut check = crate::support::check(
        id,
        Category::Performance,
        CheckStatus::Info,
        1,
        &format!("{label} was observed in this browser"),
        format!("{explanation} Observed value: {rendered}. Published Core Web Vitals thresholds describe field data at the 75th percentile, so this single view is not a field result."),
    );
    check.evidence.push(evidence("observed", rendered));
    check.references.push(crate::support::reference(
        "Web Vitals",
        "https://web.dev/articles/vitals",
    ));
    check
}
