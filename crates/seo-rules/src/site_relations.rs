//! Canonical and hreflang relationships across the pages of one Site Explorer crawl.
//!
//! A relationship is judged only when both ends were analyzed in this crawl. A target outside
//! the crawl is counted as not verified, never as missing or broken. Google documents return
//! links, self-listing, fully-qualified alternates, and a same-language canonical for hreflang
//! pages; it does not document what happens when a canonical points to a redirect, an error, or
//! a noindex page, so those findings are reported as observed contradictions, not Google rules.

use std::collections::{BTreeMap, BTreeSet};

use seo_core::{Category, CheckResult, CheckStatus, EngineError};

use crate::support::{self, bounded_evidence, evidence, reference};

pub const RELATIONS_SCHEMA_VERSION: u32 = 1;
const MAX_PAGES: usize = 500;
const MAX_ALTERNATES: usize = 50;
const CANONICAL_DOC: &str =
    "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls";
const HREFLANG_DOC: &str =
    "https://developers.google.com/search/docs/specialty/international/localized-versions";

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationsInput {
    pub schema_version: u32,
    pub origin: String,
    /// The crawl stopped at a limit or was stopped, so some targets were never requested.
    #[serde(default)]
    pub partial: bool,
    pub pages: Vec<RelationPage>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationPage {
    /// The URL the crawl requested.
    pub url: String,
    pub final_url: String,
    #[serde(default)]
    pub status: Option<u16>,
    /// HTML that was parsed. Non-HTML, failed, and skipped pages are not analyzed.
    pub analyzed: bool,
    /// Absolute canonical, or empty when none was declared.
    #[serde(default)]
    pub canonical: String,
    #[serde(default)]
    pub noindex: bool,
    /// Absolute hreflang alternates; `None` when this page's record predates their collection.
    #[serde(default)]
    pub hreflang: Option<Vec<Alternate>>,
    #[serde(default)]
    pub hreflang_truncated: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alternate {
    pub lang: String,
    pub href: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationsReport {
    pub schema_version: u32,
    pub findings: Vec<CheckResult>,
}

pub fn analyze(input: &RelationsInput) -> Result<RelationsReport, EngineError> {
    if input.schema_version != RELATIONS_SCHEMA_VERSION {
        return Err(EngineError::unsupported_schema(input.schema_version));
    }
    let pages = &input.pages[..input.pages.len().min(MAX_PAGES)];
    let site = Site::new(pages, &input.origin);
    let mut findings = canonical_findings(&site);
    findings.extend(hreflang_findings(&site));
    if input.partial {
        for finding in &mut findings {
            finding.evidence.push(evidence(
                "partial crawl",
                "Pages outside this crawl were not requested, so their side is not verified.",
            ));
        }
    }
    Ok(RelationsReport {
        schema_version: RELATIONS_SCHEMA_VERSION,
        findings,
    })
}

fn norm(url: &str) -> Option<String> {
    let mut parsed = url::Url::parse(url.trim()).ok()?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return None;
    }
    parsed.set_fragment(None);
    Some(parsed.to_string())
}

struct Site<'a> {
    pages: &'a [RelationPage],
    /// Requested URL → page.
    by_url: BTreeMap<String, &'a RelationPage>,
    host: Option<String>,
}

impl<'a> Site<'a> {
    fn new(pages: &'a [RelationPage], origin: &str) -> Self {
        let mut by_url = BTreeMap::new();
        for page in pages {
            if let Some(url) = norm(&page.url) {
                by_url.entry(url).or_insert(page);
            }
        }
        Self {
            pages,
            by_url,
            host: support::hostname(origin),
        }
    }

    fn get(&self, url: &str) -> Option<&'a RelationPage> {
        norm(url).and_then(|url| self.by_url.get(&url).copied())
    }

    fn analyzed(&self) -> impl Iterator<Item = &'a RelationPage> {
        self.pages.iter().filter(|page| page.analyzed)
    }
}

fn redirected(page: &RelationPage) -> bool {
    norm(&page.url) != norm(&page.final_url)
}

fn failed(page: &RelationPage) -> bool {
    page.status.is_some_and(|status| status >= 400)
}

/// The page's canonical when it names a URL other than the page itself.
fn elsewhere(page: &RelationPage) -> Option<String> {
    let canonical = norm(&page.canonical)?;
    let own = [norm(&page.url), norm(&page.final_url)];
    (!own.contains(&Some(canonical.clone()))).then_some(canonical)
}

