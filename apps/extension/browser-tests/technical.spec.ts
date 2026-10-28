import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");
const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

test("rendered page compares with fetched HTML and shows structured data", async () => {
  test.setTimeout(120_000);
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    if (path === "/pixel.gif") {
      response.writeHead(200, { "content-type": "image/gif" });
      response.end(pixel);
      return;
    }
    if (path === "/plain") {
      response.writeHead(302, { location: "/page" });
      response.end();
      return;
    }
    const body = path === "/fr" ? frenchPage() : path === "/page" ? sourcePage() : "";
    response.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
    response.end(body || "<!doctype html><title>Missing</title>");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-technical-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`${origin}/page`);
    await expect(page).toHaveTitle("Rendered title");
    const pageId = await tabId(worker, `${origin}/page`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 900 });
    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}&section=technical`,
    );
    const signals = report.locator("section", {
      has: report.getByRole("heading", { name: "Indexability signals" }),
    });
    await expect(signals.getByText("Google index status")).toBeVisible();
    await expect(signals.getByText("Unknown", { exact: true })).toBeVisible();
    await expect(report.getByText("A separate fetch can differ")).toBeVisible();
    const permitted = await report.evaluate(async () => {
      const chrome = (
        globalThis as unknown as {
          chrome: { permissions: { contains: (query: object) => Promise<boolean> } };
        }
      ).chrome;
      return Promise.race([
        chrome.permissions.contains({ origins: ["http://127.0.0.1/*"] }),
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000)),
      ]);
    });
    expect(permitted).toBe(true);
    await report.getByRole("button", { name: "Compare HTML" }).click({ timeout: 5_000 });
    const compare = report.locator("section", {
      has: report.getByRole("heading", { name: "HTML comparison" }),
    });
    await expect(compare.getByRole("status")).toContainText(
      /Comparison ready|not granted|could not|not HTML|timed out|cancelled|cannot be fetched|larger than|not followed/,
      { timeout: 15_000 },
    );
    await expect(compare.getByText("Source title").first()).toBeVisible();
    await expect(compare.getByText("Rendered title").first()).toBeVisible();
    await expect(compare.getByText("Changed").first()).toBeVisible();
    await expect(compare.getByText("Added after rendering").first()).toBeVisible();
    await report.screenshot({ path: "test-results/technical-compare-1280.png" });

    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}&section=schema`,
    );
    await expect(report.getByText("JSON-LD 1 · Microdata 1 · RDFa 1")).toBeVisible();
    await expect(report.getByRole("heading", { name: "Microdata was extracted" })).toBeVisible();
    await expect(report.getByRole("heading", { name: "RDFa was extracted" })).toBeVisible();
    await report.getByRole("button", { name: "Raw JSON" }).nth(1).click();
    await expect(report.getByText("Local product").first()).toBeVisible();
    await report.screenshot({ path: "test-results/technical-schema-1280.png" });

    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}&section=images`,
    );
    await expect(report.getByText(/Intrinsic/).first()).toBeVisible();
    await expect(report.getByText("Empty alt", { exact: true })).toBeVisible();
    await report.screenshot({ path: "test-results/technical-images-1280.png" });

    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}&section=international`,
    );
    await expect(report.getByText("A return link on another host is not requested.")).toBeVisible();

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 420, height: 720 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${pageId}`);
    await expect(popup.getByRole("heading", { name: "Rendered title" })).toBeVisible();
    await expect(popup.getByRole("button", { name: "Compare HTML" })).toHaveCount(0);
    await popup.screenshot({ path: "test-results/technical-popup-420.png" });

    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}&section=technical`,
    );
    await expect(report.getByRole("heading", { name: "HTML comparison" })).toBeVisible();
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await report.screenshot({ path: "test-results/technical-dark-1280.png" });
    await report.setViewportSize({ width: 768, height: 900 });
    expect(await overflows(report)).toBe(false);
    await report.screenshot({ path: "test-results/technical-768.png" });

    const sidebar = await context.newPage();
    await sidebar.setViewportSize({ width: 350, height: 700 });
    await sidebar.goto(
      `chrome-extension://${extensionId}/sidepanel.html?tabId=${pageId}&section=technical`,
    );
    await expect(sidebar.getByRole("heading", { name: "HTML comparison" })).toBeVisible();
    expect(await overflows(sidebar)).toBe(false);
    await sidebar.screenshot({ path: "test-results/technical-sidebar-350.png", fullPage: true });
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

function sourcePage(): string {
  return `<!doctype html><html lang="en"><head>
    <title>Source title</title>
    <meta name="description" content="Source description">
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="/page">
    <link rel="canonical" href="/other">
    <link rel="alternate" hreflang="en" href="/page">
    <link rel="alternate" hreflang="fr" href="/fr">
    <link rel="alternate" hreflang="de" href="https://example.com/de">
  </head><body>
    <h1>Source heading</h1>
    <div itemscope itemtype="https://schema.org/Product"><span itemprop="name">Local product</span></div>
    <div vocab="https://schema.org/" typeof="Person"><span property="name">Ada</span></div>
    <img src="/pixel.gif" alt="Pixel" width="40" height="20" loading="lazy" decoding="async">
    <img src="/missing.png" alt="">
    <script>
      document.title = "Rendered title";
      document.querySelector('link[rel="canonical"]').setAttribute("href", "/rendered");
      const block = document.createElement("script");
      block.type = "application/ld+json";
      block.textContent = '{"@type":"Article","headline":"Rendered"}';
      document.head.appendChild(block);
    </script>
  </body></html>`;
}

function frenchPage(): string {
  return `<!doctype html><html lang="fr"><head><title>Page française</title>
    <link rel="alternate" hreflang="en" href="/page">
    <link rel="alternate" hreflang="fr" href="/fr">
  </head><body><h1>Page française</h1></body></html>`;
}

async function extensionCopy() {
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-technical-ext-"));
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
