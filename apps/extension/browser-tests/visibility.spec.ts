import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

test("AI visibility records samples locally, keeps them after reload, and deletes them", async () => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Miso shop</title><h1>Miso shop</h1>");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-visibility-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const tab = await context.newPage();
    await tab.goto(`${origin}/`);
    const id = await tabId(worker, `${origin}/`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 900 });
    const url = `chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=ai-search`;
    await report.goto(url);
    const open = async () =>
      report
        .getByRole("navigation", { name: "Discoverability views" })
        .getByRole("button", { name: "Visibility" })
        .click();
    await open();
    await expect(report.getByText("No questions tracked yet")).toBeVisible();
    requests.length = 0;
    await report.getByLabel("Question", { exact: true }).fill("where to buy barley miso");
    await report.getByLabel("Your domain").fill("miso.example");
    await report.getByRole("button", { name: "Add question" }).click();
    await report.getByRole("button", { name: "Record an answer" }).click();
    const form = report.locator(".vis-record");
    await form.getByLabel("Service").selectOption({ label: "Perplexity" });
    await form.getByLabel("Date you saw it").fill("2026-11-24");
    // Fixture text only, typed as a user would paste it.
    await form
      .getByLabel("Answer text (paste)")
      .fill("Try Miso Shop (https://shop.miso.example/barley) or https://other.org/miso.");
    await form.getByRole("button", { name: "Save sample" }).click();
    const row = report.locator(".vis-rows .ax-finding").first();
    await expect(row.locator(".badge")).toHaveText("Cited");
    await row.getByText("Samples").click();
    await expect(row).toContainText("Link 1 in the pasted list: https://shop.miso.example/barley");
    expect(requests).toEqual([]);
    await report
      .locator(".vis")
      .screenshot({ animations: "disabled", path: "test-results/visibility.png" });

    const download = report.waitForEvent("download");
    await report.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^rankmiso-ai-visibility-.*\.csv$/);
    expect(await readFile((await file.path())!, "utf8")).toContain("shop.miso.example/barley");

    await report.reload();
    await open();
    await expect(report.locator(".vis-rows .badge").first()).toHaveText("Cited");
    for (const width of [768, 390]) {
      await report.setViewportSize({ width, height: 900 });
      expect(await overflows(report)).toBe(false);
    }
    await report.setViewportSize({ width: 1280, height: 900 });
    await report.getByRole("button", { name: /^Delete question/ }).click();
    await expect(report.getByText("No questions tracked yet")).toBeVisible();
    await report.reload();
    await open();
    await expect(report.getByText("No questions tracked yet")).toBeVisible();
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
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-visibility-ext-"));
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
