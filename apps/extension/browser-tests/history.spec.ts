import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

test("saved audits stay on this device and compare real measurements", async () => {
  test.setTimeout(120_000);
  let generation = 1;
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    const body = path === "/other" ? otherPage() : historyPage(generation);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-history-profile-"));
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
    await page.goto(`${origin}/page`);
    const pageId = await tabId(worker, `${origin}/page`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 800 });
    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${pageId}&section=reports`,
    );
    await expect(report.getByRole("heading", { name: "SEO history" })).toBeVisible();
    await expect(report.getByText("Save the current audit to keep a measurement")).toBeVisible();
    await report.screenshot({ path: "test-results/history-empty-1280.png" });

    await report.getByRole("button", { name: "Save current comparison" }).click();
    await expect(report.getByText("Comparison saved on this device.")).toBeVisible();
    await report.reload();
    await expect(report.getByRole("heading", { name: "Score history" })).toBeVisible();
    await expect(report.getByText("One saved measurement.")).toBeVisible();
    await report.screenshot({ path: "test-results/history-one-1280.png" });

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 420, height: 720 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${pageId}`);
    await popup.getByRole("button", { name: "History", exact: true }).click();
    await expect(popup.getByText("1 saved", { exact: true })).toBeVisible();
    await popup.screenshot({ path: "test-results/history-popup-420.png" });
    expect(await overflows(popup)).toBe(false);
    await popup.close();

    generation = 2;
    await page.reload();
    await expect(report.getByText("This result is from an earlier page.")).toBeVisible();
    await report.getByRole("button", { name: "Refresh analysis" }).click();
    await expect(report.getByRole("heading", { name: "History alpha", level: 1 })).toHaveCount(0);
    await report.getByRole("button", { name: "Save current comparison" }).click();
    await expect(report.getByRole("heading", { name: "New" })).toBeVisible();
    await expect(report.getByText("Title is missing").last()).toBeVisible();

    generation = 3;
    await page.reload();
    await expect(report.getByText("This result is from an earlier page.")).toBeVisible();
    await report.getByRole("button", { name: "Refresh analysis" }).click();
    await expect(
      report.getByRole("cell", { name: "Third measurement of this local history page." }),
    ).toBeVisible();
    await report.getByRole("button", { name: "Save current comparison" }).click();
    await expect(
      report
        .locator("section.card", {
          has: report.getByRole("heading", { name: "Saved comparisons" }),
        })
        .locator(".data-row"),
    ).toHaveCount(3);
    await expect(report.getByText("H1 is missing").last()).toBeVisible();
    const chartButton = report.getByRole("button", { name: /On-page check score/ }).first();
    await chartButton.focus();
    await chartButton.press("ArrowLeft");
    await expect(report.locator(".history-chart .point.is-selected").first()).toBeVisible();
    await report.getByRole("heading", { name: "Score history" }).scrollIntoViewIfNeeded();
    await report.screenshot({ path: "test-results/history-multi-1280.png" });
    await report.getByRole("heading", { name: "Errors and warnings" }).scrollIntoViewIfNeeded();
    await report.screenshot({ path: "test-results/history-issues-1280.png" });
    await report.getByRole("heading", { name: "New" }).scrollIntoViewIfNeeded();
    await report.screenshot({ path: "test-results/history-findings-1280.png" });

    const other = await context.newPage();
    await other.goto(`${origin}/other`);
    const otherId = await tabId(worker, `${origin}/other`);
    const otherReport = await context.newPage();
    await otherReport.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${otherId}&section=reports`,
    );
    await otherReport.getByRole("button", { name: "Save current comparison" }).click();
    await expect(otherReport.getByText("Comparison saved on this device.")).toBeVisible();
    await otherReport.close();
    await other.close();

    await report.reload();
    await expect(report.getByText("Other history page")).toHaveCount(0);
    await report.getByRole("button", { name: "All saved pages" }).click();
    await expect(report.getByText("Other history page")).toBeVisible();
    await expect(
      report.getByText("A score change across different addresses is not one page getting better."),
    ).toBeVisible();
    await report.getByRole("button", { name: "This page" }).click();
    await expect(report.getByText("Other history page")).toHaveCount(0);

    await report.evaluate((pageUrl) => {
      const browser = (
        globalThis as unknown as {
          chrome: {
            storage: {
              local: {
                set: (value: object) => Promise<void>;
                get: (key: string) => Promise<Record<string, unknown>>;
              };
            };
          };
        }
      ).chrome;
      return browser.storage.local.get("rankmiso.savedReports").then((stored) => {
        const current = Array.isArray(stored["rankmiso.savedReports"])
          ? stored["rankmiso.savedReports"]
          : [];
        return browser.storage.local.set({
          "rankmiso.savedReports": [
            {
              id: "legacy-1",
              savedAt: "2020-01-02T03:04:05.000Z",
              comparison: {
                url: pageUrl,
                title: "Legacy title",
                description: null,
                canonicals: [],
                headingCount: 0,
                h1Count: 0,
                linkCount: 0,
                imageCount: 0,
                missingAltCount: 0,
                schemaTypes: [],
                score: 50,
              },
            },
            { id: 4 },
            ...current,
          ],
        });
      });
    }, `${origin}/page`);
    await report.reload();
    await expect(report.getByText("Legacy title")).toBeVisible();
    await expect(report.getByText("Not recorded").first()).toBeVisible();
    const baseline = report.getByLabel("Baseline");
    const legacyValue = await baseline.locator("option", { hasText: "2020" }).getAttribute("value");
    await baseline.selectOption(legacyValue);
    await expect(report.getByText("Not comparable").first()).toBeVisible();
    await report.getByRole("heading", { name: "Compare two saves" }).scrollIntoViewIfNeeded();
    await report.screenshot({ path: "test-results/history-compare-1280.png" });

    const categoryCard = report
      .locator("section.card")
      .filter({ has: report.getByRole("heading", { name: "Category", exact: true }) });
    await categoryCard.getByRole("combobox").selectOption({ label: "Performance" });
    await expect(categoryCard.getByText("Not measured").first()).toBeVisible();
    await categoryCard.scrollIntoViewIfNeeded();
    await report.screenshot({ path: "test-results/history-category-1280.png" });

    const downloadPromise = report.waitForEvent("download");
    await report.getByRole("button", { name: "Export CSV" }).click();
    await report.getByRole("button", { name: "Confirm" }).click();
    const download = await downloadPromise;
    const csvPath = await download.path();
    if (!csvPath) throw new Error("history csv did not download");
    const csv = await readFile(csvPath, "utf8");
    expect(csv).toContain(`${origin}/page`);
    expect(csv).not.toContain(`${origin}/other`);

    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await report.screenshot({ path: "test-results/history-dark-1280.png" });
    await report.setViewportSize({ width: 768, height: 1024 });
    await report.screenshot({ path: "test-results/history-768.png" });
    await report.setViewportSize({ width: 360, height: 640 });
    expect(await overflows(report)).toBe(false);
    await report.screenshot({ path: "test-results/history-360.png" });

    const sidebar = await context.newPage();
    await sidebar.setViewportSize({ width: 350, height: 700 });
    await sidebar.goto(
      `chrome-extension://${extensionId}/sidepanel.html?tabId=${pageId}&section=reports`,
    );
    await expect(sidebar.getByRole("heading", { name: "Health timeline" })).toBeVisible();
    expect(await overflows(sidebar)).toBe(false);
    await sidebar.screenshot({ path: "test-results/history-sidebar-350.png" });
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

function historyPage(generation: number): string {
  const title = generation === 1 ? "<title>History alpha</title>" : "";
  const heading = generation < 3 ? "<h1>History alpha</h1>" : "";
  const description =
    generation === 3
      ? "Third measurement of this local history page."
      : "A local history page with a description that is long enough to summarize the topic.";
  return `<!doctype html><html lang="en"><head>${title}<meta name="description" content="${description}"></head><body>${heading}<p>This page exists so RankMiso can save a real audit and compare it later without leaving this computer.</p></body></html>`;
}

function otherPage(): string {
  return `<!doctype html><html lang="en"><head><title>Other history page</title><meta name="description" content="A second address that must stay out of the first page trend."></head><body><h1>Other history page</h1><p>This is a different page and its score is not the first page getting better.</p></body></html>`;
}

async function extensionCopy() {
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-history-ext-"));
  await cp(productExtension, dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
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
