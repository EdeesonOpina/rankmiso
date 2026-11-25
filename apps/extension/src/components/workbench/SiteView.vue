<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from "vue";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Link,
  ListChecks,
  LoaderCircle,
  Play,
  Radar,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Waypoints,
  X,
} from "lucide-vue-next";
import { browser } from "wxt/browser";
import { safeFilename } from "@rankmiso/report-formats";
import { appConfig } from "../../config/app.config";
import { supportsSiteCrawling } from "../../config/features.config";
import { useI18n } from "../../composables/useI18n";
import { analyzeSnapshot } from "../../services/engine";
import {
  CRAWL_LIMITS,
  filterPages,
  loadCrawl,
  runSiteCrawl,
  saveCrawl,
  sessionCsv,
  sortPages,
  type CrawlPage,
  type CrawlLimitReason,
  type CrawlSession,
} from "../../services/site-crawl";
import { extractCrawlPage, snapshotFromHtml } from "../../services/site-extract";
import {
  analyzeSite,
  filterSiteIssues,
  resolvedAnalyzedPages,
  siteAnalysisCsv,
  siteAnalysisJson,
  sortSiteIssues,
} from "../../services/site-analysis";
import {
  compareSnapshots,
  comparisonApplies,
  comparisonCsv,
  comparisonJson,
} from "../../services/site-compare";
import {
  clearUnreadableHistory,
  deleteSnapshot,
  readHistory,
  saveSnapshot,
  type CrawlSnapshot,
  type HistoryRead,
} from "../../services/site-history";
import type { SiteComparison } from "../../services/site-compare";
import { permissionPatternMatchesUrl, sitePermission } from "../../services/page-access";
import {
  discoverSitemapUrls,
  fetchCrawlPage,
  mayFetchPath,
  readRobots,
} from "../../services/site-crawl-network";
import type { AuditResult, CheckStatus } from "../../types/audit";
import type { LinkObservation } from "../../services/site-analysis";
import { badgeTone, statusKey } from "./checks";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import { categoryIcon } from "./site-icons";
import SiteComparePanel from "./SiteComparePanel.vue";
import SiteCrawlConsole from "./SiteCrawlConsole.vue";
import SxPanel from "./SxPanel.vue";
import SiteRelationsPanel from "./SiteRelationsPanel.vue";
import { hasRedirectDetails, observeRedirects } from "../../services/redirect-observer";
import SxStat from "./SxStat.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { surface, copy, openReport, toast, crumb } = useWorkbench();
const report = surface === "report";
const pageUrl = computed(() => props.audit.page.url);
const session = ref<CrawlSession | null>(null);
const analysisSession = ref<CrawlSession | null>(null);
const running = ref(false);
const permissionPending = ref(false);
const message = ref("");
const query = ref("");
const filter = ref("all");
const sort = ref("url");
const shown = ref(40);
const selectedUrl = ref("");
const activeView = ref<"overview" | "issues" | "pages" | "links" | "compare">("overview");
const history = ref<HistoryRead>({ snapshots: [], unreadable: 0, corruptStore: false });
const baselineId = ref("");
const comparisonId = ref("live");
const comparison = ref<SiteComparison | null>(null);
const comparedSelection = ref<{ baseline: string; later: string; liveStamp: string } | null>(null);
const comparing = ref(false);
const savedStamp = ref("");
const linkState = ref<"all" | LinkObservation["targetState"]>("all");
const linkStates = ["analyzed", "not-crawled", "skipped", "failed"] as const;
const liveStamp = computed(() => {
  const current = session.value;
  if (!current) return "";
  return `${current.id}\u0000${current.startedAt}\u0000${current.finishedAt ?? ""}\u0000${current.pages.length}`;
});
const shownComparison = computed(() => {
  const selected = comparedSelection.value;
  if (!comparison.value || !selected) return null;
  return comparisonApplies(
    selected.baseline,
    selected.later,
    selected.liveStamp,
    baselineId.value,
    comparisonId.value,
    liveStamp.value,
  )
    ? comparison.value
    : null;
});
const comparisonStale = computed(() => comparison.value != null && shownComparison.value == null);
const issueCategory = ref("all");
const issueSeverity = ref<"all" | "error" | "warning" | "info" | "undefined">("all");
const issueSort = ref<"affected" | "severity" | "name">("affected");
let controller: AbortController | null = null;
let disposed = false;

const origin = computed(() => {
  try {
    return new URL(pageUrl.value).origin;
  } catch {
    return "";
  }
});
const originSnapshots = computed(() =>
  history.value.snapshots.filter((snapshot) => snapshot.origin === origin.value),
);
const visible = computed(() =>
  sortPages(filterPages(session.value?.pages ?? [], query.value, filter.value), sort.value),
);
const siteAnalysis = computed(() =>
  analysisSession.value ? analyzeSite(analysisSession.value) : null,
);
const visibleIssues = computed(() =>
  siteAnalysis.value
    ? sortSiteIssues(
        filterSiteIssues(
          siteAnalysis.value.issues,
          query.value,
          issueCategory.value,
          issueSeverity.value,
        ),
        issueSort.value,
      )
    : [],
);
const matchingLinks = computed(() => {
  const links = siteAnalysis.value?.links ?? [];
  const needle = query.value.trim().toLocaleLowerCase("und");
  return links.filter(
    (link) =>
      (linkState.value === "all" || link.targetState === linkState.value) &&
      (!needle ||
        `${link.source} ${link.target} ${link.rel.join(" ")} ${link.anchors.join(" ")}`
          .toLocaleLowerCase("und")
          .includes(needle)),
  );
});
const visibleLinks = computed(() => matchingLinks.value.slice(0, shown.value));
const partialNotice = computed(() => {
  const summary = siteAnalysis.value?.summary;
  if (!summary) return "";
  const limits = summary.limitsReached.map(limitLabel).join(", ");
  const text = t("site.partial", { count: summary.analyzed });
  return limits ? `${text} ${limits.charAt(0).toUpperCase()}${limits.slice(1)}.` : text;
});
const rows = computed(() => visible.value.slice(0, shown.value));
const selected = computed(
  () => session.value?.pages.find((page) => page.url === selectedUrl.value) ?? null,
);
const listedCount = computed(() => session.value?.pages.length ?? 0);
const fetchedCount = computed(
  () => session.value?.pages.filter((page) => page.status != null).length ?? 0,
);
const failedCount = computed(() => session.value?.pages.filter((page) => page.error).length ?? 0);
const skippedCount = computed(
  () => session.value?.pages.filter((page) => page.skipped).length ?? 0,
);
const nonHtmlCount = computed(
  () => session.value?.pages.filter((page) => page.nonHtml).length ?? 0,
);
const attemptedCount = computed(() => Math.max(0, listedCount.value - skippedCount.value));
const crawlShare = computed(() => {
  if (CRAWL_LIMITS.maxPages <= 0) return "0%";
  return `${Math.min(100, (attemptedCount.value / CRAWL_LIMITS.maxPages) * 100)}%`;
});
const analyzedCount = computed(() => siteAnalysis.value?.summary.analyzed ?? 0);
const redirectCount = computed(() => siteAnalysis.value?.summary.redirectAliases ?? 0);
const observationCount = computed(() =>
  (siteAnalysis.value?.issues ?? []).reduce((sum, issue) => sum + issue.affected.length, 0),
);
const linkRecordCount = computed(() => siteAnalysis.value?.links.length ?? 0);
const ruleBars = computed(() => {
  const issues = [...(siteAnalysis.value?.issues ?? [])]
    .sort((a, b) => b.affected.length - a.affected.length)
    .slice(0, 6);
  const max = Math.max(1, ...issues.map((issue) => issue.affected.length));
  return issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    count: issue.affected.length,
    tone: issueTone(issue.statuses),
    width: `${(issue.affected.length / max) * 100}%`,
  }));
});
const viewIntro = computed(() => {
  switch (activeView.value) {
    case "issues":
      return { title: t("site.intro.issues.title"), text: t("site.intro.issues.text") };
    case "pages":
      return { title: t("site.intro.pages.title"), text: t("site.intro.pages.text") };
    case "links":
      return { title: t("site.intro.links.title"), text: t("site.intro.links.text") };
    case "compare":
      return { title: t("site.intro.compare.title"), text: t("site.intro.compare.text") };
    default:
      return { title: t("site.intro.overview.title"), text: t("site.intro.overview.text") };
  }
});

