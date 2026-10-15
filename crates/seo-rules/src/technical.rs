use seo_core::{Category, CheckResult, CheckStatus, PageSnapshot, ResponseMetadata};

use crate::support::evidence;

pub fn checks(snapshot: &PageSnapshot) -> Vec<CheckResult> {
    vec![
        https(snapshot),
        status(&snapshot.response),
        redirects(&snapshot.response),
        headers(&snapshot.response),
        robots_txt(snapshot),
        sitemap(snapshot),
        broken_links(snapshot),
        redirect_hops(snapshot),
        indexing_status(snapshot),
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
            "These headers were fetched again from this browser after the optional site check. They can differ from the original navigation. Values may be truncated.",
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
            "Headers stay unknown until you run the optional site check. A missing header list is not a pass.",
        )
    }
}

fn robots_txt(snapshot: &PageSnapshot) -> CheckResult {
    if !snapshot.site.requested {
        return crate::support::check(
            "RULE_ROBOTS_TXT",
            Category::Technical,
            CheckStatus::Unavailable,
            1,
            "robots.txt was not requested",
            "robots.txt stays unknown until you run the optional site check. A page can be blocked there even when the meta robots tag allows indexing. This result is not a pass.",
        );
    }
    let Some(status) = snapshot.site.robots_status else {
        return crate::support::check(
            "RULE_ROBOTS_TXT",
            Category::Technical,
            CheckStatus::Unavailable,
            1,
            "robots.txt could not be fetched",
            "The optional site check ran, but robots.txt did not return a usable response. This is not a pass.",
        );
    };
    if status == 404 {
        return crate::support::check(
            "RULE_ROBOTS_TXT",
            Category::Technical,
            CheckStatus::Info,
            1,
            "No robots.txt was found",
            "The origin responded 404. Crawlers generally treat a missing robots.txt as allow-all. This is not a pass that a file exists.",
        );
    }
    if status != 200 {
        return crate::support::check(
            "RULE_ROBOTS_TXT",
            Category::Technical,
            CheckStatus::Warning,
            1,
            &format!("robots.txt responded with {status}"),
            "The body was not used as crawl rules.",
        );
    }
    let path = page_path(&snapshot.url);
    let decision = robots_decision(&snapshot.site.robots_body, &path);
    let mut check = if decision.blocked {
        crate::support::check(
            "RULE_ROBOTS_TXT",
            Category::Technical,
            CheckStatus::Warning,
            1,
            &format!("robots.txt blocks this URL for User-agent: {}", decision.agent),
            "The matching group has a disallow rule that wins for this path. The group is chosen as Googlebot when that agent is present, and as * otherwise. This is not a full crawler simulation.",
        )
    } else {
        crate::support::check(
            "RULE_ROBOTS_TXT",
            Category::Technical,
            CheckStatus::Pass,
            1,
            &format!("robots.txt allows this URL for User-agent: {}", decision.agent),
            "The matching group allows this path. The group is chosen as Googlebot when that agent is present, and as * otherwise. This is not a full crawler simulation.",
        )
    };
    check.evidence.push(evidence("agent", decision.agent));
    check.evidence.push(evidence("path", path));
    check
}

fn sitemap(snapshot: &PageSnapshot) -> CheckResult {
    if !snapshot.site.requested {
        return crate::support::check(
            "RULE_XML_SITEMAP",
            Category::Technical,
            CheckStatus::Unavailable,
            1,
            "XML sitemap was not requested",
            "Sitemaps stay unknown until you run the optional site check. Missing this check is not evidence that a sitemap is absent.",
        );
    }
    let listed = sitemap_directives(&snapshot.site.robots_body);
    if listed.is_empty() {
        return crate::support::check(
            "RULE_XML_SITEMAP",
            Category::Technical,
            CheckStatus::Info,
            1,
            "robots.txt does not list a sitemap",
            "No Sitemap line was found in the fetched robots.txt. This does not prove a sitemap is absent, and it does not say whether this URL is listed.",
        );
    }
    match snapshot.site.sitemap_status {
        Some(200) => {
            let count = snapshot.site.sitemap_url_count.unwrap_or(0);
            if count == 0 {
                crate::support::check(
                    "RULE_XML_SITEMAP",
                    Category::Technical,
                    CheckStatus::Warning,
                    1,
                    "The sitemap response had no loc entries",
                    "The first listed sitemap responded, but the fetched portion contained no loc entries. This does not say whether the current URL is listed.",
                )
            } else {
                let (title, listed) = match snapshot.site.sitemap_contains_page {
                    Some(true) => ("The open URL is in the fetched sitemap portion", "yes"),
                    Some(false) => ("The open URL is not in the fetched sitemap portion", "no"),
                    None => ("The first listed sitemap responded", "unknown"),
                };
                let truncated = if snapshot.site.sitemap_truncated {
                    " The fetch was cut off, so a later loc could still name this URL."
                } else {
                    ""
                };
                let mut check = crate::support::check(
                    "RULE_XML_SITEMAP",
                    Category::Technical,
                    CheckStatus::Info,
                    1,
                    title,
                    format!("The fetched portion contained {count} loc entries. Only the first sitemap was requested.{truncated}"),
                );
                check.evidence.push(evidence("loc entries", count.to_string()));
                check.evidence.push(evidence("open URL listed", listed));
                check
            }
        }
        Some(status) => crate::support::check(
            "RULE_XML_SITEMAP",
            Category::Technical,
            CheckStatus::Warning,
            1,
            &format!("The first listed sitemap responded with {status}"),
            "A Sitemap line was present, but the fetch was not a 200. This does not prove the current URL is missing.",
        ),
        None => crate::support::check(
            "RULE_XML_SITEMAP",
            Category::Technical,
            CheckStatus::Warning,
            1,
            "A sitemap was listed but not fetched",
            "robots.txt named a sitemap, and the optional fetch did not finish. This is not a pass.",
        ),
    }
}

