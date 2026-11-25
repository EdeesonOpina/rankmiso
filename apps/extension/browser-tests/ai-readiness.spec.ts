import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

// Fixture pages only. Each exercises one readiness scenario.
const pages: Record<string, string> = {
  "/info": `<!doctype html><html lang="en"><head><title>Miso brewing guide</title>
    <meta name="description" content="How to brew miso at home.">
    <meta property="og:site_name" content="Miso Lab"><link rel="canonical" href="/info"></head>
    <body><main><h1>Miso brewing guide</h1><h2>Ingredients</h2><p>Soybeans, koji, salt.</p>
    <h2>Steps</h2><p>Mix, pack, wait.</p><a href="/article">Read the fermentation article</a></main></body></html>`,
  "/bare": `<!doctype html><html><head></head><body><div><p>Some text without a title.</p></div></body></html>`,
  "/article": `<!doctype html><html lang="en"><head><title>How long does miso ferment</title>
    <meta name="description" content="Fermentation times."><meta property="og:type" content="article">
    <meta property="og:site_name" content="Miso Lab"><link rel="canonical" href="/article">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting",
      "headline":"How long does miso ferment","author":{"@type":"Person","name":"Aiko"},
      "publisher":{"@type":"Organization","name":"Miso Lab"},"datePublished":"2026-03-01",
      "dateModified":"2026-04-02","url":"/article"}</script></head>
    <body><main><article><h1>How long does miso ferment</h1><p>By Aiko</p><h2>Short answer</h2>
    <p>Months.</p><h2>How long does white miso take?</h2><p>Weeks.</p></article></main></body></html>`,
  "/product": `<!doctype html><html lang="en"><head><title>Barley miso 500 g</title>
    <meta name="description" content="Barley miso."><link rel="canonical" href="/product">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Barley miso 500 g","url":"/product"}</script>
    </head><body><main><h1>Barley miso 500 g</h1><p>Aged twelve months.</p></main></body></html>`,
  "/contradict": `<!doctype html><html lang="en"><head><title>Miso news</title>
    <meta name="description" content="News."><meta property="article:published_time" content="2026-04-30">
    <meta property="og:site_name" content="Other Brand">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":"Completely different story",
      "datePublished":"2026-05-01","dateModified":"2026-01-01","publisher":{"@type":"Organization","name":"Miso Lab"}}</script>
    </head><body><main><h1>Miso news</h1><h2>Read more</h2><p>Text.</p><a href="/info">click here</a></main></body></html>`,
  "/spa": `<!doctype html><html lang="en"><head><title>Loading</title><meta name="description" content="App.">
    <link rel="canonical" href="/spa"></head><body><div id="app"></div><script>
      document.title = "Miso app";
      document.getElementById("app").innerHTML = "<main><h1>Miso app</h1><p>Rendered by script.</p></main>";
    </script></body></html>`,
  "/deep": `<!doctype html><html lang="en"><head><title>Deep layout page</title><meta name="description" content="Deep."></head>
    <body><div><div><div><div><div><div><h1>Deep layout page</h1></div></div></div></div></div></div></body></html>`,
};

pages["/large"] = `<!doctype html><html lang="en"><head><title>Large page</title>
  <meta name="description" content="Large.">${Array.from(
    { length: 40 },
    (_, i) =>
      `<script type="application/ld+json">{"@type":"Article","headline":"Large page ${i}","author":{"name":"A"}}</script>`,
  ).join("")}</head><body><main><h1>Large page</h1>${Array.from(
    { length: 499 },
    (_, i) => `<h2>Section ${i}</h2><p>Paragraph ${i} with some words.</p>`,
  ).join(
    "",
  )}${Array.from({ length: 2_000 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join("")}</main></body></html>`;

