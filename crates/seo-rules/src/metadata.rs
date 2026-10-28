use seo_core::{Category, CheckResult, CheckStatus, MetadataView, PageSnapshot};

use crate::support::{
    bounded_evidence, directives, displayed_title, estimate_pixels, evidence, first_meta,
    first_property, has_noindex, meta_by_name, normalize_ws, reference, rel_links, resolve_http,
    TITLE_PIXEL_BASIS,
};

pub const TITLE_SHORT: usize = 15;
pub const TITLE_LONG: usize = 60;
pub const DESCRIPTION_SHORT: usize = 50;
pub const DESCRIPTION_LONG: usize = 160;

pub fn interpret(snapshot: &PageSnapshot) -> MetadataView {
    let rendered = snapshot
        .titles
        .rendered
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let raw_titles: Vec<String> = snapshot
        .titles
        .elements
        .iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect();
    let title = displayed_title(snapshot);
    let description = first_meta(&snapshot.meta, "description");
    let robots = directives(&meta_by_name(&snapshot.meta, "robots"));
    let googlebot = directives(&meta_by_name(&snapshot.meta, "googlebot"));
    let bingbot = directives(&meta_by_name(&snapshot.meta, "bingbot"));
    let canonicals = rel_links(&snapshot.links_rel, "canonical")
        .into_iter()
        .map(|link| link.href.trim().to_string())
        .filter(|href| !href.is_empty())
        .collect::<Vec<_>>();
    let charset = snapshot
        .meta
        .iter()
        .find_map(|tag| tag.charset.clone())
        .filter(|value| !value.trim().is_empty())
        .or_else(|| first_property(&snapshot.meta, "charset"));
    let refresh = snapshot.meta.iter().find_map(|tag| {
        if tag
            .http_equiv
            .as_deref()
            .is_some_and(|value| value.eq_ignore_ascii_case("refresh"))
        {
            tag.content.clone()
        } else {
            None
        }
    });

    MetadataView {
        title: title.clone(),
        title_source: if rendered.is_some() {
            "rendered".to_string()
        } else if !raw_titles.is_empty() {
            "title-element".to_string()
        } else {
            "missing".to_string()
        },
        title_length: title
            .as_ref()
            .map(|value| value.chars().count() as u32)
            .unwrap_or(0),
        title_pixel_estimate: title.as_deref().map(estimate_pixels).unwrap_or(0),
        title_pixel_basis: TITLE_PIXEL_BASIS.to_string(),
        description_length: description
            .as_ref()
            .map(|value| value.chars().count() as u32)
            .unwrap_or(0),
        description,
        robots,
        googlebot,
        bingbot,
        canonicals,
        charset,
        viewport: first_meta(&snapshot.meta, "viewport"),
        generator: first_meta(&snapshot.meta, "generator"),
        theme_color: first_meta(&snapshot.meta, "theme-color"),
        referrer_policy: first_meta(&snapshot.meta, "referrer"),
        refresh,
        language: snapshot
            .content
            .html_lang
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        content_language: first_property(&snapshot.meta, "content-language")
            .or_else(|| first_meta(&snapshot.meta, "content-language")),
        duplicate_meta: duplicate_names(&snapshot.meta),
        raw_titles,
        rendered_title: rendered,
    }
}

pub fn checks(snapshot: &PageSnapshot, metadata: &MetadataView) -> Vec<CheckResult> {
    vec![
        title_present(metadata),
        title_length(metadata),
        title_rendered_difference(metadata),
        duplicate_title(metadata),
        description_present(metadata),
        description_length(metadata),
        duplicate_description(metadata),
        noindex(metadata),
        robots_conflict(metadata),
        viewport(metadata),
        charset(metadata),
        refresh(metadata),
    ]
    .into_iter()
    .chain(canonical_checks(snapshot, metadata))
    .collect()
}