fn rule(
    id: &str,
    title: &str,
    status: CheckStatus,
    description: &str,
    recommendation: Option<&str>,
    doc: &str,
) -> CheckResult {
    let mut check = support::check(id, Category::Technical, status, 0, title, description);
    check.recommendation = recommendation.map(str::to_string);
    check.references.push(reference(
        if doc == CANONICAL_DOC {
            "Google: consolidate duplicate URLs"
        } else {
            "Google: localized versions"
        },
        doc,
    ));
    check
}

/// A finding that lists problem cases, passes when none were found among checked ones, and is
/// not measured when nothing could be checked.
fn listing(
    id: &str,
    title: &str,
    problems: &[String],
    checked: usize,
    found: (CheckStatus, &str, &str),
    clear: &str,
    doc: &str,
) -> CheckResult {
    let mut check = if !problems.is_empty() {
        rule(id, title, found.0, found.1, Some(found.2), doc)
    } else if checked > 0 {
        rule(id, title, CheckStatus::Pass, clear, None, doc)
    } else {
        rule(
            id,
            title,
            CheckStatus::NotApplicable,
            "Nothing in this crawl could be checked for this relationship.",
            None,
            doc,
        )
    };
    check.evidence.extend(bounded_evidence(problems, "case"));
    check
        .evidence
        .push(evidence("checked", checked.to_string()));
    check
}

fn canonical_findings(site: &Site) -> Vec<CheckResult> {
    let mut checked = 0_usize;
    let mut unverified: Vec<String> = Vec::new();
    let (mut to_redirect, mut to_error, mut to_noindex, mut chains, mut others, mut cross) = (
        Vec::new(),
        Vec::new(),
        Vec::new(),
        Vec::new(),
        Vec::new(),
        Vec::new(),
    );
    for page in site.analyzed() {
        let Some(target_url) = elsewhere(page) else {
            continue;
        };
        others.push(format!("{} → {target_url}", page.final_url));
        if support::hostname(&target_url) != site.host {
            cross.push(format!("{} → {target_url}", page.final_url));
            continue;
        }
        // A target the crawl requested but could not read (no status) is not evidence either way.
        let Some(target) = site
            .get(&target_url)
            .filter(|target| target.status.is_some())
        else {
            unverified.push(target_url);
            continue;
        };
        checked += 1;
        let pair = format!("{} → {target_url}", page.final_url);
        if failed(target) {
            to_error.push(format!("{pair} (HTTP {})", target.status.unwrap_or(0)));
        } else if redirected(target) {
            to_redirect.push(format!("{pair} → {}", target.final_url));
        } else if target.analyzed && target.noindex {
            to_noindex.push(pair);
        } else if let Some(next) = target.analyzed.then(|| elsewhere(target)).flatten() {
            chains.push(format!("{pair} → {next}"));
        }
    }
    let declared = site
        .analyzed()
        .filter(|page| norm(&page.canonical).is_some())
        .count();
    let mut coverage = if declared == 0 {
        rule(
            "SITE_CANONICAL_COVERAGE",
            "Canonical relationships in this crawl",
            CheckStatus::NotApplicable,
            "No analyzed page declared a canonical URL.",
            None,
            CANONICAL_DOC,
        )
    } else {
        rule(
            "SITE_CANONICAL_COVERAGE",
            "Canonical relationships in this crawl",
            if unverified.is_empty() {
                CheckStatus::Pass
            } else {
                CheckStatus::Info
            },
            "Canonical targets were matched against the pages this crawl requested. Targets outside the crawl are listed as not verified, not as problems.",
            None,
            CANONICAL_DOC,
        )
    };
    coverage.evidence.push(evidence(
        "pages declaring a canonical",
        declared.to_string(),
    ));
    coverage.evidence.push(evidence(
        "pointing to another URL",
        others.len().to_string(),
    ));
    coverage.evidence.push(evidence(
        "targets checked in this crawl",
        checked.to_string(),
    ));
    coverage
        .evidence
        .extend(bounded_evidence(&unverified, "not verified"));
    vec![
        coverage,
        listing(
            "SITE_CANONICAL_TO_REDIRECT",
            "Canonical points to a redirect",
            &to_redirect,
            checked,
            (
                CheckStatus::Warning,
                "A canonical names a URL that this crawl saw redirect. The canonical and the redirect send different signals about the preferred URL.",
                "Point the canonical at the final URL.",
            ),
            "No checked canonical target redirected.",
            CANONICAL_DOC,
        ),
        listing(
            "SITE_CANONICAL_TO_ERROR",
            "Canonical points to an error page",
            &to_error,
            checked,
            (
                CheckStatus::Warning,
                "A canonical names a URL that returned an HTTP error in this crawl.",
                "Point the canonical at a page that loads.",
            ),
            "No checked canonical target returned an error.",
            CANONICAL_DOC,
        ),
        listing(
            "SITE_CANONICAL_TO_NOINDEX",
            "Canonical points to a noindex page",
            &to_noindex,
            checked,
            (
                CheckStatus::Warning,
                "A canonical names a page that says noindex. The two signals contradict each other.",
                "Decide which page should be indexed and make the canonical and robots meta agree.",
            ),
            "No checked canonical target says noindex.",
            CANONICAL_DOC,
        ),
        listing(
            "SITE_CANONICAL_CHAIN",
            "Canonical chains",
            &chains,
            checked,
            (
                CheckStatus::Warning,
                "A canonical names a page that itself names another canonical.",
                "Point each canonical straight at the final preferred URL.",
            ),
            "No checked canonical target names a further canonical.",
            CANONICAL_DOC,
        ),
        listing(
            "SITE_CANONICAL_CROSS_HOST",
            "Canonical on another host",
            &cross,
            declared,
            (
                CheckStatus::Info,
                "Some pages name a canonical on another host. That can be intended (syndication, a moved site); RankMiso does not request other hosts.",
                "Confirm these pages should defer to the other host.",
            ),
            "Every declared canonical stays on this host.",
            CANONICAL_DOC,
        ),
    ]
}

