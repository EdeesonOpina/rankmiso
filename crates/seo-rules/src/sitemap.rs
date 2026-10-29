//! Sitemap findings. The browser extracts XML. This module decides what is wrong.
//! It does not fetch, and it does not claim a URL is indexed.

use seo_core::{Category, CheckResult, CheckStatus, EngineError};
use url::Url;

use crate::support::{self, evidence};

pub const SITEMAP_SCHEMA_VERSION: u32 = 1;
const MAX_URL_FINDINGS: usize = 24;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SitemapDocument {
    pub schema_version: u32,
    pub site_origin: String,
    #[serde(default)]
    pub page_url: Option<String>,
    #[serde(default)]
    pub partial: bool,
    #[serde(default)]
    pub files: Vec<SitemapFile>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SitemapFile {
    pub url: String,
    pub source: String,
    pub fetch: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub truncated: bool,
    #[serde(default)]
    pub entries: Vec<SitemapEntry>,
    #[serde(default)]
    pub children: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SitemapEntry {
    #[serde(default)]
    pub loc: String,
    #[serde(default)]
    pub lastmod: String,
    #[serde(default)]
    pub changefreq: String,
    #[serde(default)]
    pub priority: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SitemapReport {
    pub schema_version: u32,
    pub page_match: String,
    pub url_count: u32,
    pub file_count: u32,
    pub partial: bool,
    pub findings: Vec<CheckResult>,
}

pub fn analyze(document: &SitemapDocument) -> Result<SitemapReport, EngineError> {
    if document.schema_version != SITEMAP_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(document.schema_version));
    }
    let mut findings = Vec::new();
    let mut seen_urls: Vec<(String, String)> = Vec::new();
    let mut url_findings = 0_usize;
    let mut url_count = 0_u32;
    let mut found_page = false;
    let mut read_a_urlset = false;

    if document.partial {
        findings.push(note(
            "SITEMAP_LIMIT",
            CheckStatus::Warning,
            "Sitemap processing stopped at a limit",
            "RankMiso stopped before every referenced file or URL was read. Counts and the active-page result cover only the processed portion.",
            "Run the check again on a smaller file, or inspect the remaining sitemap URLs one at a time.",
            &document.site_origin,
        ));
    }

    for file in &document.files {
        match file.fetch.as_str() {
            "external" => findings.push(file_note(
                file,
                "SITEMAP_EXTERNAL",
                CheckStatus::Info,
                "Sitemap is on another site",
                "This address was listed, and RankMiso did not request it. A sitemap on another host needs its own explicit check.",
                "Open a page on that host and run Discover sitemaps there, or import the file.",
            )),
            "failed" | "missing" if file.source != "conventional" => findings.push(file_note(
                file,
                "SITEMAP_UNREADABLE",
                CheckStatus::Warning,
                "Sitemap could not be read",
                "The listed sitemap was not available. This does not prove the site has no sitemap.",
                "Confirm the URL returns the sitemap file, then run the check again.",
            )),
            "missing" if file.source == "conventional" => findings.push(file_note(
                file,
                "SITEMAP_CONVENTIONAL_MISSING",
                CheckStatus::Info,
                "No sitemap at this common path",
                "This common path did not return a sitemap. A missing file here does not prove the site has no sitemap.",
                "Use the sitemap named in robots.txt, or paste the URL you already know.",
            )),
            _ => {}
        }
        if file.truncated {
            findings.push(file_note(
                file,
                "SITEMAP_LIMIT",
                CheckStatus::Warning,
                "Sitemap file was cut off",
                "The file was larger than the processing limit. Later entries in this file were not validated.",
                "Split the sitemap or inspect the unread portion separately.",
            ));
        }
        match file.kind.as_str() {
            "invalid" => findings.push(file_note(
                file,
                "SITEMAP_XML_INVALID",
                CheckStatus::Error,
                "Sitemap XML could not be parsed",
                "The file is not well-formed XML, so its URLs were not read.",
                "Fix the XML syntax and check the file again.",
            )),
            "dtd" => findings.push(file_note(
                file,
                "SITEMAP_DTD",
                CheckStatus::Error,
                "Sitemap DTD was rejected",
                "RankMiso does not process a document type definition or external entity. The file was not used as a sitemap.",
                "Remove the DOCTYPE and keep a urlset or sitemapindex root.",
            )),
            "gzip" => findings.push(file_note(
                file,
                "SITEMAP_GZIP_UNSUPPORTED",
                CheckStatus::Warning,
                "Compressed sitemap was not opened",
                "This response looks compressed, and it could not be opened safely in this browser.",
                "Save an uncompressed .xml copy and import that file.",
            )),
            "unknown" => findings.push(file_note(
                file,
                "SITEMAP_UNSUPPORTED",
                CheckStatus::Error,
                "XML is not a sitemap",
                "The root element is not urlset or sitemapindex. Arbitrary XML is not treated as a sitemap.",
                "Use a sitemap urlset or a sitemap index.",
            )),
            "index" if file.source == "child" => findings.push(file_note(
                file,
                "SITEMAP_NESTED_INDEX",
                CheckStatus::Warning,
                "Sitemap index points at another index",
                "A sitemap index listed another index. That nesting is a Google sitemap compatibility problem. RankMiso did not follow the inner index.",
                "Point the parent index at sitemap files, not at another index.",
            )),
            "index" => validate_children(file, document, &mut findings),
            "urlset" => {
                read_a_urlset = true;
                if file.entries.is_empty() && file.fetch == "fetched" {
                    findings.push(file_note(
                        file,
                        "SITEMAP_EMPTY",
                        CheckStatus::Info,
                        "Sitemap file has no URL entries",
                        "This urlset has no loc values. That does not say whether other sitemap files list URLs.",
                        "Add url entries, or remove the empty file from the index.",
                    ));
                }
            }
            _ => {}
        }

        if file.kind != "urlset" {
            continue;
        }
        for entry in &file.entries {
            url_count += 1;
            if document
                .page_url
                .as_deref()
                .is_some_and(|page| same_page(&entry.loc, page))
            {
                found_page = true;
            }
            if url_findings >= MAX_URL_FINDINGS {
                continue;
            }
            url_findings += validate_entry(file, entry, document, &mut seen_urls, &mut findings);
        }
    }

    let page_match = if document.page_url.is_none() {
        "unchecked"
    } else if found_page {
        "found"
    } else if !read_a_urlset || document.partial {
        "unknown"
    } else {
        "absent"
    };

    Ok(SitemapReport {
        schema_version: SITEMAP_SCHEMA_VERSION,
        page_match: page_match.to_string(),
        url_count,
        file_count: document.files.len() as u32,
        partial: document.partial || document.files.iter().any(|file| file.truncated),
        findings,
    })
}

fn validate_children(
    file: &SitemapFile,
    document: &SitemapDocument,
    findings: &mut Vec<CheckResult>,
) {
    let mut seen = Vec::new();
    for child in &file.children {
        let key = child.trim();
        if key.is_empty() {
            continue;
        }
        if seen.iter().any(|item: &String| item == key) {
            findings.push(file_note(
                file,
                "SITEMAP_DUPLICATE_CHILD",
                CheckStatus::Warning,
                "Sitemap index repeats a file",
                "The same sitemap address appears more than once in this index.",
                "Keep one sitemap element for each file.",
            ));
            continue;
        }
        seen.push(key.to_string());
        match classify_loc(key) {
            LocClass::Ok(url) => {
                if !same_origin(&url, &document.site_origin) {
                    findings.push(with_evidence(
                        file,
                        "SITEMAP_EXTERNAL",
                        CheckStatus::Info,
                        "Index lists a sitemap on another site",
                        "The child sitemap uses another host. RankMiso does not request it automatically.",
                        "Check that host separately.",
                        key,
                    ));
                }
            }
            LocClass::Relative => findings.push(with_evidence(
                file,
                "SITEMAP_CHILD_URL",
                CheckStatus::Error,
                "Sitemap reference is not absolute",
                "A sitemap loc must be an absolute URL.",
                "Use the full https address of the child sitemap.",
                key,
            )),
            LocClass::Scheme => findings.push(with_evidence(
                file,
                "SITEMAP_CHILD_URL",
                CheckStatus::Error,
                "Sitemap reference uses an unsupported scheme",
                "Sitemap addresses must be http or https.",
                "Replace the child loc with an http(s) URL.",
                key,
            )),
            LocClass::Bad => findings.push(with_evidence(
                file,
                "SITEMAP_CHILD_URL",
                CheckStatus::Error,
                "Sitemap reference is not a valid URL",
                "This sitemap loc could not be parsed.",
                "Replace it with an absolute http(s) URL.",
                key,
            )),
        }
    }
}

fn validate_entry(
    file: &SitemapFile,
    entry: &SitemapEntry,
    document: &SitemapDocument,
    seen_urls: &mut Vec<(String, String)>,
    findings: &mut Vec<CheckResult>,
) -> usize {
    let mut added = 0;
    let loc = entry.loc.trim();
    if loc.is_empty() {
        findings.push(file_note(
            file,
            "SITEMAP_LOC_MISSING",
            CheckStatus::Error,
            "Sitemap entry has no loc",
            "A url entry needs one loc element.",
            "Add the absolute page URL, or remove the empty entry.",
        ));
        return 1;
    }
    let parsed = match classify_loc(loc) {
        LocClass::Ok(url) => Some(url),
        LocClass::Relative => {
            findings.push(with_evidence(
                file,
                "SITEMAP_LOC_RELATIVE",
                CheckStatus::Error,
                "Sitemap URL is relative",
                "A sitemap loc must be absolute.",
                "Use the full http(s) URL.",
                loc,
            ));
            added += 1;
            None
        }
        LocClass::Scheme => {
            findings.push(with_evidence(
                file,
                "SITEMAP_LOC_SCHEME",
                CheckStatus::Error,
                "Sitemap URL uses an unsupported scheme",
                "Sitemap locations must be http or https. This is not a statement that the URL was fetched.",
                "Replace the loc with an http(s) URL.",
                loc,
            ));
            added += 1;
            None
        }
        LocClass::Bad => {
            findings.push(with_evidence(
                file,
                "SITEMAP_LOC_MALFORMED",
                CheckStatus::Error,
                "Sitemap URL could not be parsed",
                "This loc is not a valid absolute URL.",
                "Correct the loc value.",
                loc,
            ));
            added += 1;
            None
        }
    };
    if let Some(url) = parsed.as_ref() {
        let key = canonical_key(url);
        if let Some((_, prior)) = seen_urls.iter().find(|(item, _)| item == &key) {
            let mut finding = with_evidence(
                file,
                "SITEMAP_DUPLICATE_URL",
                CheckStatus::Warning,
                "Sitemap lists a URL more than once",
                "The same URL appears in more than one processed entry.",
                "Keep a single entry unless the repetition is intentional.",
                loc,
            );
            finding.evidence.push(evidence("also in", prior.clone()));
            findings.push(finding);
            added += 1;
        } else {
            seen_urls.push((key, file.url.clone()));
        }
        if !same_origin(url, &document.site_origin) {
            findings.push(with_evidence(
                file,
                "SITEMAP_OFF_SITE",
                CheckStatus::Info,
                "Sitemap URL is outside this site",
                "This loc uses a different host from the page being inspected. It was not fetched.",
                "Confirm the URL belongs in this sitemap.",
                loc,
            ));
            added += 1;
        }
    }
    if !entry.lastmod.trim().is_empty() && !valid_lastmod(entry.lastmod.trim()) {
        findings.push(with_evidence(
            file,
            "SITEMAP_LASTMOD",
            CheckStatus::Warning,
            "Sitemap lastmod is not a date",
            "lastmod should be a W3C date or date-time, such as 2026-10-27 or 2026-10-27T00:00:00Z.",
            "Correct the date or remove lastmod.",
            entry.lastmod.trim(),
        ));
        added += 1;
    }
    if !entry.priority.trim().is_empty() && !valid_priority(entry.priority.trim()) {
        findings.push(with_evidence(
            file,
            "SITEMAP_PRIORITY",
            CheckStatus::Info,
            "Sitemap priority is outside 0.0 to 1.0",
            "priority is a legacy field. This note does not say a search engine uses it for ranking.",
            "Use a number from 0.0 to 1.0, or omit priority.",
            entry.priority.trim(),
        ));
        added += 1;
    }
    if !entry.changefreq.trim().is_empty() && !valid_changefreq(entry.changefreq.trim()) {
        findings.push(with_evidence(
            file,
            "SITEMAP_CHANGEFREQ",
            CheckStatus::Info,
            "Sitemap changefreq is not a known value",
            "changefreq is a legacy field. This note does not say a search engine uses it for ranking.",
            "Use always, hourly, daily, weekly, monthly, yearly, or never, or omit it.",
            entry.changefreq.trim(),
        ));
        added += 1;
    }
    added
}

fn note(
    id: &str,
    status: CheckStatus,
    title: &str,
    description: &str,
    recommendation: &str,
    site: &str,
) -> CheckResult {
    let mut finding = support::check(id, Category::Technical, status, 0, title, description);
    finding.recommendation = Some(recommendation.to_string());
    finding.evidence.push(evidence("site", site.to_string()));
    finding
}

fn file_note(
    file: &SitemapFile,
    id: &str,
    status: CheckStatus,
    title: &str,
    description: &str,
    recommendation: &str,
) -> CheckResult {
    with_evidence(
        file,
        id,
        status,
        title,
        description,
        recommendation,
        &file.url,
    )
}

fn with_evidence(
    file: &SitemapFile,
    id: &str,
    status: CheckStatus,
    title: &str,
    description: &str,
    recommendation: &str,
    value: &str,
) -> CheckResult {
    let mut finding = support::check(id, Category::Technical, status, 0, title, description);
    finding.recommendation = Some(recommendation.to_string());
    finding.evidence.push(evidence("sitemap", file.url.clone()));
    if value != file.url {
        finding.evidence.push(evidence("value", value.to_string()));
    }
    finding
}

enum LocClass {
    Ok(Url),
    Relative,
    Scheme,
    Bad,
}

fn classify_loc(value: &str) -> LocClass {
    if value.starts_with('/') || value.starts_with("./") || value.starts_with("../") {
        return LocClass::Relative;
    }
    match Url::parse(value) {
        Ok(url) if url.scheme() == "http" || url.scheme() == "https" => LocClass::Ok(url),
        Ok(_) => LocClass::Scheme,
        Err(_) if !value.contains(':') => LocClass::Relative,
        Err(_) => LocClass::Bad,
    }
}

fn same_origin(url: &Url, origin: &str) -> bool {
    Url::parse(origin).is_ok_and(|site| url.origin() == site.origin())
}

fn same_page(left: &str, right: &str) -> bool {
    let Ok(a) = Url::parse(left) else {
        return false;
    };
    let Ok(b) = Url::parse(right) else {
        return false;
    };
    canonical_key(&a) == canonical_key(&b)
}

fn canonical_key(url: &Url) -> String {
    let path = url.path();
    let path = if path.len() > 1 {
        path.trim_end_matches('/')
    } else {
        path
    };
    format!(
        "{}://{}{}{}{}",
        url.scheme(),
        url.host_str().unwrap_or(""),
        url.port()
            .map(|port| format!(":{port}"))
            .unwrap_or_default(),
        path,
        url.query()
            .map(|query| format!("?{query}"))
            .unwrap_or_default()
    )
}

fn valid_lastmod(value: &str) -> bool {
    let date = value.get(0..10).unwrap_or("");
    let bytes = date.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let Ok(year) = date[0..4].parse::<u16>() else {
        return false;
    };
    let Ok(month) = date[5..7].parse::<u8>() else {
        return false;
    };
    let Ok(day) = date[8..10].parse::<u8>() else {
        return false;
    };
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) || year < 1990 {
        return false;
    }
    if value.len() == 10 {
        return true;
    }
    let rest = &value[10..];
    rest.starts_with('T')
        && rest.len() >= 6
        && rest.as_bytes().get(3) == Some(&b':')
        && (rest.ends_with('Z')
            || rest.contains('+')
            || rest.rfind('-').is_some_and(|index| index > 0))
}

