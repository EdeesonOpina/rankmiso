//! Redirect intelligence for one user-started trace. The browser layer follows redirects one
//! validated hop at a time and reports what it saw; this module decides what the chain means.
//!
//! Evidence kinds are kept apart: HTTP redirect hops (status and Location read from the
//! response), a meta refresh declared by the final page, and redirects that were detected but
//! could not be read. JavaScript redirects are not inferred. Nothing here changes the page score.

use seo_core::{Category, CheckResult, CheckStatus, EngineError};

use crate::support::{self, evidence, reference};

pub const TRACE_SCHEMA_VERSION: u32 = 1;
const REDIRECTS_DOC: &str =
    "https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes";
const META_DOC: &str = "https://developers.google.com/search/docs/crawling-indexing/301-redirects";

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedirectTrace {
    pub schema_version: u32,
    pub start_url: String,
    #[serde(default)]
    pub hops_observed: bool,
    #[serde(default)]
    pub hops: Vec<Hop>,
    #[serde(default)]
    pub final_url: Option<String>,
    #[serde(default)]
    pub final_status: Option<u16>,
    #[serde(default)]
    pub redirected: bool,
    /// Why the trace ended early, or empty when it reached a final response.
    #[serde(default)]
    pub stopped: String,
    #[serde(default)]
    pub meta_refresh: Option<MetaRefresh>,
    #[serde(default)]
    pub canonical: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hop {
    pub url: String,
    pub status: u16,
    pub location: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaRefresh {
    pub delay: u32,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RedirectReport {
    pub schema_version: u32,
    pub findings: Vec<CheckResult>,
}

fn rule(id: &str, title: &str, status: CheckStatus, description: &str) -> CheckResult {
    let mut check = support::check(id, Category::Technical, status, 0, title, description);
    check
        .references
        .push(reference("Google: redirects and Google Search", META_DOC));
    check
}

fn advise(mut check: CheckResult, recommendation: &str) -> CheckResult {
    check.recommendation = Some(recommendation.to_string());
    check
}

fn scheme(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()
        .map(|parsed| parsed.scheme().to_string())
}

fn same_page(left: &str, right: &str) -> bool {
    let clean = |value: &str| {
        url::Url::parse(value).ok().map(|mut parsed| {
            parsed.set_fragment(None);
            parsed.to_string()
        })
    };
    clean(left).is_some() && clean(left) == clean(right)
}

pub fn analyze(trace: &RedirectTrace) -> Result<RedirectReport, EngineError> {
    if trace.schema_version != TRACE_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(trace.schema_version));
    }
    let hops = &trace.hops[..trace.hops.len().min(20)];
    let mut findings = Vec::new();
    let readable = trace.hops_observed && trace.stopped != "unreadable";
    let hop_unavailable = |id: &str, title: &str| {
        rule(
            id,
            title,
            CheckStatus::Unavailable,
            if trace.hops_observed {
                "The redirect's status and location could not be read, so this was not measured."
            } else {
                "Redirect details are off. Allow them in the redirect trace to read each hop's status and location."
            },
        )
    };

    // Chain length and outcome.
    findings.push(if trace.stopped == "loop" {
        advise(
            rule(
                "REDIRECT_LOOP",
                "Redirect loop",
                CheckStatus::Error,
                "The chain returned to a URL it had already visited. Browsers and crawlers give up on loops.",
            ),
            "Remove the redirect that points back into the chain.",
        )
    } else if trace.redirected && !readable {
        hop_unavailable("REDIRECT_LOOP", "Redirect loop")
    } else {
        rule(
            "REDIRECT_LOOP",
            "Redirect loop",
            if trace.redirected {
                CheckStatus::Pass
            } else {
                CheckStatus::NotApplicable
            },
            if trace.redirected {
                "No URL appeared twice in the observed chain."
            } else {
                "The URL did not redirect."
            },
        )
    });

    findings.push(if trace.redirected && !readable {
        hop_unavailable("REDIRECT_CHAIN", "Redirect chain length")
    } else if trace.stopped == "limit" || hops.len() >= 3 {
        advise(
            rule(
                "REDIRECT_CHAIN",
                "Redirect chain length",
                CheckStatus::Warning,
                "The URL goes through several redirects before a final page. Each hop adds a request, and long chains can be dropped by crawlers.",
            ),
            "Redirect the first URL straight to the final destination.",
        )
    } else if hops.len() == 2 {
        advise(
            rule(
                "REDIRECT_CHAIN",
                "Redirect chain length",
                CheckStatus::Info,
                "The URL redirects twice before the final page.",
            ),
            "Consider redirecting straight to the final destination.",
        )
    } else {
        rule(
            "REDIRECT_CHAIN",
            "Redirect chain length",
            if hops.is_empty() {
                CheckStatus::NotApplicable
            } else {
                CheckStatus::Pass
            },
            if hops.is_empty() {
                "The URL did not redirect."
            } else {
                "A single redirect leads to the final page."
            },
        )
    });

    // Permanent versus temporary.
    let temporary: Vec<String> = hops
        .iter()
        .filter(|hop| matches!(hop.status, 302 | 303 | 307))
        .map(|hop| format!("{} {} → {}", hop.status, hop.url, hop.location))
        .collect();
    findings.push(if trace.redirected && !readable {
        hop_unavailable("REDIRECT_TEMPORARY", "Temporary redirects")
    } else if !temporary.is_empty() {
        let mut check = advise(
            rule(
                "REDIRECT_TEMPORARY",
                "Temporary redirects",
                CheckStatus::Info,
                "The chain uses a temporary redirect (302, 303, or 307). Google uses a permanent redirect as a signal that the target should be canonical, and does not use a temporary one that way.",
            ),
            "If the move is permanent, use 301 or 308.",
        );
        check.evidence.extend(temporary.into_iter().map(|item| evidence("hop", item)));
        check
    } else {
        rule(
            "REDIRECT_TEMPORARY",
            "Temporary redirects",
            if hops.is_empty() {
                CheckStatus::NotApplicable
            } else {
                CheckStatus::Pass
            },
            if hops.is_empty() {
                "The URL did not redirect."
            } else {
                "Every observed redirect is permanent (301 or 308)."
            },
        )
    });

    // HTTPS.
    let downgrade = hops.iter().find(|hop| {
        scheme(&hop.url).as_deref() == Some("https")
            && scheme(&hop.location).as_deref() == Some("http")
    });
    let upgrade = hops.iter().any(|hop| {
        scheme(&hop.url).as_deref() == Some("http")
            && scheme(&hop.location).as_deref() == Some("https")
    });
    findings.push(if let Some(hop) = downgrade {
        let mut check = advise(
            rule(
                "REDIRECT_HTTPS",
                "HTTPS in the redirect chain",
                CheckStatus::Warning,
                "A redirect sends an HTTPS URL to HTTP. Visitors lose transport security, and Google prefers HTTPS URLs as canonical.",
            ),
            "Keep every hop on HTTPS.",
        );
        check
            .evidence
            .push(evidence("downgrade", format!("{} → {}", hop.url, hop.location)));
        check
    } else if trace.redirected && !readable {
        hop_unavailable("REDIRECT_HTTPS", "HTTPS in the redirect chain")
    } else if upgrade {
        rule(
            "REDIRECT_HTTPS",
            "HTTPS in the redirect chain",
            CheckStatus::Pass,
            "An HTTP URL redirects to HTTPS.",
        )
    } else {
        rule(
            "REDIRECT_HTTPS",
            "HTTPS in the redirect chain",
            if hops.is_empty() {
                CheckStatus::NotApplicable
            } else {
                CheckStatus::Pass
            },
            if hops.is_empty() {
                "The URL did not redirect."
            } else {
                "No hop moves from HTTPS to HTTP."
            },
        )
    });

    // Destination.
    findings.push(match (trace.stopped.as_str(), trace.final_status) {
        ("left-origin", _) => {
            let mut check = advise(
                rule(
                    "REDIRECT_DESTINATION",
                    "Redirect destination",
                    CheckStatus::Info,
                    "The chain leaves this site. RankMiso stops at the site boundary and does not request the other host.",
                ),
                "Confirm the cross-site destination is intended.",
            );
            if let Some(hop) = hops.last() {
                check.evidence.push(evidence("leaves to", hop.location.clone()));
            }
            check
        }
        ("blocked", _) => rule(
            "REDIRECT_DESTINATION",
            "Redirect destination",
            CheckStatus::Warning,
            "A redirect points to a non-web scheme or a private address, so RankMiso did not follow it.",
        ),
        ("timeout" | "network" | "aborted", _) => rule(
            "REDIRECT_DESTINATION",
            "Redirect destination",
            CheckStatus::Unavailable,
            match trace.stopped.as_str() {
                "timeout" => "The trace timed out before a final response.",
                "aborted" => "The trace was cancelled.",
                _ => "A request in the chain failed, so the destination was not reached.",
            },
        ),
        (_, Some(status)) if status >= 400 => advise(
            rule(
                "REDIRECT_DESTINATION",
                "Redirect destination",
                if trace.redirected {
                    CheckStatus::Error
                } else {
                    CheckStatus::Warning
                },
                if trace.redirected {
                    "The chain ends on an HTTP error page."
                } else {
                    "The URL answers with an HTTP error."
                },
            ),
            "Redirect to a page that loads, or remove the redirect.",
        ),
        (_, Some(_)) => rule(
            "REDIRECT_DESTINATION",
            "Redirect destination",
            CheckStatus::Pass,
            "The trace reached a final page that loads.",
        ),
        _ => hop_unavailable("REDIRECT_DESTINATION", "Redirect destination"),
    });
    if let Some(last) = findings.last_mut() {
        if let (Some(url), Some(status)) = (&trace.final_url, trace.final_status) {
            last.evidence
                .push(evidence("final", format!("{status} {url}")));
        }
    }

    // Canonical of the final page against the chain.
    let canonical = trace.canonical.trim();
    findings.push(match &trace.final_url {
        _ if canonical.is_empty() => rule(
            "REDIRECT_CANONICAL",
            "Final page canonical",
            CheckStatus::NotApplicable,
            "The final page declares no canonical URL, or it was not reached.",
        ),
        Some(final_url) if same_page(canonical, final_url) => rule(
            "REDIRECT_CANONICAL",
            "Final page canonical",
            CheckStatus::Pass,
            "The final page names itself as canonical.",
        ),
        Some(_) if hops.iter().any(|hop| same_page(&hop.url, canonical)) => {
            let mut check = advise(
                rule(
                    "REDIRECT_CANONICAL",
                    "Final page canonical",
                    CheckStatus::Warning,
                    "The final page names a URL from the redirect chain as canonical. The redirect and the canonical point in opposite directions.",
                ),
                "Make the canonical the final URL, or remove the redirect.",
            );
            check.evidence.push(evidence("canonical", canonical.to_string()));
            check
        }
        Some(_) => {
            let mut check = rule(
                "REDIRECT_CANONICAL",
                "Final page canonical",
                CheckStatus::Info,
                "The final page names a different URL as canonical. That can be intended.",
            );
            check.evidence.push(evidence("canonical", canonical.to_string()));
            check
        }
        None => rule(
            "REDIRECT_CANONICAL",
            "Final page canonical",
            CheckStatus::NotApplicable,
            "The final page was not reached.",
        ),
    });

    // Meta refresh on the final page.
    findings.push(match &trace.meta_refresh {
        None if trace.final_url.is_some() => rule(
            "REDIRECT_META_REFRESH",
            "Meta refresh on the final page",
            CheckStatus::Pass,
            "The final page declares no meta refresh.",
        ),
        None => rule(
            "REDIRECT_META_REFRESH",
            "Meta refresh on the final page",
            CheckStatus::NotApplicable,
            "The final page was not reached.",
        ),
        Some(refresh) => {
            let instant = refresh.delay == 0 && !refresh.url.is_empty();
            let mut check = advise(
                rule(
                    "REDIRECT_META_REFRESH",
                    "Meta refresh on the final page",
                    if instant {
                        CheckStatus::Warning
                    } else {
                        CheckStatus::Info
                    },
                    if instant {
                        "The final page redirects again with an instant meta refresh. Google reads it as a permanent redirect, but advises meta refresh only when server-side redirects are not possible."
                    } else {
                        "The final page declares a meta refresh. It is not an HTTP redirect; RankMiso did not follow it."
                    },
                ),
                "Use a 301 or 308 server redirect if the page has moved.",
            );
            check
                .evidence
                .push(evidence("delay", format!("{} s", refresh.delay)));
            if !refresh.url.is_empty() {
                check.evidence.push(evidence("refresh to", refresh.url.clone()));
            }
            check
        }
    });

    for finding in &mut findings {
        finding
            .evidence
            .insert(0, evidence("traced", trace.start_url.clone()));
    }
    if let Some(first) = findings.first_mut() {
        first.references.push(reference(
            "Google: site moves with URL changes",
            REDIRECTS_DOC,
        ));
    }
    Ok(RedirectReport {
        schema_version: TRACE_SCHEMA_VERSION,
        findings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hop(url: &str, status: u16, location: &str) -> Hop {
        Hop {
            url: url.into(),
            status,
            location: location.into(),
        }
    }

    fn trace(hops: Vec<Hop>, final_url: Option<&str>, status: Option<u16>) -> RedirectTrace {
        RedirectTrace {
            schema_version: 1,
            start_url: "https://example.com/a".into(),
            hops_observed: true,
            redirected: !hops.is_empty(),
            hops,
            final_url: final_url.map(str::to_string),
            final_status: status,
            stopped: String::new(),
            meta_refresh: None,
            canonical: String::new(),
        }
    }

    fn status(report: &RedirectReport, id: &str) -> CheckStatus {
        report.findings.iter().find(|f| f.id == id).unwrap().status
    }

    #[test]
    fn no_redirect() {
        let report = analyze(&trace(vec![], Some("https://example.com/a"), Some(200))).unwrap();
        assert_eq!(
            status(&report, "REDIRECT_CHAIN"),
            CheckStatus::NotApplicable
        );
        assert_eq!(status(&report, "REDIRECT_DESTINATION"), CheckStatus::Pass);
        assert_eq!(status(&report, "REDIRECT_META_REFRESH"), CheckStatus::Pass);
        assert!(report.findings.iter().all(|f| f.weight == 0));
    }

    #[test]
    fn single_permanent_redirect_with_https_upgrade() {
        let report = analyze(&trace(
            vec![hop("http://example.com/a", 301, "https://example.com/a")],
            Some("https://example.com/a"),
            Some(200),
        ))
        .unwrap();
        assert_eq!(status(&report, "REDIRECT_CHAIN"), CheckStatus::Pass);
        assert_eq!(status(&report, "REDIRECT_TEMPORARY"), CheckStatus::Pass);
        assert_eq!(status(&report, "REDIRECT_HTTPS"), CheckStatus::Pass);
    }

    #[test]
    fn long_temporary_chain_to_an_error() {
        let report = analyze(&trace(
            vec![
                hop("https://example.com/a", 302, "https://example.com/b"),
                hop("https://example.com/b", 301, "https://example.com/c"),
                hop("https://example.com/c", 307, "https://example.com/d"),
            ],
            Some("https://example.com/d"),
            Some(404),
        ))
        .unwrap();
        assert_eq!(status(&report, "REDIRECT_CHAIN"), CheckStatus::Warning);
        assert_eq!(status(&report, "REDIRECT_TEMPORARY"), CheckStatus::Info);
        assert_eq!(status(&report, "REDIRECT_DESTINATION"), CheckStatus::Error);
        let temporary = report
            .findings
            .iter()
            .find(|f| f.id == "REDIRECT_TEMPORARY")
            .unwrap();
        assert_eq!(
            temporary
                .evidence
                .iter()
                .filter(|e| e.label == "hop")
                .count(),
            2
        );
    }

    #[test]
    fn loop_downgrade_and_cross_origin() {
        let mut looped = trace(
            vec![
                hop("https://example.com/a", 301, "https://example.com/b"),
                hop("https://example.com/b", 301, "https://example.com/a"),
            ],
            None,
            None,
        );
        looped.stopped = "loop".into();
        assert_eq!(
            status(&analyze(&looped).unwrap(), "REDIRECT_LOOP"),
            CheckStatus::Error
        );

        let down = trace(
            vec![hop("https://example.com/a", 301, "http://example.com/a")],
            Some("http://example.com/a"),
            Some(200),
        );
        assert_eq!(
            status(&analyze(&down).unwrap(), "REDIRECT_HTTPS"),
            CheckStatus::Warning
        );

        let mut away = trace(
            vec![hop("https://example.com/a", 301, "https://other.org/")],
            None,
            None,
        );
        away.stopped = "left-origin".into();
        let report = analyze(&away).unwrap();
        assert_eq!(status(&report, "REDIRECT_DESTINATION"), CheckStatus::Info);
        assert_eq!(
            status(&report, "REDIRECT_CANONICAL"),
            CheckStatus::NotApplicable
        );
    }

    #[test]
    fn unreadable_redirects_are_not_measured() {
        let mut opaque = trace(vec![], None, None);
        opaque.redirected = true;
        opaque.hops_observed = false;
        opaque.stopped = "unreadable".into();
        let report = analyze(&opaque).unwrap();
        for id in [
            "REDIRECT_LOOP",
            "REDIRECT_CHAIN",
            "REDIRECT_TEMPORARY",
            "REDIRECT_HTTPS",
            "REDIRECT_DESTINATION",
        ] {
            assert_eq!(status(&report, id), CheckStatus::Unavailable, "{id}");
        }
        let chain = report
            .findings
            .iter()
            .find(|f| f.id == "REDIRECT_CHAIN")
            .unwrap();
        assert!(chain.description.contains("Redirect details are off"));
    }

    #[test]
    fn canonical_and_meta_refresh_on_the_final_page() {
        let mut back = trace(
            vec![hop("https://example.com/a", 301, "https://example.com/b")],
            Some("https://example.com/b"),
            Some(200),
        );
        back.canonical = "https://example.com/a".into();
        back.meta_refresh = Some(MetaRefresh {
            delay: 0,
            url: "https://example.com/c".into(),
        });
        let report = analyze(&back).unwrap();
        assert_eq!(status(&report, "REDIRECT_CANONICAL"), CheckStatus::Warning);
        assert_eq!(
            status(&report, "REDIRECT_META_REFRESH"),
            CheckStatus::Warning
        );

        let mut slow = trace(vec![], Some("https://example.com/a"), Some(200));
        slow.canonical = "https://example.com/a#top".into();
        slow.meta_refresh = Some(MetaRefresh {
            delay: 30,
            url: String::new(),
        });
        let report = analyze(&slow).unwrap();
        assert_eq!(status(&report, "REDIRECT_CANONICAL"), CheckStatus::Pass);
        assert_eq!(status(&report, "REDIRECT_META_REFRESH"), CheckStatus::Info);
    }

    #[test]
    fn timeouts_are_not_measured_and_versions_are_checked() {
        let mut slow = trace(vec![], None, None);
        slow.stopped = "timeout".into();
        assert_eq!(
            status(&analyze(&slow).unwrap(), "REDIRECT_DESTINATION"),
            CheckStatus::Unavailable
        );
        slow.schema_version = 2;
        assert!(analyze(&slow).is_err());
    }
}
