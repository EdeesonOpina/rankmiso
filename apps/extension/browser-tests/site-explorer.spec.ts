import { createServer, type ServerResponse } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

test("site explorer crawls one host, skips robots, and stops", async () => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  const closedSlowResponses: string[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const origin = `http://127.0.0.1:${(request.socket.localPort ?? 0).toString()}`;
    requests.push(url.pathname);
    if (url.pathname === "/hold") {
      hold(response, () => closedSlowResponses.push(url.pathname));
      return;
    }
    const body = files(origin)[url.pathname];
    if (!body) {
      response.writeHead(url.pathname === "/gone" ? 404 : 404, { "content-type": "text/html" });
      response.end("<!doctype html><title>Missing</title><h1>Missing</h1>");
      return;
    }
    const type = url.pathname.endsWith(".txt")
      ? "text/plain"
      : url.pathname.endsWith(".xml")
        ? "application/xml"
        : "text/html";
    response.writeHead(200, { "content-type": type });
    response.end(body);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await mkdtemp(join(tmpdir(), "rankmiso-site-ext-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-site-profile-"));
  await cp(productExtension, extensionDir, { recursive: true });
  const manifest = JSON.parse(await readFile(join(extensionDir, "manifest.json"), "utf8")) as {
    host_permissions?: string[];
  };
  const product = JSON.parse(await readFile(join(productExtension, "manifest.json"), "utf8")) as {
    host_permissions?: string[];
  };
  expect(product.host_permissions).toBeUndefined();
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(join(extensionDir, "manifest.json"), JSON.stringify(manifest));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`${origin}/`);
    const tab = await tabId(worker, `${origin}/`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 800 });
    await report.goto(`chrome-extension://${extensionId}/dashboard.html?tabId=${tab}&section=site`);
    await expect(report.getByRole("heading", { name: "Site Explorer" })).toBeVisible();
    await report.getByRole("button", { name: "Start crawl" }).click();
    const siteViews = report.getByRole("navigation", { name: "Site Explorer views" });
    await siteViews.getByRole("button", { name: "Overview" }).focus();
    await report.keyboard.press("Tab");
    await expect(siteViews.getByRole("button", { name: "Issues" })).toBeFocused();
    await siteViews.getByRole("button", { name: "Pages" }).click();
    const secret = report.getByRole("button", { name: `${origin}/secret` });
    await expect(secret).toBeVisible({ timeout: 20_000 });
    await report.locator(".crawl-hero").screenshot({ path: "test-results/site-board.png" });
    await secret.click();
    await expect(report.getByText("robots.txt disallows this crawler")).toBeVisible();
    await expect(report.getByText("Alpha page").first()).toBeVisible();
    await expect.poll(() => requests.filter((path) => path === "/hold").length).toBeGreaterThan(0);
    await report.getByRole("button", { name: "Stop" }).click();
    await expect(report.getByText("Stopped", { exact: true })).toBeVisible();
    await expect.poll(() => closedSlowResponses.length).toBeGreaterThan(0);
    await siteViews.getByRole("button", { name: "Overview" }).click();
    await expect(report.getByText("Duplicate page title").first()).toBeVisible();
    await expect(report.getByText(/Partial crawl:/)).toBeVisible();
    await report.screenshot({ path: "test-results/site-overview.png" });
    await siteViews.getByRole("button", { name: "Issues" }).click();
    await expect(report.getByText(/affected pages/).first()).toBeVisible();
    const issueSearch = report.getByLabel("Search issues and affected URLs");
    await issueSearch.fill("/b.html");
    await expect(report.locator(".site-issue").first()).toBeVisible();
    const allIssueBadges = await report
      .locator(".site-issue .finding-type > .badge")
      .allTextContents();
    const expectedErrorCount = allIssueBadges.filter((text) => text.includes("Error")).length;
    await report.getByLabel("Severity filter").selectOption("error");
    const errorBadges = await report
      .locator(".site-issue .finding-type > .badge")
      .allTextContents();
    expect(errorBadges).toHaveLength(expectedErrorCount);
    expect(errorBadges.every((text) => text.includes("Error"))).toBe(true);
    await report.getByLabel("Severity filter").selectOption("all");
    await report.locator(".site-issues select").nth(2).selectOption("name");
    const issueNames = await report.locator(".site-issue h3").allTextContents();
    expect(issueNames).toEqual([...issueNames].sort((left, right) => left.localeCompare(right)));
    const firstIssue = report.locator(".site-issue").first();
    await firstIssue.locator("summary").click();
    await firstIssue.getByRole("button", { name: `${origin}/b.html` }).click();
    await expect(report.getByText("Alpha page description")).toBeVisible();
    await siteViews.getByRole("button", { name: "Issues" }).click();
    await issueSearch.fill("/b.html");
    await issueSearch.fill("no matching URL");
    await expect(report.getByText("No matching findings in this crawl.")).toBeVisible();
    await issueSearch.fill("");
    await siteViews.getByRole("button", { name: "Links" }).click();
    await expect(report.getByText("Few incoming links observed")).toBeVisible();
    await siteViews.getByRole("button", { name: "Pages" }).click();
    await report.getByLabel("Search pages").fill("a.html");
    await report.getByRole("button", { name: `${origin}/a.html` }).click();
    await expect(report.getByText("Alpha page description")).toBeVisible();
    const downloadPromise = report.waitForEvent("download");
    await report.getByRole("button", { name: "Export CSV" }).click();
    const pageCsv = await downloadPromise;
    expect(pageCsv.suggestedFilename()).toContain(".csv");
    expect(await readFile(await pageCsv.path(), "utf8")).toMatch(
      /^"url","finalUrl","status","title","description","canonical","robots","indexability","issues","skipped","error","internalLinks"/,
    );
    const analysisDownload = report.waitForEvent("download");
    await report.getByRole("button", { name: "Export Site Analysis CSV" }).click();
    expect((await analysisDownload).suggestedFilename()).toContain("-analysis.csv");
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await report.screenshot({ path: "test-results/site-explorer.png" });

    await report.evaluate((siteOrigin) => {
      const pages = Array.from({ length: 100 }, (_, pageIndex) => {
        const internalLinks = Array.from(
          { length: 200 },
          (_unused, linkIndex) => `${siteOrigin}/p/${(pageIndex + linkIndex + 1) % 100}`,
        );
        return {
          url: `${siteOrigin}/p/${pageIndex}`,
          finalUrl: `${siteOrigin}/p/${pageIndex}`,
          status: 200,
          contentType: "text/html",
          title: `Synthetic title ${pageIndex % 10}`,
          titleState: "present",
          description: `Synthetic description ${pageIndex % 5}`,
          descriptionState: "present",
          canonical: "",
          canonicalCount: 0,
          robots: "",
          h1Count: 1,
          analyzed: true,
          internalLinks,
          internalLinkDetails: internalLinks.map((url, linkIndex) => ({
            url,
            rel: linkIndex % 2 ? ["nofollow"] : [],
            anchorText: `Synthetic link ${linkIndex}`,
            target: "",
          })),
          internalLinksTruncated: false,
          externalLinks: 0,
          imageCount: 0,
          imagesMissingAlt: 0,
          structuredDataCount: 0,
          structuredDataTruncated: false,
          indexability: "unknown",
          issues: [],
          findings: [],
          error: "",
          skipped: "",
          redirectHops: [],
          fromSitemap: false,
          depth: 1,
        };
      });
      localStorage.setItem(
        "rankmiso.siteCrawl",
        JSON.stringify({
          id: "m9-memory-fixture",
          startUrl: `${siteOrigin}/`,
          origin: siteOrigin,
          scope: "This host only",
          status: "complete",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          partial: true,
          robots: "read",
          sitemap: "empty",
          sitemapUrls: 0,
          discoveredCount: 100,
          pageLimit: 100,
          depthLimit: 3,
          limitsReached: ["pages"],
          findingCatalog: [],
          pages,
          duplicates: [],
          orphans: [],
          note: "Synthetic memory measurement fixture.",
        }),
      );
    }, origin);
    const siteExplorerHeapSamples: number[] = [];
    await report.reload();
    const heapProfiler = await context.newCDPSession(report);
    await heapProfiler.send("HeapProfiler.enable");
    for (let sample = 0; sample < 5; sample += 1) {
      if (sample > 0) await report.reload();
      await expect(report.getByText("100 / 100")).toBeVisible();
      await report.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await heapProfiler.send("HeapProfiler.collectGarbage");
      const heap = await report.evaluate(async () => {
        const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } })
          .memory;
        return memory?.usedJSHeapSize ?? null;
      });
      expect(heap).not.toBeNull();
      siteExplorerHeapSamples.push(heap!);
    }
    siteExplorerHeapSamples.sort((left, right) => left - right);
    console.info(
      `100-page / 20k-link Site Explorer Chromium ${context.browser()?.version()} JS heap bytes: median=${siteExplorerHeapSamples[2]}, range=${siteExplorerHeapSamples[0]}–${siteExplorerHeapSamples[4]} (n=5)`,
    );
    await heapProfiler.detach();

    await report.setViewportSize({ width: 360, height: 640 });
    expect(
      await report.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);

    const priorSlowCount = requests.filter((path) => path === "/hold").length;
    await report.getByRole("button", { name: "Start crawl" }).click();
    await expect
      .poll(() => requests.filter((path) => path === "/hold").length)
      .toBeGreaterThan(priorSlowCount);
    const priorClosedCount = closedSlowResponses.length;
    await report.close();
    await expect.poll(() => closedSlowResponses.length).toBeGreaterThan(priorClosedCount);
    await page.close();
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionDir, { recursive: true, force: true });
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});

