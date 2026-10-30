import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

test("sidebar follows active tabs and same-tab navigation without optional requests", async () => {
  test.setTimeout(60_000);
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (path !== "/favicon.ico") requests.push(path);
    const label =
      path === "/b" ? "Sidebar Page B" : path === "/spa" ? "Sidebar SPA Route" : "Sidebar Page A";
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="en"><head><title>${label}</title>
      <meta name="description" content="Active tab synchronization fixture">
      <link rel="canonical" href="http://127.0.0.1${path}">
    </head><body><h1>${label}</h1><p>${"fixture content ".repeat(80)}</p></body></html>`);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await mkdtemp(join(tmpdir(), "rankmiso-f1-tab-sync-ext-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-f1-tab-sync-profile-"));
  await cp(productExtension, extensionDir, { recursive: true });
  const manifestPath = join(extensionDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    host_permissions?: string[];
  };
  // Match-pattern host permissions are not scoped to this fixture's ephemeral port.
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, JSON.stringify(manifest));

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const pageA = await context.newPage();
    await pageA.goto(`${origin}/a`);
    const pageB = await context.newPage();
    await pageB.goto(`${origin}/b`);

    const sidebar = await context.newPage();
    sidebar.setDefaultTimeout(5_000);
    await sidebar.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await pageA.bringToFront();
    await expect(sidebar.locator(".top-title")).toContainText("Sidebar Page A");
    expect(await sidebar.locator(".subtitle span").getAttribute("title")).toContain("/a");

    await pageB.bringToFront();
    await expect(sidebar.locator(".top-title")).toContainText("Sidebar Page B");
    expect(await sidebar.locator(".subtitle span").getAttribute("title")).toContain("/b");

    await pageA.bringToFront();
    await expect(sidebar.locator(".top-title")).toContainText("Sidebar Page A");

    const switchSamples: number[] = [];
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const started = Date.now();
      await pageB.bringToFront();
      await expect(sidebar.locator(".top-title")).toContainText("Sidebar Page B");
      await pageA.bringToFront();
      await expect(sidebar.locator(".top-title")).toContainText("Sidebar Page A");
      switchSamples.push(Date.now() - started);
    }
    console.log(`sidebar five-cycle A/B/A switching ms: ${JSON.stringify(switchSamples)}`);
    const heap = await sidebar.evaluate(() => {
      const measured = performance as Performance & { memory?: { usedJSHeapSize: number } };
      return measured.memory?.usedJSHeapSize ?? null;
    });
    console.log(`sidebar JS heap after switching bytes: ${heap ?? "unavailable"}`);

    await pageA.evaluate(() => {
      history.pushState({}, "", "/spa");
      document.title = "Sidebar SPA Route";
      document.querySelector("h1")!.textContent = "Sidebar SPA Route";
    });
    await expect(sidebar.locator(".top-title")).toContainText("Sidebar SPA Route");
    await expect(sidebar.locator(".subtitle span")).toHaveAttribute("title", `${origin}/spa`);

    await pageA.goto(`${origin}/a`);
    await expect(sidebar.locator(".top-title")).toContainText("Sidebar Page A");
    await pageA.evaluate(() => {
      document.title = "Sidebar Fresh Refresh";
      document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content =
        "Updated after the initial audit";
    });
    await sidebar.getByRole("button", { name: "Refresh" }).click();
    await expect(sidebar.locator(".top-title")).toContainText("Sidebar Fresh Refresh");

    // Auditing reads the local DOM; switching pages must not initiate optional probes.
    expect(requests).toEqual(["/a", "/b", "/a"]);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionDir, { recursive: true, force: true });
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});
