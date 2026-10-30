import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  expect,
  test,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";

const productExtension = resolve(".output/chrome-mv3");

test("scored fixtures render in the popup and the report", async () => {
  test.setTimeout(120_000);
  const served = await serveFixtures();
  const extensionDir = await extensionForLocalFixtures();
  const userDataDir = await mkdtemp(join(tmpdir(), "rankmiso-audit-profile-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });

  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    const extensionId = new URL(worker.url()).host;
    const productManifest = JSON.parse(
      await readFile(join(productExtension, "manifest.json"), "utf8"),
    ) as { host_permissions?: string[] };
    expect(productManifest.host_permissions).toBeUndefined();

    const healthy = await openFixture(context, `${served.origin}/healthy.html`);
    const healthyId = await tabId(worker, "/healthy.html");
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 420, height: 720 });
    const popupStarted = Date.now();
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${healthyId}`);
    await expect(popup.getByRole("heading", { name: "Healthy guide" })).toBeVisible();
    await expect(popup.getByText("Not enough measured checks for a score.")).toHaveCount(0);
    await expect(popup.getByText(/\d+ measured checks/).first()).toBeVisible();
    console.log(`popup audit ms ${Date.now() - popupStarted}`);
    await popup.getByRole("button", { name: "All tools", exact: true }).click();
    const toolsMenu = popup.getByRole("dialog", { name: "All RankMiso tools" });
    await expect(toolsMenu.getByRole("button", { name: "Dark", exact: true })).toBeVisible();
    await toolsMenu.getByRole("button", { name: "Settings", exact: true }).click();
    const inspectionModes = popup.locator(".inspection-mode-segmented");
    await expect(inspectionModes).toBeVisible();
    expect(
      await inspectionModes.evaluate((element) =>
        Array.from(element.children).every(
          (button) => button.scrollWidth <= button.clientWidth + 1,
        ),
      ),
    ).toBe(true);
    await popup.screenshot({ path: reviewScreenshot("popup-settings.png") });
    await popup.getByRole("button", { name: "Overview", exact: true }).click();
    await popup.keyboard.press("Escape");
    await expect(popup.locator(".main-btn")).toHaveCount(1);
    await expect(popup.getByRole("button", { name: "Sidebar", exact: true })).toBeVisible();
    await popup.setViewportSize({ width: 420, height: 650 });
    const needs = popup.getByRole("heading", { name: "Fix next" });
    await expect(needs).toBeVisible();
    const needsBox = await needs.boundingBox();
    const findingBox = await popup.locator(".finding-row").nth(1).boundingBox();
    expect((needsBox?.y ?? 999) + (needsBox?.height ?? 0)).toBeLessThan(650);
    expect((findingBox?.y ?? 999) + (findingBox?.height ?? 0)).toBeLessThan(650);
    expect(await overflows(popup)).toBe(false);
    await expect(popup.locator(".hero-score")).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-overview.png" });
    await popup.setViewportSize({ width: 420, height: 720 });
    await popup.screenshot({ path: "test-results/audit-popup-overview-720.png" });
    await popup.screenshot({
      path: reviewScreenshot("overview-420.png"),
    });
    // A toolbar popup sizes to its page, so the page keeps 420px even in a narrow window.
    await popup.setViewportSize({ width: 360, height: 640 });
    expect(await popup.evaluate(() => document.body.getBoundingClientRect().width)).toBe(420);
    await popup.screenshot({
      path: reviewScreenshot("overview-360.png"),
    });
    await popup.setViewportSize({ width: 420, height: 735 });
    expect(await overflows(popup)).toBe(false);
    await popup.setViewportSize({ width: 420, height: 720 });
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await popup.screenshot({
      path: reviewScreenshot("overview-dark.png"),
    });
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    const tools = popup.locator(".rail-nav");
    const workspace = popup.locator(".view");
    await expect(popup.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await tools.evaluate((el) => {
      el.scrollTop = 120;
    });
    expect(await tools.evaluate((el) => el.scrollTop)).toBeGreaterThan(20);
    expect(await workspace.evaluate((el) => el.scrollTop)).toBe(0);
    await popup.screenshot({ path: reviewScreenshot("nav-middle.png") });
    await tools.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await popup.screenshot({ path: reviewScreenshot("nav-bottom.png") });
    await tools.evaluate((el) => {
      el.scrollTop = 0;
    });
    await popup.screenshot({ path: reviewScreenshot("nav-top.png") });
    await workspace.evaluate((el) => {
      el.scrollTop = 80;
    });
    expect(await tools.evaluate((el) => el.scrollTop)).toBe(0);
    await workspace.evaluate((el) => {
      el.scrollTop = 0;
    });
    await popup.getByRole("button", { name: "Social", exact: true }).click();
    await expect(popup.getByRole("button", { name: "Social", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await popup.getByRole("button", { name: "Overview", exact: true }).click();

    await popup.getByRole("button", { name: "Issues", exact: true }).click();
    await expect(popup.locator(".row-title", { hasText: "Page uses HTTP" })).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-issues.png" });
    await popup.getByRole("button", { name: "Metadata", exact: true }).click();
    await expect(popup.getByRole("heading", { name: "Page identity" })).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-metadata.png" });
    await popup.screenshot({ path: reviewScreenshot("metadata.png") });
    await popup.getByRole("button", { name: "Headings", exact: true }).click();
    await expect(popup.getByText("Healthy topic")).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-headings.png" });
    await popup.screenshot({ path: reviewScreenshot("headings.png") });
    await popup.getByRole("button", { name: "Links", exact: true }).click();
    await expect(popup.getByText("Read the guide")).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-links.png" });
    await popup.screenshot({ path: reviewScreenshot("links.png") });
    await popup.locator("summary", { hasText: "External links" }).click();
    await expect(popup.getByText("Outside reference")).toBeVisible();
    for (const flag of ["nofollow", "sponsored", "ugc"]) {
      await expect(popup.locator(".badge", { hasText: flag })).toBeVisible();
    }
    await popup.screenshot({ path: "test-results/audit-popup-links-external.png" });
    await popup.getByLabel("Search destinations").fill("no-such-link");
    await expect(popup.getByText("No links match this search.")).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-links-search.png" });
    await popup.getByLabel("Search destinations").fill("");
    await expect(popup.getByText("Read the guide")).toBeVisible();
    expect(await overflows(popup)).toBe(false);
    await popup.getByRole("button", { name: "Images", exact: true }).click();
    await expect(popup.getByText("A one pixel sample")).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-images.png" });
    await popup.getByRole("button", { name: "Schema", exact: true }).click();
    await expect(popup.getByText("Article").first()).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-schema.png" });
    await popup.locator("summary", { hasText: "Organization, LocalBusiness" }).click();
    await expect(popup.getByText("Example Company")).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-schema-graph.png" });
    await popup.getByRole("button", { name: "Raw JSON" }).click();
    await expect(
      popup.locator(".code-block", { hasText: '"name": "Example Company"' }),
    ).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-schema-raw.png" });
    expect(await overflows(popup)).toBe(false);
    await popup.getByRole("button", { name: "Social", exact: true }).click();
    await popup.getByText("Full values").first().click();
    await popup.screenshot({ path: "test-results/audit-popup-social-full.png" });
    await expect(popup.getByText(/visual approximations only/)).toBeVisible();
    await popup.screenshot({ path: "test-results/audit-popup-light.png" });
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await popup.screenshot({ path: "test-results/audit-popup-dark.png" });
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

    const review = process.env.RANKMISO_REVIEW_SCREENSHOT_DIR
      ? resolve(process.env.RANKMISO_REVIEW_SCREENSHOT_DIR)
      : resolve("../../docs/design/reviews/ux9r2/final");
    const shots: Array<[string, string]> = [
      ["Content", "content"],
      ["Technical", "technical"],
      ["Performance", "performance"],
      ["International", "international"],
      ["Accessibility", "accessibility"],
      ["Site", "site"],
      ["Sitemaps", "sitemaps"],
      ["History", "history"],
      ["Export", "export"],
      ["Settings", "settings"],
    ];
    for (const [name, file] of shots) {
      await popup.getByRole("button", { name, exact: true }).click();
      if (file === "history") {
        await expect(popup.getByRole("heading", { name: "SEO over time" })).toBeVisible();
      }
      await popup.screenshot({ path: `${review}/${file}.png` });
    }
    await popup.getByRole("button", { name: "Issues", exact: true }).click();
    await popup.screenshot({ path: `${review}/issues.png` });
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await popup.screenshot({ path: `${review}/issues-dark.png` });
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await popup.getByRole("button", { name: "Metadata", exact: true }).click();
    await popup.screenshot({ path: `${review}/metadata.png` });
    await popup.getByRole("button", { name: "Headings", exact: true }).click();
    await popup.screenshot({ path: `${review}/headings.png` });
    await popup.getByRole("button", { name: "Links", exact: true }).click();
    await popup.screenshot({ path: `${review}/links.png` });
    await popup.getByRole("button", { name: "Images", exact: true }).click();
    await popup.screenshot({ path: `${review}/images.png` });
    await popup.getByRole("button", { name: "Schema", exact: true }).click();
    await popup.screenshot({ path: `${review}/schema.png` });
    await popup.getByRole("button", { name: "Social", exact: true }).click();
    await popup.screenshot({ path: `${review}/social.png` });
    await popup.getByRole("button", { name: "Overview", exact: true }).click();
    await popup.screenshot({ path: `${review}/overview.png` });

    const darkDir = resolve("../../docs/design/reviews/ux9r2-fidelity/production-dark");
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const darkShots: Array<[string, string]> = [
      ["Overview", "overview"],
      ["Issues", "issues"],
      ["Metadata", "metadata"],
      ["Content", "content"],
      ["Headings", "headings"],
      ["Links", "links"],
      ["Images", "images"],
      ["Schema", "schema"],
      ["Social", "social"],
      ["Technical", "technical"],
      ["Performance", "performance"],
      ["International", "international"],
      ["Accessibility", "accessibility"],
      ["Site", "site"],
      ["Sitemaps", "sitemaps"],
      ["History", "history"],
      ["Export", "export"],
      ["Settings", "settings"],
    ];
    for (const [name, file] of darkShots) {
      await popup.getByRole("button", { name, exact: true }).click();
      if (file === "history") {
        await expect(popup.getByRole("heading", { name: "SEO over time" })).toBeVisible();
      }
      await popup.screenshot({ path: `${darkDir}/${file}.png` });
    }
    await popup.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await popup.getByRole("button", { name: "Overview", exact: true }).click();

    const opened = context.waitForEvent("page");
    await popup.getByRole("button", { name: "Headings", exact: true }).click();
    await popup.getByRole("button", { name: "Open heading report" }).click();
    const linked = await opened;
    await linked.waitForURL(/section=headings/);
    await expect(linked.getByText("Healthy topic").locator("visible=true").first()).toBeVisible();
    await linked.setViewportSize({ width: 1280, height: 800 });
    await linked.getByRole("button", { name: "Schema", exact: true }).click();
    await expect(linked.getByText("Article").locator("visible=true").first()).toBeVisible();
    await linked.locator("summary", { hasText: "Organization, LocalBusiness" }).click();
    await linked.screenshot({ path: "test-results/audit-report-schema.png", fullPage: true });
    await linked.getByRole("button", { name: "Links", exact: true }).click();
    await expect(linked.getByText("Read the guide").locator("visible=true")).toBeVisible();
    await linked.screenshot({ path: "test-results/audit-report-links.png", fullPage: true });
    expect(await overflows(linked)).toBe(false);
    await healthy.close();

    const issues = await openFixture(context, `${served.origin}/issues.html`);
    const issuesId = await tabId(worker, "/issues.html");
    const reportStarted = Date.now();
    const report = await context.newPage();
    await report.setViewportSize({ width: 1280, height: 800 });
    await report.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${issuesId}&section=issues`,
    );
    await expect(shown(report, "Images missing alt attributes")).toBeVisible();
    console.log(`report audit ms ${Date.now() - reportStarted}`);
    await expect(shown(report, "Meta description is missing")).toBeVisible();
    await expect(shown(report, "Multiple H1 elements")).toBeVisible();
    await expect(shown(report, "Empty headings")).toBeVisible();
    await expect(shown(report, "JSON-LD syntax error")).toBeVisible();
    await expect(report.getByText("Fix the JSON syntax.").filter({ visible: true })).toHaveCount(1);
    const metaDescription = report
      .locator("article")
      .filter({ has: shown(report, "Meta description is missing") })
      .first();
    await metaDescription.getByText("Inspect evidence").click();
    await expect(metaDescription.getByText("How to check")).toBeVisible();
    const example = metaDescription.locator("code", { hasText: '<meta name="description"' });
    await expect(example).not.toHaveCount(0);
    expect(await report.locator("code meta").count()).toBe(0);

    await report.getByRole("button", { name: /^Errors · / }).click();
    await expect(shown(report, "Images missing alt attributes")).toBeVisible();
    await expect(shown(report, "Meta description is missing")).toHaveCount(0);
    await report.getByRole("button", { name: /^Warnings · / }).click();
    await expect(shown(report, "Multiple H1 elements")).toBeVisible();
    await expect(shown(report, "Images missing alt attributes")).toHaveCount(0);
    await report.getByRole("button", { name: "All", exact: true }).click();
    await report.getByLabel("Category", { exact: true }).selectOption({ label: "Images" });
    await expect(shown(report, "Images missing alt attributes")).toBeVisible();
    await expect(shown(report, "JSON-LD syntax error")).toHaveCount(0);
    await report.getByLabel("Category", { exact: true }).selectOption({ label: "All" });
    await report.getByPlaceholder("Filter checks…").locator("visible=true").fill("JSON-LD syntax");
    await expect(shown(report, "JSON-LD syntax error")).toBeVisible();
    await expect(shown(report, "Empty headings")).toHaveCount(0);
    await report.getByPlaceholder("Filter checks…").locator("visible=true").fill("");
    await report
      .getByLabel("Sort", { exact: true })
      .locator("visible=true")
      .selectOption({ label: "Title" });
    const titles = await report
      .locator("article")
      .filter({ visible: true })
      .locator("h3")
      .allTextContents();
    expect(titles).toEqual([...titles].sort((left, right) => left.localeCompare(right)));
    await report
      .getByLabel("Sort", { exact: true })
      .locator("visible=true")
      .selectOption({ label: "Severity" });
    const bySeverity = await report
      .locator("article")
      .filter({ visible: true })
      .locator("h3")
      .allTextContents();
    expect(bySeverity.indexOf("Images missing alt attributes")).toBeLessThan(
      bySeverity.indexOf("Meta description is missing"),
    );
    await report.screenshot({ path: "test-results/audit-issues.png", fullPage: true });
    await report.getByRole("button", { name: "Schema", exact: true }).click();
    await expect(report.getByText("JSON did not parse").locator("visible=true")).toBeVisible();
    await report.screenshot({
      path: "test-results/audit-report-schema-invalid.png",
      fullPage: true,
    });
    await report.getByRole("button", { name: "Links", exact: true }).click();
    await report.locator("summary", { hasText: "Other link types" }).click();
    await expect(report.getByText("Script link", { exact: true })).toBeVisible();
    await report.screenshot({ path: "test-results/audit-report-links-other.png", fullPage: true });

    await report.getByRole("button", { name: "Headings", exact: true }).click();
    await expect(report).toHaveURL(/section=headings/);
    await expect(report.getByText("First topic").locator("visible=true")).not.toHaveCount(0);
    expect(await overflows(report)).toBe(false);
    await report.setViewportSize({ width: 360, height: 640 });
    await expect(report.getByLabel("Current view")).toHaveCount(0);
    await expect(report.getByRole("button", { name: "Headings", exact: true })).toBeVisible();
    expect(await overflows(report)).toBe(false);
    await report.screenshot({ path: "test-results/audit-dashboard-360.png", fullPage: true });
    await report.setViewportSize({ width: 320, height: 640 });
    expect(await overflows(report)).toBe(false);
    await report.setViewportSize({ width: 768, height: 1024 });
    await report.screenshot({ path: "test-results/audit-dashboard-768.png", fullPage: true });
    await report.setViewportSize({ width: 1280, height: 800 });

    await report.setViewportSize({ width: 1280, height: 800 });
    await report.getByRole("button", { name: "Links", exact: true }).click();
    await report.screenshot({ path: "test-results/audit-report-links.png" });
    await report.getByRole("button", { name: "Social", exact: true }).click();
    await expect(
      report.getByText("These previews are approximations.").locator("visible=true"),
    ).toBeVisible();
    await report.screenshot({ path: "test-results/audit-report-social.png" });
    await report.getByRole("button", { name: "Overview", exact: true }).click();
    const issuesPerformance = report.locator(".category-item").filter({ hasText: "Performance" });
    await expect(issuesPerformance).toContainText("Not measured");
    await expect(issuesPerformance.locator(".fill")).toHaveCount(0);
    await report.screenshot({ path: "test-results/audit-dashboard-overview.png" });
    await expect(report.getByRole("button", { name: "Performance", exact: true })).toBeVisible();
    await expect(report.getByRole("button", { name: "International", exact: true })).toBeVisible();
    await expect(report.getByRole("button", { name: "Accessibility", exact: true })).toBeVisible();
    await report.getByRole("button", { name: "Performance", exact: true }).click();
    await expect(report.getByText("PageSpeed Insights was not requested").first()).toBeVisible();
    await report.getByRole("button", { name: "Export", exact: true }).click();
    const json = await downloadText(report, "Export JSON");
    const parsed = JSON.parse(json) as { page: { url: string }; checks: Array<{ id: string }> };
    expect(parsed.page.url).toContain("/issues.html");
    expect(parsed.checks.some((check) => check.id === "RULE_IMAGE_ALT_MISSING")).toBe(true);
    const csv = await downloadText(report, "Export headings CSV");
    expect(csv).toContain(`"'=1+1"`);
    const html = await downloadText(report, "Download HTML report");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");

    await report.getByRole("button", { name: "History", exact: true }).click();
    await report.getByRole("button", { name: "Save current comparison" }).click();
    await expect(report.getByText("Comparison saved on this device.")).toBeVisible();
    await report.reload();
    await expect(report.getByText("Saved comparisons: 1")).toBeVisible();
    await expect(report.getByText(/Saved page:.*\/issues\.html/)).toBeVisible();

    await report.getByRole("button", { name: "Settings", exact: true }).click();
    await report.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(report.locator("html")).toHaveAttribute("data-theme", "dark");
    await report.screenshot({ path: "test-results/audit-dashboard-dark.png" });
    await report.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await report.getByRole("button", { name: "System", exact: true }).click();
    await expect(report.locator("html")).toHaveAttribute("data-theme", "dark");
    const motion = await report.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.animation = "spin 1s linear infinite";
      document.body.appendChild(probe);
      return getComputedStyle(probe).animationName;
    });
    expect(motion).toBe("none");

    const panel = await context.newPage();
    await panel.setViewportSize({ width: 350, height: 720 });
    const sidebarStarted = Date.now();
    await panel.goto(
      `chrome-extension://${extensionId}/sidepanel.html?tabId=${issuesId}&section=metadata`,
    );
    await expect(panel.getByLabel("Current view")).toHaveCount(0);
    await expect(panel.locator(".top-title")).toContainText("Issues");
    console.log(`sidebar audit ms ${Date.now() - sidebarStarted}`);
    await panel.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(panel.locator(".score-figure")).toBeVisible();
    await panel.screenshot({ path: "test-results/audit-sidebar-overview.png" });
    await panel.getByRole("button", { name: "Metadata", exact: true }).click();
    await panel.screenshot({ path: "test-results/audit-sidebar-metadata.png" });
    await panel.getByRole("button", { name: "Social", exact: true }).click();
    await expect(panel.getByText("These previews are approximations.")).toBeVisible();
    await panel.screenshot({ path: "test-results/audit-sidebar-nav.png" });
    await panel.screenshot({ path: "test-results/audit-sidebar-social.png" });
    await panel.getByRole("button", { name: "Headings", exact: true }).click();
    await expect(panel).toHaveURL(/section=headings/);
    await expect(panel.getByText("First topic").locator("visible=true")).not.toHaveCount(0);
    await panel.screenshot({ path: "test-results/audit-sidebar-headings.png" });
    await panel.getByRole("button", { name: "Links", exact: true }).click();
    await panel.screenshot({ path: "test-results/audit-sidebar-links.png" });
    await panel.getByRole("button", { name: "Schema", exact: true }).click();
    await expect(panel.getByText("JSON did not parse").first()).toBeVisible();
    await panel.screenshot({ path: "test-results/audit-sidebar-schema.png" });
    expect(await overflows(panel)).toBe(false);
    await panel.close();

    await issues.close();
    await report.close();

    const socialPage = await openFixture(context, `${served.origin}/social-large.html`);
    const socialId = await tabId(worker, "/social-large.html");
    const socialPopup = await context.newPage();
    await socialPopup.setViewportSize({ width: 420, height: 720 });
    await socialPopup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${socialId}`);
    await expect(socialPopup.getByRole("heading", { name: "Wide share" })).toBeVisible();
    await socialPopup.getByRole("button", { name: "Social", exact: true }).click();
    await expect(socialPopup.locator(".badge", { hasText: "summary_large_image" })).toBeVisible();
    await socialPopup.screenshot({ path: "test-results/audit-popup-social-large.png" });
    await socialPopup.getByText("Full values").first().click();
    await socialPopup.screenshot({ path: "test-results/audit-popup-social-large-full.png" });
    await socialPopup.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await socialPopup.screenshot({ path: "test-results/audit-popup-social-dark.png" });
    expect(await overflows(socialPopup)).toBe(false);
    await socialPopup.close();
    await socialPage.close();

    const sparse = await openFixture(context, `${served.origin}/sparse.html`);
    const sparseId = await tabId(worker, "/sparse.html");
    const sparseReport = await context.newPage();
    await sparseReport.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${sparseId}&section=overview`,
    );
    await expect(sparseReport.locator(".top-title")).toContainText("Sparse page");
    const performance = sparseReport.locator(".category-item").filter({ hasText: "Performance" });
    await expect(performance).toContainText("Not measured");
    await expect(performance).not.toContainText("100");
    await expect(performance.locator(".fill")).toHaveCount(0);
    await sparseReport.getByRole("button", { name: "Issues", exact: true }).click();
    await sparseReport.getByRole("button", { name: /^Passed · / }).click();
    await expect(
      sparseReport.getByRole("heading", { name: "PageSpeed Insights was not requested" }),
    ).toHaveCount(0);
    await sparse.close();

    const largePage = await openFixture(context, `${served.origin}/large.html`);
    const largeId = await tabId(worker, "/large.html");
    const largeReport = await context.newPage();
    const largeStarted = Date.now();
    await largeReport.goto(
      `chrome-extension://${extensionId}/dashboard.html?tabId=${largeId}&section=overview`,
    );
    await expect(largeReport.getByText("Audit available")).toBeVisible();
    await expect(largeReport.getByText(/\d+ measured checks/).first()).toBeVisible();
    console.log(`large-page audit ms ${Date.now() - largeStarted}`);
    const heapBytes = await largeReport.evaluate(() => {
      const browserPerformance = window.performance as unknown as Performance & {
        memory?: { usedJSHeapSize?: number };
      };
      return browserPerformance.memory?.usedJSHeapSize ?? null;
    });
    console.log(`large-page JS heap bytes ${heapBytes ?? "unavailable"}`);
    await largeReport.close();
    await largePage.close();
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
    await rm(extensionDir, { recursive: true, force: true });
    await new Promise<void>((done, reject) =>
      served.server.close((error) => (error ? reject(error) : done())),
    );
  }
});

