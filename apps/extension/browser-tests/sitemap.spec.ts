import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type BrowserContext, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

const files: Record<string, { type: string; body: string }> = {
  "/page.html": {
    type: "text/html; charset=utf-8",
    body: "<!doctype html><html lang='en'><head><title>Sitemap page</title></head><body><h1>Sitemap page</h1></body></html>",
  },
  "/robots.txt": {
    type: "text/plain",
    body: "User-agent: *\nSitemap: /sitemap.xml\nSitemap: /sitemap_index.xml\n",
  },
  "/sitemap.xml": {
    type: "application/xml",
    body: "<urlset><url><loc>PAGE</loc><lastmod>2026-10-27</lastmod></url></urlset>",
  },
  "/sitemap_index.xml": {
    type: "application/xml",
    body: "<sitemapindex><sitemap><loc>CHILD</loc></sitemap><sitemap><loc>NESTED</loc></sitemap></sitemapindex>",
  },
  "/child.xml": {
    type: "application/xml",
    body: "<urlset><url><loc>https://example.com/from-child</loc></url></urlset>",
  },
  "/nested.xml": {
    type: "application/xml",
    body: "<sitemapindex><sitemap><loc>https://example.com/inner.xml</loc></sitemap></sitemapindex>",
  },
  "/bad.xml": { type: "application/xml", body: "<urlset><url>" },
  "/dupes.xml": {
    type: "application/xml",
    body: "<urlset><url><loc>https://example.com/twice</loc><lastmod>yesterday</lastmod></url><url><loc>https://example.com/twice</loc></url></urlset>",
  },
};

test("sitemap explorer reads a local site and an imported file", async () => {
  test.setTimeout(120_000);
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const file = files[url.pathname];
    if (!file) {
      response.writeHead(404);
      response.end("missing");
      return;
    }
    const origin = `http://127.0.0.1:${(request.socket.localPort ?? 0).toString()}`;
    const body = file.body
      .replaceAll("PAGE", `${origin}/page.html`)
      .replaceAll("CHILD", `${origin}/child.xml`)
      .replaceAll("NESTED", `${origin}/nested.xml`);
    response.writeHead(200, { "content-type": file.type });
    response.end(body);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await mkdtemp(join(tmpdir(), "rankmiso-sitemap-ext-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-sitemap-profile-"));
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
    await page.goto(`${origin}/page.html`);
    const tab = await tabId(context, worker, "/page.html");
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 800 });
    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${tab}&section=sitemaps`,
    );
    await expect(report.getByRole("heading", { name: "Sitemap Explorer" })).toBeVisible();
    await report.getByRole("button", { name: "Discover sitemaps" }).click();
    await expect(report.getByText("This page Found").locator("visible=true")).toBeVisible();
    await report.screenshot({ path: "test-results/audit-sitemaps.png", fullPage: true });
    await expect(
      report.getByText(`${origin}/page.html`).locator("visible=true").first(),
    ).toBeVisible();
    await expect(report.getByText("Sitemap index points at another index")).toBeVisible();
    await report.getByLabel("Sitemap URL").fill(`${origin}/bad.xml`);
    await report.getByRole("button", { name: "Discover sitemaps" }).click();
    await expect(report.getByText("Sitemap XML could not be parsed")).toBeVisible();
    await report.getByLabel("Sitemap URL").fill(`${origin}/dupes.xml`);
    await report.getByRole("button", { name: "Discover sitemaps" }).click();
    await expect(report.getByText("Sitemap lists a URL more than once")).toBeVisible();
    await expect(report.getByText("Sitemap lastmod is not a date")).toBeVisible();
    await report.locator("input.sitemap-file-input").setInputFiles({
      name: "local.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(
        `<urlset><url><loc>${origin}/imported</loc></url><url><loc>&lt;script&gt;alert(1)&lt;/script&gt;</loc></url></urlset>`,
      ),
    });
    await expect(report.getByText(`${origin}/imported`)).toBeVisible();
    await report.setViewportSize({ width: 360, height: 640 });
    expect(
      await report.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
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

async function tabId(context: BrowserContext, worker: Worker, urlPart: string) {
  void context;
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
      found = tabs.find((tab) => tab.url.includes(urlPart))?.id ?? 0;
      return found;
    })
    .toBeGreaterThan(0);
  return found;
}
