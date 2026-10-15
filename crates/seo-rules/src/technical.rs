use seo_core::{Category, CheckResult, CheckStatus, PageSnapshot, ResponseMetadata};

use crate::support::evidence;

pub fn checks(snapshot: &PageSnapshot) -> Vec<CheckResult> {
    vec![
        https(snapshot),
        status(&snapshot.response),
        redirects(&snapshot.response),
        headers(&snapshot.response),
        robots_txt(),
        sitemap(),
        indexing_status(),
    ]
}

fn https(snapshot: &PageSnapshot) -> CheckResult {
    let Ok(url) = url::Url::parse(&snapshot.url) else {
        return crate::support::check(
            "RULE_HTTPS_MISSING",
            Category::Technical,
            CheckStatus::Unavailable,
            2,
            "HTTPS could not be evaluated",
            "The page URL could not be parsed.",
        );
    };
    match url.scheme() {
        "https" => crate::support::check(
            "RULE_HTTPS_MISSING",
            Category::Technical,
            CheckStatus::Pass,
            2,
            "Page uses HTTPS",
            "The collected page URL uses https.",
        ),
        "http" => {
            let mut check = crate::support::check(
                "RULE_HTTPS_MISSING",
                Category::Technical,
                CheckStatus::Warning,
                2,
                "Page uses HTTP",
                "The page URL is not encrypted. Browsers mark HTTP pages as not secure.",
            );
            check.recommendation =
                Some("Serve the page over HTTPS and redirect the HTTP URL.".to_string());
            check
        }
        _ => crate::support::check(
            "RULE_HTTPS_MISSING",
            Category::Technical,
            CheckStatus::NotApplicable,
            2,
            "HTTPS does not apply to this URL",
            "The URL scheme is neither http nor https.",
        ),
    }
}

fn status(response: &ResponseMetadata) -> CheckResult {
    let Some(status) = response.status else {
        return crate::support::check(
            "RULE_HTTP_STATUS",
            Category::Technical,
            CheckStatus::Unavailable,
            2,
            "HTTP status was not exposed",
            "The browser did not provide a navigation status for this document. A missing status is not treated as success.",
        );
    };
    if status == 0 {
        return crate::support::check(
            "RULE_HTTP_STATUS",
            Category::Technical,
            CheckStatus::Unavailable,
            2,
            "HTTP status was not exposed",
            "The navigation timing status was 0, which means the browser did not report a code.",
        );
    }
    let mut check = if (400..600).contains(&status) {
        let mut check = crate::support::check(
            "RULE_HTTP_STATUS",
            Category::Technical,
            CheckStatus::Error,
            2,
            "Page returned an error status",
            format!("The browser reported HTTP {status} for the navigation. Search engines may drop or devalue error URLs."),
        );
        check.recommendation = Some(
            "Return a successful response for indexable URLs, or redirect to the replacement."
                .to_string(),
        );
        check
    } else {
        crate::support::check(
            "RULE_HTTP_STATUS",
            Category::Technical,
            CheckStatus::Pass,
            2,
            "Page status is available",
            format!("The browser reported HTTP {status}. This is the status the browser observed, not a crawler response."),
        )
    };
    check.evidence.push(evidence("status", status.to_string()));
    check.references.push(crate::support::reference(
        "HTTP status codes",
        "https://developers.google.com/search/docs/crawling-indexing/http-network-errors",
    ));
    check
}

fn redirects(response: &ResponseMetadata) -> CheckResult {
    match response.redirect_count {
        None => crate::support::check(
            "RULE_REDIRECT_CHAIN",
            Category::Technical,
            CheckStatus::Unavailable,
            1,
            "Redirect chain was not exposed",
            "The browser did not report how many redirects the navigation followed. Individual hops, status codes, and headers are not available without an optional network trace.",
        ),
        Some(0) => crate::support::check(
            "RULE_REDIRECT_CHAIN",
            Category::Technical,
            CheckStatus::Pass,
            1,
            "No browser-reported redirects",
            "Performance navigation timing reported zero redirects. Client-side redirects that replace the document without a browser redirect may still exist.",
        ),
        Some(count) => {
            let mut check = crate::support::check(
                "RULE_REDIRECT_CHAIN",
                Category::Technical,
                CheckStatus::Info,
                1,
                "Navigation followed redirects",
                "The browser followed one or more redirects before this document. The hop-by-hop status codes were not exposed by this API.",
            );
            check.evidence.push(evidence("redirect count", count.to_string()));
            check
        }
    }
}

fn headers(response: &ResponseMetadata) -> CheckResult {
    if response.headers_available {
        let mut check = crate::support::check(
            "RULE_HTTP_HEADERS",
            Category::Technical,
            CheckStatus::Info,
            1,
            "Response headers were collected",
            "Headers included in the snapshot are shown in the technical report. Header names and values are untrusted page data.",
        );
        check
            .evidence
            .push(evidence("header count", response.headers.len().to_string()));
        check
    } else {
        crate::support::check(
            "RULE_HTTP_HEADERS",
            Category::Technical,
            CheckStatus::Unavailable,
            1,
            "Response headers were not collected",
            "Reading response headers requires an optional network permission. They were not requested during local analysis, so X-Robots-Tag and cache headers are unknown.",
        )
    }
}

fn robots_txt() -> CheckResult {
    crate::support::check(
        "RULE_ROBOTS_TXT",
        Category::Technical,
        CheckStatus::Unavailable,
        1,
        "robots.txt was not requested",
        "Local analysis does not fetch robots.txt. A page can be blocked by robots.txt even when the meta robots tag allows indexing. This result is not a pass.",
    )
}

fn sitemap() -> CheckResult {
    crate::support::check(
        "RULE_XML_SITEMAP",
        Category::Technical,
        CheckStatus::Unavailable,
        1,
        "XML sitemap was not requested",
        "Local analysis does not fetch or discover sitemaps. Missing this check is not evidence that a sitemap is absent.",
    )
}

fn indexing_status() -> CheckResult {
    let mut check = crate::support::check(
        "RULE_INDEXING_STATUS",
        Category::Technical,
        CheckStatus::Unavailable,
        1,
        "Search index status is unknown",
        "This toolkit cannot tell whether Google, Bing, or another search engine has indexed the URL. Index coverage requires data from that search engine.",
    );
    check.evidence.push(evidence(
        "what this check can see",
        "On-page meta robots only. HTTP X-Robots-Tag and robots.txt are separate unavailable checks.",
    ));
    check
}