fn broken_links(snapshot: &PageSnapshot) -> CheckResult {
    if !snapshot.site.requested {
        return crate::support::check(
            "RULE_BROKEN_LINKS",
            Category::Technical,
            CheckStatus::Unavailable,
            1,
            "Broken links were not requested",
            "Links stay unchecked until you run the optional site check. A link is not treated as healthy because it was not fetched.",
        );
    }
    let site = &snapshot.site;
    let mut check = if site.links_checked == 0 {
        crate::support::check(
            "RULE_BROKEN_LINKS",
            Category::Technical,
            CheckStatus::Info,
            1,
            "No links were sampled",
            "The optional check found no public http(s) links to request. Private and local addresses are skipped.",
        )
    } else if site.links_broken > 0 {
        crate::support::check(
            "RULE_BROKEN_LINKS",
            Category::Technical,
            CheckStatus::Warning,
            1,
            "Some sampled links returned an error",
            format!(
                "{} of {} requested links returned 4xx or 5xx, excluding 401, 403, and 429. {} public links were found.",
                site.links_broken, site.links_checked, site.links_total
            ),
        )
    } else if site.links_unreachable > 0 || site.links_blocked > 0 {
        crate::support::check(
            "RULE_BROKEN_LINKS",
            Category::Technical,
            CheckStatus::Info,
            1,
            "The link sample did not all respond",
            "Some sampled links were blocked or did not respond. That is not counted as a pass.",
        )
    } else if site.links_total > site.links_checked {
        crate::support::check(
            "RULE_BROKEN_LINKS",
            Category::Technical,
            CheckStatus::Info,
            1,
            "Only part of the link list was requested",
            format!(
                "{} of {} public links responded. The rest were not requested, so this is not a pass.",
                site.links_checked, site.links_total
            ),
        )
    } else {
        crate::support::check(
            "RULE_BROKEN_LINKS",
            Category::Technical,
            CheckStatus::Pass,
            1,
            "The requested public links responded",
            "Every public http(s) link that was requested responded without a 4xx or 5xx. Private and local addresses stay skipped.",
        )
    };
    check
        .evidence
        .push(evidence("public links", site.links_total.to_string()));
    check
        .evidence
        .push(evidence("checked", site.links_checked.to_string()));
    check
        .evidence
        .push(evidence("broken", site.links_broken.to_string()));
    check
        .evidence
        .push(evidence("unreachable", site.links_unreachable.to_string()));
    check
        .evidence
        .push(evidence("blocked", site.links_blocked.to_string()));
    check
}

fn redirect_hops(snapshot: &PageSnapshot) -> CheckResult {
    if !snapshot.site.requested {
        return crate::support::check(
            "RULE_REDIRECT_HOPS",
            Category::Technical,
            CheckStatus::Unavailable,
            1,
            "Redirect hops were not requested",
            "The hop list comes from the optional site check. Navigation timing still supplies the redirect count when the browser exposes it.",
        );
    }
    if snapshot.site.redirect_hops.is_empty() {
        return crate::support::check(
            "RULE_REDIRECT_HOPS",
            Category::Technical,
            CheckStatus::Info,
            1,
            "The fresh fetch did not redirect",
            "The optional request followed no redirect before the final response. This can differ from the original navigation.",
        );
    }
    let mut check = crate::support::check(
        "RULE_REDIRECT_HOPS",
        Category::Technical,
        CheckStatus::Info,
        1,
        "The fresh fetch followed redirects",
        "Each hop is the status and URL seen while following the optional request, up to five hops.",
    );
    check.evidence = crate::support::bounded_evidence(&snapshot.site.redirect_hops, "hop");
    check
}