const hasCrawl = computed(() => siteAnalysis.value != null && listedCount.value > 0);
const savedThisCrawl = computed(
  () => liveStamp.value !== "" && savedStamp.value === liveStamp.value,
);
const messageTone = computed<"" | "ok" | "err">(() => {
  if (!message.value) return "";
  const done = [
    t("site.compare.saved"),
    t("site.compare.deleted"),
    t("site.compare.unreadableCleared"),
  ];
  return done.includes(message.value) ? "ok" : "err";
});
const lastCrawlLine = computed(() => {
  if (running.value || permissionPending.value) return crawlState();
  const finished = session.value?.finishedAt;
  if (!finished || !session.value?.pages.length) return t("site.intro.never");
  return t("site.intro.last", { when: finished.replace("T", " ").slice(0, 16) });
});
const heroHeading = computed(() => {
  if (running.value) return t("site.hero.running");
  if (session.value?.status === "stopped") return t("site.hero.stopped");
  if (session.value?.status === "error") return t("site.hero.error");
  return siteAnalysis.value?.summary.partial ? t("site.hero.partial") : t("site.hero.complete");
});
// Analyzed pages against the fixed page cap. It is not a share of the website.
const capShare = computed(() => {
  const limit = siteAnalysis.value?.summary.pagesLimit ?? 0;
  return limit > 0 ? Math.round(Math.min(100, (analyzedCount.value / limit) * 100)) : 0;
});
const severitySplit = computed(() => {
  const split = { err: 0, warn: 0, info: 0 };
  for (const issue of siteAnalysis.value?.issues ?? []) {
    const tone = issueTone(issue.statuses);
    if (tone === "err") split.err += 1;
    else if (tone === "warn") split.warn += 1;
    else split.info += 1;
  }
  return split;
});
const healthRows = computed(() => {
  const summary = siteAnalysis.value?.summary;
  const duplicates = siteAnalysis.value?.duplicates ?? [];
  if (!summary) return [];
  return [
    { label: t("site.missingTitles"), count: summary.missingTitles + summary.emptyTitles },
    {
      label: t("site.missingDescriptions"),
      count: summary.missingDescriptions + summary.emptyDescriptions,
    },
    {
      label: t("site.duplicateTitles"),
      count: duplicates.filter((group) => group.kind === "title").length,
    },
    {
      label: t("site.duplicateDescriptions"),
      count: duplicates.filter((group) => group.kind === "description").length,
    },
    { label: t("site.missingH1"), count: summary.h1Missing },
    { label: t("site.multipleH1"), count: summary.multipleH1 },
    { label: t("site.canonicalWarnings"), count: summary.canonicalIssues },
    { label: t("site.imagesMissingAlt"), count: summary.imagesMissingAlt },
  ];
});
const visibleFindings = computed(() =>
  visibleIssues.value.reduce((sum, issue) => sum + issue.affected.length, 0),
);
const issueFiltersActive = computed(
  () =>
    query.value !== "" ||
    issueCategory.value !== "all" ||
    issueSeverity.value !== "all" ||
    issueSort.value !== "affected",
);
const duplicateFlags = computed(() => {
  const flags = new Map<string, Set<"title" | "description">>();
  for (const group of siteAnalysis.value?.duplicates ?? []) {
    for (const url of group.urls) {
      const entry = flags.get(url) ?? new Set();
      entry.add(group.kind);
      flags.set(url, entry);
    }
  }
  return flags;
});
const linkStats = computed(() => {
  const links = siteAnalysis.value?.links ?? [];
  const states = { analyzed: 0, "not-crawled": 0, skipped: 0, failed: 0 };
  for (const link of links) states[link.targetState] += 1;
  return {
    sources: new Set(links.map((link) => link.source)).size,
    targets: new Set(links.map((link) => link.target)).size,
    states,
  };
});

watchEffect(() => {
  if (report) crumb.value = t(`site.view.${activeView.value}`);
});

function resetIssues() {
  query.value = "";
  issueCategory.value = "all";
  issueSeverity.value = "all";
  issueSort.value = "affected";
}

function pageFlags(page: CrawlPage): string[] {
  if (!page.analyzed) return [];
  const flags: string[] = [];
  const duplicate =
    duplicateFlags.value.get(page.finalUrl || page.url) ?? duplicateFlags.value.get(page.url);
  if (!page.title) flags.push(t("site.pages.noTitle"));
  if (!page.description) flags.push(t("site.pages.noDescription"));
  if (duplicate?.has("title")) flags.push(t("site.duplicateTitle"));
  if (duplicate?.has("description")) flags.push(t("site.duplicateDescription"));
  return flags;
}

function pageChip(page: CrawlPage): string {
  const tone = pageTone(page);
  if (tone === "err") return "err";
  if (tone === "gray") return "";
  return page.redirectHops.length ? "violet" : "ok";
}

function linkChip(state: LinkObservation["targetState"]): string {
  if (state === "analyzed") return "ok";
  if (state === "failed") return "err";
  return state === "skipped" ? "warn" : "violet";
}

function consoleStatus(): "running" | "complete" | "partial" | "stopped" | "error" | "idle" {
  if (running.value || permissionPending.value) return "running";
  if (session.value?.status === "complete") return session.value.partial ? "partial" : "complete";
  if (session.value?.status === "stopped") return "stopped";
  if (session.value?.status === "error") return "error";
  return "idle";
}

function refreshHistory() {
  history.value = readHistory();
}

onMounted(() => {
  if (origin.value) {
    session.value = loadCrawl(origin.value);
    analysisSession.value = session.value;
  }
  refreshHistory();
});
onUnmounted(() => {
  if (report) crumb.value = "";
  disposed = true;
  controller?.abort();
});