fn title_present(metadata: &MetadataView) -> CheckResult {
    let mut check = if metadata.title.is_none() {
        let mut check = crate::support::check(
            "RULE_META_TITLE_MISSING",
            Category::Metadata,
            CheckStatus::Error,
            2,
            "Title is missing",
            "The page has no rendered title and no title element with text. Search engines may invent a title from other page content.",
        );
        check.recommendation = Some(
            "Add one descriptive title element that states the page topic in plain language."
                .to_string(),
        );
        check
    } else {
        crate::support::check(
            "RULE_META_TITLE_MISSING",
            Category::Metadata,
            CheckStatus::Pass,
            2,
            "Title is present",
            "A non-empty title is available.",
        )
    };
    if let Some(title) = &metadata.title {
        check.evidence.push(evidence("title", title.clone()));
    }
    check.references.push(reference(
        "Google title links",
        "https://developers.google.com/search/docs/appearance/title-link",
    ));
    check
}

fn title_length(metadata: &MetadataView) -> CheckResult {
    let Some(title) = &metadata.title else {
        return crate::support::check(
            "RULE_META_TITLE_LENGTH",
            Category::Metadata,
            CheckStatus::NotApplicable,
            1,
            "Title length was not evaluated",
            "There is no title to measure.",
        );
    };
    let length = title.chars().count();
    let mut check = if !(TITLE_SHORT..=TITLE_LONG).contains(&length) {
        let mut check = crate::support::check(
            "RULE_META_TITLE_LENGTH",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Title length is outside the usual display range",
            format!(
                "The title is {length} characters. A range of {TITLE_SHORT}–{TITLE_LONG} characters is a common editorial convention for snippets. It is not a confirmed ranking threshold, and search engines may rewrite the title."
            ),
        );
        check.recommendation = Some(
            "Rewrite the title so the main topic is clear in the first words, then check the snippet preview.".to_string(),
        );
        check
    } else {
        crate::support::check(
            "RULE_META_TITLE_LENGTH",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "Title length is in the usual display range",
            format!("The title is {length} characters."),
        )
    };
    check
        .evidence
        .push(evidence("characters", length.to_string()));
    check.evidence.push(evidence(
        "estimated pixels",
        metadata.title_pixel_estimate.to_string(),
    ));
    check.references.push(reference(
        "Google title links",
        "https://developers.google.com/search/docs/appearance/title-link",
    ));
    check
}

fn title_rendered_difference(metadata: &MetadataView) -> CheckResult {
    let raw = metadata.raw_titles.first().map(|value| normalize_ws(value));
    let rendered = metadata
        .rendered_title
        .as_ref()
        .map(|value| normalize_ws(value));
    match (raw, rendered) {
        (Some(raw), Some(rendered)) if raw != rendered => {
            let mut check = crate::support::check(
                "RULE_TITLE_RENDERED_DIFFERS",
                Category::Metadata,
                CheckStatus::Info,
                1,
                "Rendered title differs from the title element",
                "The browser title and the first title element do not match. JavaScript may have changed the title after the initial HTML.",
            );
            check.evidence.push(evidence("title element", raw));
            check.evidence.push(evidence("rendered title", rendered));
            check
        }
        (None, None) => crate::support::check(
            "RULE_TITLE_RENDERED_DIFFERS",
            Category::Metadata,
            CheckStatus::NotApplicable,
            1,
            "No titles were available to compare",
            "Raw and rendered titles were both absent.",
        ),
        _ => crate::support::check(
            "RULE_TITLE_RENDERED_DIFFERS",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "Rendered title matches the title element",
            "No difference was found between the available title sources.",
        ),
    }
}

fn duplicate_title(metadata: &MetadataView) -> CheckResult {
    if metadata.raw_titles.len() > 1 {
        let mut check = crate::support::check(
            "RULE_DUPLICATE_TITLE",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Multiple title elements",
            "More than one title element contains text. Browsers use one title, so the extras add ambiguity.",
        );
        check.evidence = bounded_evidence(&metadata.raw_titles, "title");
        check.recommendation = Some("Keep a single title element.".to_string());
        check
    } else if metadata.raw_titles.is_empty() {
        crate::support::check(
            "RULE_DUPLICATE_TITLE",
            Category::Metadata,
            CheckStatus::NotApplicable,
            1,
            "Duplicate titles were not evaluated",
            "No title elements were collected.",
        )
    } else {
        crate::support::check(
            "RULE_DUPLICATE_TITLE",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "One title element",
            "Only one title element with text was found.",
        )
    }
}

