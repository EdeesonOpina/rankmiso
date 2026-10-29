import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, firefox, type Page, type Worker } from "@playwright/test";
import { capturesDir, extensionDir, fixtureDir } from "./paths.ts";

interface CaptureMeta {
  runtime: "chromium";
  firefoxRuntime: string;
  safariRuntime: string;
  framed: Record<string, { height: number; complete: boolean }>;
}

export async function capture(): Promise<void> {
  await mkdir(capturesDir, { recursive: true });
  try {
    await readFile(join(extensionDir, "manifest.json"), "utf8");
  } catch {
    throw new Error(
      "Chrome build is missing. Run pnpm --filter @rankmiso/extension build from the repository root.",
    );
  }

  const served = await serveFixture();
  const extensionCopy = await extensionForFixture();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-marketing-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    args: [
      `--disable-extensions-except=${extensionCopy}`,
      `--load-extension=${extensionCopy}`,
      "--hide-scrollbars",
    ],
  });

  const framed: CaptureMeta["framed"] = {};
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const fixture = await context.newPage();
    await fixture.goto(`${served.origin}/page.html`, { waitUntil: "load" });
    const id = await tabId(worker, "/page.html");

    const popup = await context.newPage();
    await popup.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${id}`);
    await popup.locator(".hero-score").waitFor({ timeout: 45_000 });
    await rejectEmpty(popup);
    await hideScrollbars(popup);
    framed["popup-overview"] = await savePopup(popup, "popup-overview.png");

    await popup.locator('[data-nav="schema"]').click();
    await popup.getByText("Article", { exact: true }).first().waitFor();
    framed["popup-schema"] = await savePopup(popup, "popup-schema.png");

    await popup.locator('[data-nav="headings"]').click();
    await popup.getByRole("heading", { name: "Document outline" }).waitFor();
    await popup.getByText("Field notes from the harbor workshop").first().waitFor();
    framed["popup-headings"] = await savePopup(popup, "popup-headings.png");

    await popup.locator('[data-nav="images"]').click();
    await popup.getByRole("heading", { name: "Image inspector" }).waitFor();
    await popup.getByText("A red circle on a dark harbor mark").waitFor();
    framed["popup-images"] = await savePopup(popup, "popup-images.png");

    await popup.locator('[data-nav="social"]').click();
    await popup.getByRole("heading", { name: "Share appearance" }).waitFor();
    await popup.getByText("Field notes from the harbor workshop").first().waitFor();
    framed["popup-social"] = await savePopup(popup, "popup-social.png");

    await popup.locator('[data-nav="metadata"]').click();
    await popup.getByRole("heading", { name: "Page identity" }).waitFor();
    framed["popup-metadata"] = await savePopup(popup, "popup-metadata.png");

    await popup.locator('[data-nav="content"]').click();
    await popup.getByRole("heading", { name: "Content profile" }).waitFor();
    framed["popup-content"] = await savePopup(popup, "popup-content.png");

    const report = await context.newPage();
    await report.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await report.setViewportSize({ width: 1440, height: 900 });
    await report.goto(`chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=links`);
    await report.getByRole("heading", { name: "Link explorer" }).waitFor({ timeout: 45_000 });
    const group = report.locator("details").filter({ hasText: "Harbor notes" });
    if (!(await group.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await group.locator("summary").click();
    }
    await group.getByText("Harbor notes").waitFor();
    await hideScrollbars(report);
    await report.screenshot({
      path: join(capturesDir, "report-links.png"),
      type: "png",
      animations: "disabled",
    });
    framed["report-links"] = { height: 900, complete: true };

    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=overview`,
    );
    await report.locator(".score-svg").waitFor({ timeout: 45_000 });
    await rejectEmpty(report);
    await report.screenshot({
      path: join(capturesDir, "report-overview.png"),
      type: "png",
      animations: "disabled",
    });
    framed["report-overview"] = { height: 900, complete: true };

    const broken = await report.evaluate(() =>
      [...document.images]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.alt || image.src),
    );
    if (broken.length) throw new Error(`Broken images in the report: ${broken.join(", ")}`);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionCopy, { recursive: true, force: true });
    served.server.close();
  }

  const meta: CaptureMeta = {
    runtime: "chromium",
    firefoxRuntime: await probeFirefox(),
    safariRuntime:
      "No Safari extension target exists in this repository, and this machine has no Safari runtime.",
    framed,
  };
  await writeFile(join(capturesDir, "manifest.json"), JSON.stringify(meta, null, 2));
}