fn valid_priority(value: &str) -> bool {
    value
        .parse::<f32>()
        .is_ok_and(|number| (0.0..=1.0).contains(&number))
}

fn valid_changefreq(value: &str) -> bool {
    matches!(
        value.to_ascii_lowercase().as_str(),
        "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(kind: &str, entries: Vec<SitemapEntry>, children: Vec<&str>) -> SitemapFile {
        SitemapFile {
            url: "https://example.com/sitemap.xml".to_string(),
            source: "robots".to_string(),
            fetch: "fetched".to_string(),
            kind: kind.to_string(),
            truncated: false,
            entries,
            children: children.into_iter().map(str::to_string).collect(),
        }
    }

    fn entry(loc: &str) -> SitemapEntry {
        SitemapEntry {
            loc: loc.to_string(),
            lastmod: String::new(),
            changefreq: String::new(),
            priority: String::new(),
        }
    }

    fn document(files: Vec<SitemapFile>) -> SitemapDocument {
        SitemapDocument {
            schema_version: 1,
            site_origin: "https://example.com".to_string(),
            page_url: Some("https://example.com/guide".to_string()),
            partial: false,
            files,
        }
    }

    #[test]
    fn reads_a_urlset_and_finds_the_page() {
        let report = analyze(&document(vec![file(
            "urlset",
            vec![entry("https://example.com/guide")],
            vec![],
        )]))
        .unwrap();
        assert_eq!(report.page_match, "found");
        assert_eq!(report.url_count, 1);
        assert!(report.findings.is_empty());
    }

    #[test]
    fn rejects_invalid_xml_and_a_nested_index() {
        let mut nested = file("index", vec![], vec!["https://example.com/more.xml"]);
        nested.source = "child".to_string();
        nested.url = "https://example.com/nested.xml".to_string();
        let mut broken = file("invalid", vec![], vec![]);
        broken.url = "https://example.com/bad.xml".to_string();
        let report = analyze(&document(vec![broken, nested])).unwrap();
        let ids: Vec<_> = report
            .findings
            .iter()
            .map(|item| item.id.as_str())
            .collect();
        assert!(ids.contains(&"SITEMAP_XML_INVALID"));
        assert!(ids.contains(&"SITEMAP_NESTED_INDEX"));
        assert_ne!(report.page_match, "absent");
    }

    #[test]
    fn flags_duplicate_relative_and_bad_dates_without_calling_them_indexed() {
        let mut row = entry("https://example.com/guide");
        row.lastmod = "yesterday".to_string();
        row.priority = "5".to_string();
        row.changefreq = "sometimes".to_string();
        let report = analyze(&document(vec![file(
            "urlset",
            vec![
                row,
                entry("https://example.com/guide"),
                entry("/relative"),
                entry("javascript:alert(1)"),
            ],
            vec![],
        )]))
        .unwrap();
        let ids: Vec<_> = report
            .findings
            .iter()
            .map(|item| item.id.as_str())
            .collect();
        assert!(ids.contains(&"SITEMAP_DUPLICATE_URL"));
        assert!(ids.contains(&"SITEMAP_LOC_RELATIVE"));
        assert!(ids.contains(&"SITEMAP_LOC_SCHEME"));
        assert!(ids.contains(&"SITEMAP_LASTMOD"));
        assert!(ids.contains(&"SITEMAP_PRIORITY"));
        assert!(ids.contains(&"SITEMAP_CHANGEFREQ"));
        assert_eq!(report.page_match, "found");
    }

    #[test]
    fn an_incomplete_read_is_unknown_when_the_page_was_not_seen() {
        let mut doc = document(vec![file(
            "urlset",
            vec![entry("https://example.com/other")],
            vec![],
        )]);
        doc.partial = true;
        let report = analyze(&doc).unwrap();
        assert_eq!(report.page_match, "unknown");
        assert!(report
            .findings
            .iter()
            .any(|item| item.id == "SITEMAP_LIMIT"));
    }

    #[test]
    fn a_complete_urlset_can_say_the_page_is_absent() {
        let report = analyze(&document(vec![file(
            "urlset",
            vec![entry("https://example.com/other")],
            vec![],
        )]))
        .unwrap();
        assert_eq!(report.page_match, "absent");
    }

    #[test]
    fn index_children_must_be_absolute_and_unique() {
        let report = analyze(&document(vec![file(
            "index",
            vec![],
            vec![
                "https://example.com/a.xml",
                "https://example.com/a.xml",
                "/b.xml",
                "https://cdn.example/a.xml",
            ],
        )]))
        .unwrap();
        let ids: Vec<_> = report
            .findings
            .iter()
            .map(|item| item.id.as_str())
            .collect();
        assert!(ids.contains(&"SITEMAP_DUPLICATE_CHILD"));
        assert!(ids.contains(&"SITEMAP_CHILD_URL"));
        assert!(ids.contains(&"SITEMAP_EXTERNAL"));
        assert_eq!(report.page_match, "unknown");
    }

    #[test]
    fn dtd_and_unsupported_roots_are_not_sitemaps() {
        let report = analyze(&document(vec![
            file("dtd", vec![], vec![]),
            file("unknown", vec![], vec![]),
        ]))
        .unwrap();
        let ids: Vec<_> = report
            .findings
            .iter()
            .map(|item| item.id.as_str())
            .collect();
        assert!(ids.contains(&"SITEMAP_DTD"));
        assert!(ids.contains(&"SITEMAP_UNSUPPORTED"));
    }
}
