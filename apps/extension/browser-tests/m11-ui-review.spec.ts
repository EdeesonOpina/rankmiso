import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Page, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");
const shots = process.env.RANKMISO_REVIEW_DIR ?? "test-results/m11-review";

// Fixture page only: exercises every M11 view with real findings.
function page(origin: string) {
  return `<!doctype html><html lang="en"><head><title>Barley miso guide</title>
<meta name="description" content="How barley miso is made.">
<meta name="robots" content="max-snippet:120"><link rel="canonical" href="${origin}/guide">
<link rel="alternate" hreflang="en" href="${origin}/guide"><link rel="alternate" hreflang="en-UK" href="/uk">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"Barley miso guide",
"datePublished":"2026-03-01","dateModified":"2026-02-01","author":{"@type":"Person","name":"Aiko"},
"publisher":{"@id":"#org"},"image":"www.example.com/a.jpg"}</script>
</head><body><main><article><h1>Barley miso guide</h1><h2>What you need</h2><p>Barley koji, soybeans, salt.</p>
<h2>How long does it take?</h2><p>A year.</p><a href="/old">Read more</a></article></main></body></html>`;
}

test("M11 views fit every width in light and dark", async () => {
  test.setTimeout(300_000);
  let origin = "";
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    if (path === "/old") {
      response.writeHead(301, { location: "/guide" });
      response.end();
      return;
    }
    if (path === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page(origin));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  origin = `http://127.0.0.1:${address.port}`;
  await mkdir(shots, { recursive: true });
  const extensionDir = await extensionCopy();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-review-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const tab = await context.newPage();
    await tab.goto(`${origin}/guide`);
    const id = await tabId(worker, `${origin}/guide`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1440, height: 900 });
    const base = `chrome-extension://${extensionId}/dashboard.html?tabId=${id}`;

    // Populate results once so every view has content.
    await report.goto(`${base}&section=ai-search`);
    await report.getByRole("button", { name: "Check access" }).click();
    await expect(report.getByText("Path checked: /guide")).toBeVisible({ timeout: 20_000 });
    await report.locator('[data-nav="technical"]').click();
    await report.locator(".redirect-card").getByLabel("URL on this site").fill(`${origin}/old`);
    await report.locator(".redirect-card").getByRole("button", { name: "Trace redirects" }).click();
    await expect(report.locator(".redirect-card .ax-finding").first()).toBeVisible({
      timeout: 15_000,
    });
    await report.locator('[data-nav="site"]').click();
    await report.getByRole("button", { name: "Start crawl" }).click();
    await expect(report.getByText("Complete", { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });

    const views: Array<[string, () => Promise<void>]> = [
      ["technical", () => report.locator('[data-nav="technical"]').click()],
      ["schema", () => report.locator('[data-nav="schema"]').click()],
      ["site-overview", () => report.locator('[data-nav="site"]').click()],
      ...(["Crawler access", "Content readiness", "Visibility"] as const).map(
        (name): [string, () => Promise<void>] => [
          `ai-${name.toLowerCase().replace(/\s+/g, "-")}`,
          async () => {
            await report.locator('[data-nav="ai-search"]').click();
            await report
              .getByRole("navigation", { name: "AI & Search views" })
              .getByRole("button", { name })
              .click();
          },
        ],
      ),
    ];
    const problems: string[] = [];
    for (const [name, show] of views) {
      await report.setViewportSize({ width: 1440, height: 900 });
      await show();
      await report.waitForTimeout(150);
      for (const theme of ["light", "dark"] as const) {
        await report.evaluate(
          (value) => document.documentElement.setAttribute("data-theme", value),
          theme,
        );
        for (const width of [1440, 1024, 768, 390]) {
          await report.setViewportSize({ width, height: 900 });
          if (await overflows(report)) problems.push(`${name} ${theme} ${width}`);
          if (width === 1440 || width === 390) {
            await report.screenshot({
              animations: "disabled",
              path: `${shots}/${name}-${theme}-${width}.png`,
            });
          }
        }
      }
      await report.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    }

    const sidebar = await context.newPage();
    await sidebar.setViewportSize({ width: 350, height: 800 });
    for (const section of ["ai-search", "technical", "schema"]) {
      await sidebar.goto(
        `chrome-extension://${extensionId}/sidepanel.html?tabId=${id}&section=${section}`,
      );
      await sidebar.waitForTimeout(400);
      if (await overflows(sidebar)) problems.push(`sidebar ${section}`);
      if (section === "ai-search") {
        // Every tab must be fully on screen, not scrolled out of view.
        const hidden = await sidebar.evaluate(
          () =>
            Array.from(document.querySelectorAll(".ax-tabs button")).filter((button) => {
              const box = button.getBoundingClientRect();
              return box.right > window.innerWidth || box.width === 0;
            }).length,
        );
        if (hidden) problems.push(`sidebar ai-search: ${hidden} tab(s) off screen`);
      }
      await sidebar.screenshot({ animations: "disabled", path: `${shots}/sidebar-${section}.png` });
    }

    // Keyboard: the AI & Search tabs are reachable and operable.
    await report.setViewportSize({ width: 1440, height: 900 });
    await report.locator('[data-nav="ai-search"]').click();
    const nav = report.getByRole("navigation", { name: "AI & Search views" });
    await nav.getByRole("button", { name: "Crawler access" }).focus();
    await report.keyboard.press("Tab");
    await expect(nav.getByRole("button", { name: "Content readiness" })).toBeFocused();
    await report.keyboard.press("Enter");
    await expect(nav.getByRole("button", { name: "Content readiness" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(problems).toEqual([]);
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
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-review-ext-"));
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
