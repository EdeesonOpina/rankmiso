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

const shots = process.env.CAPTURE_DIR ?? "test-results";

test("a crawler access check is kept across reloads, the sidebar, the popup, and Overview", async () => {
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
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><html lang=en><head><title>Guide | Miso Shop</title></head><body><main><h1>Barley miso guide</h1><p>Text.</p></main></body></html>",
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-retain-profile-"));
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
    const base = `chrome-extension://${extensionId}`;

    const report = await context.newPage();
    await report.setViewportSize({ width: 1440, height: 1000 });
    await report.goto(`${base}/dashboard.html?tabId=${pageId}&section=ai-search`);
    await report.getByRole("button", { name: "Check access" }).click();
    await expect(report.getByText("Path checked: /guide")).toBeVisible({ timeout: 20_000 });
    const robotsReads = requests.filter((path) => path === "/robots.txt").length;

    // Reload: the result is still there, with no new request.
    await report.reload();
    await expect(report.getByText("Path checked: /guide")).toBeVisible();
    await report.locator('[data-nav="overview"]').click();
    const tiles = report.locator(".disc-card .psnap-tile");
    await expect(tiles).toHaveCount(15);
    await expect(tiles.filter({ hasText: "Claude" })).toContainText("Disallowed");
    await expect(tiles.filter({ hasText: "ChatGPT" })).toContainText("Allowed");
    await expect(report.locator(".disc-card .psnap-head")).toContainText("Checked");
    await report.locator(".disc-card").screenshot({ path: `${shots}/overview-snapshots.png` });

    // The sidebar and the popup show the same result without checking again.
    const sidebar = await context.newPage();
    await sidebar.setViewportSize({ width: 350, height: 900 });
    await sidebar.goto(`${base}/sidepanel.html?tabId=${pageId}&section=overview`);
    await expect(sidebar.locator(".psnap-tile").filter({ hasText: "Claude" })).toContainText(
      "Disallowed",
    );
    await sidebar.locator(".psnap").screenshot({ path: `${shots}/sidebar-snapshots.png` });
    expect(await overflows(sidebar)).toBe(false);
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 420, height: 1200 });
    await popup.goto(`${base}/popup.html?tabId=${pageId}`);
    await expect(popup.locator(".psnap-tile").filter({ hasText: "Claude" })).toContainText(
      "Disallowed",
    );
    await popup.locator(".psnap").screenshot({ path: `${shots}/popup-snapshots.png` });
    await popup.locator('[data-nav="ai-search"]').click();
    await expect(popup.getByText("Platform snapshots")).toBeVisible();
    expect(requests.filter((path) => path === "/robots.txt").length).toBe(robotsReads);

    // A new check in the popup reaches the open report without a reload.
    const before = await report.locator(".disc-card .psnap-head span").textContent();
    // The checked time is shown to the second, so make the new check land in a later second.
    await popup.waitForTimeout(1_100);
    await popup.getByRole("button", { name: "Check access" }).click();
    await expect
      .poll(() => report.locator(".disc-card .psnap-head span").textContent(), { timeout: 20_000 })
      .not.toBe(before);
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
