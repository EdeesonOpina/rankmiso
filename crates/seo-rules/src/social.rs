use seo_core::{Category, CheckResult, CheckStatus, MetadataView, SocialView};

use crate::support::evidence;

pub fn interpret(metadata_tags: &seo_core::PageSnapshot) -> SocialView {
    SocialView {
        og_title: crate::support::first_property(&metadata_tags.meta, "og:title"),
        og_description: crate::support::first_property(&metadata_tags.meta, "og:description"),
        og_image: crate::support::first_property(&metadata_tags.meta, "og:image"),
        og_url: crate::support::first_property(&metadata_tags.meta, "og:url"),
        og_type: crate::support::first_property(&metadata_tags.meta, "og:type"),
        og_locale: crate::support::first_property(&metadata_tags.meta, "og:locale"),
        twitter_card: crate::support::first_property(&metadata_tags.meta, "twitter:card"),
        twitter_title: crate::support::first_property(&metadata_tags.meta, "twitter:title"),
        twitter_description: crate::support::first_property(
            &metadata_tags.meta,
            "twitter:description",
        ),
        twitter_image: crate::support::first_property(&metadata_tags.meta, "twitter:image"),
    }
}

pub fn checks(metadata: &MetadataView, social: &SocialView) -> Vec<CheckResult> {
    vec![
        field(
            "RULE_OG_TITLE_MISSING",
            "Open Graph title",
            social.og_title.as_deref(),
            metadata.title.as_deref(),
        ),
        field(
            "RULE_OG_DESCRIPTION_MISSING",
            "Open Graph description",
            social.og_description.as_deref(),
            metadata.description.as_deref(),
        ),
        field(
            "RULE_OG_IMAGE_MISSING",
            "Open Graph image",
            social.og_image.as_deref(),
            None,
        ),
        field(
            "RULE_TWITTER_CARD_MISSING",
            "X card type",
            social.twitter_card.as_deref(),
            None,
        ),
    ]
}

fn field(id: &str, label: &str, value: Option<&str>, fallback: Option<&str>) -> CheckResult {
    if value.is_some_and(|item| !item.trim().is_empty()) {
        let mut check = crate::support::check(
            id,
            Category::Social,
            CheckStatus::Pass,
            1,
            &format!("{label} is present"),
            format!("{label} has a value. Platform previews are approximations and may rewrite this text."),
        );
        check
            .evidence
            .push(evidence(label, value.unwrap_or_default().to_string()));
        check
    } else if fallback.is_some_and(|item| !item.trim().is_empty()) {
        let mut check = crate::support::check(
            id,
            Category::Social,
            CheckStatus::Info,
            1,
            &format!("{label} is missing"),
            format!("{label} is empty. Some platforms fall back to the page title or description, and some do not."),
        );
        check.recommendation = Some(format!("Add {label} when this page is meant to be shared."));
        check
    } else {
        let mut check = crate::support::check(
            id,
            Category::Social,
            CheckStatus::Info,
            1,
            &format!("{label} is missing"),
            format!("No {label} was found. Sharing previews may be incomplete."),
        );
        check.recommendation = Some(format!("Add {label} when this page is meant to be shared."));
        check
    }
}
