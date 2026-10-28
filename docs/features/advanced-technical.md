# Advanced technical SEO

These checks live in the existing Technical, Schema, International, and Images sections. There is no new destination and no second score.

## Fetched HTML and the rendered page

**Compare HTML** is in Technical, in the report and the sidebar. The popup does not fetch HTML.

The comparison uses two sources:

- **Rendered DOM.** The page snapshot RankMiso already collected.
- **Separately fetched HTML.** A new request the user starts, or an HTML file the user chooses.

The fetched response is not the original navigation response. Cookies, cache, headers, authentication, and personalization can make it different. A difference is not proof that JavaScript changed the page.

Chromium asks for that origin, then requests the page with cookies omitted, `http` or `https` only, and redirects that stay on the same host. A redirect onto another host, or onto a different private address, stops the comparison. The response must look like HTML, stay under 512 KB, and finish within 8 seconds. The HTML is not saved, and it is not written into history.

Firefox does not make that request. Both builds can compare an HTML file you choose. The file stays in the browser for that comparison and is not stored.

Compared fields are title, description, canonical, robots, Googlebot, Bingbot, language, hreflang, H1 count, H1 text, JSON-LD, Microdata, RDFa, and internal and external link counts. Each row is Same, Added after rendering, Removed after rendering, or Changed. The response text is not shown.

## Structured data

Schema still lists JSON-LD with the existing structured and raw views. Microdata and RDFa are additional blocks from the rendered page.

Microdata reads `itemscope`, `itemtype`, `itemprop`, `itemid`, and `itemref`, including a nested item. A property uses the Microdata value when the element provides one (`content`, `href`, `src`, `datetime`, or a form value) and otherwise uses its text. A self-reference and a one-step cycle stop. The reader keeps 40 items, 12 properties, and 6 levels.

RDFa here is a bounded subset: `vocab`, `prefix`, `typeof`, `property`, `about`, `resource`, `href`, `src`, and `content`. `rel` is copied only when `href` is present. `rev` is not read. `datatype` is not applied, so the value stays the literal text. This is not a complete RDFa processor and not a rich-result test.

The same name in two formats stays two items. Extraction success is an informational finding. It does not change the JSON-LD score and does not claim Google rich-result eligibility. The Rich Results Test link stays.

## Indexability and canonicals

Technical lists the signals that were observed: meta robots, Googlebot, Bingbot, canonical declarations, the navigation status when the browser exposed it, and meta refresh. Google index status stays **Unknown**. `X-Robots-Tag` stays **Not checked** until the optional header request collected it.

A canonical is a declared preference. It is not Google's selected canonical. A relative canonical or a fragment is an informational finding. Multiple canonicals stay a warning. These observations do not change the existing score weights.

## Redirects and hreflang

Redirect hops still come from the optional Chromium site check, up to the existing five-hop budget. Navigation timing still supplies the status and redirect count for the page you opened. A meta refresh is reported from the snapshot. A text pattern such as `window.location` is not treated as an executed redirect.

Hreflang return links are requested only for the same host, and only when that check runs. Another host says the return link was not checked. A failed fetch is not called a missing return link. Only a page that was fetched and did not point back counts as missing.

## Images

Each image row shows the alt state, the address, and the sizes the browser already exposed: intrinsic size, displayed size, `loading`, `decoding`, and `sizes`. RankMiso does not download the image to measure it. A failed load stays a warning. Empty alt stays informational, because a decorative image may use it. A displayed width under half the intrinsic width is an informational note when both widths were measured. It is not a file size.
