use std::collections::HashMap;

use seo_core::{
    AnalyzeOptions, Category, CheckResult, CheckStatus, ContentMetrics, MetadataView, PageSnapshot,
    TermGroups, TermStat,
};
use unicode_segmentation::UnicodeSegmentation;

use crate::support::normalize_ws;

const READING_WPM: f64 = 200.0;

pub fn metrics(
    snapshot: &PageSnapshot,
    metadata: &MetadataView,
    options: &AnalyzeOptions,
) -> ContentMetrics {
    let text = &snapshot.content.visible_text;
    let character_count = text.chars().count() as u32;
    let non_whitespace_characters = text.chars().filter(|ch| !ch.is_whitespace()).count() as u32;
    let paragraph_count = snapshot.content.paragraph_count;
    let language = metadata.language.as_deref();
    let spaced = uses_whitespace_words(language);

    if !spaced {
        return ContentMetrics {
            word_count: None,
            word_count_method: "unavailable-no-space-segmentation".to_string(),
            character_count,
            non_whitespace_characters,
            sentence_count: None,
            paragraph_count,
            reading_time_minutes: None,
            reading_time_basis:
                "Not estimated because word boundaries were not identified for this language."
                    .to_string(),
            text_to_html_ratio: ratio(character_count, snapshot.content.html_length),
            readability_value: None,
            readability_method: None,
            terms: TermGroups::default(),
        };
    }

    let words = tokenize(text);
    let word_count = words.len() as u32;
    let sentence_count = count_sentences(text);
    let stop = stop_words(options);
    let max_terms = options.max_terms.clamp(1, 50);
    let terms = term_groups(&words, &stop, max_terms, metadata);
    let readability = flesch(&words, sentence_count, language);

    ContentMetrics {
        word_count: Some(word_count),
        word_count_method: if language.is_none() {
            "unicode-word-boundaries-language-undeclared".to_string()
        } else {
            "unicode-word-boundaries".to_string()
        },
        character_count,
        non_whitespace_characters,
        sentence_count,
        paragraph_count,
        reading_time_minutes: if word_count == 0 {
            None
        } else {
            Some((word_count as f64 / READING_WPM * 10.0).round() / 10.0)
        },
        reading_time_basis: "Estimate at 200 words per minute. This is an editorial average, not a measurement of a specific reader.".to_string(),
        text_to_html_ratio: ratio(character_count, snapshot.content.html_length),
        readability_value: readability,
        readability_method: readability.map(|_| {
            "flesch-reading-ease-english-heuristic".to_string()
        }),
        terms,
    }
}

pub fn checks(metrics: &ContentMetrics) -> Vec<CheckResult> {
    vec![thin_content(metrics)]
}

fn thin_content(metrics: &ContentMetrics) -> CheckResult {
    let Some(words) = metrics.word_count else {
        return crate::support::check(
            "RULE_CONTENT_THIN",
            Category::Content,
            CheckStatus::Unavailable,
            1,
            "Word count is unavailable",
            "Visible text was collected, but this language was not segmented into words. A low or high word count is not assumed.",
        );
    };
    if words < 50 {
        let mut check = crate::support::check(
            "RULE_CONTENT_THIN",
            Category::Content,
            CheckStatus::Warning,
            1,
            "Very little visible text",
            format!(
                "{words} words were counted with Unicode word boundaries. Short pages can be complete, especially for tools and navigation. This is not a Google ranking threshold."
            ),
        );
        check.recommendation = Some(
            "Add the explanation a visitor needs, or ignore this warning when the page is intentionally short.".to_string(),
        );
        check
    } else {
        crate::support::check(
            "RULE_CONTENT_THIN",
            Category::Content,
            CheckStatus::Pass,
            1,
            "Visible text is present",
            format!("{words} words were counted. Length alone does not measure quality."),
        )
    }
}

fn uses_whitespace_words(language: Option<&str>) -> bool {
    let Some(language) = language else {
        return true;
    };
    let code = language.to_ascii_lowercase();
    let primary = code.split(['-', '_']).next().unwrap_or(&code);
    !matches!(primary, "zh" | "ja" | "ko" | "th" | "lo" | "km" | "my")
}

fn tokenize(text: &str) -> Vec<String> {
    text.unicode_words()
        .map(|word| word.to_lowercase())
        .filter(|word| word.chars().any(|ch| ch.is_alphanumeric()))
        .collect()
}

fn count_sentences(text: &str) -> Option<u32> {
    let count = text
        .chars()
        .filter(|ch| matches!(ch, '.' | '!' | '?' | '。' | '！' | '？'))
        .count() as u32;
    (count > 0).then_some(count)
}

fn ratio(characters: u32, html_length: u32) -> Option<f64> {
    if html_length == 0 {
        None
    } else {
        Some(((characters as f64) / (html_length as f64) * 1000.0).round() / 1000.0)
    }
}

fn term_groups(
    words: &[String],
    stop: &std::collections::HashSet<String>,
    max_terms: usize,
    metadata: &MetadataView,
) -> TermGroups {
    let title = metadata.title.as_deref().unwrap_or("").to_lowercase();
    let description = metadata.description.as_deref().unwrap_or("").to_lowercase();
    let context = TermContext {
        title: &title,
        headings: "",
        description: &description,
    };
    TermGroups {
        unigrams: top_ngrams(words, 1, stop, true, max_terms, &context),
        bigrams: top_ngrams(words, 2, stop, false, max_terms.min(8), &context),
        trigrams: top_ngrams(words, 3, stop, false, max_terms.min(8), &context),
        fourgrams: top_ngrams(words, 4, stop, false, max_terms.min(8), &context),
    }
}

