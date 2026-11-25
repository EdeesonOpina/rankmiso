import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

// Fixture page only: deliberately flawed markup.
const page = `<!doctype html><html lang="en"><head><title>Barley miso</title>
<meta name="description" content="Barley miso.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Barley miso",
  "image":"www.example.com/miso.jpg","aggregateRating":{"@type":"AggregateRating","ratingValue":"4,5"}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
  {"@type":"ListItem","name":"Shop","item":"https://example.com/shop"},{"@type":"ListItem","position":2,"name":"Miso"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","@id":"#org","name":"Miso Lab"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","@id":"#org","name":"Miso Labs Ltd",
  "foundingDate":"1/2/2020"}</script>
</head><body><main><h1>Barley miso</h1><p>Aged twelve months.</p></main></body></html>`;

test("structured data checks report flawed markup and feed content readiness", async () => {
  test.setTimeout(120_000);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-sd-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const tab = await context.newPage();
    await tab.goto(`${origin}/product`);
    const id = await tabId(worker, `${origin}/product`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 900 });
    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=schema`,
    );
    const checks = report.locator(".related-checks");
    await expect(checks).toContainText("A Google-listed required property is missing", {
      timeout: 20_000,
    });
    await expect(checks).toContainText("Structured data value types");
    await expect(checks).toContainText("Structured data URLs");
    await expect(checks).toContainText("Duplicate and conflicting entities");
    await expect(report.getByText("not a full Schema.org validator")).toBeVisible();
    await checks
      .locator("button", { hasText: "A Google-listed required property is missing" })
      .click();
    await expect(report.getByText("ListItem 1 is missing position").first()).toBeVisible();
    await expect(
      report.getByText("needs one of review, aggregateRating, or offers").first(),
    ).toHaveCount(0);
    await report.screenshot({
      animations: "disabled",
      path: "test-results/structured-data-issues.png",
    });

    await report.locator('[data-nav="ai-search"]').click();
    await report
      .getByRole("navigation", { name: "AI & Search views" })
      .getByRole("button", { name: "Content readiness" })
      .click();
    const finding = (title: string) =>
      report.locator(".ax-finding").filter({ hasText: title }).first();
    await expect(finding("Structured data value types").locator(".badge")).toHaveText("Review");
    await expect(finding("Structured data value types")).toContainText("open in Issues");
    await expect(finding("Duplicate and conflicting entities").locator(".badge")).toHaveText(
      "Review",
    );
    for (const width of [1024, 390]) {
      await report.setViewportSize({ width, height: 900 });
      expect(await overflows(report)).toBe(false);
    }
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
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-sd-ext-"));
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