fn description_present(metadata: &MetadataView) -> CheckResult {
    if metadata
        .description
        .as_ref()
        .is_none_or(|value| value.trim().is_empty())
    {
        let mut check = crate::support::check(
            "RULE_META_DESCRIPTION_MISSING",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Meta description is missing",
            "No meta description was found. Search engines often write their own snippet from page content. A description is still useful as a suggested snippet.",
        );
        check.recommendation = Some(
            "Add a unique meta description that summarizes the page for a person deciding whether to open it.".to_string(),
        );
        check.references.push(reference(
            "Google snippets",
            "https://developers.google.com/search/docs/appearance/snippet",
        ));
        check
    } else {
        let mut check = crate::support::check(
            "RULE_META_DESCRIPTION_MISSING",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "Meta description is present",
            "A non-empty meta description was found. Search engines may still rewrite the snippet.",
        );
        check.evidence.push(evidence(
            "description",
            metadata.description.clone().unwrap_or_default(),
        ));
        check
    }
}

fn description_length(metadata: &MetadataView) -> CheckResult {
    let Some(description) = &metadata.description else {
        return crate::support::check(
            "RULE_META_DESCRIPTION_LENGTH",
            Category::Metadata,
            CheckStatus::NotApplicable,
            1,
            "Description length was not evaluated",
            "There is no meta description to measure.",
        );
    };
    let length = description.chars().count();
    if !(DESCRIPTION_SHORT..=DESCRIPTION_LONG).contains(&length) {
        let mut check = crate::support::check(
            "RULE_META_DESCRIPTION_LENGTH",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Meta description length is outside the usual display range",
            format!(
                "The description is {length} characters. A range of {DESCRIPTION_SHORT}–{DESCRIPTION_LONG} characters is an editorial convention for snippets, not a confirmed ranking rule."
            ),
        );
        check
            .evidence
            .push(evidence("characters", length.to_string()));
        check.recommendation = Some(
            "Adjust the description so the offer or summary is readable in a search snippet."
                .to_string(),
        );
        check
    } else {
        let mut check = crate::support::check(
            "RULE_META_DESCRIPTION_LENGTH",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "Meta description length is in the usual display range",
            format!("The description is {length} characters."),
        );
        check
            .evidence
            .push(evidence("characters", length.to_string()));
        check
    }
}

fn duplicate_description(metadata: &MetadataView) -> CheckResult {
    if metadata
        .duplicate_meta
        .iter()
        .any(|name| name == "description")
    {
        let mut check = crate::support::check(
            "RULE_DUPLICATE_META_DESCRIPTION",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Duplicate meta descriptions",
            "More than one meta description was found. Crawlers may pick either one.",
        );
        check.recommendation = Some("Leave a single meta description.".to_string());
        check
    } else {
        crate::support::check(
            "RULE_DUPLICATE_META_DESCRIPTION",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "No duplicate meta description",
            "A single description name was found, or the description is absent.",
        )
    }
}

fn noindex(metadata: &MetadataView) -> CheckResult {
    let mut sources = Vec::new();
    if has_noindex(&metadata.robots) {
        sources.push(format!("robots: {}", metadata.robots.join(", ")));
    }
    if has_noindex(&metadata.googlebot) {
        sources.push(format!("googlebot: {}", metadata.googlebot.join(", ")));
    }
    if has_noindex(&metadata.bingbot) {
        sources.push(format!("bingbot: {}", metadata.bingbot.join(", ")));
    }
    if sources.is_empty() {
        crate::support::check(
            "RULE_NOINDEX_DETECTED",
            Category::Metadata,
            CheckStatus::Pass,
            2,
            "No noindex directive in meta tags",
            "Meta robots, googlebot, and bingbot tags do not contain noindex or none. HTTP X-Robots-Tag and robots.txt were not read in this local pass, so this is not a full indexability verdict.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_NOINDEX_DETECTED",
            Category::Metadata,
            CheckStatus::Warning,
            2,
            "Noindex directive detected",
            "A meta robots directive asks at least one crawler not to index this page. That can be intentional. This is not a statement that the page is absent from a search index.",
        );
        check.evidence = bounded_evidence(&sources, "directive");
        check.recommendation = Some(
            "Confirm that this page should stay out of search results. Remove noindex only if the page should be eligible for indexing.".to_string(),
        );
        check.references.push(reference(
            "Robots meta tag",
            "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
        ));
        check
    }
}

