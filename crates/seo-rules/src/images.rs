use seo_core::{Category, CheckResult, CheckStatus, ImageSnapshot};

use crate::support::{bounded_evidence, evidence};

pub fn checks(images: &[ImageSnapshot]) -> Vec<CheckResult> {
    vec![missing_alt(images), empty_alt(images), broken(images)]
}

fn missing_alt(images: &[ImageSnapshot]) -> CheckResult {
    if images.is_empty() {
        return crate::support::check(
            "RULE_IMAGE_ALT_MISSING",
            Category::Images,
            CheckStatus::NotApplicable,
            2,
            "Image alternatives were not evaluated",
            "No images were collected.",
        );
    }
    let missing: Vec<String> = images
        .iter()
        .filter(|image| !image.alt_present)
        .map(image_label)
        .collect();
    if missing.is_empty() {
        crate::support::check(
            "RULE_IMAGE_ALT_MISSING",
            Category::Images,
            CheckStatus::Pass,
            2,
            "Images have alt attributes",
            "Every collected image includes an alt attribute. An empty alt can still be correct for a decorative image.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_IMAGE_ALT_MISSING",
            Category::Images,
            CheckStatus::Error,
            2,
            "Images missing alt attributes",
            "Some img elements have no alt attribute. An omitted alt is different from an empty alt: assistive technology may announce the file name instead.",
        );
        check.evidence = bounded_evidence(&missing, "image");
        check.recommendation = Some(
            "Add alt text that describes the image, or alt=\"\" when the image is decorative and the surrounding text already conveys the meaning.".to_string(),
        );
        check.references.push(crate::support::reference(
            "Google image SEO",
            "https://developers.google.com/search/docs/appearance/google-images",
        ));
        check
    }
}

fn empty_alt(images: &[ImageSnapshot]) -> CheckResult {
    if images.is_empty() {
        return crate::support::check(
            "RULE_IMAGE_ALT_EMPTY",
            Category::Images,
            CheckStatus::NotApplicable,
            1,
            "Empty alt text was not evaluated",
            "No images were collected.",
        );
    }
    let empty: Vec<String> = images
        .iter()
        .filter(|image| image.alt_present && image.alt_value.trim().is_empty())
        .map(image_label)
        .collect();
    if empty.is_empty() {
        crate::support::check(
            "RULE_IMAGE_ALT_EMPTY",
            Category::Images,
            CheckStatus::Pass,
            1,
            "No empty alt attributes",
            "Collected images with an alt attribute also have alt text.",
        )
    } else {
        let mut check = crate::support::check(
            "RULE_IMAGE_ALT_EMPTY",
            Category::Images,
            CheckStatus::Info,
            1,
            "Images with empty alt text",
            "Empty alt text marks an image as decorative. That is appropriate for some images and a problem when the image carries meaning. This check does not decide which case applies.",
        );
        check.evidence = bounded_evidence(&empty, "image");
        check
    }
}

fn broken(images: &[ImageSnapshot]) -> CheckResult {
    if images.is_empty() {
        return crate::support::check(
            "RULE_IMAGE_BROKEN",
            Category::Images,
            CheckStatus::NotApplicable,
            1,
            "Broken images were not evaluated",
            "No images were collected.",
        );
    }
    let broken: Vec<String> = images
        .iter()
        .filter(|image| image.broken == Some(true))
        .map(image_label)
        .collect();
    let unknown = images.iter().filter(|image| image.broken.is_none()).count();
    if !broken.is_empty() {
        let mut check = crate::support::check(
            "RULE_IMAGE_BROKEN",
            Category::Images,
            CheckStatus::Warning,
            1,
            "Images that failed to display",
            "The browser reported a natural width of zero after the image finished loading. That usually means the image response failed.",
        );
        check.evidence = bounded_evidence(&broken, "image");
        check.recommendation = Some("Repair the image URL or remove the image.".to_string());
        return check;
    }
    if unknown > 0 {
        let mut check = crate::support::check(
            "RULE_IMAGE_BROKEN",
            Category::Images,
            CheckStatus::Unavailable,
            1,
            "Some images could not be verified",
            "At least one image had not finished loading, so a failed image cannot be ruled out. Unverified images are not counted as passed.",
        );
        check
            .evidence
            .push(evidence("unverified", unknown.to_string()));
        check
    } else {
        crate::support::check(
            "RULE_IMAGE_BROKEN",
            Category::Images,
            CheckStatus::Pass,
            1,
            "Collected images loaded",
            "Every collected image reported a non-zero natural width.",
        )
    }
}

fn image_label(image: &ImageSnapshot) -> String {
    image
        .src
        .clone()
        .filter(|src| !src.is_empty())
        .unwrap_or_else(|| image.location.clone())
}
