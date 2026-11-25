import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

// Fixture site only. The rules are made up to exercise each reading.
const robots = [
  "User-agent: GPTBot",
  "Disallow: /",
  "",
  "User-agent: OAI-SearchBot",
  "Allow: /",
  "",
  "User-agent: Claude-SearchBot",
  "Disallow: /guide",
  "",
  "User-agent: __usage_ai-training",
  "Disallow: /",
  "",
  "User-agent: *",
  "Disallow: /private",
].join("\n");

test("AI & Search reads robots.txt, robots meta, and X-Robots-Tag per crawler", async () => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    requests.push(path);
    if (path === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(robots);
      return;
    }
    if (path === "/guide") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "bingbot: ai-grounding:disallowextended",
      });
      response.end(
        `<!doctype html><html lang="en"><head><title>Guide</title>
          <meta name="robots" content="max-snippet:80">
          <meta name="googlebot" content="nosnippet">
          <meta name="bingbot" content="ai-training:disallow">
          </head><body><h1>Guide</h1><p>Sample page.</p></body></html>`,
      );
      return;
    }
    response.writeHead(404, { "content-type": "text/html" });
    response.end("<!doctype html><title>Missing</title>");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-access-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`${origin}/guide`);
    const pageId = await tabId(worker, `${origin}/guide`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 900 });
    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}&section=ai-search`,
    );
    await expect(report.getByRole("heading", { name: "AI & Search", exact: true })).toBeVisible();
    await expect(
      report
        .getByRole("navigation", { name: "AI & Search views" })
        .getByRole("button", { name: "Crawler access" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(report.getByText("No check yet")).toBeVisible();
    requests.length = 0;
    await report.getByRole("button", { name: "Check access" }).click();
    await expect(report.getByText("Path checked: /guide")).toBeVisible({ timeout: 20_000 });
    // One robots.txt and one page request; nothing else.
    expect(requests.sort()).toEqual(["/guide", "/robots.txt"]);

    const card = (name: string) =>
      report
        .locator(".ax-card")
        .filter({ has: report.getByRole("heading", { name, exact: true }) });
    await expect(card("Google Search")).toContainText("Allowed by robots.txt");
    await expect(card("ChatGPT search")).toContainText("Allowed by robots.txt");
    await expect(card("Claude")).toContainText("Disallowed by robots.txt");
    await expect(card("Yahoo Search")).toContainText("Not supported");

    const claude = card("Claude");
    await claude.getByText("Evidence").click();
    await expect(claude.locator("dd").filter({ hasText: "Disallow: /guide" })).toBeVisible();
    const google = card("Google Search");
    await google.getByText("Evidence").click();
    await expect(google).toContainText("nosnippet (meta googlebot)");
    await expect(google).toContainText("max-snippet:80 (meta robots)");

    const use = report.locator(".ax-use li");
    await expect(use.filter({ hasText: "GPTBot" })).toContainText("Disallowed by robots.txt");
    await expect(use.filter({ hasText: "__usage_ai-training" })).toContainText("Use restricted");
    const ms = report.locator(".ax-ms");
    await expect(ms).toContainText("disallow (meta bingbot)");
    await expect(ms).toContainText("disallowextended (X-Robots-Tag (bingbot))");
    await expect(ms).toContainText("1 February 2027");

    const shots = "test-results";
    await report.screenshot({ path: `${shots}/ai-search-1280.png`, fullPage: true });
    await report
      .locator(".ax-section")
      .first()
      .screenshot({ path: `${shots}/ai-search-cards.png` });
    await report
      .locator(".ax-section")
      .nth(2)
      .screenshot({ path: `${shots}/ai-search-use.png` });
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await report
      .locator(".ax-section")
      .nth(1)
      .screenshot({ path: `${shots}/ai-search-dark.png` });
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    for (const width of [1024, 768, 390]) {
      await report.setViewportSize({ width, height: 900 });
      expect(await overflows(report)).toBe(false);
    }
    await report.screenshot({ path: `${shots}/ai-search-390.png` });

    const sidebar = await context.newPage();
    await sidebar.setViewportSize({ width: 350, height: 700 });
    await sidebar.goto(
      `chrome-extension://${extensionId}/sidepanel.html?tabId=${pageId}&section=ai-search`,
    );
    await expect(sidebar.getByRole("button", { name: "Check access" })).toBeVisible();
    expect(await overflows(sidebar)).toBe(false);
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

async function extensionCopy() {
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-access-ext-"));
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