function shown(page: Page, name: string) {
  return page.getByRole("heading", { name }).filter({ visible: true });
}

async function serveFixtures() {
  const root = resolve("browser-tests/fixtures");
  const server = createServer(async (request, response) => {
    const name = new URL(request.url || "/", "http://127.0.0.1").pathname.replace(/^\//, "");
    try {
      const body =
        name === "large.html" ? Buffer.from(largePageFixture()) : await readFile(join(root, name));
      const type = name.endsWith(".png")
        ? "image/png"
        : name.endsWith(".svg")
          ? "image/svg+xml"
          : "text/html; charset=utf-8";
      response.writeHead(200, { "content-type": type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("missing");
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not start");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function largePageFixture() {
  const sections = Array.from(
    { length: 500 },
    (_, index) =>
      `<section><h2>Section ${index + 1}</h2><p>Representative audit text for section ${index + 1}.</p><a href="#section-${index + 1}">Read section ${index + 1}</a></section>`,
  ).join("");
  return `<!doctype html><html lang="en"><head><title>Large audit fixture</title><meta name="description" content="A deterministic page with 500 sections and 500 links."></head><body><h1>Large audit fixture</h1>${sections}</body></html>`;
}

async function extensionForLocalFixtures() {
  const dir = await mkdtemp(join(tmpdir(), "rankmiso-audit-ext-"));
  await cp(productExtension, dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    host_permissions?: string[];
  };
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, JSON.stringify(manifest));
  return dir;
}

async function openFixture(context: BrowserContext, url: string) {
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

async function tabId(worker: Worker, urlPart: string) {
  let found = 0;
  await expect
    .poll(async () => {
      const tabs = await worker.evaluate(async () => {
        const browser = (
          globalThis as unknown as {
            chrome: {
              tabs: {
                query: (query: object) => Promise<Array<{ id?: number; url?: string }>>;
              };
            };
          }
        ).chrome;
        const all = await browser.tabs.query({});
        return all.map((tab) => ({ id: tab.id ?? 0, url: tab.url ?? "" }));
      });
      found = tabs.find((tab) => tab.url.includes(urlPart))?.id ?? 0;
      return found;
    })
    .toBeGreaterThan(0);
  return found;
}

async function overflows(page: Page) {
  return page.evaluate(() => {
    const root = document.body.classList.contains("popup")
      ? document.body
      : document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
}

function reviewScreenshot(name: string) {
  const outputDirectory = process.env.RANKMISO_REVIEW_SCREENSHOT_DIR;
  return outputDirectory
    ? join(outputDirectory, name)
    : join("../../docs/design/reviews/ux9r/final", name);
}

async function downloadText(page: Page, name: string) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  const file = await download;
  const path = await file.path();
  if (!path) throw new Error(`${name} did not download`);
  return readFile(path, "utf8");
}
