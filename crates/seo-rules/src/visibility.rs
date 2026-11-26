//! AI answer visibility: classifies one observation the user recorded (pasted answer text and
//! citation links) for one domain. RankMiso never queries AI services; it reads only what the
//! user provides, so a result describes that sample and nothing more.
//!
//! Status:
//! - `cited`: a pasted citation or link points to the domain (or a subdomain).
//! - `mentioned`: the answer text names the domain or brand, without a matching link.
//! - `not-observed`: evidence was pasted and neither was found. One sample proves nothing about
//!   other prompts, dates, places, or people.
//! - `unknown` or a user-chosen outcome: recorded by hand without pasted evidence.
//! - `not-measured`: nothing was provided.

use seo_core::EngineError;

pub const VISIBILITY_SCHEMA_VERSION: u32 = 1;
const MAX_TEXT: usize = 20_000;
const MAX_URLS: usize = 50;
const SNIPPET: usize = 160;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    pub schema_version: u32,
    pub domain: String,
    #[serde(default)]
    pub brand: String,
    /// Pasted answer text.
    #[serde(default)]
    pub response: String,
    /// Pasted citation links, one per entry, in the order the answer listed them.
    #[serde(default)]
    pub citations: Vec<String>,
    /// Outcome chosen by hand when nothing is pasted: `cited`, `mentioned`, `not-observed`, `unknown`.
    #[serde(default)]
    pub outcome: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Citation {
    pub url: String,
    /// 1-based order among the distinct links found, citations first. It is the order in this
    /// pasted sample, not a ranking.
    pub order: u32,
    pub on_domain: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Classification {
    pub schema_version: u32,
    pub domain: String,
    pub status: String,
    /// `pasted` when evidence was provided, `manual` when the outcome was chosen by hand.
    pub basis: String,
    pub citations: Vec<Citation>,
    pub mentions: Vec<String>,
    pub notes: Vec<String>,
}

/// `https://www.Example.com/a` or `www.example.com` → `example.com`.
pub fn normalize_domain(value: &str) -> Option<String> {
    let value = value.trim().to_ascii_lowercase();
    if value.is_empty() {
        return None;
    }
    let with_scheme = if value.contains("://") {
        value.clone()
    } else {
        format!("https://{value}")
    };
    let host = url::Url::parse(&with_scheme).ok()?.host_str()?.to_string();
    let host = host
        .trim_start_matches("www.")
        .trim_end_matches('.')
        .to_string();
    (host.contains('.') && !host.starts_with('.')).then_some(host)
}

fn on_domain(url: &str, domain: &str) -> bool {
    normalize_domain(url)
        .is_some_and(|host| host == domain || host.ends_with(&format!(".{domain}")))
}

/// http(s) links in free text, without regular expressions.
fn links_in(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = text;
    while let Some(start) = rest.find("http") {
        let tail = &rest[start..];
        if !(tail.starts_with("http://") || tail.starts_with("https://")) {
            rest = &rest[start + 4..];
            continue;
        }
        let end = tail
            .find(|ch: char| {
                ch.is_whitespace() || matches!(ch, '"' | '\'' | '<' | '>' | ')' | ']' | '}')
            })
            .unwrap_or(tail.len());
        let link = tail[..end].trim_end_matches(['.', ',', ';', ':', '!', '?']);
        if url::Url::parse(link).is_ok() {
            out.push(link.to_string());
        }
        rest = &tail[end..];
    }
    out
}

fn clip(text: &str, limit: usize) -> &str {
    if text.len() <= limit {
        return text;
    }
    let mut end = limit;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

/// Case-insensitive whole-word occurrences of `needle`, as short snippets.
fn mentions(text: &str, needle: &str) -> Vec<String> {
    let needle = needle.trim().to_lowercase();
    if needle.chars().count() < 3 {
        return Vec::new();
    }
    let lower = text.to_lowercase();
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(found) = lower[from..].find(&needle) {
        let at = from + found;
        let end = at + needle.len();
        let before = lower[..at].chars().next_back();
        let mut tail = lower[end..].chars();
        let after = tail.next();
        // "example.com.evil.io" continues the host; "example.com." ends a sentence.
        let longer_host = after == Some('.') && tail.next().is_some_and(char::is_alphanumeric);
        let word = |ch: Option<char>| ch.is_some_and(|ch| ch.is_alphanumeric() || ch == '-');
        if !word(before) && !word(after) && !longer_host && lower.is_char_boundary(at) {
            let start = lower[..at]
                .char_indices()
                .rev()
                .nth(60)
                .map_or(0, |(index, _)| index);
            let snippet = text
                .get(start..)
                .map(|tail| clip(tail, SNIPPET))
                .unwrap_or("");
            out.push(snippet.split_whitespace().collect::<Vec<_>>().join(" "));
            if out.len() >= 3 {
                break;
            }
        }
        from = end;
    }
    out
}

pub fn classify(input: &Observation) -> Result<Classification, EngineError> {
    if input.schema_version != VISIBILITY_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(input.schema_version));
    }
    let domain = normalize_domain(&input.domain)
        .ok_or_else(|| EngineError::new("INVALID_DOMAIN", "Enter a domain such as example.com."))?;
    let response = clip(&input.response, MAX_TEXT);
    let mut notes = Vec::new();
    if input.response.len() > MAX_TEXT {
        notes.push(format!(
            "Only the first {MAX_TEXT} characters of the answer were read."
        ));
    }
    let mut seen = Vec::<String>::new();
    for link in input
        .citations
        .iter()
        .flat_map(|entry| {
            let found = links_in(entry);
            if found.is_empty() {
                normalize_domain(entry)
                    .map(|_| vec![format!("https://{}", entry.trim())])
                    .unwrap_or_default()
            } else {
                found
            }
        })
        .chain(links_in(response))
    {
        let key = link.trim_end_matches('/').to_ascii_lowercase();
        if !seen
            .iter()
            .any(|item| item.trim_end_matches('/').to_ascii_lowercase() == key)
        {
            seen.push(link);
        }
        if seen.len() >= MAX_URLS {
            notes.push(format!("Only the first {MAX_URLS} links were read."));
            break;
        }
    }
    let citations: Vec<Citation> = seen
        .iter()
        .enumerate()
        .map(|(index, url)| Citation {
            url: url.clone(),
            order: index as u32 + 1,
            on_domain: on_domain(url, &domain),
        })
        .collect();
    let mut found = mentions(response, &domain);
    if !input.brand.trim().is_empty() {
        for snippet in mentions(response, &input.brand) {
            if !found.contains(&snippet) && found.len() < 3 {
                found.push(snippet);
            }
        }
    }
    let pasted =
        !response.trim().is_empty() || !input.citations.iter().all(|c| c.trim().is_empty());
    let (status, basis) = if citations.iter().any(|citation| citation.on_domain) {
        ("cited", "pasted")
    } else if !found.is_empty() {
        ("mentioned", "pasted")
    } else if pasted {
        ("not-observed", "pasted")
    } else {
        match input.outcome.as_str() {
            outcome @ ("cited" | "mentioned" | "not-observed" | "unknown") => (outcome, "manual"),
            _ => ("not-measured", "manual"),
        }
    };
    Ok(Classification {
        schema_version: VISIBILITY_SCHEMA_VERSION,
        domain,
        status: status.to_string(),
        basis: basis.to_string(),
        citations,
        mentions: found,
        notes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn observe(domain: &str, response: &str, citations: &[&str]) -> Classification {
        classify(&Observation {
            schema_version: 1,
            domain: domain.into(),
            brand: String::new(),
            response: response.into(),
            citations: citations.iter().map(|c| c.to_string()).collect(),
            outcome: String::new(),
        })
        .unwrap()
    }

    #[test]
    fn domains_normalize() {
        assert_eq!(
            normalize_domain("https://www.Example.com/a?b").as_deref(),
            Some("example.com")
        );
        assert_eq!(
            normalize_domain("blog.example.com").as_deref(),
            Some("blog.example.com")
        );
        assert_eq!(normalize_domain("localhost"), None);
        assert_eq!(normalize_domain(""), None);
    }

    #[test]
    fn citation_on_the_domain_or_a_subdomain() {
        let result = observe(
            "example.com",
            "Sources: [1] https://other.org/x, [2] https://docs.example.com/guide.",
            &["https://news.site/a"],
        );
        assert_eq!(result.status, "cited");
        assert_eq!(result.citations.len(), 3);
        let ours = result.citations.iter().find(|c| c.on_domain).unwrap();
        assert_eq!(ours.url, "https://docs.example.com/guide");
        assert_eq!(ours.order, 3);
    }

    #[test]
    fn look_alike_domains_are_not_attributed() {
        let result = observe(
            "example.com",
            "See https://notexample.com/ and https://example.com.evil.io/",
            &[],
        );
        assert_eq!(result.status, "not-observed");
        assert!(result.citations.iter().all(|c| !c.on_domain));
    }

    #[test]
    fn duplicate_links_count_once() {
        let result = observe(
            "example.com",
            "https://example.com/a and https://example.com/a/",
            &["https://example.com/a"],
        );
        assert_eq!(result.citations.len(), 1);
    }

    #[test]
    fn mentions_without_links_and_brand_names() {
        let result = observe(
            "example.com",
            "Many people recommend Example.com for this.",
            &[],
        );
        assert_eq!(result.status, "mentioned");
        assert!(result.mentions[0].contains("Example.com"));
        let branded = classify(&Observation {
            schema_version: 1,
            domain: "rankmiso.app".into(),
            brand: "RankMiso".into(),
            response: "Try RankMiso, a free extension. Not RankMisoPro.".into(),
            citations: vec![],
            outcome: String::new(),
        })
        .unwrap();
        assert_eq!(branded.status, "mentioned");
        assert_eq!(branded.mentions.len(), 1);
    }

    #[test]
    fn manual_and_missing_evidence() {
        let manual = |outcome: &str| {
            classify(&Observation {
                schema_version: 1,
                domain: "example.com".into(),
                brand: String::new(),
                response: String::new(),
                citations: vec![],
                outcome: outcome.into(),
            })
            .unwrap()
        };
        assert_eq!(
            (
                manual("cited").status.as_str(),
                manual("cited").basis.as_str()
            ),
            ("cited", "manual")
        );
        assert_eq!(manual("unknown").status, "unknown");
        assert_eq!(manual("").status, "not-measured");
        assert_eq!(manual("ranked-1").status, "not-measured");
    }

    #[test]
    fn bounds_and_invalid_input() {
        let long = format!("{} https://example.com/late", "word ".repeat(5_000));
        let result = observe("example.com", &long, &[]);
        assert_eq!(result.status, "not-observed");
        assert!(result.notes[0].contains("first 20000 characters"));
        assert!(classify(&Observation {
            schema_version: 1,
            domain: "not a domain".into(),
            brand: String::new(),
            response: String::new(),
            citations: vec![],
            outcome: String::new(),
        })
        .is_err());
    }
}
