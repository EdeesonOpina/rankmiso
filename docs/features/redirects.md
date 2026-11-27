# Redirect intelligence (M11.2, unreleased)

Where: Technical → **Redirect trace** (report and sidebar, Chrome and Firefox). Site Explorer also uses it when redirect details are allowed.

## How a trace works

1. The user enters a URL on the site being inspected (default: the current page) and chooses **Trace redirects**. RankMiso asks for access to that site if it does not have it.
2. Each hop is one `GET` with `redirect: "manual"`, no cookies, no cache, no referrer, 10 s timeout. Browsers hide redirect responses from such fetches. With the optional `webRequest` permission ("Allow redirect details"), RankMiso reads the hop's status and `Location` from the response headers of its own request.
3. The next URL is followed only if it is http(s), on the same origin, and not a private or metadata address. Otherwise the trace stops and says why. At most 10 hops; a repeated URL is a loop.
4. The final page is read up to 512 KB and parsed (never run) for meta refresh and canonical.
5. The Rust engine (`seo-rules::redirects`, WASM `analyze_redirects`, schema 1) turns the trace into findings (weight 0).

Without redirect details, the trace reports that a redirect happened and nothing more; hop findings are "Not measured".

## Findings

| Id                    | Review / Opportunity when                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REDIRECT_LOOP         | a URL repeats (Review)                                                                                                                                                                              |
| REDIRECT_CHAIN        | 3+ hops or the 10-hop limit (Review); 2 hops (Opportunity)                                                                                                                                          |
| REDIRECT_TEMPORARY    | a 302, 303, or 307 hop (Opportunity). Google uses permanent redirects as a canonical signal and temporary ones not.                                                                                 |
| REDIRECT_HTTPS        | an HTTPS → HTTP hop (Review); HTTP → HTTPS passes                                                                                                                                                   |
| REDIRECT_DESTINATION  | final HTTP error (Review); leaves the site (Opportunity, not followed); blocked scheme or private address (Review); timeout, failure, or cancel (Not measured)                                      |
| REDIRECT_CANONICAL    | final page's canonical names a URL from the chain (Review); another URL (Observation)                                                                                                               |
| REDIRECT_META_REFRESH | instant meta refresh on the final page (Review); delayed (Opportunity). Google reads instant ones as permanent, delayed as temporary, and advises them only when server redirects are not possible. |

## Evidence kinds kept apart

- HTTP redirect hops: status and Location read from responses.
- Meta refresh: declared by the final page; never followed.
- Detected but unreadable redirects: reported as such.
- JavaScript redirects: not inferred from page scripts and not measured. Google notes it may not see them if rendering fails.
- The browser's own navigation redirect count stays in the existing `RULE_REDIRECT_CHAIN` page check.

## Site Explorer

When redirect details are already granted, the crawler follows same-origin redirects hop by hop (up to 5, as before) and records the final URL and hops. Canonical and hreflang relationships (M11.3) then see redirected targets. Without the permission, redirected URLs are recorded as unread, as in v0.7.0, with a hint to allow details.

## Limits

- Hops on other origins are not requested, so a chain that leaves the site is shown up to that hop.
- Firefox runtime has not been exercised; the code path is the same.