fn robots_conflict(metadata: &MetadataView) -> CheckResult {
    let combined = metadata
        .robots
        .iter()
        .chain(metadata.googlebot.iter())
        .chain(metadata.bingbot.iter())
        .cloned()
        .collect::<Vec<_>>();
    let noindex = has_noindex(&combined);
    let index = combined.iter().any(|token| token == "index");
    if noindex && index {
        let mut check = crate::support::check(
            "RULE_ROBOTS_CONFLICT",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Conflicting robots directives",
            "The page sends both an index and a noindex signal. Crawlers may disagree about which one applies.",
        );
        check.recommendation = Some("Keep one clear robots directive.".to_string());
        check
    } else {
        crate::support::check(
            "RULE_ROBOTS_CONFLICT",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "No conflicting index directives",
            "Meta robots directives do not ask for both index and noindex.",
        )
    }
}

fn viewport(metadata: &MetadataView) -> CheckResult {
    if metadata
        .viewport
        .as_ref()
        .is_none_or(|value| value.trim().is_empty())
    {
        let mut check = crate::support::check(
            "RULE_VIEWPORT_MISSING",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Viewport meta tag is missing",
            "Without a viewport tag, mobile browsers may lay the page out as a desktop page.",
        );
        check.recommendation = Some(
            "Add a viewport meta tag, commonly width=device-width, initial-scale=1.".to_string(),
        );
        check
    } else {
        let mut check = crate::support::check(
            "RULE_VIEWPORT_MISSING",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "Viewport meta tag is present",
            "A viewport meta tag was found.",
        );
        check.evidence.push(evidence(
            "viewport",
            metadata.viewport.clone().unwrap_or_default(),
        ));
        check
    }
}

fn charset(metadata: &MetadataView) -> CheckResult {
    if metadata
        .charset
        .as_ref()
        .is_none_or(|value| value.trim().is_empty())
    {
        let mut check = crate::support::check(
            "RULE_CHARSET_MISSING",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Character encoding is not declared in the collected tags",
            "No charset was found on a meta tag. The HTTP Content-Type header may still declare one, and that header was not read in this pass.",
        );
        check.recommendation = Some(
            "Declare UTF-8 early in the document if the response header does not already do so."
                .to_string(),
        );
        check
    } else {
        let mut check = crate::support::check(
            "RULE_CHARSET_MISSING",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "Character encoding is declared",
            "A charset was found in the collected metadata.",
        );
        check.evidence.push(evidence(
            "charset",
            metadata.charset.clone().unwrap_or_default(),
        ));
        check
    }
}

fn canonical_checks(snapshot: &PageSnapshot, metadata: &MetadataView) -> Vec<CheckResult> {
    let canonical_ref = reference(
        "Canonicalization",
        "https://developers.google.com/search/docs/crawling-indexing/canonicalization",
    );
    if metadata.canonicals.is_empty() {
        let mut missing = crate::support::check(
            "RULE_CANONICAL_MISSING",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Canonical link is missing",
            "No rel=canonical link was found. A canonical helps when the same content is available at more than one URL. It is not required for every page.",
        );
        missing.recommendation = Some(
            "Add a canonical link to the preferred URL when this content can be reached more than one way.".to_string(),
        );
        missing.references.push(canonical_ref);
        return vec![
            missing,
            crate::support::check(
                "RULE_CANONICAL_INVALID",
                Category::Metadata,
                CheckStatus::NotApplicable,
                2,
                "Canonical URL was not evaluated",
                "There is no canonical link to validate.",
            ),
            crate::support::check(
                "RULE_CANONICAL_MULTIPLE",
                Category::Metadata,
                CheckStatus::NotApplicable,
                1,
                "Duplicate canonicals were not evaluated",
                "There is no canonical link to compare.",
            ),
            canonical_observation(metadata),
        ];
    }

    let mut missing = crate::support::check(
        "RULE_CANONICAL_MISSING",
        Category::Metadata,
        CheckStatus::Pass,
        1,
        "Canonical link is present",
        "At least one rel=canonical link was found.",
    );
    missing
        .evidence
        .push(evidence("canonical", metadata.canonicals[0].clone()));

    let multiple = if metadata.canonicals.len() > 1 {
        let mut check = crate::support::check(
            "RULE_CANONICAL_MULTIPLE",
            Category::Metadata,
            CheckStatus::Warning,
            1,
            "Multiple canonical links",
            "More than one canonical link was found. Crawlers may ignore the signal when it is inconsistent.",
        );
        check.evidence = bounded_evidence(&metadata.canonicals, "canonical");
        check.recommendation = Some("Keep one canonical link.".to_string());
        check
    } else {
        crate::support::check(
            "RULE_CANONICAL_MULTIPLE",
            Category::Metadata,
            CheckStatus::Pass,
            1,
            "One canonical link",
            "A single canonical link was found.",
        )
    };

    let invalid: Vec<String> = metadata
        .canonicals
        .iter()
        .filter(|href| resolve_http(href, &snapshot.url).is_none())
        .cloned()
        .collect();
    let validity = if invalid.is_empty() {
        let mut check = crate::support::check(
            "RULE_CANONICAL_INVALID",
            Category::Metadata,
            CheckStatus::Pass,
            2,
            "Canonical link is a usable URL",
            "Each canonical href resolves to an http or https URL. This does not prove the target returns a successful response.",
        );
        check
            .evidence
            .push(evidence("canonical", metadata.canonicals[0].clone()));
        check
    } else {
        let mut check = crate::support::check(
            "RULE_CANONICAL_INVALID",
            Category::Metadata,
            CheckStatus::Error,
            2,
            "Canonical link is not a usable HTTP URL",
            "A canonical href could not be resolved to an http or https URL.",
        );
        check.evidence = bounded_evidence(&invalid, "canonical");
        check.recommendation =
            Some("Point rel=canonical at the preferred http or https URL.".to_string());
        check.references.push(canonical_ref);
        check
    };

    vec![missing, validity, multiple, canonical_observation(metadata)]
}