fn indexing_status(snapshot: &PageSnapshot) -> CheckResult {
    let mut check = crate::support::check(
        "RULE_INDEXING_STATUS",
        Category::Technical,
        CheckStatus::Unavailable,
        1,
        "Search index status is unknown",
        "This toolkit cannot tell whether Google, Bing, or another search engine has indexed the URL. Index coverage requires data from that search engine.",
    );
    let seen = if snapshot.response.headers_available {
        "On-page meta robots, plus the headers fetched for this report. Search-engine index coverage is still unknown."
    } else {
        "On-page meta robots only. X-Robots-Tag and robots.txt stay unknown until the optional site check."
    };
    check
        .evidence
        .push(evidence("what this check can see", seen));
    check
}

fn page_path(url: &str) -> String {
    url::Url::parse(url)
        .ok()
        .map(|parsed| {
            let path = parsed.path();
            if path.is_empty() {
                "/".to_string()
            } else {
                path.to_string()
            }
        })
        .unwrap_or_else(|| "/".to_string())
}

fn sitemap_directives(body: &str) -> Vec<String> {
    body.lines()
        .filter_map(|raw| {
            let line = raw.split('#').next().unwrap_or("").trim();
            let (key, value) = line.split_once(':')?;
            if key.trim().eq_ignore_ascii_case("sitemap") {
                let url = value.trim();
                if url.is_empty() {
                    None
                } else {
                    Some(url.to_string())
                }
            } else {
                None
            }
        })
        .take(8)
        .collect()
}

struct AgentGroup {
    agents: Vec<String>,
    rules: Vec<(bool, String)>,
}

struct RobotsDecision {
    agent: String,
    blocked: bool,
}

fn robots_decision(body: &str, path: &str) -> RobotsDecision {
    let groups = parse_groups(body);
    let product = "googlebot";
    let specific = groups.iter().filter_map(|group| {
        group
            .agents
            .iter()
            .filter(|agent| {
                let token = agent.to_ascii_lowercase();
                token != "*" && product.contains(token.as_str())
            })
            .max_by_key(|agent| agent.len())
            .map(|agent| (agent.clone(), group))
    });
    if let Some((agent, group)) = specific.max_by_key(|(agent, _)| agent.len()) {
        return RobotsDecision {
            blocked: group_blocks(&group.rules, path),
            agent,
        };
    }
    let blocked = groups
        .iter()
        .find(|group| group.agents.iter().any(|agent| agent == "*"))
        .is_some_and(|group| group_blocks(&group.rules, path));
    RobotsDecision {
        agent: "*".to_string(),
        blocked,
    }
}

fn parse_groups(body: &str) -> Vec<AgentGroup> {
    let mut groups = Vec::new();
    let mut agents = Vec::new();
    let mut rules = Vec::new();
    for raw in body.lines() {
        let line = raw.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase();
        let value = value.trim().to_string();
        match key.as_str() {
            "user-agent" => {
                if !rules.is_empty() {
                    groups.push(AgentGroup {
                        agents: std::mem::take(&mut agents),
                        rules: std::mem::take(&mut rules),
                    });
                }
                agents.push(value);
            }
            "allow" => rules.push((true, value)),
            "disallow" => rules.push((false, value)),
            _ => {}
        }
    }
    if !agents.is_empty() {
        groups.push(AgentGroup { agents, rules });
    }
    groups
}

fn group_blocks(rules: &[(bool, String)], path: &str) -> bool {
    let mut best_allow = 0_usize;
    let mut best_disallow = 0_usize;
    for (allow, pattern) in rules {
        if pattern.is_empty() || !rule_matches(pattern, path) {
            continue;
        }
        let len = pattern.len();
        if *allow {
            best_allow = best_allow.max(len);
        } else {
            best_disallow = best_disallow.max(len);
        }
    }
    best_disallow > best_allow
}

