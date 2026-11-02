// Real Google Chrome acceptance for the RankMiso companion on Linux.
//
// Usage:
//   node scripts/plugin/chrome-acceptance.mjs <home> <extension-dir> <public-key-base64>
//
// <home> is an isolated HOME in which `plugins/rankmiso/bin/rankmiso connect --yes`
// already installed the companion. Chrome refuses automation on its default
// profile folder, so it gets a separate profile whose NativeMessagingHosts
// folder links to <home>/.config/google-chrome/NativeMessagingHosts: Chrome
// reads the manifest exactly as the installer wrote it.
// <extension-dir> is an unpacked RankMiso build. A temporary copy gets the
// store public key (so its ID is the production ID), a pregranted
// nativeMessaging permission (headless Chrome cannot show the prompt), and
// access to the local fixture page. The share is made through the real UI.
// Prints one JSON evidence object and exits 0 only when the share succeeded.
import { cp, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const require = createRequire(resolve("apps/extension/package.json"));
const { chromium } = require("@playwright/test");

const [home, extensionSource, publicKey] = process.argv.slice(2).map((arg, i) => (i < 2 ? resolve(arg) : arg));
if (!home || !extensionSource || !publicKey) throw new Error("usage: <home> <extension-dir> <public-key-base64>");
const PRODUCTION_ID = "gdklhfalmmahhgimegjlfnhmacimeonl";
const auditDir = join(home, ".local/share/rankmiso-mcp/audits");
const work = await mkdtemp(join(tmpdir(), "rankmiso-chrome-"));
const userDataDir = join(work, "profile");
await mkdir(userDataDir);
await symlink(join(home, ".config/google-chrome/NativeMessagingHosts"), join(userDataDir, "NativeMessagingHosts"));
const extensionDir = join(work, "extension");
const evidence = { browser: spawnSync("google-chrome", ["--version"], { encoding: "utf8" }).stdout.trim() };

await cp(extensionSource, extensionDir, { recursive: true });
const manifestPath = join(extensionDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
evidence.extensionVersion = manifest.version;
manifest.key = publicKey;
manifest.permissions = [...(manifest.permissions ?? []), "nativeMessaging"];
manifest.optional_permissions = (manifest.optional_permissions ?? []).filter((p) => p !== "nativeMessaging");
manifest.host_permissions = ["http://127.0.0.1/*"];
await writeFile(manifestPath, JSON.stringify(manifest));

// Record the argv of every native host process Chrome starts.
const hostLaunches = [];
let watching = true;
const watchHosts = (async () => {
  const seen = new Set();
  while (watching) {
    for (const pid of await readdir("/proc").catch(() => [])) {
      if (!/^\d+$/.test(pid) || seen.has(pid)) continue;
      const exe = await readlink(`/proc/${pid}/exe`).catch(() => "");
      if (!exe.endsWith("/rankmiso-mcp-native-host")) continue;
      seen.add(pid);
      const argv = (await readFile(`/proc/${pid}/cmdline`, "utf8").catch(() => "")).split("\0").filter(Boolean);
      hostLaunches.push({ exe, args: argv.slice(1) });
    }
    await new Promise((done) => setImmediate(done));
  }
})();

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end("<!doctype html><html lang='en'><head><title>RankMiso acceptance fixture</title><meta name='description' content='Local acceptance page'></head><body><h1>Acceptance page</h1><p>Local content.</p></body></html>");
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/`;

let context;
let exitCode = 1;
try {
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: true,
    ignoreDefaultArgs: ["--no-sandbox", "--disable-extensions"],
    // Chrome keeps the real HOME; the native host it starts reads its config
    // from XDG_CONFIG_HOME, which points into the isolated HOME.
    env: { ...process.env, XDG_CONFIG_HOME: join(home, ".config") },
  });
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send("Extensions.loadUnpacked", { path: extensionDir });
  await cdp.detach();
  evidence.extensionId = id;
  if (id !== PRODUCTION_ID) throw new Error(`extension loaded as ${id}, not ${PRODUCTION_ID}`);

  const page = await context.newPage();
  await page.goto(url);
  const report = await context.newPage();
  report.setDefaultTimeout(10_000);
  await report.goto(`chrome-extension://${id}/dashboard.html`);
  const tabId = await report.evaluate(async (target) => (await chrome.tabs.query({ url: target }))[0]?.id, url);
  await report.goto(`chrome-extension://${id}/dashboard.html?tabId=${tabId}`);
  await report.locator(".top-title").filter({ hasText: "RankMiso acceptance fixture" }).waitFor();
  await report.getByRole("button", { name: "AI Integrations", exact: true }).click();
  // A fresh profile starts with local sharing off: the user turns it on.
  const enable = report.getByRole("button", { name: "Enable local sharing", exact: true });
  if (await enable.isVisible().catch(() => false)) await enable.click();
  const status = report.locator(".mcp-status");
  await status.waitFor();
  await report.waitForFunction(() => {
    const value = document.querySelector(".mcp-status")?.getAttribute("data-status");
    return value && !["checking", "connecting", "unknown", "ready"].includes(value);
  }, undefined, { timeout: 15_000 }).catch(() => {});
  evidence.companionStatus = await status.getAttribute("data-status");
  evidence.companionStatusText = (await status.innerText()).replace(/\s+/g, " ").trim();
  if (evidence.companionStatus !== "connected") throw new Error(`companion status ${evidence.companionStatus}`);

  const before = new Set(await readdir(auditDir));
  await report.getByRole("button", { name: "Export", exact: true }).click();
  await report.getByRole("button", { name: "Share with MCP" }).click();
  await report.getByRole("dialog").getByRole("button", { name: "Share audit" }).click();
  await report.locator(".toast").filter({ hasText: "Audit Shared Successfully" }).waitFor();
  const added = (await readdir(auditDir)).filter((name) => !before.has(name));
  if (added.length !== 1) throw new Error(`expected one new snapshot, found ${added.length}`);
  const shared = JSON.parse(await readFile(join(auditDir, added[0]), "utf8"));
  evidence.snapshot = { file: added[0], schemaVersion: shared.schemaVersion, pageUrl: shared.page?.url, pageTitle: shared.page?.title };
  exitCode = 0;
} catch (error) {
  evidence.error = String(error?.message ?? error).split("\n")[0];
} finally {
  await context?.close().catch(() => {});
  server.close();
  watching = false;
  await watchHosts;
  evidence.hostLaunches = hostLaunches;
  await rm(work, { recursive: true, force: true });
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(exitCode);
}
