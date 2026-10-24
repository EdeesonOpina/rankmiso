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
    await expect(popup.getByText("RankMiso", { exact: true })).toBeVisible();
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
