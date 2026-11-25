# AI answer visibility (M11.7, unreleased)

Where: report and sidebar → AI & Search → **Visibility**.

This is a log of what the user saw, not a tracker that queries AI services. RankMiso never sends questions to ChatGPT, Google, Gemini, Copilot, Claude, Perplexity, or DuckDuckGo, and does not scrape their pages. No official API offers this data without accounts and keys, so nothing automated is shipped. Links open each service's home page.

## Workflow

1. Add a question and the domain to look for (defaults to the inspected site without `www.`), optionally a brand name.
2. Ask the question on a service yourself, then **Record an answer**: service, date seen, pasted answer text, pasted source links (one per line), notes. If nothing is pasted, choose what you saw.
3. The Rust engine (`seo-rules::visibility`, WASM `classify_visibility`, schema 1) classifies the sample.

| Status                      | When                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Cited                       | a pasted link points to the domain or a subdomain (`notexample.com` and `example.com.evil.io` do not count) |
| Mentioned                   | the answer text names the domain or brand as a whole word, without a matching link                          |
| Not observed in this sample | something was pasted and neither was found                                                                  |
| Unknown / chosen outcome    | recorded by hand with nothing pasted (`basis: manual`)                                                      |
| Not measured                | nothing provided                                                                                            |

Link order is shown as "link N in the pasted list": the order in that answer, not a ranking. Duplicate links count once. At most 20,000 characters of answer text and 50 links are read.

Platforms: ChatGPT search, Google AI Overviews, Google AI Mode, Gemini, Microsoft Copilot, Claude, Perplexity, DuckDuckGo AI-assisted answers (`visibilityPlatforms` in `crawlers.config.ts`, linked to the crawler-access platforms).

## Storage

`localStorage` key `rankmiso.aiVisibility`, schema 1, this browser only, never uploaded. Limits: 50 questions, 500 samples, 20 per question and service, 400 KB; the oldest samples are dropped with a notice. Stored answer excerpts are cut to 1,000 characters and notes to 500. Malformed records are dropped on load and reported. Questions and samples can be deleted; deleting a question removes its samples. Export: JSON, and CSV through the shared formatter, which prefixes formula characters.

## Limits

Answers vary with wording, time, place, account, and model, so one sample says nothing about other prompts. Visibility is kept apart from crawler access and content readiness; none of them predicts the others.
