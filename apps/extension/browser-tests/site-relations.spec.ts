import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

// Fixture site only: each page sets up one canonical or hreflang relationship.
function html(head: string, body = "") {
  return `<!doctype html><html lang="en"><head><title>Fixture</title>${head}</head><body><h1>Fixture</h1>${body}</body></html>`;
}

test("Site Explorer reports canonical and hreflang relationships between crawled pages", async () => {
  test.setTimeout(120_000);
  let origin = "";
  const pages = (): Record<string, string> => ({
    "/": html(
      `<link rel="canonical" href="${origin}/">`,
      ["/en", "/fr", "/a", "/b", "/c", "/x", "/old", "/missing", "/hidden"]
        .map((path) => `<a href="${path}">${path}</a>`)
        .join(""),
    ),
    "/en": html(
      `<link rel="canonical" href="${origin}/en"><link rel="alternate" hreflang="en" href="${origin}/en">
       <link rel="alternate" hreflang="fr" href="${origin}/fr"><link rel="alternate" hreflang="x-default" href="${origin}/en">`,
    ),
    "/fr": html(
      `<link rel="canonical" href="${origin}/fr"><link rel="alternate" hreflang="fr" href="${origin}/fr">`,
    ),
    "/a": html(`<link rel="canonical" href="${origin}/old">`),
    "/b": html(`<link rel="canonical" href="${origin}/missing">`),
    "/c": html(`<link rel="canonical" href="${origin}/hidden">`),
    "/x": html(`<link rel="canonical" href="https://partner.example/x">`),
    "/new": html(`<link rel="canonical" href="${origin}/new">`),
    "/hidden": html(`<meta name="robots" content="noindex">`),
  });
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    if (path === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /\n");
      return;
    }
    if (path === "/old") {
      response.writeHead(301, { location: "/new" });
      response.end();
      return;
    }
    const body = pages()[path];
    response.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
    response.end(body ?? "<!doctype html><title>Missing</title>");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-relations-profile-"));
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
    const id = await tabId(worker, `${origin}/`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 900 });
    await report.goto(`chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=site`);
    await report.getByRole("button", { name: "Start crawl" }).click();
    await expect(report.getByText("Complete", { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
    const panel = (name: string) =>
      report
        .locator(".sx-relations .sx-panel")
        .filter({ has: report.getByRole("heading", { name }) });
    const status = (group: string, title: string) =>
      panel(group).locator(".ax-finding").filter({ hasText: title }).first().locator(".badge");
    // The crawler cannot read redirect responses yet (M11.2): /old is listed as not verified,
    // and "no issue" covers only the targets that were checked.
    await expect(status("Canonical relationships", "Canonical points to a redirect")).toHaveText(
      "No issue observed",
      { timeout: 15_000 },
    );
    await expect(
      panel("Canonical relationships")
        .locator(".ax-finding")
        .filter({ hasText: "Canonical relationships in this crawl" }),
    ).toContainText("Observation");
    await expect(status("Canonical relationships", "Canonical points to an error page")).toHaveText(
      "Review",
    );
    await expect(
      status("Canonical relationships", "Canonical points to a noindex page"),
    ).toHaveText("Review");
    await expect(status("Canonical relationships", "Canonical on another host")).toHaveText(
      "Opportunity",
    );
    await expect(status("Hreflang relationships", "Hreflang return links")).toHaveText("Review");
    await expect(status("Hreflang relationships", "x-default for language groups")).toHaveText(
      "No issue observed",
    );
    const coverage = panel("Canonical relationships")
      .locator(".ax-finding")
      .filter({ hasText: "Canonical relationships in this crawl" });
    await coverage.getByText("Evidence").click();
    await expect(coverage).toContainText(`${origin}/old`);
    const error = panel("Canonical relationships")
      .locator(".ax-finding")
      .filter({ hasText: "Canonical points to an error page" });
    await error.getByText("Evidence").click();
    await expect(error).toContainText(`${origin}/b → ${origin}/missing (HTTP 404)`);
    await report
      .locator(".sx-relations")
      .screenshot({ animations: "disabled", path: "test-results/site-relations.png" });
    for (const width of [1024, 768, 390]) {
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
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-relations-ext-"));
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