fn hreflang_findings(site: &Site) -> Vec<CheckResult> {
    let annotated: Vec<&RelationPage> = site
        .analyzed()
        .filter(|page| page.hreflang.as_ref().is_some_and(|list| !list.is_empty()))
        .collect();
    let unknown = site
        .analyzed()
        .filter(|page| page.hreflang.is_none())
        .count();
    let mut coverage = rule(
        "SITE_HREFLANG_COVERAGE",
        "Hreflang relationships in this crawl",
        if annotated.is_empty() {
            CheckStatus::NotApplicable
        } else {
            CheckStatus::Info
        },
        if annotated.is_empty() {
            "No analyzed page declared hreflang alternates."
        } else {
            "Hreflang alternates were matched against the pages this crawl requested. A return link is judged only when both pages were analyzed."
        },
        None,
        HREFLANG_DOC,
    );
    coverage
        .evidence
        .push(evidence("pages with hreflang", annotated.len().to_string()));
    if unknown > 0 {
        coverage.evidence.push(evidence(
            "pages saved before hreflang was recorded",
            unknown.to_string(),
        ));
    }
    if annotated.is_empty() {
        return vec![coverage];
    }

    let (mut checked, mut return_checked, mut unverified) = (0_usize, 0_usize, BTreeSet::new());
    let (mut missing, mut bad_target, mut non_canonical) = (Vec::new(), Vec::new(), Vec::new());
    // Union of URLs connected by hreflang, for conflict and x-default checks per cluster.
    let mut cluster: BTreeMap<String, String> = BTreeMap::new();
    fn root(cluster: &mut BTreeMap<String, String>, url: &str) -> String {
        let mut current = url.to_string();
        while let Some(parent) = cluster.get(&current).cloned() {
            if parent == current {
                break;
            }
            current = parent;
        }
        current
    }
    let mut join = |a: &str, b: &str| {
        cluster
            .entry(a.to_string())
            .or_insert_with(|| a.to_string());
        cluster
            .entry(b.to_string())
            .or_insert_with(|| b.to_string());
        let (ra, rb) = (root(&mut cluster, a), root(&mut cluster, b));
        if ra != rb {
            cluster.insert(ra, rb);
        }
    };
    let mut declarations: Vec<(String, String, String)> = Vec::new();
    for page in &annotated {
        let Some(source) = norm(&page.final_url) else {
            continue;
        };
        let own = [norm(&page.url), norm(&page.final_url)];
        for alternate in page.hreflang.iter().flatten().take(MAX_ALTERNATES) {
            let Some(target_url) = norm(&alternate.href) else {
                continue;
            };
            join(&source, &target_url);
            declarations.push((
                source.clone(),
                alternate.lang.to_ascii_lowercase(),
                target_url.clone(),
            ));
            if own.contains(&Some(target_url.clone())) {
                continue;
            }
            let Some(target) = site
                .get(&target_url)
                .filter(|target| target.status.is_some())
            else {
                unverified.insert(target_url);
                continue;
            };
            checked += 1;
            let pair = format!("{} → {} ({})", page.final_url, target_url, alternate.lang);
            if failed(target) {
                bad_target.push(format!("{pair}: HTTP {}", target.status.unwrap_or(0)));
                continue;
            }
            if redirected(target) {
                bad_target.push(format!("{pair}: redirects to {}", target.final_url));
                continue;
            }
            if !target.analyzed {
                unverified.insert(target_url);
                continue;
            }
            if let Some(canonical) = elsewhere(target) {
                non_canonical.push(format!("{pair}: canonical is {canonical}"));
            }
            if target.hreflang_truncated {
                continue;
            }
            match &target.hreflang {
                None => {
                    unverified.insert(target_url);
                }
                Some(list) => {
                    return_checked += 1;
                    let points_back = list
                        .iter()
                        .filter_map(|back| norm(&back.href))
                        .any(|back| own.contains(&Some(back)));
                    if !points_back {
                        missing.push(pair);
                    }
                }
            }
        }
    }

    let mut by_cluster: BTreeMap<String, BTreeMap<String, BTreeSet<String>>> = BTreeMap::new();
    for (source, lang, target) in &declarations {
        let key = root(&mut cluster, source);
        by_cluster
            .entry(key)
            .or_default()
            .entry(lang.clone())
            .or_default()
            .insert(target.clone());
    }
    let mut conflicts = Vec::new();
    let mut no_default = Vec::new();
    for (key, langs) in &by_cluster {
        for (lang, targets) in langs {
            if targets.len() > 1 {
                conflicts.push(format!(
                    "{lang}: {}",
                    targets.iter().cloned().collect::<Vec<_>>().join(" | ")
                ));
            }
        }
        if langs.len() >= 2 && !langs.contains_key("x-default") {
            no_default.push(key.clone());
        }
    }

    coverage.evidence.push(evidence(
        "alternates checked in this crawl",
        checked.to_string(),
    ));
    let unverified = unverified.into_iter().collect::<Vec<_>>();
    coverage
        .evidence
        .extend(bounded_evidence(&unverified, "not verified"));
    vec![
        coverage,
        listing(
            "SITE_HREFLANG_RETURN",
            "Hreflang return links",
            &missing,
            return_checked,
            (
                CheckStatus::Warning,
                "An alternate page in this crawl does not link back. Google says that if two pages don't both point to each other, the tags are ignored.",
                "Add the missing alternate on the target page, including a link to itself.",
            ),
            "Every checked alternate links back.",
            HREFLANG_DOC,
        ),
        listing(
            "SITE_HREFLANG_TARGET_STATUS",
            "Hreflang targets that redirect or fail",
            &bad_target,
            checked,
            (
                CheckStatus::Warning,
                "An hreflang alternate points to a URL that redirected or returned an error in this crawl.",
                "Point alternates at the final, working URL of each language version.",
            ),
            "No checked alternate redirected or failed.",
            HREFLANG_DOC,
        ),
        listing(
            "SITE_HREFLANG_NON_CANONICAL",
            "Hreflang targets with another canonical",
            &non_canonical,
            checked,
            (
                CheckStatus::Warning,
                "An hreflang alternate names a different canonical. Google asks for a canonical page in the same language when hreflang is used.",
                "Point hreflang at canonical URLs, and keep each language version's canonical on itself.",
            ),
            "Checked alternates are their own canonical.",
            CANONICAL_DOC,
        ),
        listing(
            "SITE_HREFLANG_CONFLICT",
            "Conflicting hreflang targets",
            &conflicts,
            declarations.len(),
            (
                CheckStatus::Warning,
                "Within one group of language versions, the same hreflang value points to different URLs.",
                "Give each language value a single URL across the group.",
            ),
            "Each hreflang value points to one URL within its group.",
            HREFLANG_DOC,
        ),
        listing(
            "SITE_HREFLANG_X_DEFAULT",
            "x-default for language groups",
            &no_default,
            by_cluster.len(),
            (
                CheckStatus::Info,
                "Some language groups have no x-default. It is optional; Google uses it when no other version matches the visitor.",
                "Add x-default if a language selector or fallback page exists.",
            ),
            "Every language group with two or more versions has an x-default.",
            HREFLANG_DOC,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    const O: &str = "https://example.com";

    fn page(path: &str) -> RelationPage {
        RelationPage {
            url: format!("{O}{path}"),
            final_url: format!("{O}{path}"),
            status: Some(200),
            analyzed: true,
            canonical: format!("{O}{path}"),
            noindex: false,
            hreflang: Some(Vec::new()),
            hreflang_truncated: false,
        }
    }

    fn alt(lang: &str, path: &str) -> Alternate {
        Alternate {
            lang: lang.into(),
            href: if path.starts_with("http") {
                path.into()
            } else {
                format!("{O}{path}")
            },
        }
    }

    fn run(pages: Vec<RelationPage>, partial: bool) -> RelationsReport {
        analyze(&RelationsInput {
            schema_version: 1,
            origin: O.into(),
            partial,
            pages,
        })
        .unwrap()
    }

    fn get<'a>(report: &'a RelationsReport, id: &str) -> &'a CheckResult {
        report.findings.iter().find(|f| f.id == id).unwrap()
    }

    #[test]
    fn self_canonical_site_is_clear() {
        let report = run(vec![page("/"), page("/a")], false);
        assert_eq!(
            get(&report, "SITE_CANONICAL_COVERAGE").status,
            CheckStatus::Pass
        );
        assert_eq!(
            get(&report, "SITE_CANONICAL_TO_REDIRECT").status,
            CheckStatus::NotApplicable
        );
        assert_eq!(
            get(&report, "SITE_HREFLANG_COVERAGE").status,
            CheckStatus::NotApplicable
        );
        assert!(report.findings.iter().all(|f| f.weight == 0));
    }

    #[test]
    fn canonical_targets_that_redirect_fail_noindex_or_chain() {
        let mut a = page("/a");
        a.canonical = format!("{O}/old");
        let mut old = page("/old");
        old.final_url = format!("{O}/new");
        let mut b = page("/b");
        b.canonical = format!("{O}/gone");
        let mut gone = page("/gone");
        gone.status = Some(404);
        gone.analyzed = false;
        let mut c = page("/c");
        c.canonical = format!("{O}/hidden");
        let mut hidden = page("/hidden");
        hidden.noindex = true;
        let mut d = page("/d");
        d.canonical = format!("{O}/e");
        let mut e = page("/e");
        e.canonical = format!("{O}/f");
        let report = run(vec![a, old, b, gone, c, hidden, d, e, page("/f")], false);
        assert_eq!(
            get(&report, "SITE_CANONICAL_TO_REDIRECT").status,
            CheckStatus::Warning
        );
        assert_eq!(
            get(&report, "SITE_CANONICAL_TO_ERROR").status,
            CheckStatus::Warning
        );
        assert!(get(&report, "SITE_CANONICAL_TO_ERROR").evidence[0]
            .value
            .contains("404"));
        assert_eq!(
            get(&report, "SITE_CANONICAL_TO_NOINDEX").status,
            CheckStatus::Warning
        );
        assert_eq!(
            get(&report, "SITE_CANONICAL_CHAIN").status,
            CheckStatus::Warning
        );
    }

    #[test]
    fn unreadable_targets_are_not_verified() {
        let mut a = page("/a");
        a.canonical = format!("{O}/old");
        let mut old = page("/old");
        old.status = None;
        old.analyzed = false;
        let report = run(vec![a, old], false);
        assert_eq!(
            get(&report, "SITE_CANONICAL_TO_REDIRECT").status,
            CheckStatus::NotApplicable
        );
        assert_eq!(
            get(&report, "SITE_CANONICAL_COVERAGE").status,
            CheckStatus::Info
        );
    }

    #[test]
    fn cross_host_canonical_is_information_not_an_error() {
        let mut a = page("/a");
        a.canonical = "https://partner.org/a".into();
        let report = run(vec![a], false);
        assert_eq!(
            get(&report, "SITE_CANONICAL_CROSS_HOST").status,
            CheckStatus::Info
        );
        assert_eq!(
            get(&report, "SITE_CANONICAL_TO_ERROR").status,
            CheckStatus::NotApplicable
        );
    }

    #[test]
    fn relative_and_absolute_forms_normalize() {
        let mut a = page("/a");
        a.canonical = format!("{O}:443/a#top");
        let report = run(vec![a], false);
        // Default port and fragment do not make it a different URL.
        assert!(get(&report, "SITE_CANONICAL_COVERAGE")
            .evidence
            .iter()
            .any(|e| e.label == "pointing to another URL" && e.value == "0"));
    }

    #[test]
    fn targets_outside_the_crawl_are_not_verified_not_missing() {
        let mut a = page("/a");
        a.canonical = format!("{O}/elsewhere");
        a.hreflang = Some(vec![alt("en", "/a"), alt("fr", "/fr/a")]);
        let report = run(vec![a], true);
        let coverage = get(&report, "SITE_CANONICAL_COVERAGE");
        assert_eq!(coverage.status, CheckStatus::Info);
        assert!(coverage.evidence.iter().any(|e| e.label == "not verified"));
        assert_eq!(
            get(&report, "SITE_HREFLANG_RETURN").status,
            CheckStatus::NotApplicable
        );
        assert!(get(&report, "SITE_HREFLANG_RETURN")
            .evidence
            .iter()
            .any(|e| e.label == "partial crawl"));
    }

    #[test]
    fn reciprocity_x_default_and_conflicts() {
        let mut en = page("/en");
        en.hreflang = Some(vec![
            alt("en", "/en"),
            alt("fr", "/fr"),
            alt("x-default", "/en"),
        ]);
        let mut fr = page("/fr");
        fr.hreflang = Some(vec![
            alt("fr", "/fr"),
            alt("en", "/en"),
            alt("x-default", "/en"),
        ]);
        let ok = run(vec![en.clone(), fr.clone()], false);
        assert_eq!(get(&ok, "SITE_HREFLANG_RETURN").status, CheckStatus::Pass);
        assert_eq!(
            get(&ok, "SITE_HREFLANG_X_DEFAULT").status,
            CheckStatus::Pass
        );
        assert_eq!(get(&ok, "SITE_HREFLANG_CONFLICT").status, CheckStatus::Pass);

        let mut lonely = fr.clone();
        lonely.hreflang = Some(vec![alt("fr", "/fr"), alt("en", "/en-gb")]);
        let mut en_no_default = en.clone();
        en_no_default.hreflang = Some(vec![alt("en", "/en"), alt("fr", "/fr")]);
        let report = run(vec![en_no_default, lonely], false);
        assert_eq!(
            get(&report, "SITE_HREFLANG_RETURN").status,
            CheckStatus::Warning
        );
        assert_eq!(
            get(&report, "SITE_HREFLANG_CONFLICT").status,
            CheckStatus::Warning
        );
        assert_eq!(
            get(&report, "SITE_HREFLANG_X_DEFAULT").status,
            CheckStatus::Info
        );
    }

    #[test]
    fn hreflang_targets_that_redirect_or_canonicalize_elsewhere() {
        let mut en = page("/en");
        en.hreflang = Some(vec![alt("en", "/en"), alt("de", "/de"), alt("fr", "/fr")]);
        let mut de = page("/de");
        de.final_url = format!("{O}/de/");
        let mut fr = page("/fr");
        fr.canonical = format!("{O}/en");
        fr.hreflang = Some(vec![alt("en", "/en"), alt("fr", "/fr")]);
        let report = run(vec![en, de, fr], false);
        assert_eq!(
            get(&report, "SITE_HREFLANG_TARGET_STATUS").status,
            CheckStatus::Warning
        );
        assert_eq!(
            get(&report, "SITE_HREFLANG_NON_CANONICAL").status,
            CheckStatus::Warning
        );
    }

    #[test]
    fn records_without_hreflang_data_are_unknown_not_missing() {
        let mut en = page("/en");
        en.hreflang = Some(vec![alt("en", "/en"), alt("fr", "/fr")]);
        let mut fr = page("/fr");
        fr.hreflang = None;
        let report = run(vec![en, fr], false);
        assert_eq!(
            get(&report, "SITE_HREFLANG_RETURN").status,
            CheckStatus::NotApplicable
        );
        assert!(get(&report, "SITE_HREFLANG_COVERAGE")
            .evidence
            .iter()
            .any(|e| e.label == "not verified" && e.value.ends_with("/fr")));
    }

    #[test]
    fn rejects_other_versions_and_reads_camel_case() {
        let json = r#"{"schemaVersion":1,"origin":"https://example.com","pages":[
            {"url":"https://example.com/","finalUrl":"https://example.com/","status":200,"analyzed":true,
             "canonical":"https://example.com/","hreflang":[{"lang":"en","href":"https://example.com/"}]}]}"#;
        let input: RelationsInput = serde_json::from_str(json).unwrap();
        assert!(analyze(&input).is_ok());
        assert!(analyze(&RelationsInput {
            schema_version: 2,
            ..input
        })
        .is_err());
    }
}
