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

    // More popup destinations.
    const popupViews: Array<[string, string]> = [
      ["issues", "Findings"],
      ["performance", "Browser observations"],
      ["accessibility", "Accessible foundations"],
      ["export", "Your report, your data"],
    ];
    for (const [nav, ready] of popupViews) {
      await popup.locator(`[data-nav="${nav}"]`).click();
      await popup.getByText(ready, { exact: true }).first().waitFor();
      framed[`popup-${nav}`] = await savePopup(popup, `popup-${nav}.png`);
    }

    // Settings: keep the top of the screen so the website-access choice stays legible.
    await popup.locator('[data-nav="settings"]').click();
    await popup.getByText("Website inspection", { exact: true }).waitFor();
    await popup.setViewportSize({ width: 480, height: 720 });
    const settingsFrame = await popup.locator(".work").evaluate((work) => {
      const bounds = work.getBoundingClientRect();
      const nextSection = [...work.querySelectorAll("h2")].find(
        (heading) => heading.textContent?.trim() === "Extension behavior",
      );
      const bottom = nextSection?.getBoundingClientRect().top ?? bounds.bottom;
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: Math.max(1, Math.floor(bottom - bounds.y)),
      };
    });
    await popup.screenshot({
      path: join(capturesDir, "popup-settings.png"),
      clip: settingsFrame,
      type: "png",
      animations: "disabled",
    });
    framed["popup-settings"] = { height: settingsFrame.height, complete: false };

    // Language targeting reads the visit page, which declares hreflang alternates.
    await fixture.goto(`${served.origin}/visit.html`, { waitUntil: "load" });
    const visitId = await tabId(worker, "/visit.html");
    const visitPopup = await context.newPage();
    await visitPopup.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await visitPopup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${visitId}`);
    await visitPopup.locator(".hero-score").waitFor({ timeout: 45_000 });
    await hideScrollbars(visitPopup);
    await visitPopup.locator('[data-nav="international"]').click();
    await visitPopup.getByText("Alternate pages", { exact: true }).waitFor();
    framed["popup-international"] = await savePopup(visitPopup, "popup-international.png");
    await visitPopup.close();
    await fixture.goto(`${served.origin}/page.html`, { waitUntil: "load" });

    // Report sections at desktop width.
    const saveReport = async (name: string) => {
      await hideScrollbars(report);
      await report.screenshot({
        path: join(capturesDir, `${name}.png`),
        type: "png",
        animations: "disabled",
      });
      framed[name] = { height: 900, complete: true };
    };
    const openSection = async (section: string, heading: string) => {
      await report.goto(
        `chrome-extension://${extensionId}/dashboard.html?tabId=${id}&section=${section}`,
      );
      await report.getByRole("heading", { name: heading }).first().waitFor({ timeout: 45_000 });
    };

    await openSection("technical", "Diagnostic workspace");
    await saveReport("report-technical");

    await openSection("overview", "Your SEO snapshot");
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await saveReport("report-dark");
    await report.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

    await openSection("sitemaps", "Sitemap Explorer");
    await report.getByRole("button", { name: "Discover sitemaps" }).click();
    await report.getByText(`${served.origin}/schedule.html`).first().waitFor({ timeout: 30_000 });
    await saveReport("report-sitemaps");

    await openSection("site", "Site Explorer");
    await report.getByRole("button", { name: "Start crawl" }).click();
    await report.getByText("Complete", { exact: true }).first().waitFor({ timeout: 90_000 });
    await saveReport("report-site");

    // The sidebar docked beside the sample page, as the browser shows it.
    await fixture.setViewportSize({ width: 740, height: 900 });
    await fixture.bringToFront();
    // Screenshot-only styling so the sample page reads like a real site. The audit already ran.
    await fixture.addStyleTag({ content: pageStyle });
    await fixture.screenshot({ path: join(capturesDir, "web-page.png"), type: "png" });
    const sidebar = await context.newPage();
    await sidebar.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await sidebar.setViewportSize({ width: 400, height: 900 });
    await sidebar.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${id}`);
    await sidebar.locator(".score-svg").first().waitFor({ timeout: 45_000 });
    await hideScrollbars(sidebar);
    await sidebar.screenshot({
      path: join(capturesDir, "sidebar.png"),
      type: "png",
      animations: "disabled",
    });
    framed["sidebar"] = { height: 900, complete: true };
    await sidebar.close();

    // History: save three real measurements while earlier versions of the page are served.
    // Each version keeps the same measured checks so the saves stay comparable.
    const noAlt = (html: string) => html.replace(/ alt="[^"]*"/, "");
    const versions: Array<((html: string) => string) | undefined> = [
      (html) => noAlt(html).replace(/<title>[^<]*<\/title>/, "<title>Notes</title>"),
      noAlt,
      undefined,
    ];
    await openSection("reports", "SEO history");
    for (const [index, edit] of versions.entries()) {
      served.state.edit = edit;
      await fixture.reload({ waitUntil: "load" });
      if (index === 0) {
        await report.reload();
        await report.getByRole("heading", { name: "SEO history" }).waitFor({ timeout: 45_000 });
      } else {
        await report
          .getByText("This result is from an earlier page.")
          .first()
          .waitFor({ timeout: 20_000 });
        await report.getByRole("button", { name: "Refresh analysis" }).click();
        await report
          .getByText("This result is from an earlier page.")
          .first()
          .waitFor({ state: "detached" });
      }
      await report.getByRole("button", { name: "Save current comparison" }).click();
      await report.getByText("Comparison saved on this device.").first().waitFor();
    }
    await report.reload();
    await report.getByRole("heading", { name: "Score history" }).waitFor({ timeout: 45_000 });
    await saveReport("report-history");
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
  const height = Math.min(needed, 1080);
  await page.setViewportSize({ width: 480, height });
  const extra = await page.evaluate(() => {
    const view = document.querySelector(".view");
    if (!view) return 0;
    view.scrollTop = 0;
    return Math.max(0, view.scrollHeight - view.clientHeight);
  });
  if (extra > 1 && height < 1080) {
    await page.setViewportSize({ width: 480, height: Math.min(1080, height + extra + 4) });
  }
  return { height: Math.min(1080, height + (extra > 1 ? extra : 0)), complete: needed <= 1080 };
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

const pageStyle = `
  body { margin: 0; background: #fbfaf7; color: #1d2026; font: 17px/1.6 Georgia, "DejaVu Serif", serif; }
  article { max-width: 640px; margin: 0 auto; padding: 56px 32px; }
  h1 { font: 700 40px/1.1 "Liberation Sans", Arial, sans-serif; letter-spacing: -0.02em; margin: 0 0 18px; }
  h2 { font: 700 24px/1.2 "Liberation Sans", Arial, sans-serif; margin: 36px 0 8px; }
  h3 { font: 700 13px/1.3 "Liberation Sans", Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.08em; color: #c42a20; margin: 22px 0 4px; }
  img { width: 100%; height: auto; border-radius: 6px; }
  a { color: #c42a20; }
`;

const contentTypes: Record<string, string> = {
  svg: "image/svg+xml",
  xml: "application/xml",
  txt: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
};

/** Serves marketing/fixture. `edit` lets the History shot serve earlier versions of page.html. */
async function serveFixture() {
  const state: { edit?: (html: string) => string } = {};
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    const file = fixtureFileName(pathname);
    if (!file) {
      response.writeHead(404, { "content-type": contentTypes.html });
      response.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
      return;
    }
    try {
      let body = (await readFile(join(fixtureDir, file), "utf8")).replaceAll("__ORIGIN__", origin);
      if (file === "page.html" && state.edit) body = state.edit(body);
      const type = contentTypes[file.split(".").pop() ?? ""] ?? contentTypes.html;
      response.writeHead(200, { "content-type": type });
      response.end(file.endsWith(".svg") ? await readFile(join(fixtureDir, file)) : body);
    } catch {
      response.writeHead(404, { "content-type": contentTypes.html });
      response.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server did not start.");
  const origin = `http://127.0.0.1:${address.port}`;
  return { server, origin, state };
}

const fixtureFiles = new Set([
  "page.html",
  "gallery.html",
  "schedule.html",
  "tools.html",
  "visit.html",
  "robots.txt",
  "sitemap.xml",
  "harbor.svg",
]);

export function fixtureFileName(pathname: string): string | undefined {
  const name = pathname === "/" ? "page.html" : pathname.slice(1);
  return !name.includes("/") && !name.includes("\\") && fixtureFiles.has(name) ? name : undefined;
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