fn rule_matches(pattern: &str, path: &str) -> bool {
    let anchored = pattern.ends_with('$');
    let pattern = pattern.trim_end_matches('$');
    if pattern.is_empty() {
        return false;
    }
    if !pattern.contains('*') {
        return if anchored {
            path == pattern
        } else {
            path.starts_with(pattern)
        };
    }
    let parts: Vec<&str> = pattern.split('*').collect();
    let mut rest = path;
    for (index, part) in parts.iter().enumerate() {
        if part.is_empty() {
            continue;
        }
        if index == 0 {
            if !rest.starts_with(part) {
                return false;
            }
            rest = &rest[part.len()..];
        } else if let Some(found) = rest.find(part) {
            rest = &rest[found + part.len()..];
        } else {
            return false;
        }
    }
    !anchored || rest.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;
    use seo_core::{AnalyzeOptions, CheckStatus, SiteProbe};

    fn status_of(id: &str, snapshot: &PageSnapshot) -> CheckStatus {
        crate::analyze(snapshot, &AnalyzeOptions::default())
            .unwrap()
            .checks
            .into_iter()
            .find(|check| check.id == id)
            .unwrap()
            .status
    }

    #[test]
    fn longer_allow_beats_a_shorter_disallow() {
        let body = "User-agent: *\nDisallow: /\nAllow: /docs\n";
        assert!(!robots_decision(body, "/docs/guide").blocked);
        assert!(robots_decision(body, "/private").blocked);
        assert_eq!(robots_decision(body, "/private").agent, "*");
    }

    #[test]
    fn googlebot_group_is_the_one_that_is_applied() {
        let body = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n";
        let decision = robots_decision(body, "/");
        assert_eq!(decision.agent, "Googlebot");
        assert!(!decision.blocked);
    }

    #[test]
    fn missing_robots_file_is_info() {
        let mut snapshot = PageSnapshot::default();
        snapshot.site.requested = true;
        snapshot.site.robots_status = Some(404);
        assert_eq!(status_of("RULE_ROBOTS_TXT", &snapshot), CheckStatus::Info);
        assert_eq!(status_of("RULE_XML_SITEMAP", &snapshot), CheckStatus::Info);
    }

    #[test]
    fn a_blocked_path_is_a_warning() {
        let snapshot = PageSnapshot {
            url: "https://example.com/private/page".to_string(),
            site: SiteProbe {
                requested: true,
                robots_status: Some(200),
                robots_body: "User-agent: *\nDisallow: /private\n".to_string(),
                ..SiteProbe::default()
            },
            ..PageSnapshot::default()
        };
        assert_eq!(
            status_of("RULE_ROBOTS_TXT", &snapshot),
            CheckStatus::Warning
        );
    }

    #[test]
    fn sampled_errors_warn_and_a_clean_sample_passes() {
        let mut broken = PageSnapshot::default();
        broken.site.requested = true;
        broken.site.links_checked = 4;
        broken.site.links_broken = 1;
        assert_eq!(
            status_of("RULE_BROKEN_LINKS", &broken),
            CheckStatus::Warning
        );
        let mut clean = PageSnapshot::default();
        clean.site.requested = true;
        clean.site.links_checked = 3;
        clean.site.links_total = 3;
        assert_eq!(status_of("RULE_BROKEN_LINKS", &clean), CheckStatus::Pass);
    }

    #[test]
    fn a_partial_clean_sample_is_not_a_pass() {
        let mut snapshot = PageSnapshot::default();
        snapshot.site.requested = true;
        snapshot.site.links_checked = 20;
        snapshot.site.links_total = 45;
        assert_eq!(status_of("RULE_BROKEN_LINKS", &snapshot), CheckStatus::Info);
    }

    #[test]
    fn sitemap_names_whether_the_open_url_was_found() {
        let mut snapshot = PageSnapshot {
            url: "https://example.com/guide".to_string(),
            ..PageSnapshot::default()
        };
        snapshot.site.requested = true;
        snapshot.site.robots_status = Some(200);
        snapshot.site.robots_body = "Sitemap: https://example.com/sitemap.xml".to_string();
        snapshot.site.sitemap_status = Some(200);
        snapshot.site.sitemap_url_count = Some(1);
        snapshot.site.sitemap_contains_page = Some(true);
        let audit = crate::analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        let check = audit
            .checks
            .iter()
            .find(|check| check.id == "RULE_XML_SITEMAP")
            .unwrap();
        assert_eq!(check.status, CheckStatus::Info);
        assert!(check.title.contains("open URL"));
    }

    #[test]
    fn redirect_hops_from_the_fresh_fetch_are_listed() {
        let mut snapshot = PageSnapshot::default();
        snapshot.site.requested = true;
        snapshot.site.redirect_hops = vec!["301 https://example.com/".to_string()];
        let audit = crate::analyze(&snapshot, &AnalyzeOptions::default()).unwrap();
        let check = audit
            .checks
            .iter()
            .find(|check| check.id == "RULE_REDIRECT_HOPS")
            .unwrap();
        assert_eq!(check.status, CheckStatus::Info);
        assert!(check.evidence.iter().any(|item| item.value.contains("301")));
    }
}