struct TermContext<'a> {
    title: &'a str,
    headings: &'a str,
    description: &'a str,
}

fn top_ngrams(
    words: &[String],
    size: usize,
    stop: &std::collections::HashSet<String>,
    drop_stop_unigrams: bool,
    limit: usize,
    context: &TermContext<'_>,
) -> Vec<TermStat> {
    if words.len() < size {
        return Vec::new();
    }
    let mut counts: HashMap<String, (u32, usize)> = HashMap::new();
    for (index, window) in words.windows(size).enumerate() {
        if drop_stop_unigrams
            && window
                .iter()
                .all(|word| stop.contains(word) || word.len() < 2)
        {
            continue;
        }
        if !drop_stop_unigrams && window.iter().all(|word| stop.contains(word)) {
            continue;
        }
        let term = window.join(" ");
        let entry = counts.entry(term).or_insert((0, index));
        entry.0 += 1;
        entry.1 = entry.1.min(index);
    }
    let slots = (words.len() - size + 1) as u32;
    let mut rows: Vec<TermStat> = counts
        .into_iter()
        .map(|(term, (count, first))| TermStat {
            in_title: !context.title.is_empty() && context.title.contains(&term),
            in_headings: !context.headings.is_empty() && context.headings.contains(&term),
            in_description: !context.description.is_empty() && context.description.contains(&term),
            density: if slots == 0 {
                None
            } else {
                Some((count as f64 / slots as f64 * 10000.0).round() / 10000.0)
            },
            prominence: if words.is_empty() {
                None
            } else {
                Some((first as f64 / words.len() as f64 * 1000.0).round() / 1000.0)
            },
            term,
            count,
        })
        .collect();
    rows.sort_by(|a, b| b.count.cmp(&a.count).then(a.term.cmp(&b.term)));
    rows.truncate(limit);
    rows
}

pub fn with_headings(metrics: &mut ContentMetrics, headings: &str) {
    let headings = headings.to_lowercase();
    for group in [
        &mut metrics.terms.unigrams,
        &mut metrics.terms.bigrams,
        &mut metrics.terms.trigrams,
        &mut metrics.terms.fourgrams,
    ] {
        for term in group {
            term.in_headings = headings.contains(&term.term);
        }
    }
}

fn flesch(words: &[String], sentences: Option<u32>, language: Option<&str>) -> Option<f64> {
    let english = language.is_some_and(|value| {
        value
            .split(['-', '_'])
            .next()
            .unwrap_or(value)
            .eq_ignore_ascii_case("en")
    });
    if !english {
        return None;
    }
    let sentences = sentences.filter(|count| *count > 0)?;
    if words.is_empty() {
        return None;
    }
    let syllables: u32 = words.iter().map(|word| syllable_estimate(word)).sum();
    let words_per_sentence = words.len() as f64 / sentences as f64;
    let syllables_per_word = syllables as f64 / words.len() as f64;
    let score = 206.835 - (1.015 * words_per_sentence) - (84.6 * syllables_per_word);
    Some((score * 10.0).round() / 10.0)
}

fn syllable_estimate(word: &str) -> u32 {
    let chars: Vec<char> = word.chars().collect();
    if chars.is_empty() || chars.iter().any(|ch| !ch.is_ascii_alphabetic()) {
        return 1;
    }
    let vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
    let mut groups = 0;
    let mut previous = false;
    for ch in &chars {
        let vowel = vowels.contains(ch);
        if vowel && !previous {
            groups += 1;
        }
        previous = vowel;
    }
    if chars.len() > 2 && chars.last() == Some(&'e') && groups > 1 {
        groups -= 1;
    }
    groups.max(1)
}

fn stop_words(options: &AnalyzeOptions) -> std::collections::HashSet<String> {
    let mut words = ENGLISH_STOP
        .iter()
        .map(|word| (*word).to_string())
        .collect::<std::collections::HashSet<_>>();
    for word in &options.extra_stop_words {
        let normalized = normalize_ws(word).to_lowercase();
        if !normalized.is_empty() {
            words.insert(normalized);
        }
    }
    words
}

const ENGLISH_STOP: &[&str] = &[
    "a",
    "about",
    "above",
    "after",
    "again",
    "against",
    "all",
    "am",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "because",
    "been",
    "before",
    "being",
    "below",
    "between",
    "both",
    "but",
    "by",
    "can",
    "did",
    "do",
    "does",
    "doing",
    "down",
    "during",
    "each",
    "few",
    "for",
    "from",
    "further",
    "had",
    "has",
    "have",
    "having",
    "he",
    "her",
    "here",
    "hers",
    "herself",
    "him",
    "himself",
    "his",
    "how",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "itself",
    "just",
    "me",
    "more",
    "most",
    "my",
    "myself",
    "no",
    "nor",
    "not",
    "now",
    "of",
    "off",
    "on",
    "once",
    "only",
    "or",
    "other",
    "our",
    "ours",
    "ourselves",
    "out",
    "over",
    "own",
    "same",
    "she",
    "should",
    "so",
    "some",
    "such",
    "than",
    "that",
    "the",
    "their",
    "theirs",
    "them",
    "themselves",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "to",
    "too",
    "under",
    "until",
    "up",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "whom",
    "why",
    "with",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves",
];
