//! Code lists Google documents for hreflang: ISO 639-1 languages and ISO 3166-1 alpha-2 regions.
//! Source: https://developers.google.com/search/docs/specialty/international/localized-versions
//! (read 2026-11-25). Matching is case-insensitive, as Google states.

/// ISO 639-1 two-letter language codes (184, including `bh`).
pub const ISO_639_1: [&str; 184] = [
    "aa", "ab", "ae", "af", "ak", "am", "an", "ar", "as", "av", "ay", "az", "ba", "be", "bg", "bh",
    "bi", "bm", "bn", "bo", "br", "bs", "ca", "ce", "ch", "co", "cr", "cs", "cu", "cv", "cy", "da",
    "de", "dv", "dz", "ee", "el", "en", "eo", "es", "et", "eu", "fa", "ff", "fi", "fj", "fo", "fr",
    "fy", "ga", "gd", "gl", "gn", "gu", "gv", "ha", "he", "hi", "ho", "hr", "ht", "hu", "hy", "hz",
    "ia", "id", "ie", "ig", "ii", "ik", "io", "is", "it", "iu", "ja", "jv", "ka", "kg", "ki", "kj",
    "kk", "kl", "km", "kn", "ko", "kr", "ks", "ku", "kv", "kw", "ky", "la", "lb", "lg", "li", "ln",
    "lo", "lt", "lu", "lv", "mg", "mh", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "na", "nb",
    "nd", "ne", "ng", "nl", "nn", "no", "nr", "nv", "ny", "oc", "oj", "om", "or", "os", "pa", "pi",
    "pl", "ps", "pt", "qu", "rm", "rn", "ro", "ru", "rw", "sa", "sc", "sd", "se", "sg", "si", "sk",
    "sl", "sm", "sn", "so", "sq", "sr", "ss", "st", "su", "sv", "sw", "ta", "te", "tg", "th", "ti",
    "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ty", "ug", "uk", "ur", "uz", "ve", "vi", "vo",
    "wa", "wo", "xh", "yi", "yo", "za", "zh", "zu",
];

/// ISO 3166-1 alpha-2 officially assigned country codes (249).
pub const ISO_3166_1: [&str; 249] = [
    "ad", "ae", "af", "ag", "ai", "al", "am", "ao", "aq", "ar", "as", "at", "au", "aw", "ax", "az",
    "ba", "bb", "bd", "be", "bf", "bg", "bh", "bi", "bj", "bl", "bm", "bn", "bo", "bq", "br", "bs",
    "bt", "bv", "bw", "by", "bz", "ca", "cc", "cd", "cf", "cg", "ch", "ci", "ck", "cl", "cm", "cn",
    "co", "cr", "cu", "cv", "cw", "cx", "cy", "cz", "de", "dj", "dk", "dm", "do", "dz", "ec", "ee",
    "eg", "eh", "er", "es", "et", "fi", "fj", "fk", "fm", "fo", "fr", "ga", "gb", "gd", "ge", "gf",
    "gg", "gh", "gi", "gl", "gm", "gn", "gp", "gq", "gr", "gs", "gt", "gu", "gw", "gy", "hk", "hm",
    "hn", "hr", "ht", "hu", "id", "ie", "il", "im", "in", "io", "iq", "ir", "is", "it", "je", "jm",
    "jo", "jp", "ke", "kg", "kh", "ki", "km", "kn", "kp", "kr", "kw", "ky", "kz", "la", "lb", "lc",
    "li", "lk", "lr", "ls", "lt", "lu", "lv", "ly", "ma", "mc", "md", "me", "mf", "mg", "mh", "mk",
    "ml", "mm", "mn", "mo", "mp", "mq", "mr", "ms", "mt", "mu", "mv", "mw", "mx", "my", "mz", "na",
    "nc", "ne", "nf", "ng", "ni", "nl", "no", "np", "nr", "nu", "nz", "om", "pa", "pe", "pf", "pg",
    "ph", "pk", "pl", "pm", "pn", "pr", "ps", "pt", "pw", "py", "qa", "re", "ro", "rs", "ru", "rw",
    "sa", "sb", "sc", "sd", "se", "sg", "sh", "si", "sj", "sk", "sl", "sm", "sn", "so", "sr", "ss",
    "st", "sv", "sx", "sy", "sz", "tc", "td", "tf", "tg", "th", "tj", "tk", "tl", "tm", "tn", "to",
    "tr", "tt", "tv", "tw", "tz", "ua", "ug", "um", "us", "uy", "uz", "va", "vc", "ve", "vg", "vi",
    "vn", "vu", "wf", "ws", "ye", "yt", "za", "zm", "zw",
];

/// Why an hreflang value is not one Google supports, or `None` when it is.
pub fn hreflang_problem(value: &str) -> Option<&'static str> {
    let value = value.trim().to_ascii_lowercase();
    if value == "x-default" {
        return None;
    }
    let parts: Vec<&str> = value.split('-').collect();
    let language = parts[0];
    if language.is_empty() || parts.iter().any(|part| part.is_empty()) {
        return Some("empty subtag");
    }
    if !ISO_639_1.contains(&language) {
        return Some(if ISO_3166_1.contains(&language) {
            "a region code on its own; Google requires a language first"
        } else {
            "language is not an ISO 639-1 code"
        });
    }
    let mut rest = &parts[1..];
    // Optional ISO 15924 script, four letters (zh-Hant). The shape is checked, not the registry.
    if let Some(script) = rest.first() {
        if script.len() == 4 && script.chars().all(|ch| ch.is_ascii_alphabetic()) {
            rest = &rest[1..];
        }
    }
    match rest {
        [] => None,
        [region] if ISO_3166_1.contains(region) => None,
        [region] if *region == "uk" || *region == "eu" || *region == "un" => Some(
            "reserved region code; Google says it has no effect (use GB for the United Kingdom)",
        ),
        [region] if region.chars().all(|ch| ch.is_ascii_digit()) => {
            Some("numeric region codes such as 419 are not supported")
        }
        [_] => Some("region is not an ISO 3166-1 alpha-2 code"),
        _ => Some("too many subtags"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_have_documented_sizes_and_no_duplicates() {
        let languages: std::collections::BTreeSet<_> = ISO_639_1.iter().collect();
        let regions: std::collections::BTreeSet<_> = ISO_3166_1.iter().collect();
        assert_eq!(languages.len(), 184);
        assert_eq!(regions.len(), 249);
    }

    #[test]
    fn google_examples() {
        for ok in [
            "de",
            "en-GB",
            "en-us",
            "zh-Hant",
            "zh-Hans-US",
            "zh-TW",
            "x-default",
            "ES-mx",
        ] {
            assert_eq!(hreflang_problem(ok), None, "{ok}");
        }
        assert!(
            hreflang_problem("be").is_none(),
            "be is Belarusian, a language"
        );
        assert!(hreflang_problem("us")
            .unwrap()
            .contains("region code on its own"));
        assert!(hreflang_problem("en-UK").unwrap().contains("GB"));
        assert!(hreflang_problem("es-419").unwrap().contains("numeric"));
        assert!(hreflang_problem("en-ZZ").unwrap().contains("ISO 3166-1"));
        assert!(hreflang_problem("english").is_some());
        assert!(hreflang_problem("en-").is_some());
        assert!(hreflang_problem("en-Latn-GB-x").is_some());
    }
}