function files(origin: string): Record<string, string> {
  const page = (title: string, body: string) =>
    `<!doctype html><html lang="en"><head><title>${title}</title><meta name="description" content="${title} description"></head><body><h1>${title}</h1>${body}</body></html>`;
  return {
    "/robots.txt": `User-agent: *\nDisallow: /secret\nSitemap: ${origin}/sitemap.xml\n`,
    "/sitemap.xml": `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/a.html</loc></url><url><loc>${origin}/secret</loc></url></urlset>`,
    "/": page(
      "Home",
      `<a href="/a.html">Alpha</a><a href="/b.html">Beta</a><a href="/gone">Gone</a><a href="/secret">Secret</a><a href="/hold">Hold</a><a href="https://example.com/out">Out</a>`,
    ),
    "/a.html": page("Alpha page", `<a href="/b.html">Beta</a>`),
    "/b.html": page("Alpha page", ""),
    "/secret": page("Secret", ""),
  };
}

function hold(response: ServerResponse, onClientClose: () => void) {
  const timer = setTimeout(() => {
    try {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<!doctype html><title>Hold</title>");
    } catch {
      // The crawl stopped and the socket closed.
    }
  }, 20_000);
  response.on("close", () => {
    clearTimeout(timer);
    if (!response.writableEnded) onClientClose();
  });
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
