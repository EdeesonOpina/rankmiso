import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect, chromium } from "@playwright/test";

test("built extension loads and renders its popup", async () => {
  const extensionPath = resolve(".output/chrome-mv3");
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-chromium-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.setViewportSize({ width: 420, height: 720 });
    await expect(popup.getByRole("img", { name: "RankMiso" })).toBeVisible();
    const overview = popup.getByRole("button", { name: "Overview", exact: true });
    await expect(overview).toBeVisible();
    await expect(popup.getByRole("button", { name: "Issues", exact: true })).toBeVisible();
    await expect(popup.getByRole("button", { name: "Metadata", exact: true })).toBeAttached();
    await overview.focus();
    await popup.keyboard.press("ArrowRight");
    await expect(popup.getByRole("button", { name: "Issues", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await popup.getByRole("button", { name: "Headings", exact: true }).click();
    await expect(popup.getByRole("button", { name: "Headings", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await popup.screenshot({ path: "test-results/popup-420.png" });
    // Chrome sizes a toolbar popup from a tiny first window. The page must still ask for 420px.
    await popup.setViewportSize({ width: 120, height: 600 });
    const measured = await popup.evaluate(() => ({
      body: document.body.getBoundingClientRect().width,
      work: document.querySelector(".work")?.getBoundingClientRect().width ?? 0,
    }));
    expect(measured.body).toBe(420);
    expect(measured.work).toBeGreaterThan(300);
    await popup.setViewportSize({ width: 420, height: 720 });
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    // The browser frame shows the page background at its edges, so it must be dark too.
    const backgrounds = await popup.evaluate(() => [
      getComputedStyle(document.documentElement).backgroundColor,
      getComputedStyle(document.body).backgroundColor,
    ]);
    expect(backgrounds).toEqual(["rgb(15, 20, 36)", "rgb(15, 20, 36)"]);
    await popup.screenshot({ path: "test-results/popup-dark.png" });

    const report = await context.newPage();
    await report.goto(`chrome-extension://${extensionId}/dashboard.html`);
    await expect(report.getByRole("button", { name: "Metadata", exact: true })).toBeVisible();
    await expect(report.getByRole("button", { name: "Schema", exact: true })).toBeVisible();
    await expect(report.getByRole("button", { name: "History" })).toBeVisible();
    await expect(report.getByRole("button", { name: "Site", exact: true })).toBeVisible();
    for (const [width, height, name] of [
      [360, 640, "dashboard-360"],
      [768, 1024, "dashboard-768"],
      [1280, 800, "dashboard-1280"],
    ] as const) {
      await report.setViewportSize({ width, height });
      await report.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    }
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test("Firefox package includes its add-on id and local WASM asset", async () => {
  const extensionPath = resolve(".output/firefox-mv3");
  const manifest = JSON.parse(await readFile(join(extensionPath, "manifest.json"), "utf8")) as {
    browser_specific_settings?: {
      gecko?: { id?: string; data_collection_permissions?: { required?: string[] } };
    };
    optional_host_permissions?: string[];
  };
  const assets = await readdir(join(extensionPath, "assets"));
  const chunks = await readdir(join(extensionPath, "chunks"));
  const builtCode = (
    await Promise.all(
      chunks
        .filter((chunk) => chunk.endsWith(".js"))
        .map((chunk) => readFile(join(extensionPath, "chunks", chunk), "utf8")),
    )
  ).join("\n");

  expect(manifest.browser_specific_settings?.gecko?.id).toBe("rankmiso@rankmiso.extension");
  expect(manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required).toEqual([
    "none",
  ]);
  expect(manifest.optional_host_permissions).toBeUndefined();
  expect(builtCode).not.toContain("pagespeedonline/v5/runPagespeed");
  expect(builtCode).not.toContain("https://www.googleapis.com");
  expect(builtCode).not.toContain("/robots.txt");
  expect(assets.some((asset) => asset.endsWith(".wasm"))).toBe(true);
  await expect(access(join(extensionPath, "popup.html"))).resolves.toBeUndefined();
});