async function savePopup(page: Page, name: string) {
  const frame = await framePopup(page);
  const active = page.locator(".rail-link[aria-current='page']");
  if ((await active.count()) > 0) await active.scrollIntoViewIfNeeded();
  await page.locator(".work").screenshot({
    path: join(capturesDir, name),
    type: "png",
    animations: "disabled",
  });
  return frame;
}

async function framePopup(page: Page) {
  await page.setViewportSize({ width: 480, height: 720 });
  const needed = await page.evaluate(() => {
    const view = document.querySelector(".view");
    const head = document.querySelector(".app-head")?.getBoundingClientRect().height ?? 0;
    const foot = document.querySelector(".foot")?.getBoundingClientRect().height ?? 0;
    const viewNeed = (view?.scrollHeight ?? 0) + head + foot + 4;
    return Math.ceil(Math.max(viewNeed, 640));
  });
  const height = Math.min(needed, 1040);
  await page.setViewportSize({ width: 480, height });
  const extra = await page.evaluate(() => {
    const view = document.querySelector(".view");
    if (!view) return 0;
    view.scrollTop = 0;
    return Math.max(0, view.scrollHeight - view.clientHeight);
  });
  if (extra > 1 && height < 1040) {
    await page.setViewportSize({ width: 480, height: Math.min(1040, height + extra + 4) });
  }
  return { height: Math.min(1040, height + (extra > 1 ? extra : 0)), complete: needed <= 1040 };
}

async function rejectEmpty(page: Page) {
  if ((await page.getByText("Not enough measured checks for a score.").count()) > 0) {
    throw new Error("The sample page did not produce a score.");
  }
  const failure = page.locator(".note.status-red");
  if ((await failure.count()) > 0) throw new Error(await failure.first().innerText());
}

async function hideScrollbars(page: Page) {
  await page.addStyleTag({
    content: "*{scrollbar-width:none !important} *::-webkit-scrollbar{display:none !important}",
  });
}

async function tabId(worker: Worker, part: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
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
    const found = tabs.find((tab) => tab.url.includes(part));
    if (found && found.id > 0) return found.id;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`Could not find the sample tab (${part}).`);
}

async function serveFixture() {
  const server = createServer(async (request, response) => {
    const name = new URL(request.url || "/", "http://127.0.0.1").pathname.replace(/^\//, "");
    const file = name || "page.html";
    try {
      const body = await readFile(join(fixtureDir, file));
      const type = file.endsWith(".svg") ? "image/svg+xml" : "text/html; charset=utf-8";
      response.writeHead(200, { "content-type": type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("missing");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not start.");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function extensionForFixture() {
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-marketing-ext-"));
  await cp(extensionDir, dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    host_permissions?: string[];
  };
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  return dir;
}

async function probeFirefox() {
  let detail = "Firefox was not found on this machine.";
  for (const executablePath of ["/usr/bin/firefox", "/usr/lib/firefox/firefox"]) {
    try {
      await access(executablePath);
    } catch {
      continue;
    }
    try {
      const browser = await firefox.launch({ executablePath, headless: true, timeout: 20_000 });
      await browser.close();
      return "System Firefox launched, but this pipeline does not load the unsigned add-on. Firefox images use the shared interface captured in Chromium.";
    } catch (error) {
      detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
      break;
    }
  }
  return `System Firefox is installed, and Playwright could not drive it (${detail}). Playwright's patched Firefox is not installed, and this pipeline does not load the add-on. Firefox images use the shared interface captured in Chromium.`;
}

if (process.argv[1]?.endsWith("capture.ts")) {
  capture().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