async function start() {
  if (!supportsSiteCrawling || running.value || permissionPending.value || !origin.value) return;
  message.value = "";
  const page = pageUrl.value;
  const permission = sitePermission(page);
  if (!permission || permission.origin !== origin.value) {
    message.value = t("site.noOrigin");
    return;
  }

  permissionPending.value = true;
  let request: Promise<boolean>;
  try {
    // Keep this request in the Start button's user-action context in Firefox.
    request = browser.permissions.request({ origins: [permission.pattern] });
  } catch {
    permissionPending.value = false;
    message.value = t("site.permissionDenied");
    return;
  }

  let granted = false;
  try {
    granted = await request;
    if (granted) {
      granted = await browser.permissions.contains({ origins: [permission.pattern] });
    }
  } catch {
    message.value = t("site.permissionUnavailable");
    return;
  } finally {
    permissionPending.value = false;
  }
  if (!granted) {
    message.value = t("site.permissionDenied");
    return;
  }
  if (disposed) return;
  if (pageUrl.value !== page) {
    message.value = t("site.permissionUnavailable");
    return;
  }

  const crawlController = new AbortController();
  controller = crawlController;
  running.value = true;
  shown.value = 40;
  let permissionRevoked = false;
  const stopForRevocation = () => {
    permissionRevoked = true;
    message.value = t("site.permissionRevoked");
    crawlController.abort();
  };
  const onPermissionRemoved = (removed: { origins?: string[] }) => {
    if (!removed.origins?.some((pattern) => permissionPatternMatchesUrl(pattern, page))) return;
    void browser.permissions
      .contains({ origins: [permission.pattern] })
      .then((stillAllowed) => {
        if (!stillAllowed) stopForRevocation();
      })
      .catch(stopForRevocation);
  };
  const authorizedFetch: typeof fetch = async (input, init) => {
    if (crawlController.signal.aborted) throw new DOMException("Stopped", "AbortError");
    const target =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(target).origin !== permission.origin) {
      throw new TypeError("A crawl request left the selected origin.");
    }
    if (!(await browser.permissions.contains({ origins: [permission.pattern] }))) {
      stopForRevocation();
      throw new DOMException("Website access was removed", "AbortError");
    }
    if (crawlController.signal.aborted) throw new DOMException("Stopped", "AbortError");
    return fetch(input, { ...init, referrerPolicy: "no-referrer" });
  };

  browser.permissions.onRemoved.addListener(onPermissionRemoved);
  // Follow same-origin redirects only when the optional redirect details permission is granted.
  const redirects = (await hasRedirectDetails()) ? observeRedirects(permission.pattern) : null;
  try {
    let robotsBody = "";
    const next = await runSiteCrawl({
      startUrl: page,
      signal: crawlController.signal,
      readRobots: async (signal) => {
        const result = await readRobots(permission.origin, signal, authorizedFetch);
        robotsBody = result.body;
        return result;
      },
      discoverSitemaps: (signal) => discoverSitemapUrls(page, signal, authorizedFetch),
      mayFetch: (path) => mayFetchPath(robotsBody, path),
      fetchPage: (url, signal) =>
        fetchCrawlPage(url, permission.origin, signal, authorizedFetch, redirects),
      inspect: async (page, html) => {
        const extracted = extractCrawlPage(html, page.finalUrl || page.url);
        try {
          const audit = await analyzeSnapshot(
            snapshotFromHtml(
              html,
              page.finalUrl || page.url,
              page.status ?? 0,
              page.contentType,
            ) as never,
          );
          const findings = audit.checks
            .filter((check) => check.status !== "PASS")
            .map((check) => ({
              id: check.id,
              category: check.category,
              title: check.title,
              description: check.description,
              recommendation: check.recommendation,
              status: check.status,
              evidence: check.evidence,
            }));
          extracted.issues = audit.checks
            .filter((check) => check.status === "ERROR" || check.status === "WARNING")
            .map((check) => check.title)
            .slice(0, 12);
          extracted.imageCount = audit.metrics.counts.images;
          extracted.imagesMissingAlt = audit.metrics.counts.imagesMissingAlt;
          extracted.structuredDataCount = Math.max(
            extracted.structuredDataCount ?? 0,
            audit.details.structuredData.length,
          );
          extracted.analyzed = true;
          return {
            page: {
              ...page,
              ...extracted,
              url: page.url,
              fromSitemap: page.fromSitemap,
              depth: page.depth,
            },
            findings,
          };
        } catch {
          extracted.error = t("site.scoreFailed");
        }
        return {
          ...page,
          ...extracted,
          url: page.url,
          fromSitemap: page.fromSitemap,
          depth: page.depth,
          analyzed: false,
        };
      },
      onProgress: (current) => {
        session.value = { ...current, pages: current.pages.slice() };
        if (current.pages.length === 1 || current.pages.length % 10 === 0) {
          analysisSession.value = { ...current, pages: current.pages.slice() };
        }
      },
    });
    if (!disposed) {
      session.value = next;
      analysisSession.value = next;
      if (!saveCrawl(next)) message.value = t("site.saveFailed");
    }
  } catch {
    if (!disposed && !permissionRevoked) message.value = t("site.failed");
  } finally {
    browser.permissions.onRemoved.removeListener(onPermissionRemoved);
    redirects?.stop();
    running.value = false;
    if (controller === crawlController) controller = null;
  }
}

function stop() {
  controller?.abort();
}

