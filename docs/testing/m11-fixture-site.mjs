// RankMiso v0.7.1 manual-testing fixture site. No dependencies: `node m11-fixture-site.mjs`.
// Serves made-up pages on http://127.0.0.1:8471 (override with PORT). Fixture content only.
import { createServer } from "node:http";

const port = Number(process.env.PORT || 8471);
const origin = `http://127.0.0.1:${port}`;
const html = (title, head, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;

const robots = [
  "User-agent: GPTBot",
  "Disallow: /",
  "",
  "User-agent: OAI-SearchBot",
  "Disallow: /article",
  "",
  "User-agent: Claude-SearchBot",
  "Disallow: /guide",
  "",
  "User-agent: __usage_ai-training",
  "Disallow: /",
  "",
  "User-agent: *",
  "Allow: /",
].join("\n");

const redirects = {
  "/start": [301, "/step"],
  "/step": [302, "/final"],
  "/loop-a": [301, "/loop-b"],
  "/loop-b": [301, "/loop-a"],
  "/to-missing": [308, "/missing"],
  "/old": [301, "/new"],
  "/leave": [302, "https://example.org/"],
};

const pages = {
  "/": html(
    "RankMiso fixture site",
    `<meta name="description" content="Fixture index."><link rel="canonical" href="${origin}/">`,
    `<main><h1>RankMiso v0.7.1 fixtures</h1><ul>${[
      "/info", "/bare", "/article", "/product", "/contradict", "/spa", "/deep", "/guide",
      "/schema", "/en", "/fr", "/a", "/b", "/c", "/x", "/old", "/missing", "/hidden", "/start",
    ]
      .map((path) => `<li><a href="${path}">${path}</a></li>`)
      .join("")}</ul></main>`,
  ),
  "/info": html(
    "Miso brewing guide",
    `<meta name="description" content="How to brew miso at home."><meta property="og:site_name" content="Miso Lab"><link rel="canonical" href="${origin}/info">`,
    `<main><h1>Miso brewing guide</h1><h2>Ingredients</h2><p>Soybeans, koji, salt.</p><h2>Steps</h2><p>Mix, pack, wait.</p><a href="/article">Read the fermentation article</a></main>`,
  ),
  "/bare": html("", "", `<div><p>Some text without a title or heading.</p></div>`),
  "/article": html(
    "How long does miso ferment",
    `<meta name="description" content="Fermentation times."><meta property="og:type" content="article"><meta property="og:site_name" content="Miso Lab"><link rel="canonical" href="${origin}/article">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"How long does miso ferment","author":{"@type":"Person","name":"Aiko"},"publisher":{"@type":"Organization","name":"Miso Lab"},"datePublished":"2026-03-01","dateModified":"2026-04-02","url":"${origin}/article"}</script>`,
    `<main><article><h1>How long does miso ferment</h1><p>By Aiko</p><h2>Short answer</h2><p>Months.</p><h2>How long does white miso take?</h2><p>Weeks.</p></article></main>`,
  ),
  "/product": html(
    "Barley miso 500 g",
    `<meta name="description" content="Barley miso."><link rel="canonical" href="${origin}/product">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Barley miso 500 g","url":"${origin}/product","offers":{"@type":"Offer","price":"12.50","priceCurrency":"EUR"}}</script>`,
    `<main><h1>Barley miso 500 g</h1><p>Aged twelve months.</p></main>`,
  ),
  "/contradict": html(
    "Miso news",
    `<meta name="description" content="News."><meta property="article:published_time" content="2026-04-30"><meta property="og:site_name" content="Other Brand">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":"Completely different story","datePublished":"2026-05-01","dateModified":"2026-01-01","publisher":{"@type":"Organization","name":"Miso Lab"}}</script>`,
    `<main><h1>Miso news</h1><h2>Read more</h2><p>Text.</p><a href="/info">click here</a></main>`,
  ),
  "/spa": html(
    "Loading",
    `<meta name="description" content="App."><link rel="canonical" href="${origin}/spa">`,
    `<div id="app"></div><script>document.title="Miso app";document.getElementById("app").innerHTML="<main><h1>Miso app</h1><p>Rendered by script.</p><a href='/info'>Guide</a></main>";</script>`,
  ),
  "/deep": html(
    "Deep layout page",
    `<meta name="description" content="Deep.">`,
    `<div><div><div><div><div><div><h1>Deep layout page</h1></div></div></div></div></div></div>`,
  ),
  "/guide": html(
    "Barley miso guide",
    `<meta name="description" content="How barley miso is made."><meta name="robots" content="max-snippet:120"><meta name="googlebot" content="nosnippet"><meta name="bingbot" content="ai-training:disallow, ai-grounding:disallowextended">
     <link rel="canonical" href="${origin}/guide"><link rel="alternate" hreflang="en" href="${origin}/guide"><link rel="alternate" hreflang="en-UK" href="/uk">`,
    `<main><article><h1>Barley miso guide</h1><h2>What you need</h2><p>Barley koji, soybeans, salt.</p><a href="/old">Read more</a></article></main>`,
  ),
  "/schema": html(
    "Barley miso",
    `<meta name="description" content="Barley miso.">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Barley miso","image":"www.example.com/miso.jpg","aggregateRating":{"@type":"AggregateRating","ratingValue":"4,5"}}</script>
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","name":"Shop","item":"${origin}/"},{"@type":"ListItem","position":2,"name":"Miso"}]}</script>
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","@id":"#org","name":"Miso Lab"}</script>
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","@id":"#org","name":"Miso Labs Ltd","foundingDate":"1/2/2020"}</script>`,
    `<main><h1>Barley miso</h1><p>Aged twelve months.</p></main>`,
  ),
  "/en": html(
    "English",
    `<link rel="canonical" href="${origin}/en"><link rel="alternate" hreflang="en" href="${origin}/en"><link rel="alternate" hreflang="fr" href="${origin}/fr"><link rel="alternate" hreflang="x-default" href="${origin}/en">`,
    `<main><h1>English</h1></main>`,
  ),
  "/fr": html(
    "Français",
    `<link rel="canonical" href="${origin}/fr"><link rel="alternate" hreflang="fr" href="${origin}/fr">`,
    `<main><h1>Français</h1></main>`,
  ),
  "/a": html("A", `<link rel="canonical" href="${origin}/old">`, `<main><h1>Canonical to a redirect</h1></main>`),
  "/b": html("B", `<link rel="canonical" href="${origin}/missing">`, `<main><h1>Canonical to a 404</h1></main>`),
  "/c": html("C", `<link rel="canonical" href="${origin}/hidden">`, `<main><h1>Canonical to noindex</h1></main>`),
  "/x": html("X", `<link rel="canonical" href="https://partner.example/x">`, `<main><h1>Cross-host canonical</h1></main>`),
  "/new": html("New", `<link rel="canonical" href="${origin}/new">`, `<main><h1>Redirect target</h1></main>`),
  "/hidden": html("Hidden", `<meta name="robots" content="noindex">`, `<main><h1>Noindex page</h1></main>`),
  "/final": html("Final", `<link rel="canonical" href="${origin}/start">`, `<main><h1>End of the chain</h1></main>`),
};

createServer((request, response) => {
  const path = new URL(request.url || "/", origin).pathname;
  if (path === "/robots.txt") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end(robots);
    return;
  }
  const redirect = redirects[path];
  if (redirect) {
    response.writeHead(redirect[0], { location: redirect[1] });
    response.end();
    return;
  }
  const body = pages[path];
  const headers = { "content-type": "text/html; charset=utf-8" };
  if (path === "/guide") headers["x-robots-tag"] = "gptbot: noindex";
  response.writeHead(body ? 200 : 404, headers);
  response.end(body ?? html("Missing", "", "<h1>404</h1>"));
}).listen(port, "127.0.0.1", () => console.log(`RankMiso fixtures on ${origin}/`));