fn canonical_observation(metadata: &MetadataView) -> CheckResult {
    let mut notes = Vec::new();
    for href in &metadata.canonicals {
        if href.contains('#') {
            notes.push(format!("{href} contains a fragment"));
        }
        if !href.contains("://") {
            notes.push(format!("{href} is relative"));
        }
    }
    if notes.is_empty() {
        return crate::support::check(
            "RULE_CANONICAL_OBSERVATION",
            Category::Metadata,
            CheckStatus::NotApplicable,
            1,
            "Canonical shape was not flagged",
            "No fragment or relative canonical was collected. A canonical is a preference, not a search engine's selected URL.",
        );
    }
    let mut check = crate::support::check(
        "RULE_CANONICAL_OBSERVATION",
        Category::Metadata,
        CheckStatus::Info,
        1,
        "Canonical URL needs a closer look",
        "A fragment or a relative reference was collected. A canonical states a preference. It is not Google's selected canonical.",
    );
    check.evidence = bounded_evidence(&notes, "canonical");
    check.recommendation =
        Some("Use one absolute http(s) URL without a fragment when this page should declare a preference.".to_string());
    check
}

fn refresh(metadata: &MetadataView) -> CheckResult {
    if let Some(refresh) = &metadata.refresh {
        let mut check = crate::support::check(
            "RULE_META_REFRESH",
            Category::Technical,
            CheckStatus::Warning,
            1,
            "Meta refresh is present",
            "A meta refresh can redirect people and some crawlers. Prefer a server redirect when the page is moving.",
        );
        check.evidence.push(evidence("refresh", refresh.clone()));
        check.recommendation = Some(
            "Replace meta refresh with the appropriate HTTP redirect when a move is intended."
                .to_string(),
        );
        check
    } else {
        crate::support::check(
            "RULE_META_REFRESH",
            Category::Technical,
            CheckStatus::Pass,
            1,
            "No meta refresh",
            "No meta refresh directive was found.",
        )
    }
}

fn duplicate_names(tags: &[seo_core::MetaTag]) -> Vec<String> {
    use std::collections::BTreeMap;
    let mut counts: BTreeMap<String, u32> = BTreeMap::new();
    for tag in tags {
        if let Some(name) = tag
            .name
            .as_ref()
            .map(|value| value.trim().to_ascii_lowercase())
        {
            if !name.is_empty() {
                *counts.entry(name).or_insert(0) += 1;
            }
        }
    }
    counts
        .into_iter()
        .filter_map(|(name, count)| (count > 1).then_some(name))
        .collect()
}
