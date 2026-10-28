import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, chromium, type Worker } from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

test("site explorer crawls one host, skips robots, and stops", async () => {
  test.setTimeout(120_000);
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const origin = `http://127.0.0.1:${(request.socket.localPort ?? 0).toString()}`;
    if (url.pathname === "/hold") {
      hold(request, response);
      return;
    }
    const body = files(origin)[url.pathname];
    if (!body) {
      response.writeHead(url.pathname === "/gone" ? 404 : 404, { "content-type": "text/html" });
      response.end("<!doctype html><title>Missing</title><h1>Missing</h1>");
      return;
    }
    const type = url.pathname.endsWith(".txt")
      ? "text/plain"
      : url.pathname.endsWith(".xml")
        ? "application/xml"
        : "text/html";
    response.writeHead(200, { "content-type": type });
    response.end(body);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  const origin = `http://127.0.0.1:${address.port}`;
  const extensionDir = await mkdtemp(join(tmpdir(), "rankmiso-site-ext-"));
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-site-profile-"));
  await cp(productExtension, extensionDir, { recursive: true });
  const manifest = JSON.parse(await readFile(join(extensionDir, "manifest.json"), "utf8")) as {
    host_permissions?: string[];
  };
  const product = JSON.parse(await readFile(join(productExtension, "manifest.json"), "utf8")) as {
    host_permissions?: string[];
  };
  expect(product.host_permissions).toBeUndefined();
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(join(extensionDir, "manifest.json"), JSON.stringify(manifest));
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
    const tab = await tabId(worker, `${origin}/`);
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 800 });
    await report.goto(`chrome-extension://${extensionId}/dashboard.html?tabId=${tab}&section=site`);
    await expect(report.getByRole("heading", { name: "Site Explorer" })).toBeVisible();
    await report.getByRole("button", { name: "Start crawl" }).click();
    const secret = report.getByRole("button", { name: `${origin}/secret` });
    await expect(secret).toBeVisible({ timeout: 20_000 });
    await report.locator(".crawl-board").screenshot({
      path: "../../docs/design/reviews/ux9-continuation/final/site-board.png",
    });
    await secret.click();
    await expect(report.getByText("robots.txt disallows this crawler")).toBeVisible();
    await expect(report.getByText("Alpha page").first()).toBeVisible();
    await report.getByRole("button", { name: "Stop" }).click();
    await expect(report.getByText("Stopped", { exact: true })).toBeVisible();
    await report.getByLabel("Search pages").fill("a.html");
    await report.getByRole("button", { name: `${origin}/a.html` }).click();
    await expect(report.getByText("Alpha page description")).toBeVisible();
    const downloadPromise = report.waitForEvent("download");
    await report.getByRole("button", { name: "Export CSV" }).click();
    expect((await downloadPromise).suggestedFilename()).toContain(".csv");
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await report.screenshot({ path: "test-results/site-explorer.png" });
    await report.setViewportSize({ width: 360, height: 640 });
    expect(
      await report.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
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

function files(origin: string): Record<string, string> {
  const page = (title: string, body: string) =>
    `<!doctype html><html lang="en"><head><title>${title}</title><meta name="description" content="${title} description"></head><body><h1>${title}</h1>${body}</body></html>`;
  return {
    "/robots.txt": `User-agent: *\nDisallow: /secret\nSitemap: ${origin}/sitemap.xml\n`,
    "/sitemap.xml": `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/a.html</loc></url><url><loc>${origin}/secret</loc></url></urlset>`,
    "/": page(
      "Home",
      `<a href="/a.html">Alpha</a><a href="/b.html">Beta</a><a href="/gone">Gone</a><a href="/secret">Secret</a><a href="/hold">Hold</a><a href="https://example.com/out">Out</a>`,
    ),
    "/a.html": page("Alpha page", `<a href="/b.html">Beta</a>`),
    "/b.html": page("Alpha page", ""),
    "/secret": page("Secret", ""),
  };
}

function hold(request: IncomingMessage, response: ServerResponse) {
  const timer = setTimeout(() => {
    try {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<!doctype html><title>Hold</title>");
    } catch {
      // The crawl stopped and the socket closed.
    }
  }, 20_000);
  request.on("close", () => clearTimeout(timer));
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
