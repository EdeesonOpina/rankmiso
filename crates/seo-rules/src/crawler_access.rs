//! AI and search crawler accessibility: what the observed robots.txt, robots meta tags, and
//! X-Robots-Tag headers say to each documented crawler or control token.
//!
//! These are rule readings, not measurements of a crawler. RankMiso's own requests are not
//! Googlebot's or GPTBot's: firewalls, bot management, and IP rules may treat real crawlers
//! differently. Nothing here says a page is crawled, indexed, ranked, or cited.

use seo_core::EngineError;

use crate::technical::robots_verdict;

pub const ACCESS_SCHEMA_VERSION: u32 = 1;
/// Microsoft honours the AI Training and AI Grounding preferences from this date (Bing blog, 2026-10-30).
pub const MICROSOFT_PREFERENCES_FROM: &str = "2027-02-01";
const MAX_AGENTS: usize = 64;
const MAX_META: usize = 400;
const MAX_HEADER_VALUES: usize = 32;

/// Directive names that can follow a `name:` prefix without being a user-agent scope.
const DIRECTIVES: [&str; 18] = [
    "all",
    "noindex",
    "nofollow",
    "none",
    "nosnippet",
    "noarchive",
    "nocache",
    "notranslate",
    "noimageindex",
    "indexifembedded",
    "unavailable_after",
    "max-snippet",
    "max-image-preview",
    "max-video-preview",
    "noai",
    "noimageai",
    "ai-training",
    "ai-grounding",
];

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessRequest {
    pub schema_version: u32,
    pub page_url: String,
    /// ISO 8601 time of the check, used only to say whether dated preferences are in effect.
    pub checked_at: String,
    pub robots: RobotsObservation,
    pub page: PageObservation,
    pub agents: Vec<AgentInput>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RobotsObservation {
    /// `read` (2xx body), `missing` (4xx), `error` (5xx or 429), or `not-read` (this browser could not fetch it).
    pub state: String,
    #[serde(default)]
    pub status: Option<u16>,
    #[serde(default)]
    pub body: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageObservation {
    /// `read` or `not-read`.
    pub state: String,
    #[serde(default)]
    pub status: Option<u16>,
    #[serde(default)]
    pub x_robots_tag: Vec<String>,
    #[serde(default)]
    pub meta: Vec<MetaDirective>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaDirective {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInput {
    pub id: String,
    /// The robots.txt product token, for example `OAI-SearchBot` or `Google-Extended`.
    pub token: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessReport {
    pub schema_version: u32,
    pub path: String,
    pub page_access: String,
    pub page_status: Option<u16>,
    pub agents: Vec<AgentVerdict>,
    pub microsoft: MicrosoftPreferences,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentVerdict {
    pub id: String,
    pub token: String,
    /// `allowed`, `disallowed`, `no-rules`, `robots-missing`, `robots-error`, or `not-measured`.
    pub crawl: String,
    /// `User-agent` value of the group used, `*`, or none.
    pub group: Option<String>,
    pub rule: Option<String>,
    /// True when the decision came from the `*` group, not a group naming this token.
    pub via_wildcard: bool,
    /// `read` or `not-measured`.
    pub indexing_state: String,
    pub indexing: Vec<Directive>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Directive {
    pub value: String,
    pub source: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MicrosoftPreferences {
    /// `read` or `not-measured`.
    pub state: String,
    /// `allow` or `disallow` from a page-level Bingbot preference; none when the page sets none.
    pub training: Option<Directive>,
    /// `allow`, `disallow`, or `disallowextended`; none when the page sets none.
    pub grounding: Option<Directive>,
    /// False before 2027-02-01: announced, not yet honoured.
    pub in_effect: bool,
}

pub fn analyze(request: &AccessRequest) -> Result<AccessReport, EngineError> {
    if request.schema_version != ACCESS_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(request.schema_version));
    }
    let url = url::Url::parse(&request.page_url)
        .map_err(|_| EngineError::new("INVALID_URL", "The page URL could not be read."))?;
    let mut path = url.path().to_string();
    if let Some(query) = url.query() {
        path.push('?');
        path.push_str(query);
    }
    let page_read = request.page.state == "read";
    let meta = &request.page.meta[..request.page.meta.len().min(MAX_META)];
    let headers = scoped_header_directives(
        &request.page.x_robots_tag[..request.page.x_robots_tag.len().min(MAX_HEADER_VALUES)],
    );
    let agents = request
        .agents
        .iter()
        .take(MAX_AGENTS)
        .map(|agent| {
            let (crawl, group, rule, via_wildcard) =
                crawl_state(&request.robots, &path, &agent.token);
            AgentVerdict {
                id: agent.id.clone(),
                token: agent.token.clone(),
                crawl,
                group,
                rule,
                via_wildcard,
                indexing_state: if page_read { "read" } else { "not-measured" }.to_string(),
                indexing: if page_read {
                    indexing_for(&agent.token, meta, &headers)
                } else {
                    Vec::new()
                },
            }
        })
        .collect();
    Ok(AccessReport {
        schema_version: ACCESS_SCHEMA_VERSION,
        path,
        page_access: page_access(&request.page),
        page_status: request.page.status,
        agents,
        microsoft: microsoft(page_read, meta, &headers, &request.checked_at),
    })
}

fn crawl_state(
    robots: &RobotsObservation,
    path: &str,
    token: &str,
) -> (String, Option<String>, Option<String>, bool) {
    let plain = |state: &str| (state.to_string(), None, None, false);
    match robots.state.as_str() {
        "read" => {
            let verdict = robots_verdict(&robots.body, path, token);
            let state = match (&verdict.group, verdict.allowed) {
                (None, _) => "no-rules",
                (Some(_), true) => "allowed",
                (Some(_), false) => "disallowed",
            };
            let wildcard = verdict.group.as_deref() == Some("*");
            (state.to_string(), verdict.group, verdict.rule, wildcard)
        }
        "missing" => plain("robots-missing"),
        "error" => plain("robots-error"),
        _ => plain("not-measured"),
    }
}

/// This browser's response to the page. It says nothing certain about a crawler's response.
fn page_access(page: &PageObservation) -> String {
    let Some(status) = page.status.filter(|_| page.state == "read") else {
        return "not-measured".to_string();
    };
    match status {
        200..=299 => "ok",
        401 => "auth-required",
        403 => "forbidden",
        404 | 410 => "not-found",
        429 => "rate-limited",
        500..=599 => "server-error",
        _ => "other",
    }
    .to_string()
}

/// Splits X-Robots-Tag values into (scope, directive) pairs. `googlebot: noindex, nofollow`
/// scopes both directives to googlebot. Browsers join repeated headers with `, `, so a scope
/// carries forward until the next `name:` prefix within the same header value.
fn scoped_header_directives(values: &[String]) -> Vec<(Option<String>, String)> {
    let mut out = Vec::new();
    for value in values {
        let mut scope: Option<String> = None;
        for part in value.split(',') {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }
            let directive = match part.split_once(':') {
                Some((prefix, rest)) if !is_directive(prefix) => {
                    scope = Some(prefix.trim().to_ascii_lowercase());
                    rest.trim()
                }
                _ => part,
            };
            if !directive.is_empty() {
                out.push((scope.clone(), directive.to_ascii_lowercase()));
            }
        }
    }
    out
}

fn is_directive(name: &str) -> bool {
    let name = name.trim().to_ascii_lowercase();
    DIRECTIVES.contains(&name.as_str())
}

fn meta_tokens(content: &str) -> impl Iterator<Item = String> + '_ {
    content
        .split(',')
        .map(|part| part.trim().to_ascii_lowercase())
        .filter(|part| !part.is_empty())
}

fn is_ai_preference(directive: &str) -> bool {
    directive.starts_with("ai-training") || directive.starts_with("ai-grounding")
}

/// Indexing directives that apply to `token`: meta `robots`, meta named after the token, and
/// X-Robots-Tag values with no scope or this token's scope. Microsoft AI preferences are left
/// out: they are content-use settings, not indexing rules.
fn indexing_for(
    token: &str,
    meta: &[MetaDirective],
    headers: &[(Option<String>, String)],
) -> Vec<Directive> {
    let token = token.to_ascii_lowercase();
    let mut out: Vec<Directive> = Vec::new();
    let mut push = |value: String, source: String| {
        if is_ai_preference(&value) {
            return;
        }
        let item = Directive { value, source };
        if !out.contains(&item) {
            out.push(item);
        }
    };
    for tag in meta {
        let name = tag.name.trim().to_ascii_lowercase();
        if name == "robots" || name == token {
            for value in meta_tokens(&tag.content) {
                push(value, format!("meta {name}"));
            }
        }
    }
    for (scope, value) in headers {
        match scope {
            None => push(value.clone(), "X-Robots-Tag".to_string()),
            Some(name) if *name == token => push(value.clone(), format!("X-Robots-Tag ({name})")),
            _ => {}
        }
    }
    out
}

fn microsoft(
    page_read: bool,
    meta: &[MetaDirective],
    headers: &[(Option<String>, String)],
    checked_at: &str,
) -> MicrosoftPreferences {
    let in_effect = checked_at
        .get(..10)
        .is_some_and(|day| day >= MICROSOFT_PREFERENCES_FROM);
    if !page_read {
        return MicrosoftPreferences {
            state: "not-measured".to_string(),
            training: None,
            grounding: None,
            in_effect,
        };
    }
    let mut found: Vec<(String, String)> = Vec::new();
    for tag in meta {
        if tag.name.trim().eq_ignore_ascii_case("bingbot") {
            found
                .extend(meta_tokens(&tag.content).map(|value| (value, "meta bingbot".to_string())));
        }
    }
    for (scope, value) in headers {
        if scope.as_deref() == Some("bingbot") {
            found.push((value.clone(), "X-Robots-Tag (bingbot)".to_string()));
        }
    }
    let pick = |name: &str, allowed: &[&str]| {
        found.iter().find_map(|(value, source)| {
            let (key, setting) = value.split_once(':')?;
            let setting = setting.trim();
            (key.trim() == name && allowed.contains(&setting)).then(|| Directive {
                value: setting.to_string(),
                source: source.clone(),
            })
        })
    };
    MicrosoftPreferences {
        state: "read".to_string(),
        training: pick("ai-training", &["allow", "disallow"]),
        grounding: pick("ai-grounding", &["allow", "disallow", "disallowextended"]),
        in_effect,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn agents() -> Vec<AgentInput> {
        [
            ("googlebot", "Googlebot"),
            ("bingbot", "Bingbot"),
            ("gptbot", "GPTBot"),
            ("oai-searchbot", "OAI-SearchBot"),
            ("google-extended", "Google-Extended"),
            ("usage-ai-training", "__usage_ai-training"),
        ]
        .into_iter()
        .map(|(id, token)| AgentInput {
            id: id.into(),
            token: token.into(),
        })
        .collect()
    }

    fn request(robots: RobotsObservation, page: PageObservation) -> AccessRequest {
        AccessRequest {
            schema_version: ACCESS_SCHEMA_VERSION,
            page_url: "https://example.com/guide?lang=en".into(),
            checked_at: "2026-11-25T10:00:00.000Z".into(),
            robots,
            page,
            agents: agents(),
        }
    }

    fn read(body: &str) -> RobotsObservation {
        RobotsObservation {
            state: "read".into(),
            status: Some(200),
            body: body.into(),
        }
    }

    fn page(meta: &[(&str, &str)], headers: &[&str]) -> PageObservation {
        PageObservation {
            state: "read".into(),
            status: Some(200),
            x_robots_tag: headers.iter().map(|h| h.to_string()).collect(),
            meta: meta
                .iter()
                .map(|(name, content)| MetaDirective {
                    name: name.to_string(),
                    content: content.to_string(),
                })
                .collect(),
        }
    }

    fn agent<'a>(report: &'a AccessReport, id: &str) -> &'a AgentVerdict {
        report.agents.iter().find(|a| a.id == id).unwrap()
    }

    #[test]
    fn search_and_training_crawlers_are_read_separately() {
        let robots = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: *\nDisallow: /private\n";
        let report = analyze(&request(read(robots), page(&[], &[]))).unwrap();
        assert_eq!(report.path, "/guide?lang=en");
        assert_eq!(agent(&report, "gptbot").crawl, "disallowed");
        assert_eq!(
            agent(&report, "gptbot").rule.as_deref(),
            Some("Disallow: /")
        );
        assert_eq!(agent(&report, "oai-searchbot").crawl, "allowed");
        let google = agent(&report, "googlebot");
        assert_eq!(google.crawl, "allowed");
        assert!(google.via_wildcard);
        assert_eq!(google.rule, None);
    }

    #[test]
    fn no_group_is_not_the_same_as_allowed() {
        let report = analyze(&request(
            read("User-agent: Bingbot\nDisallow: /x\n"),
            page(&[], &[]),
        ))
        .unwrap();
        assert_eq!(agent(&report, "gptbot").crawl, "no-rules");
        assert_eq!(agent(&report, "bingbot").crawl, "allowed");
    }

    #[test]
    fn robots_fetch_outcomes_never_become_allowed() {
        for (state, expected) in [
            ("missing", "robots-missing"),
            ("error", "robots-error"),
            ("not-read", "not-measured"),
        ] {
            let robots = RobotsObservation {
                state: state.into(),
                status: None,
                body: String::new(),
            };
            let report = analyze(&request(robots, page(&[], &[]))).unwrap();
            assert!(report
                .agents
                .iter()
                .all(|a| a.crawl == expected && a.rule.is_none()));
        }
    }

    #[test]
    fn indexing_directives_are_scoped_to_the_crawler() {
        let report = analyze(&request(
            read(""),
            page(
                &[
                    ("robots", "max-snippet:50"),
                    ("googlebot", "noindex"),
                    ("bingbot", "ai-training:disallow, nosnippet"),
                ],
                &["gptbot: noindex, nofollow", "noarchive"],
            ),
        ))
        .unwrap();
        let values = |id: &str| {
            agent(&report, id)
                .indexing
                .iter()
                .map(|d| d.value.clone())
                .collect::<Vec<_>>()
        };
        assert_eq!(
            values("googlebot"),
            ["max-snippet:50", "noindex", "noarchive"]
        );
        assert_eq!(
            values("bingbot"),
            ["max-snippet:50", "nosnippet", "noarchive"]
        );
        assert_eq!(
            values("gptbot"),
            ["max-snippet:50", "noindex", "nofollow", "noarchive"]
        );
        assert_eq!(
            agent(&report, "gptbot").indexing[1].source,
            "X-Robots-Tag (gptbot)"
        );
    }

    #[test]
    fn microsoft_preferences_are_content_use_not_crawl_access() {
        let report = analyze(&request(
            read("User-agent: Bingbot\nAllow: /\n\nUser-agent: __usage_ai-training\nDisallow: /\n"),
            page(
                &[("Bingbot", "ai-training:disallow")],
                &["bingbot: ai-grounding:disallowextended"],
            ),
        ))
        .unwrap();
        assert_eq!(agent(&report, "bingbot").crawl, "allowed");
        assert_eq!(agent(&report, "usage-ai-training").crawl, "disallowed");
        let ms = &report.microsoft;
        assert_eq!(ms.training.as_ref().unwrap().value, "disallow");
        assert_eq!(ms.grounding.as_ref().unwrap().value, "disallowextended");
        assert_eq!(
            ms.grounding.as_ref().unwrap().source,
            "X-Robots-Tag (bingbot)"
        );
        assert!(!ms.in_effect);
        assert!(agent(&report, "bingbot").indexing.is_empty());
    }

    #[test]
    fn preferences_take_effect_on_the_announced_date() {
        let mut later = request(read(""), page(&[], &[]));
        later.checked_at = "2027-02-01T00:00:00Z".into();
        assert!(analyze(&later).unwrap().microsoft.in_effect);
    }

    #[test]
    fn unread_page_is_not_measured_and_access_is_classified() {
        let mut unread = page(&[("robots", "noindex")], &[]);
        unread.state = "not-read".into();
        let report = analyze(&request(read(""), unread)).unwrap();
        assert_eq!(report.page_access, "not-measured");
        assert_eq!(report.microsoft.state, "not-measured");
        assert!(report
            .agents
            .iter()
            .all(|a| a.indexing_state == "not-measured" && a.indexing.is_empty()));
        for (status, expected) in [
            (401, "auth-required"),
            (403, "forbidden"),
            (429, "rate-limited"),
            (503, "server-error"),
            (404, "not-found"),
        ] {
            let mut observed = page(&[], &[]);
            observed.status = Some(status);
            assert_eq!(
                analyze(&request(read(""), observed)).unwrap().page_access,
                expected
            );
        }
    }

    #[test]
    fn reads_the_browser_json_contract() {
        let json = r#"{"schemaVersion":1,"pageUrl":"https://example.com/","checkedAt":"2026-11-25T00:00:00Z",
            "robots":{"state":"read","status":200,"body":"User-agent: ClaudeBot\nDisallow: /"},
            "page":{"state":"read","status":200,"xRobotsTag":[],"meta":[]},
            "agents":[{"id":"claudebot","token":"ClaudeBot"},{"id":"claude-searchbot","token":"Claude-SearchBot"}]}"#;
        let request: AccessRequest = serde_json::from_str(json).unwrap();
        let out = serde_json::to_value(analyze(&request).unwrap()).unwrap();
        assert_eq!(out["agents"][0]["crawl"], "disallowed");
        assert_eq!(out["agents"][1]["crawl"], "no-rules");
        assert_eq!(out["agents"][0]["viaWildcard"], false);
        assert_eq!(out["microsoft"]["inEffect"], false);
        assert!(analyze(&AccessRequest {
            schema_version: 2,
            ..request
        })
        .is_err());
    }
}