function download(kind: "csv" | "analysis-csv" | "json") {
  if (!session.value) return;
  const content =
    kind === "csv"
      ? sessionCsv(session.value)
      : kind === "analysis-csv"
        ? siteAnalysisCsv(session.value)
        : siteAnalysisJson(session.value);
  const isCsv = kind !== "json";
  const suffix = kind === "analysis-csv" ? "-analysis" : "";
  const blob = new Blob([content], { type: isCsv ? "text/csv" : "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(`${origin.value}-site${suffix}`, isCsv ? "csv" : "json");
  anchor.click();
  URL.revokeObjectURL(url);
}

function snapshotLabel(snapshot: CrawlSnapshot): string {
  const count = resolvedAnalyzedPages(snapshot.session).pages.length;
  const when = snapshot.savedAt.replace("T", " ").slice(0, 16);
  const partial =
    snapshot.session.partial || snapshot.session.status === "stopped"
      ? ` · ${t("site.compare.partialShort")}`
      : "";
  return `${when} · ${t("site.compare.savedPages", { count })}${partial}`;
}

function saveForComparison() {
  if (!session.value || running.value) return;
  const result = saveSnapshot(
    session.value,
    browser.runtime.getManifest().version,
    appConfig.rulesetVersion,
  );
  refreshHistory();
  if (!result.ok) {
    message.value =
      result.reason === "origin-full"
        ? t("site.compare.save.originFull")
        : result.reason === "budget"
          ? t("site.compare.save.budget")
          : result.reason === "quota"
            ? t("site.compare.save.quota")
            : result.reason === "too-large"
              ? t("site.compare.save.tooLarge")
              : result.reason === "corrupt"
                ? t("site.compare.save.corrupt")
                : t("site.compare.save.invalid");
    return;
  }
  baselineId.value = result.snapshot.id;
  comparisonId.value = "live";
  savedStamp.value = liveStamp.value;
  message.value = t("site.compare.saved");
  toast(t("site.compare.saved"), "", "success");
}

function removeSnapshot(id: string) {
  if (!deleteSnapshot(id)) {
    message.value = t("site.compare.deleteFailed");
    return;
  }
  if (baselineId.value === id) baselineId.value = "";
  if (comparisonId.value === id) comparisonId.value = "live";
  comparison.value = null;
  comparedSelection.value = null;
  refreshHistory();
  message.value = t("site.compare.deleted");
  toast(t("site.compare.deleted"));
}

function clearUnreadable() {
  clearUnreadableHistory();
  comparison.value = null;
  comparedSelection.value = null;
  refreshHistory();
  message.value = t("site.compare.unreadableCleared");
}

function selectedSnapshot(id: string): CrawlSnapshot | null {
  if (id === "live") {
    if (!session.value || session.value.origin !== origin.value) return null;
    return {
      schemaVersion: 1,
      id: "live",
      origin: session.value.origin,
      savedAt: session.value.finishedAt || session.value.startedAt,
      rankmisoVersion: browser.runtime.getManifest().version,
      rulesetVersion: appConfig.rulesetVersion,
      linksBounded: session.value.pages.some((page) => page.internalLinksTruncated),
      session: session.value,
    };
  }
  return originSnapshots.value.find((snapshot) => snapshot.id === id) ?? null;
}

async function runCompare() {
  const baseline = selectedSnapshot(baselineId.value);
  const current = selectedSnapshot(comparisonId.value);
  if (!baseline || !current || baseline.id === current.id) {
    comparison.value = null;
    comparedSelection.value = null;
    message.value = t("site.compare.needTwo");
    return;
  }
  comparing.value = true;
  comparison.value = null;
  await new Promise((resolve) => setTimeout(resolve, 0));
  comparison.value = compareSnapshots(baseline, current);
  comparedSelection.value = {
    baseline: baselineId.value,
    later: comparisonId.value,
    liveStamp: liveStamp.value,
  };
  comparing.value = false;
  const reason = comparison.value.reason;
  message.value = comparison.value.comparable
    ? ""
    : reason === "origin"
      ? t("site.compare.blocked.origin")
      : reason === "schema"
        ? t("site.compare.blocked.schema")
        : reason === "ruleset"
          ? t("site.compare.blocked.ruleset")
          : t("site.compare.needTwo");
}

function downloadComparison(kind: "csv" | "json") {
  if (!shownComparison.value?.comparable) return;
  const isCsv = kind === "csv";
  const content = isCsv
    ? comparisonCsv(shownComparison.value)
    : comparisonJson(shownComparison.value);
  const blob = new Blob([content], { type: isCsv ? "text/csv" : "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(`${origin.value}-site-comparison`, isCsv ? "csv" : "json");
  anchor.click();
  URL.revokeObjectURL(url);
}

function crawlState(): string {
  if (permissionPending.value) return t("site.authorizing");
  if (running.value) return t("site.running");
  if (!session.value || session.value.status === "idle") return t("site.idle");
  if (session.value.status === "complete") {
    return session.value.partial ? t("site.statePartial") : t("site.stateComplete");
  }
  if (session.value.status === "stopped") return t("site.stateStopped");
  if (session.value.status === "error") return t("site.stateError");
  return t("site.running");
}

function sitemapLine(): string {
  if (!session.value) return "";
  if (session.value.sitemap === "urls")
    return `${t("site.sitemap.urls")} ${n(session.value.sitemapUrls)}`;
  if (session.value.sitemap === "empty") return t("site.sitemap.empty");
  if (session.value.sitemap === "unavailable") return t("site.sitemap.unavailable");
  return t("site.sitemap.notRead");
}

function stateBadge(): "ok" | "warn" | "err" | "gray" {
  if (running.value || permissionPending.value) return "warn";
  if (session.value?.status === "complete") return session.value.partial ? "warn" : "ok";
  if (session.value?.status === "error") return "err";
  if (session.value?.status === "stopped") return "warn";
  return "gray";
}

function pageTone(page: CrawlPage): "good" | "warn" | "err" | "gray" {
  if (page.skipped || page.nonHtml) return "gray";
  if (page.error || (page.status != null && page.status >= 400)) return "err";
  if (page.issues.length || page.redirectHops.length) return "warn";
  return "good";
}

function pageBadge(page: CrawlPage): string {
  if (page.skipped) return t("site.skipped");
  if (page.error && page.status == null) return t("site.failedShort");
  if (page.status != null && page.status >= 400) return String(page.status);
  if (page.nonHtml) return t("site.nonHtmlStatus", { status: page.status ?? "—" });
  if (page.redirectHops.length) return t("wb.si.redirected");
  return page.status == null ? "—" : t("wb.si.fetched", { status: page.status });
}

function path(url: string): string {
  try {
    const value = new URL(url);
    return value.origin === origin.value ? `${value.pathname}${value.search}` || "/" : url;
  } catch {
    return url;
  }
}

function statusLabel(page: CrawlPage): string {
  if (page.skipped) return t("site.skipped");
  if (page.error && page.status == null) return t("site.failedShort");
  return page.status == null ? "—" : String(page.status);
}

function showPage(url: string) {
  selectedUrl.value = url;
  activeView.value = "pages";
}

const severityOrder: CheckStatus[] = ["ERROR", "WARNING", "INFO"];

function issueTone(statuses: string[]) {
  const worst = severityOrder.find((status) => statuses.includes(status));
  return worst ? badgeTone(worst) : "gray";
}

function issueStatusLabel(statuses: string[]): string {
  const known = statuses.filter((status): status is CheckStatus => status in statusKey);
  return known.length
    ? known.map((status) => t(statusKey[status])).join(" / ")
    : t("site.severityUndefined");
}

function limitLabel(limit: CrawlLimitReason): string {
  switch (limit) {
    case "pages":
      return t("site.limit.pages");
    case "discovered":
      return t("site.limit.discovered");
    case "depth":
      return t("site.limit.depth");
    case "time":
      return t("site.limit.time");
  }
}
</script>

<template>
  <div v-if="report" class="sx">
    <header class="sx-intro">
      <div>
        <div class="sx-eyebrow">{{ t("site.intro.kicker") }} / {{ t("site.intro.product") }}</div>
        <h1>{{ viewIntro.title }}</h1>
        <p>{{ viewIntro.text }}</p>
      </div>
      <div class="sx-note-pill"><i aria-hidden="true"></i>{{ lastCrawlLine }}</div>
    </header>

    <SiteCrawlConsole
      v-if="supportsSiteCrawling"
      :host="origin.replace(/^https?:\/\//, '')"
      :status="consoleStatus()"
      :status-label="crawlState()"
      :headline="session?.note || crawlState()"
      :listed="listedCount"
      :analyzed="analyzedCount"
      :fetched="fetchedCount"
      :non-html="nonHtmlCount"
      :redirects="redirectCount"
      :failed="failedCount"
      :skipped="skippedCount"
      :running="running"
      :pending="permissionPending"
      :saved="savedThisCrawl"
      :message="message"
      :message-tone="messageTone"
      :sitemap="session ? sitemapLine() : ''"
      :saved-count="originSnapshots.length"
      @start="start"
      @stop="stop"
      @save="saveForComparison"
      @export="download"
    />

    <nav class="sx-tabs site-views" :aria-label="t('site.views')">
      <button
        v-for="view in ['overview', 'issues', 'pages', 'links', 'compare'] as const"
        :key="view"
        type="button"
        :class="{ active: activeView === view }"
        :aria-current="activeView === view ? 'page' : undefined"
        @click="activeView = view"
      >
        {{ t(`site.view.${view}`) }}
        <span v-if="view === 'issues' && siteAnalysis?.issues.length" class="count">{{
          n(siteAnalysis.issues.length)
        }}</span>
        <span v-else-if="view === 'pages' && listedCount" class="count">{{ n(listedCount) }}</span>
        <span
          v-else-if="view === 'compare' && originSnapshots.length"
          class="dot"
          :title="t('site.console.saved', { count: n(originSnapshots.length) })"
        ></span>
      </button>
    </nav>

    <section v-if="activeView !== 'compare' && !hasCrawl" class="sx-pane sx-empty">
      <div class="sx-empty-icon"><Radar class="ic" aria-hidden="true" /></div>
      <h3>{{ running ? t("site.console.crawling") : t("site.empty.title") }}</h3>
      <p>{{ running ? t("site.progress", { count: listedCount }) : t("wb.si.empty") }}</p>
      <button
        v-if="supportsSiteCrawling && !running"
        type="button"
        class="primary"
        :disabled="permissionPending || !origin"
        @click="start"
      >
        <Play class="ic" aria-hidden="true" /> {{ t("site.empty.cta") }}
      </button>
    </section>

    <!-- Overview -->
    <section
      v-else-if="activeView === 'overview' && siteAnalysis"
      class="sx-pane site-overview"
      aria-live="polite"
    >
      <div class="sx-grid-hero">
        <section class="sx-hero" :aria-label="t('site.coverage')">
          <div>
            <span class="sx-hero-tag">
              <ShieldCheck class="ic" aria-hidden="true" /> {{ t("site.hero.tag") }}
            </span>
            <h2>{{ heroHeading }}</h2>
            <p>{{ siteAnalysis.summary.partial ? partialNotice : t("site.hero.completeText") }}</p>
          </div>
          <div class="sx-hero-chips">
            <span>
              <Check class="ic" aria-hidden="true" />
              {{ t("site.hero.pages", { count: n(analyzedCount) }) }}
            </span>
            <span>
              <TriangleAlert class="ic" aria-hidden="true" />
              {{ t("site.hero.rules", { count: n(siteAnalysis.issues.length) }) }}
            </span>
            <span>
              <ShieldCheck class="ic" aria-hidden="true" /> {{ t("site.hero.noScore") }}
            </span>
          </div>
          <ArrowUpRight class="sx-hero-mark" aria-hidden="true" />
        </section>
        <section class="sx-cover" :aria-label="t('site.console.scope')">
          <div class="sx-cover-top">
            <span class="sx-kicker">{{ t("site.console.scope") }}</span>
            <span class="sx-kicker-icon">
              <ChartNoAxesColumn class="ic" aria-hidden="true" />
            </span>
          </div>
          <div class="sx-cover-number">
            {{ n(analyzedCount) }}
            <span>{{
              t("site.console.ofCap", { count: n(siteAnalysis.summary.pagesLimit) })
            }}</span>
          </div>
          <p>{{ t("site.console.scopeText") }}</p>
          <div class="sx-bar-label">
            <span>{{ t("site.console.analysisCap") }}</span>
            <strong>{{ n(capShare) }}%</strong>
          </div>
          <div
            class="sx-bar"
            role="img"
            :aria-label="`${t('site.console.analysisCap')}: ${capShare}%`"
          >
            <span :style="{ width: `${capShare}%` }" />
          </div>
          <div class="sx-mini">
            <div>
              <strong>{{ n(redirectCount) }}</strong>
              <span>{{ t("site.console.redirects") }}</span>
            </div>
            <div>
              <strong>{{ n(failedCount) }}</strong>
              <span>{{ t("site.console.failedRequests") }}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="sx-stats">
        <SxStat
          :label="t('site.analyzed')"
          :value="n(analyzedCount)"
          :note="t('site.console.unique')"
          tone="brand"
          :icon="FileText"
        />
        <SxStat
          :label="t('site.console.observations')"
          :value="n(observationCount)"
          :note="t('site.console.fromRules')"
          tone="warning"
          :icon="TriangleAlert"
        />
        <SxStat
          :label="t('site.console.linkRecords')"
          :value="n(linkRecordCount)"
          :note="t('site.console.pairs')"
          tone="success"
          :icon="Link"
        />
        <SxStat
          :label="t('site.console.rules')"
          :value="n(siteAnalysis.issues.length)"
          :note="t('site.console.ruleFoot')"
          tone="neutral"
          :icon="ListChecks"
        />
      </div>

      <div class="sx-grid-main">
        <SxPanel
          :title="t('site.console.byRule')"
          :text="t('site.console.byRuleNote')"
          :badge="t('site.console.rulesShown', { count: n(ruleBars.length) })"
        >
          <div class="sx-panel-body">
            <p v-if="!ruleBars.length" class="sx-small">{{ t("site.noIssues") }}</p>
            <ol v-else class="sx-rules">
              <li v-for="rule in ruleBars" :key="rule.id">
                <div class="sx-rule-label">
                  <span><i :class="rule.tone" aria-hidden="true"></i>{{ rule.title }}</span>
                  <span>{{ t("site.console.pagesCount", { count: n(rule.count) }) }}</span>
                </div>
                <div class="sx-bar" role="img" :aria-label="rule.title">
                  <span :style="{ width: rule.width }" />
                </div>
              </li>
            </ol>
          </div>
          <template #foot>
            <span>{{ t("site.hero.noScore") }}</span>
            <button type="button" class="sx-link" @click="activeView = 'issues'">
              {{ t("site.console.inspectIssues") }} <ChevronRight class="ic" aria-hidden="true" />
            </button>
          </template>
        </SxPanel>

        <div class="sx-stack">
          <SxPanel :title="t('site.console.notes')" :text="t('site.console.notesText')">
            <div class="sx-panel-body sx-notes">
              <div>
                <span class="sx-note-icon" :class="siteAnalysis.summary.partial ? 'warn' : 'ok'">
                  <Check class="ic" aria-hidden="true" />
                </span>
                <div>
                  <strong>{{ crawlState() }}</strong>
                  <p>{{ session?.note || t("site.console.scopeText") }}</p>
                </div>
              </div>
              <div>
                <span class="sx-note-icon"><TriangleAlert class="ic" aria-hidden="true" /></span>
                <div>
                  <strong>{{
                    t("site.console.severityLine", {
                      errors: n(siteAnalysis.summary.pagesWithErrors),
                      warnings: n(siteAnalysis.summary.pagesWithWarnings),
                    })
                  }}</strong>
                  <p>
                    {{
                      t("site.console.ruleSplit", {
                        errors: n(severitySplit.err),
                        warnings: n(severitySplit.warn),
                        notes: n(severitySplit.info),
                      })
                    }}
                  </p>
                </div>
              </div>
              <div>
                <span class="sx-note-icon"><Link class="ic" aria-hidden="true" /></span>
                <div>
                  <strong>{{ t("site.console.linkLine", { count: n(linkRecordCount) }) }}</strong>
                  <p>{{ t("site.console.linkLineText") }}</p>
                </div>
              </div>
              <div>
                <span class="sx-note-icon ok"><ShieldCheck class="ic" aria-hidden="true" /></span>
                <div>
                  <strong>{{ t("site.console.private") }}</strong>
                  <p>{{ t("wb.footerNote") }}</p>
                </div>
              </div>
            </div>
            <template #foot>
              <span>{{ t("site.console.saved", { count: n(originSnapshots.length) }) }}</span>
              <button type="button" class="sx-link" @click="activeView = 'compare'">
                {{ t("site.compare.run") }} <ChevronRight class="ic" aria-hidden="true" />
              </button>
            </template>
          </SxPanel>
        </div>
      </div>

      <div class="sx-grid-two">
        <SxPanel :title="t('site.metadata')" :text="t('site.console.metadataNote')">
          <div class="sx-panel-body">
            <dl class="sx-health">
              <div v-for="row in healthRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>
                  <span class="sx-chip" :class="row.count ? 'warn' : 'ok'">{{ n(row.count) }}</span>
                </dd>
              </div>
            </dl>
          </div>
        </SxPanel>
        <SxPanel
          :title="t('site.duplicateMetadata')"
          :text="t('site.console.duplicateNote')"
          :badge="t('site.console.groups', { count: n(siteAnalysis.duplicates.length) })"
        >
          <div v-if="!siteAnalysis.duplicates.length" class="sx-empty small">
            <div class="sx-empty-icon ok"><Check class="ic" aria-hidden="true" /></div>
            <h3>{{ t("site.noDuplicates") }}</h3>
          </div>
          <div v-else class="sx-panel-body">
            <ul class="sx-dupes">
              <li v-for="group in siteAnalysis.duplicates" :key="`${group.kind}:${group.value}`">
                <span class="sx-chip warn">{{
                  group.kind === "title" ? t("site.duplicateTitle") : t("site.duplicateDescription")
                }}</span>
                <h4>{{ group.value }}</h4>
                <details class="sx-details">
                  <summary>
                    <ChevronRight class="ic" aria-hidden="true" />
                    {{ t("site.affectedPages", { count: group.urls.length }) }}
                  </summary>
                  <ul class="sx-urls">
                    <li v-for="url in group.urls" :key="url">
                      <button type="button" class="sx-url" @click="showPage(url)">{{ url }}</button>
                    </li>
                  </ul>
                </details>
              </li>
            </ul>
          </div>
        </SxPanel>
      </div>

      <SiteRelationsPanel v-if="session" :session="session" />

      <div class="sx-foot-notes">
        <p v-if="siteAnalysis.summary.redirectAliases" class="sx-small">
          {{ t("site.redirectAliases", { count: siteAnalysis.summary.redirectAliases }) }}
        </p>
        <p v-if="siteAnalysis.summary.unavailableFindings" class="sx-small">
          {{ t("site.unavailableCount", { count: siteAnalysis.summary.unavailableFindings }) }}
        </p>
      </div>
    </section>

    <!-- Issues -->
    <section v-else-if="activeView === 'issues' && siteAnalysis" class="sx-pane site-issues">
      <div class="sx-section-head">
        <div>
          <h2>{{ t("site.issues.heading") }}</h2>
          <p>{{ t("site.issues.note") }}</p>
        </div>
        <span class="sx-chip ghost">{{
          t("site.issues.count", { rules: n(visibleIssues.length), findings: n(visibleFindings) })
        }}</span>
      </div>
      <div class="sx-toolbar">
        <label class="sx-search">
          <Search class="ic" aria-hidden="true" />
          <input
            v-model="query"
            type="search"
            autocomplete="off"
            :placeholder="t('site.searchIssues')"
            :aria-label="t('site.searchIssues')"
          />
        </label>
        <label class="sx-select">
          <span class="sr-only">{{ t("site.category") }}</span>
          <select v-model="issueCategory">
            <option value="all">{{ t("site.allCategories") }}</option>
            <option
              v-for="category in [...new Set(siteAnalysis.issues.map((issue) => issue.category))]"
              :key="category"
              :value="category"
            >
              {{ t(`site.category.${category}`) }}
            </option>
          </select>
          <ChevronDown class="ic" aria-hidden="true" />
        </label>
        <label class="sx-select">
          <span class="sr-only">{{ t("site.severity") }}</span>
          <select v-model="issueSeverity">
            <option value="all">{{ t("site.allSeverities") }}</option>
            <option value="error">{{ t("site.severity.error") }}</option>
            <option value="warning">{{ t("site.severity.warning") }}</option>
            <option value="info">{{ t("site.severity.info") }}</option>
            <option value="undefined">{{ t("site.severity.undefined") }}</option>
          </select>
          <ChevronDown class="ic" aria-hidden="true" />
        </label>
        <label class="sx-select">
          <span class="sr-only">{{ t("site.sort") }}</span>
          <select v-model="issueSort">
            <option value="affected">{{ t("site.sortAffected") }}</option>
            <option value="severity">{{ t("site.sortSeverity") }}</option>
            <option value="name">{{ t("site.sortName") }}</option>
          </select>
          <ChevronDown class="ic" aria-hidden="true" />
        </label>
        <button
          type="button"
          class="secondary"
          :disabled="!issueFiltersActive"
          @click="resetIssues"
        >
          {{ t("site.issues.reset") }}
        </button>
      </div>
      <div v-if="!visibleIssues.length" class="sx-empty">
        <div class="sx-empty-icon"><Search class="ic" aria-hidden="true" /></div>
        <h3>{{ t("site.noIssues") }}</h3>
        <p>{{ t("site.issues.emptyHint") }}</p>
      </div>
      <div v-else class="sx-records">
        <article
          v-for="issue in visibleIssues.slice(0, shown)"
          :key="issue.id"
          class="sx-record site-issue"
        >
          <span class="sx-symbol" :class="issueTone(issue.statuses)">
            <component :is="categoryIcon(issue.category)" class="ic" aria-hidden="true" />
          </span>
          <div class="sx-record-main">
            <h3>{{ issue.title }}</h3>
            <div class="finding-type">
              <span class="badge" :class="issueTone(issue.statuses)">{{
                issueStatusLabel(issue.statuses)
              }}</span>
              <span>{{ t(`site.category.${issue.category}`) }}</span>
              <span aria-hidden="true">·</span>
              <span translate="no">{{ issue.id }}</span>
            </div>
            <p class="sx-record-text">{{ issue.description }}</p>
            <p v-if="issue.recommendation" class="sx-record-text">
              <strong>{{ t("check.fix") }}:</strong> {{ issue.recommendation }}
            </p>
            <details class="sx-details">
              <summary>
                <ChevronRight class="ic" aria-hidden="true" />
                {{ t("site.affectedPages", { count: issue.affected.length }) }}
              </summary>
              <ul class="sx-urls">
                <li v-for="page in issue.affected" :key="page.url">
                  <button type="button" class="sx-url" @click="showPage(page.url)">
                    {{ page.url }}
                  </button>
                  <small v-if="page.evidence">{{ page.evidence }}</small>
                </li>
              </ul>
            </details>
          </div>
          <div class="sx-record-end">
            <span class="sx-chip" :class="issueTone(issue.statuses)">{{
              t("site.console.pagesCount", { count: n(issue.affected.length) })
            }}</span>
          </div>
        </article>
      </div>
      <div v-if="visibleIssues.length > shown" class="sx-table-foot">
        <span>{{ t("site.showing", { shown: n(shown), total: n(visibleIssues.length) }) }}</span>
        <button type="button" class="sx-mini-btn" @click="shown += 40">
          {{ t("site.moreIssues") }}
        </button>
      </div>
    </section>

    <!-- Pages -->
    <section v-else-if="activeView === 'pages' && session" class="sx-pane site-pages">
      <div class="sx-section-head">
        <div>
          <h2>{{ t("pm.inspectedPages") }}</h2>
          <p>{{ t("site.pages.note") }}</p>
        </div>
        <span class="sx-chip ghost">{{
          t("site.showing", { shown: n(rows.length), total: n(visible.length) })
        }}</span>
      </div>
      <div class="sx-toolbar">
        <label class="sx-search">
          <Search class="ic" aria-hidden="true" />
          <input
            v-model="query"
            type="search"
            name="site-search"
            autocomplete="off"
            :placeholder="t('site.pages.search')"
            :aria-label="t('site.search')"
          />
        </label>
        <label class="sx-select">
          <span class="sr-only">{{ t("site.filter") }}</span>
          <select v-model="filter" :aria-label="t('site.filter')">
            <option value="all">{{ t("site.pages.all") }}</option>
            <option value="issues">{{ t("site.filterIssues") }}</option>
            <option value="failed">{{ t("site.filterFailed") }}</option>
            <option value="skipped">{{ t("site.filterSkipped") }}</option>
          </select>
          <ChevronDown class="ic" aria-hidden="true" />
        </label>
        <label class="sx-select">
          <span class="sr-only">{{ t("site.sort") }}</span>
          <select v-model="sort" :aria-label="t('site.sort')">
            <option value="url">{{ t("site.pages.sortUrl") }}</option>
            <option value="title">{{ t("site.pages.sortTitle") }}</option>
            <option value="issues">{{ t("site.pages.sortIssues") }}</option>
          </select>
          <ChevronDown class="ic" aria-hidden="true" />
        </label>
        <span v-if="siteAnalysis?.duplicates.length" class="sx-chip warn"
          >{{ t("site.console.groups", { count: n(siteAnalysis.duplicates.length) }) }} ·
          {{ t("site.duplicateMetadata") }}</span
        >
      </div>
      <div :class="selected ? 'sx-split' : ''">
        <div class="sx-table sx-pages">
          <div class="sx-row head" aria-hidden="true">
            <span>{{ t("site.col.page") }}</span>
            <span class="wide-only">{{ t("site.sortTitle") }}</span>
            <span>{{ t("site.sortIssues") }}</span>
            <span class="wide-only">{{ t("site.view.links") }}</span>
            <span>{{ t("site.colStatus") }}</span>
          </div>
          <div v-if="!rows.length" class="sx-empty small" style="margin: 20px">
            <h3>{{ t("site.pages.none") }}</h3>
          </div>
          <div class="site-list" :aria-label="t('site.caption')">
            <button
              v-for="page in rows"
              :key="page.url"
              type="button"
              class="sx-row"
              :class="{ 'is-selected': selectedUrl === page.url }"
              :aria-pressed="selectedUrl === page.url"
              @click="selectedUrl = selectedUrl === page.url ? '' : page.url"
            >
              <span class="sx-cell-main">
                <strong :title="page.url">{{ path(page.url) }}</strong>
                <small>{{ page.url }}</small>
                <span v-if="pageFlags(page).length" class="sx-cell-flags">
                  <span v-for="flag in pageFlags(page)" :key="flag" class="sx-chip warn">{{
                    flag
                  }}</span>
                </span>
              </span>
              <span
                class="sx-cell-clip wide-only"
                :class="{ missing: !page.title }"
                :title="page.title"
                >{{ page.title || (page.analyzed ? t("site.pages.noTitle") : "—") }}</span
              >
              <span>
                <span class="sx-chip" :class="page.issues.length ? 'warn' : ''">{{
                  page.analyzed
                    ? t("wb.si.issues", { count: n(page.issues.length) })
                    : t("site.notAnalyzed")
                }}</span>
              </span>
              <span class="sx-num wide-only">{{ n(page.internalLinks.length) }}</span>
              <span>
                <span class="sx-chip" :class="pageChip(page)">{{ pageBadge(page) }}</span>
              </span>
            </button>
          </div>
          <div class="sx-table-foot">
            <span>{{
              t("site.showing", { shown: n(rows.length), total: n(visible.length) })
            }}</span>
            <button
              v-if="visible.length > rows.length"
              type="button"
              class="sx-mini-btn"
              @click="shown += 40"
            >
              {{ t("site.more") }}
            </button>
          </div>
        </div>
        <SxPanel
          v-if="selected"
          class="sx-detail site-detail"
          :title="selected.title || path(selected.url)"
          :text="t('site.detail')"
        >
          <template #aside>
            <button
              type="button"
              class="sx-mini-btn"
              :aria-label="t('action.dismiss')"
              @click="selectedUrl = ''"
            >
              <X class="ic" aria-hidden="true" style="width: 13px; height: 13px" />
            </button>
          </template>
          <div class="sx-panel-body">
            <dl class="sx-props">
              <div>
                <dt>{{ t("field.url") }}</dt>
                <dd>
                  {{ selected.finalUrl || selected.url }}
                  <button
                    type="button"
                    class="sx-link"
                    @click="copy(selected.finalUrl || selected.url)"
                  >
                    <Copy class="ic" aria-hidden="true" /> {{ t("action.copy") }}
                  </button>
                </dd>
              </div>
              <div class="sx-props-pair">
                <div>
                  <dt>{{ t("site.colStatus") }}</dt>
                  <dd>{{ statusLabel(selected) }}</dd>
                </div>
                <div>
                  <dt>{{ t("site.colIndex") }}</dt>
                  <dd>{{ selected.indexability }}</dd>
                </div>
              </div>
              <div>
                <dt>{{ t("site.description") }}</dt>
                <dd :class="{ none: !selected.description && selected.analyzed }">
                  {{
                    selected.description ||
                    (selected.analyzed ? t("site.pages.noDescription") : "—")
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ t("field.canonical") }}</dt>
                <dd>{{ selected.canonical || "—" }}</dd>
              </div>
              <div>
                <dt>{{ t("site.robotsMeta") }}</dt>
                <dd>{{ selected.robots || "—" }}</dd>
              </div>
              <div class="sx-props-pair">
                <div>
                  <dt>{{ t("site.headings") }}</dt>
                  <dd>{{ n(selected.h1Count) }}</dd>
                </div>
                <div>
                  <dt>{{ t("site.colLinks") }}</dt>
                  <dd>{{ n(selected.internalLinks.length) }}</dd>
                </div>
              </div>
            </dl>
            <p v-if="selected.skipped" class="sx-rail-note warn">{{ selected.skipped }}</p>
            <p v-if="selected.nonHtml" class="sx-rail-note">
              {{ t("site.nonHtmlNote", { type: selected.contentType || t("site.unknownType") }) }}
            </p>
            <p v-if="selected.error" class="sx-rail-note">{{ selected.error }}</p>
            <ul v-if="selected.issues.length" class="sx-findings">
              <li v-for="issue in selected.issues" :key="issue">
                <TriangleAlert class="ic" aria-hidden="true" /> {{ issue }}
              </li>
            </ul>
          </div>
        </SxPanel>
      </div>
    </section>

    <!-- Links -->
    <section v-else-if="activeView === 'links' && siteAnalysis" class="sx-pane site-links">
      <div class="sx-section-head">
        <div>
          <h2>{{ t("site.links.heading") }}</h2>
          <p>{{ t("site.linkScope") }}</p>
        </div>
        <span class="sx-chip ghost">{{
          t("site.links.count", { count: n(linkRecordCount) })
        }}</span>
      </div>
      <div class="sx-stats">
        <SxStat
          :label="t('site.links.sources')"
          :value="n(linkStats.sources)"
          :note="t('site.links.sourcesNote')"
          tone="brand"
          :icon="FileText"
        />
        <SxStat
          :label="t('site.links.relationships')"
          :value="n(linkRecordCount)"
          :note="t('site.console.pairs')"
          tone="neutral"
          :icon="Link"
        />
        <SxStat
          :label="t('site.links.targets')"
          :value="n(linkStats.targets)"
          :note="t('site.links.targetsNote')"
          tone="warning"
          :icon="Waypoints"
        />
        <SxStat
          :label="t('site.links.analyzedTargets')"
          :value="n(linkStats.states.analyzed)"
          :note="t('site.links.analyzedNote')"
          tone="success"
          :icon="Check"
        />
      </div>
      <div v-if="siteAnalysis.links.length === 0" class="sx-empty">
        <div class="sx-empty-icon"><Link class="ic" aria-hidden="true" /></div>
        <h3>{{ t("site.noLinks") }}</h3>
      </div>
      <template v-else>
        <div class="sx-grid-main wide" style="margin-bottom: 17px">
          <SxPanel :title="t('site.links.reach')" :text="t('site.links.reachNote')">
            <div class="sx-panel-body">
              <div class="sx-dist" role="img" :aria-label="t('site.links.reach')">
                <span
                  v-for="state in linkStates"
                  v-show="linkStats.states[state]"
                  :key="state"
                  :class="state"
                  :style="{ flex: linkStats.states[state] }"
                />
              </div>
              <div class="sx-legend">
                <span v-for="state in linkStates" :key="state">
                  <i class="sx-swatch" :class="state" aria-hidden="true"></i>
                  {{ t(`site.linkState.${state}`) }}
                  <b>{{ n(linkStats.states[state]) }}</b>
                </span>
              </div>
              <p v-if="siteAnalysis.linksTruncated" class="sx-rail-note warn">
                {{ t("site.linkTruncated") }}
              </p>
            </div>
          </SxPanel>
          <SxPanel
            :title="t('site.lowIncoming')"
            :badge="
              t('site.console.pagesCount', { count: n(siteAnalysis.lowIncomingPages.length) })
            "
          >
            <div class="sx-panel-body">
              <p class="sx-small">{{ t("site.lowIncomingScope") }}</p>
              <ul
                v-if="siteAnalysis.lowIncomingPages.length"
                class="sx-urls"
                style="max-height: 190px"
              >
                <li v-for="item in siteAnalysis.lowIncomingPages" :key="item.url">
                  <button type="button" class="sx-url" @click="showPage(item.url)">
                    {{ path(item.url) }}
                  </button>
                  <small>{{ t("site.incomingCount", { count: item.incomingSources }) }}</small>
                </li>
              </ul>
            </div>
          </SxPanel>
        </div>
        <div class="sx-toolbar">
          <label class="sx-search">
            <Search class="ic" aria-hidden="true" />
            <input
              v-model="query"
              type="search"
              autocomplete="off"
              :placeholder="t('site.searchLinks')"
              :aria-label="t('site.searchLinks')"
            />
          </label>
          <label class="sx-select">
            <span class="sr-only">{{ t("site.targetStatus") }}</span>
            <select v-model="linkState">
              <option value="all">{{ t("site.links.allTargets") }}</option>
              <option v-for="state in linkStates" :key="state" :value="state">
                {{ t(`site.linkState.${state}`) }}
              </option>
            </select>
            <ChevronDown class="ic" aria-hidden="true" />
          </label>
          <span class="sx-chip ghost">{{
            t("site.showing", { shown: n(visibleLinks.length), total: n(matchingLinks.length) })
          }}</span>
        </div>
        <div class="sx-table sx-linkrows">
          <div
            class="sx-table-scroll site-link-table"
            role="table"
            :aria-label="t('site.view.links')"
          >
            <div class="sx-row head" role="row">
              <span role="columnheader">{{ t("site.source") }}</span>
              <span aria-hidden="true"></span>
              <span role="columnheader">{{ t("site.target") }}</span>
              <span role="columnheader">{{ t("site.targetStatus") }}</span>
              <span role="columnheader" :title="t('site.incomingObserved')">{{
                t("site.links.incoming")
              }}</span>
            </div>
            <div
              v-for="link in visibleLinks"
              :key="`${link.source}|${link.target}`"
              class="sx-row"
              role="row"
            >
              <span role="cell" class="sx-cell-main">
                <strong :title="link.source">{{ path(link.source) }}</strong>
                <small v-if="link.anchors.length || link.rel.length">{{
                  [...link.anchors, ...link.rel].join(" · ")
                }}</small>
              </span>
              <ArrowRight class="sx-arrow" aria-hidden="true" />
              <span role="cell" class="sx-cell-main">
                <strong :title="link.target">{{ path(link.target) }}</strong>
                <small v-if="link.redirectTo">{{
                  t("site.redirectsTo", { url: path(link.redirectTo) })
                }}</small>
              </span>
              <span role="cell">
                <span class="sx-chip" :class="linkChip(link.targetState)">{{
                  t(`site.linkState.${link.targetState}`)
                }}</span>
              </span>
              <span role="cell" class="sx-num">{{ n(link.incomingSources) }}</span>
            </div>
            <div v-if="!visibleLinks.length" class="sx-empty small" style="margin: 20px">
              <h3>{{ t("site.links.none") }}</h3>
            </div>
          </div>
          <div class="sx-table-foot">
            <span>{{
              t("site.showing", { shown: n(visibleLinks.length), total: n(matchingLinks.length) })
            }}</span>
            <button
              v-if="matchingLinks.length > visibleLinks.length"
              type="button"
              class="sx-mini-btn"
              @click="shown += 40"
            >
              {{ t("site.moreLinks") }}
            </button>
          </div>
        </div>
      </template>
    </section>

    <!-- Compare -->
    <section v-else-if="activeView === 'compare'" class="sx-pane site-compare-setup">
      <p
        v-if="history.corruptStore || history.unreadable"
        class="sx-rail-note warn"
        style="margin: 0 0 15px"
      >
        {{ t("site.compare.unreadable", { count: history.unreadable }) }}
        <button type="button" @click="clearUnreadable">
          {{ t("site.compare.clearUnreadable") }}
        </button>
      </p>
      <div class="sx-compare-controls comparison-controls">
        <label class="sx-field">
          <span>{{ t("site.compare.baseline") }}</span>
          <span class="sx-select">
            <select v-model="baselineId">
              <option value="">{{ t("site.compare.choose") }}</option>
              <option v-if="session?.pages.length" value="live">
                {{ t("site.compare.thisCrawl") }}
              </option>
              <option v-for="snapshot in originSnapshots" :key="snapshot.id" :value="snapshot.id">
                {{ snapshotLabel(snapshot) }}
              </option>
            </select>
            <ChevronDown class="ic" aria-hidden="true" />
          </span>
        </label>
        <label class="sx-field">
          <span>{{ t("site.compare.current") }}</span>
          <span class="sx-select">
            <select v-model="comparisonId">
              <option v-if="session?.pages.length" value="live">
                {{ t("site.compare.thisCrawl") }}
              </option>
              <option v-for="snapshot in originSnapshots" :key="snapshot.id" :value="snapshot.id">
                {{ snapshotLabel(snapshot) }}
              </option>
            </select>
            <ChevronDown class="ic" aria-hidden="true" />
          </span>
        </label>
        <button type="button" class="primary" :disabled="comparing || running" @click="runCompare">
          <LoaderCircle v-if="comparing" class="ic spin" aria-hidden="true" />
          <ArrowLeftRight v-else class="ic" aria-hidden="true" />
          {{ comparing ? t("site.compare.working") : t("site.compare.run") }}
        </button>
        <button
          type="button"
          class="secondary danger"
          :disabled="!baselineId || baselineId === 'live'"
          @click="removeSnapshot(baselineId)"
        >
          <Trash2 class="ic" aria-hidden="true" /> {{ t("site.compare.delete") }}
        </button>
        <span class="sx-control-hint">{{ t("site.compare.hint") }}</span>
      </div>
      <p v-if="comparisonStale" class="sx-stale" role="status">{{ t("site.compare.stale") }}</p>
      <p v-else-if="message && messageTone === 'err'" class="sx-stale">{{ message }}</p>
      <SiteComparePanel v-if="shownComparison?.comparable" :comparison="shownComparison" />
      <div v-else-if="!comparing" class="sx-empty">
        <div class="sx-empty-icon"><ArrowLeftRight class="ic" aria-hidden="true" /></div>
        <h3>{{ t("site.compare.emptyTitle") }}</h3>
        <p>
          {{
            !originSnapshots.length
              ? t("site.compare.empty")
              : originSnapshots.length < 2 && !session?.pages.length
                ? t("site.compare.oneCrawl")
                : t("site.compare.ready")
          }}
        </p>
      </div>
      <div v-if="shownComparison?.comparable" class="sx-export compare-exports">
        <span>{{ t("site.compare.notAScore") }}</span>
        <div>
          <button type="button" class="secondary" @click="downloadComparison('csv')">
            <Download class="ic" aria-hidden="true" /> {{ t("site.compare.exportCsv") }}
          </button>
          <button type="button" class="secondary" @click="downloadComparison('json')">
            <Download class="ic" aria-hidden="true" /> {{ t("site.compare.exportJson") }}
          </button>
        </div>
      </div>
    </section>
  </div>

  <template v-else>
    <PageHeading :overline="t('wb.si.overline')" :title="t('site.title')" :text="t('wb.si.text')" />
    <div class="crawl-hero">
      <div class="eyebrow">{{ t("wb.si.eyebrow") }}</div>
      <div class="crawl-status">
        <span class="crawl-host">{{
          origin ? origin.replace(/^https?:\/\//, "") : t("site.noOrigin")
        }}</span>
        <span class="badge" :class="stateBadge()">{{ crawlState() }}</span>
      </div>
      <p>
        {{
          t("wb.si.limits", { pages: n(CRAWL_LIMITS.maxPages), depth: n(CRAWL_LIMITS.maxDepth) })
        }}
      </p>
      <div class="track" role="img" :aria-label="t('site.console.cap')">
        <span class="fill red" :style="{ width: crawlShare }" />
      </div>
      <div class="crawl-metrics">
        <div class="kpi">
          <strong>{{ n(fetchedCount) }}</strong
          ><span>{{ t("site.fetched") }}</span>
        </div>
        <div class="kpi">
          <strong>{{ n(listedCount) }}</strong
          ><span>{{ t("site.discovered") }}</span>
        </div>
        <div class="kpi">
          <strong>{{ n(failedCount) }}</strong
          ><span>{{ t("site.failedCount") }}</span>
        </div>
        <div class="kpi">
          <strong>{{ n(skippedCount) }}</strong
          ><span>{{ t("site.skippedCount") }}</span>
        </div>
      </div>
      <div class="actions-row">
        <button type="button" class="primary" @click="openReport('site')">
          {{ t("wb.si.inReport") }}
        </button>
      </div>
    </div>
    <p v-if="message" class="callout" role="status">{{ message }}</p>
    <p v-if="session?.note" class="hint">{{ session.note }}</p>
    <div class="section-heading">
      <div>
        <h2>{{ t("pm.inspectedPages") }}</h2>
      </div>
      <button
        v-if="session?.pages.length"
        type="button"
        class="subtle-btn"
        @click="openReport('site')"
      >
        {{ t("wb.si.details") }} ↗
      </button>
    </div>
    <p v-if="!session || !session.pages.length" class="callout">{{ t("wb.si.emptySidebar") }}</p>
    <template v-else>
      <div class="site-notes">
        <span class="badge gray">{{ sitemapLine() }}</span>
        <span v-if="siteAnalysis?.duplicates.length" class="badge warn">{{
          t("site.duplicates", { count: siteAnalysis.duplicates.length })
        }}</span>
      </div>
      <div class="list site-list" :aria-label="t('site.caption')">
        <button
          v-for="page in rows.slice(0, 12)"
          :key="page.url"
          type="button"
          class="data-row is-link"
          @click="openReport('site')"
        >
          <div class="record-dot" :class="pageTone(page)" aria-hidden="true" />
          <div class="data-main">
            <strong>{{ page.title || path(page.url) }}</strong>
            <small>{{ page.url }}</small>
            <small v-if="page.issues.length">{{
              t("wb.si.issues", { count: n(page.issues.length) })
            }}</small>
          </div>
          <div class="data-end">
            <span
              class="badge"
              :class="{
                ok: pageTone(page) === 'good',
                warn: pageTone(page) === 'warn',
                err: pageTone(page) === 'err',
              }"
            >
              {{ pageBadge(page) }}
            </span>
          </div>
        </button>
      </div>
    </template>
    <p class="hint">{{ t("wb.si.sidebarHint") }}</p>
  </template>
</template>