test("content readiness reports real fixture observations per page type", async () => {
  test.setTimeout(180_000);
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    requests.push(path);
    if (path === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(
        "User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n",
      );
      return;
    }
    const body = pages[path];
    response.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
    response.end(body ?? "<!doctype html><title>Missing</title>");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-ready-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 900 });

    const open = async (path: string, section = "ai-search") => {
      const page = await context.newPage();
      await page.goto(`${origin}${path}`);
      const id = await tabId(worker, `${origin}${path}`);
      await report.goto(
        `chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=${section}`,
      );
      return { page, id };
    };
    const readiness = async () => {
      await report
        .getByRole("navigation", { name: "Discoverability views" })
        .getByRole("button", { name: "Content readiness" })
        .click();
      await expect(report.locator(".ax-finding").first()).toBeVisible({ timeout: 20_000 });
    };
    const status = (title: string) =>
      report.locator(".ax-finding").filter({ hasText: title }).first().locator(".badge");

    // 1. Well-structured informational page.
    await open("/info");
    requests.length = 0;
    await readiness();
    await expect(report.getByText("Page type: general page")).toBeVisible();
    await expect(status("Main content region")).toHaveText("No issue observed");
    await expect(status("Title and main heading")).toHaveText("No issue observed");
    await expect(status("Author")).toHaveText("Not applicable");
    // 9. Crawler access and the HTML comparison have not been run: not measured, nothing fetched.
    await expect(status("Search and AI search crawler rules")).toHaveText("Not measured");
    await expect(status("Content before and after JavaScript")).toHaveText("Not measured");
    expect(requests).toEqual([]);

    // Running Check access feeds the readiness result without another request from readiness.
    await report.getByRole("button", { name: "Check crawler access" }).click();
    await report.getByRole("button", { name: "Check access" }).click();
    await expect(report.getByText("Path checked: /info")).toBeVisible({ timeout: 20_000 });
    await readiness();
    await expect(status("Search and AI search crawler rules")).toHaveText("Opportunity");
    await expect(
      report.locator(".ax-finding").filter({ hasText: "Search and AI search crawler rules" }),
    ).toContainText("oai-searchbot");

    // 2. Missing metadata reuses the existing page checks.
    await open("/bare");
    await readiness();
    await expect(status("Title is missing")).toHaveText("Review");
    await expect(
      report.locator(".ax-finding").filter({ hasText: "Title is missing" }),
    ).toContainText("open in Issues");

    // 3. Article with author, dates, and matching markup.
    await open("/article");
    await readiness();
    await expect(report.getByText("Page type: article")).toBeVisible();
    await expect(status("Author")).toHaveText("No issue observed");
    await expect(status("Published and modified dates")).toHaveText("No issue observed");
    await expect(status("Structured data headline matches")).toHaveText("No issue observed");
    await expect(status("Questions and answers")).toHaveText("Observation");
    const shots = "test-results";
    await report.screenshot({
      animations: "disabled",
      path: `${shots}/readiness-article-1280.png`,
    });
    await report
      .locator(".ax-section")
      .nth(3)
      .screenshot({ animations: "disabled", path: `${shots}/readiness-attribution.png` });

    // 4. Product page: no article requirements.
    await open("/product");
    await readiness();
    await expect(report.getByText("Page type: product")).toBeVisible();
    await expect(status("Author")).toHaveText("Not applicable");
    await expect(status("Published and modified dates")).toHaveText("Not applicable");

    // 7 and 8. Contradictory metadata and structured data.
    await open("/contradict");
    await readiness();
    await expect(status("Structured data headline matches")).toHaveText("Review");
    await expect(status("Published and modified dates")).toHaveText("Review");
    await expect(status("Organization names agree")).toHaveText("Opportunity");
    await expect(status("Descriptive headings")).toHaveText("Opportunity");
    await expect(status("Descriptive link text")).toHaveText("Opportunity");
    const dates = report.locator(".ax-finding").filter({ hasText: "Published and modified dates" });
    await dates.getByText("Evidence").click();
    await expect(dates).toContainText("earlier than published");
    await report
      .locator(".ax-section")
      .nth(4)
      .screenshot({ animations: "disabled", path: `${shots}/readiness-sd.png` });
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await report
      .locator(".ax-section")
      .nth(3)
      .screenshot({ animations: "disabled", path: `${shots}/readiness-dark.png` });
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

    // 5 and 6. JavaScript-rendered page: rendering is not measured until the comparison runs.
    await open("/spa");
    await readiness();
    await expect(status("Content before and after JavaScript")).toHaveText("Not measured");
    await report.getByRole("button", { name: "Open HTML comparison" }).click();
    await report.getByRole("button", { name: "Compare HTML" }).click({ timeout: 10_000 });
    await expect(report.locator(".render-findings")).toBeVisible({ timeout: 15_000 });
    // In-app navigation keeps this report page's results; a full reload would not.
    await report.locator('[data-nav="ai-search"]').click();
    await readiness();
    // Title and H1 change but neither is a warning in the comparison: an opportunity to review.
    await expect(status("Content before and after JavaScript")).toHaveText("Opportunity");

    // 10. Partially unavailable observations.
    await open("/deep");
    await readiness();
    await expect(status("Main content region")).toHaveText("Not measured");

    // Large page at the snapshot caps: time from opening the tab to the first finding.
    await open("/large");
    await report.bringToFront();
    const timings: number[] = [];
    for (let sample = 0; sample < 5; sample += 1) {
      await report
        .getByRole("navigation", { name: "Discoverability views" })
        .getByRole("button", { name: "Crawler access" })
        .click();
      // Measured inside the page, from the click to the first rendered finding.
      timings.push(
        await report.evaluate(
          () =>
            new Promise<number>((done) => {
              const nav = document.querySelector('nav[aria-label="Discoverability views"]');
              const button = Array.from(nav?.querySelectorAll("button") ?? []).find(
                (item) => item.getAttribute("aria-label") === "Content readiness",
              );
              const started = performance.now();
              const observer = new MutationObserver(() => {
                if (!document.querySelector(".ax-finding")) return;
                observer.disconnect();
                done(performance.now() - started);
              });
              observer.observe(document.body, { childList: true, subtree: true });
              button?.click();
            }),
        ),
      );
    }
    timings.sort((a, b) => a - b);
    console.log(
      `content readiness on a large page (500 headings, 2,000 links, 40 JSON-LD): median=${Math.round(timings[2]!)} ms, range=${Math.round(timings[0]!)}–${Math.round(timings[4]!)} ms (n=5)`,
    );
    expect(timings[2]).toBeLessThan(500);

    for (const width of [1024, 768, 390]) {
      await report.setViewportSize({ width, height: 900 });
      expect(await overflows(report)).toBe(false);
    }
    await report.screenshot({ animations: "disabled", path: `${shots}/readiness-390.png` });
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionDir, { recursive: true, force: true });
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});

async function extensionCopy() {
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-ready-ext-"));
  await cp(productExtension, dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const product = JSON.parse(await readFile(join(productExtension, "manifest.json"), "utf8")) as {
    host_permissions?: string[];
  };
  expect(product.host_permissions).toBeUndefined();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    host_permissions?: string[];
  };
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  return dir;
}

async function tabId(worker: Worker, pageUrl: string) {
  let found = 0;
  await expect
    .poll(async () => {
      const tabs = await worker.evaluate(async () => {
        const browser = (
          globalThis as unknown as {
            chrome: {
              tabs: { query: (query: object) => Promise<Array<{ id?: number; url?: string }>> };
            };
          }
        ).chrome;
        const all = await browser.tabs.query({});
        return all.map((tab) => ({ id: tab.id ?? 0, url: tab.url ?? "" }));
      });
      found = tabs.find((tab) => tab.url === pageUrl)?.id ?? 0;
      return found;
    })
    .toBeGreaterThan(0);
  return found;
}

async function overflows(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}
