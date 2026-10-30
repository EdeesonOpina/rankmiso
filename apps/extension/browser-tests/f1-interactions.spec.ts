import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

test("page highlights are reversible and copy actions write the displayed values", async () => {
  test.setTimeout(90_000);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await mkdtemp(join(tmpdir(), "rankmiso-f1-interaction-ext-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-f1-interaction-profile-"));
  await cp(productExtension, extensionDir, { recursive: true });
  const manifestPath = join(extensionDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    host_permissions?: string[];
  };
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, JSON.stringify(manifest));

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.goto(origin);
    const pageId = await tabId(worker, origin);
    const report = await context.newPage();
    report.setDefaultTimeout(5_000);
    await report.goto(`chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}`);
    await expect(report.locator(".top-title")).toContainText("F1 Interaction Fixture");

    const originalStyle = await page.locator("h1[data-page-owner]").getAttribute("style");
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await report.getByRole("button", { name: "Headings", exact: true }).click();
      await report.getByRole("button", { name: "Highlight headings" }).click();
      await expect
        .poll(() => page.locator("h2").first().getAttribute("data-rankmiso-highlight"))
        .toBe("rankmiso:headings");
      if (cycle === 1) {
        expect(
          await page
            .getByRole("heading", { name: "Inserted after extraction" })
            .getAttribute("data-rankmiso-highlight"),
        ).toBe("rankmiso:headings");
      }
      expect(
        await page.locator("h1:not([data-page-owner])").getAttribute("data-rankmiso-highlight"),
      ).toBe("rankmiso:headings");
      expect(
        await page
          .locator("h1[data-page-owner]")
          .evaluate((element) => getComputedStyle(element).outlineStyle),
      ).not.toBe("none");
      expect(await page.locator("h1[data-page-owner]").getAttribute("data-seo-toolkit-mark")).toBe(
        "page-owned",
      );
      await report.getByRole("button", { name: "Clear highlights" }).click();
      await expect
        .poll(() => page.locator("h2").first().getAttribute("data-rankmiso-highlight"))
        .toBeNull();
      expect(await page.locator("h1[data-page-owner]").getAttribute("data-seo-toolkit-mark")).toBe(
        "page-owned",
      );
      expect(await page.locator("h1[data-page-owner]").getAttribute("style")).toBe(originalStyle);
      expect(await page.locator("#seo-toolkit-highlight").count()).toBe(0);
      if (cycle === 0) {
        await page.evaluate(() => {
          const heading = document.createElement("h2");
          heading.textContent = "Inserted after extraction";
          document.body.append(heading);
        });
      }
    }

    await report.getByRole("button", { name: "Links", exact: true }).click();
    await report.locator("summary", { hasText: "External links" }).click();
    await report.getByRole("button", { name: "Highlight external" }).click();
    await expect
      .poll(() =>
        page.locator("a[href^='https://outside.example']").getAttribute("data-rankmiso-highlight"),
      )
      .toBe("rankmiso:external");
    await expect(page.locator("a[href^='mailto:']")).not.toHaveAttribute("data-rankmiso-highlight");
    await expect(page.locator("a[href^='tel:']")).not.toHaveAttribute("data-rankmiso-highlight");
    await report.getByRole("button", { name: "Clear highlights" }).click();

    await context.grantPermissions(["clipboard-read"], { origin });
    await report.getByRole("button", { name: "Metadata", exact: true }).click();
    await report.getByRole("button", { name: "Copy title" }).click();
    await expect(report.locator(".toast")).toContainText("Copied");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("F1 Interaction Fixture");

    await report.getByRole("button", { name: "Headings", exact: true }).click();
    await report.getByRole("button", { name: "Copy outline" }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("H1 Primary heading");

    await report.getByRole("button", { name: "Links", exact: true }).click();
    await report
      .getByRole("button", { name: /Copy link/ })
      .first()
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(`${origin}/inside`);

    await report.getByRole("button", { name: "Images", exact: true }).click();
    await report
      .getByRole("button", { name: /Details for/ })
      .first()
      .click();
    await report.getByRole("button", { name: "Copy source" }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("data:image/gif");

    await report.getByRole("button", { name: "Schema", exact: true }).click();
    await report
      .locator("details.disclosure")
      .first()
      .getByRole("button", { name: "Copy JSON" })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("Clipboard fixture — 日本語");
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionDir, { recursive: true, force: true });
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});

async function tabId(worker: Worker, origin: string): Promise<number> {
  const id = await worker.evaluate(async (target) => {
    const api = (
      globalThis as unknown as {
        chrome: {
          tabs: { query: (query: object) => Promise<Array<{ id?: number; url?: string }>> };
        };
      }
    ).chrome;
    const tabs = await api.tabs.query({});
    return tabs.find((tab) => tab.url?.startsWith(target))?.id ?? null;
  }, origin);
  if (id == null) throw new Error("Fixture tab was not found");
  return id;
}

const fixture = `<!doctype html><html lang="en"><head>
  <title>F1 Interaction Fixture</title><meta name="description" content="Clipboard fixture — 日本語">
  <link rel="canonical" href="http://127.0.0.1/">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Clipboard fixture — 日本語"}</script>
  <style>h1 { margin: 11px; color: purple; }</style>
  </head><body><h1 data-page-owner data-seo-toolkit-mark="page-owned" style="color: purple">Primary heading</h1>
  <h1>Secondary heading</h1><h2>Section two</h2><h3>Section three</h3>
  <a href="/inside">Internal link</a><a href="https://outside.example/path">External link</a>
  <a href="mailto:test@example.test">Email link</a><a href="tel:+15551234567">Phone link</a>
  <img alt="fixture image" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=">
  </body></html>`;
