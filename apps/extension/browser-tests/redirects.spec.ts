import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

// Fixture redirects only.
const redirects: Record<string, [number, string]> = {
  "/start": [301, "/step"],
  "/step": [302, "/final"],
  "/loop-a": [301, "/loop-b"],
  "/loop-b": [301, "/loop-a"],
  "/to-missing": [308, "/missing"],
  "/old": [301, "/new"],
};

test("redirect trace reads each hop, and Site Explorer follows redirects with details on", async () => {
  test.setTimeout(120_000);
  let origin = "";
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    const redirect = redirects[path];
    if (redirect) {
      response.writeHead(redirect[0], { location: redirect[1] });
      response.end();
      return;
    }
    if (path === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /\n");
      return;
    }
    const pages: Record<string, string> = {
      "/": `<!doctype html><title>Home</title><h1>Home</h1><a href="/a">a</a><a href="/old">old</a>`,
      "/final": `<!doctype html><title>Final</title><link rel="canonical" href="${origin}/start"><h1>Final</h1>`,
      "/a": `<!doctype html><title>A</title><link rel="canonical" href="${origin}/old"><h1>A</h1>`,
      "/new": `<!doctype html><title>New</title><link rel="canonical" href="${origin}/new"><h1>New</h1>`,
    };
    const body = pages[path];
    response.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
    response.end(body ?? "<!doctype html><title>Missing</title>");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-redirect-profile-"));
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
    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=technical`,
    );
    const card = report.locator(".redirect-card");
    await expect(card.getByText("Redirect details are on")).toBeVisible();
    const trace = async (path: string) => {
      await card.getByLabel("URL on this site").fill(`${origin}${path}`);
      await card.getByRole("button", { name: "Trace redirects" }).click();
      await expect(card.getByRole("button", { name: "Trace redirects" })).toBeEnabled({
        timeout: 15_000,
      });
      await expect(card.locator(".ax-finding").first()).toBeVisible();
    };
    const status = (title: string) =>
      card.locator(".ax-finding").filter({ hasText: title }).first().locator(".badge");

    await trace("/start");
    await expect(card.locator(".redirect-steps li")).toHaveCount(3);
    await expect(card.locator(".redirect-steps")).toContainText("301");
    await expect(card.locator(".redirect-steps")).toContainText("302");
    await expect(card.getByText("2 redirect hops observed.")).toBeVisible();
    await expect(status("Temporary redirects")).toHaveText("Opportunity");
    await expect(status("Redirect chain length")).toHaveText("Opportunity");
    await expect(status("Final page canonical")).toHaveText("Review");
    await card.screenshot({ animations: "disabled", path: "test-results/redirect-trace.png" });

    await trace("/loop-a");
    await expect(status("Redirect loop")).toHaveText("Review");
    await expect(card.getByText("Stopped: the chain loops.")).toBeVisible();

    await report.setViewportSize({ width: 390, height: 900 });
    expect(await overflows(report)).toBe(false);
    await report.setViewportSize({ width: 1280, height: 900 });

    await trace("/to-missing");
    await expect(status("Redirect destination")).toHaveText("Review");

    // Site Explorer follows /old to /new, so a canonical to /old is a canonical to a redirect.
    await report.locator('[data-nav="site"]').click();
    await report.getByRole("button", { name: "Start crawl" }).click();
    await expect(report.getByText("Complete", { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
    const relation = report
      .locator(".sx-relations .ax-finding")
      .filter({ hasText: "Canonical points to a redirect" });
    await expect(relation.locator(".badge")).toHaveText("Review", { timeout: 15_000 });
    await relation.getByText("Evidence").click();
    await expect(relation).toContainText(`${origin}/a → ${origin}/old → ${origin}/new`);
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
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-redirect-ext-"));
  await cp(productExtension, dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const product = JSON.parse(await readFile(join(productExtension, "manifest.json"), "utf8")) as {
    host_permissions?: string[];
  };
  expect(product.host_permissions).toBeUndefined();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    host_permissions?: string[];
    permissions?: string[];
  };
  manifest.host_permissions = ["http://127.0.0.1/*"];
  // Test copy only: the product manifest lists webRequest as optional.
  manifest.permissions = [...(manifest.permissions ?? []), "webRequest"];
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
