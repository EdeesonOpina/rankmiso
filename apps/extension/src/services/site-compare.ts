import { toCsv } from "@rankmiso/report-formats";
import type { Category } from "../types/audit";
import {
  duplicateGroups,
  normalizeMetadata,
  pageIdentity,
  resolvedAnalyzedPages,
} from "./site-analysis";
import type { CrawlFindingReference, CrawlPage, CrawlSession } from "./site-crawl";
import type { CrawlSnapshot } from "./site-history";

export const COMPARISON_SCHEMA_VERSION = 1;

export type IssueChange = "new" | "resolved" | "unchanged" | "not-comparable";
export type PageCoverage = "both" | "newly-observed" | "not-observed";
export type CrawlPresence = "analyzed" | "skipped" | "failed" | "redirected" | "absent";

/**
 * Issue identity is the resolved page, the Rust rule id, and a sorted evidence
 * fingerprint. Display text and timestamps are not part of the id. Two findings
 * of the same rule on one page stay distinct when their evidence differs.
 * A finding is resolved only when that page was analyzed in both crawls and the
 * finding is absent from the later one. A page the later crawl did not analyze
 * is not-comparable, never resolved.
 */
export interface ComparedIssue {
  key: string;
  change: IssueChange;
  reason: string;
  page: string;
  ruleId: string;
  category: Category | "unknown";
  severity: string;
  title: string;
  previousStatus: string;
  currentStatus: string;
  evidence: string;
  /** The rule is still present. Only the stored evidence text differs. */
  evidenceChanged: boolean;
}

export interface ComparedField {
  field: string;
  previous: string;
  current: string;
  changed: boolean;
  comparable: boolean;
}

export interface ComparedPage {
  page: string;
  coverage: PageCoverage;
  previousState: CrawlPresence;
  currentState: CrawlPresence;
  status: "changed" | "unchanged" | "not-comparable";
  fields: ComparedField[];
}

export interface ComparedLink {
  change: "added" | "removed" | "changed" | "not-comparable";
  source: string;
  target: string;
  previousState: string;
  currentState: string;
  previousRedirect: string;
  currentRedirect: string;
  reason: string;
}

export interface ComparedDuplicate {
  kind: "title" | "description";
  value: string;
  change: "new" | "resolved" | "changed" | "unchanged" | "not-comparable";
  previousUrls: string[];
  currentUrls: string[];
  reason: string;
}

export interface SiteComparison {
  schemaVersion: 1;
  kind: "rankmiso.siteComparison";
  comparable: boolean;
  reason: "" | "origin" | "schema" | "ruleset";
  origin: string;
  coverage: {
    previousAnalyzed: number;
    currentAnalyzed: number;
    sharedPages: number;
    newlyObserved: number;
    notObserved: number;
    previousPartial: boolean;
    currentPartial: boolean;
  };
  counts: {
    newIssues: number;
    resolvedIssues: number;
    unchangedIssues: number;
    notComparableIssues: number;
    addedLinks: number;
    removedLinks: number;
    changedLinks: number;
    notComparableLinks: number;
    linkPagesChanged: number;
    linkPagesUnchanged: number;
    linkPagesNotComparable: number;
  };
  /** True when both sides are the same crawl session, including its saved copy. */
  sameSession: boolean;
  limitations: {
    partial: boolean;
    missingFindings: boolean;
    truncatedLinks: boolean;
  };
  issues: ComparedIssue[];
  pages: ComparedPage[];
  links: ComparedLink[];
  duplicates: ComparedDuplicate[];
}

interface StoredFinding {
  ruleId: string;
  status: string;
  evidence: string;
  evidenceKey: string;
  truncated: boolean;
  category: Category | "unknown";
  title: string;
}

/** True only while the displayed comparison still matches the selected crawls. */
export function comparisonApplies(
  baseline: string,
  later: string,
  liveStamp: string,
  selectedBaseline: string,
  selectedLater: string,
  currentLiveStamp: string,
): boolean {
  return baseline === selectedBaseline && later === selectedLater && liveStamp === currentLiveStamp;
}

function emptyComparison(reason: SiteComparison["reason"], origin = ""): SiteComparison {
  return {
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    kind: "rankmiso.siteComparison",
    comparable: false,
    reason,
    origin,
    coverage: {
      previousAnalyzed: 0,
      currentAnalyzed: 0,
      sharedPages: 0,
      newlyObserved: 0,
      notObserved: 0,
      previousPartial: false,
      currentPartial: false,
    },
    counts: {
      newIssues: 0,
      resolvedIssues: 0,
      unchangedIssues: 0,
      notComparableIssues: 0,
      addedLinks: 0,
      removedLinks: 0,
      changedLinks: 0,
      notComparableLinks: 0,
      linkPagesChanged: 0,
      linkPagesUnchanged: 0,
      linkPagesNotComparable: 0,
    },
    sameSession: false,
    limitations: { partial: false, missingFindings: false, truncatedLinks: false },
    issues: [],
    pages: [],
    links: [],
    duplicates: [],
  };
}

function evidenceKey(finding: CrawlFindingReference): string {
  return finding.evidence
    .map((item) => `${item.label}\u001f${item.value}`)
    .sort()
    .join("\u001e");
}

function evidenceText(finding: CrawlFindingReference): string {
  return finding.evidence.map((item) => `${item.label}: ${item.value}`).join("; ");
}

function linksComplete(page: CrawlPage): boolean {
  if (page.internalLinksTruncated) return false;
  return !(page.analyzed === undefined && page.internalLinkDetails === undefined);
}

interface CrawlIndex {
  session: CrawlSession;
  resolved: ReturnType<typeof resolvedAnalyzedPages>;
  byIdentity: Map<string, CrawlPage>;
  byUrl: Map<string, CrawlPage[]>;
  isInternal: (value: string) => boolean;
}

function indexCrawl(session: CrawlSession): CrawlIndex {
  const resolved = resolvedAnalyzedPages(session);
  const byIdentity = new Map(resolved.pages.map((page) => [pageIdentity(page), page]));
  const byUrl = new Map<string, CrawlPage[]>();
  const add = (key: string, page: CrawlPage) => {
    const list = byUrl.get(key);
    if (list) list.push(page);
    else byUrl.set(key, [page]);
  };
  for (const page of session.pages) {
    add(page.url, page);
    if (page.finalUrl && page.finalUrl !== page.url) add(page.finalUrl, page);
  }
  const originCache = new Map<string, boolean>();
  const isInternal = (value: string) => {
    const cached = originCache.get(value);
    if (cached !== undefined) return cached;
    const internal = sameOrigin(value, session.origin);
    originCache.set(value, internal);
    return internal;
  };
  return { session, resolved, byIdentity, byUrl, isInternal };
}

function presence(index: CrawlIndex, identity: string): CrawlPresence {
  if (index.byIdentity.has(identity)) return "analyzed";
  const related = index.byUrl.get(identity) ?? [];
  if (
    related.some(
      (page) =>
        !page.error && !page.skipped && pageIdentity(page) !== page.url && page.url === identity,
    )
  ) {
    return "redirected";
  }
  if (related.some((page) => page.skipped)) return "skipped";
  if (related.some((page) => page.error || (page.status != null && page.status >= 400)))
    return "failed";
  return "absent";
}

function pageFindings(index: CrawlIndex): {
  byPage: Map<string, StoredFinding[]>;
  missing: Set<string>;
} {
  const catalog = new Map((index.session.findingCatalog ?? []).map((item) => [item.id, item]));
  const byPage = new Map<string, StoredFinding[]>();
  const missing = new Set<string>();
  for (const page of index.resolved.pages) {
    const identity = pageIdentity(page);
    if (!Array.isArray(page.findings)) {
      missing.add(identity);
      continue;
    }
    const list: StoredFinding[] = [];
    for (const finding of page.findings) {
      if (finding.status === "UNAVAILABLE" || finding.status === "NOT_APPLICABLE") continue;
      const definition = catalog.get(finding.id);
      list.push({
        ruleId: finding.id,
        status: finding.status,
        evidence: evidenceText(finding),
        evidenceKey: evidenceKey(finding),
        truncated: finding.evidenceTruncated === true,
        category: definition?.category ?? "unknown",
        title: definition?.title || finding.id,
      });
    }
    byPage.set(identity, list);
  }
  return { byPage, missing };
}

function describedIssue(
  page: string,
  change: IssueChange,
  reason: string,
  before: StoredFinding | undefined,
  after: StoredFinding | undefined,
  evidenceChanged = false,
): ComparedIssue {
  const sample = after ?? before;
  if (!sample) throw new Error("A compared issue needs a finding.");
  return {
    key: `${page}\u0000${sample.ruleId}\u0000${before?.evidenceKey ?? ""}\u0000${after?.evidenceKey ?? ""}\u0000${reason}`,
    change,
    reason,
    page,
    ruleId: sample.ruleId,
    category: sample.category,
    severity: (after ?? before)?.status || "",
    title: sample.title,
    previousStatus: before?.status || "",
    currentStatus: after?.status || "",
    evidence: (after ?? before)?.evidence || "",
    evidenceChanged,
  };
}

/** Pair findings of one rule. Evidence text is not the identity. */
function pairRule(page: string, left: StoredFinding[], right: StoredFinding[]): ComparedIssue[] {
  const truncated = left.some((item) => item.truncated) || right.some((item) => item.truncated);
  const used = new Set<number>();
  const matched: Array<[StoredFinding, StoredFinding]> = [];
  const unmatchedLeft: StoredFinding[] = [];
  for (const item of left) {
    const index = right.findIndex(
      (other, position) => !used.has(position) && other.evidenceKey === item.evidenceKey,
    );
    if (index >= 0) {
      used.add(index);
      matched.push([item, right[index]!]);
    } else unmatchedLeft.push(item);
  }
  const unmatchedRight = right.filter((_item, position) => !used.has(position));
  const issues = matched.map(([before, after]) =>
    describedIssue(page, "unchanged", "", before, after, false),
  );
  const pairCount = Math.min(unmatchedLeft.length, unmatchedRight.length);
  for (let index = 0; index < pairCount; index += 1) {
    issues.push(
      describedIssue(
        page,
        "unchanged",
        truncated ? "" : "evidence-changed",
        unmatchedLeft[index],
        unmatchedRight[index],
        !truncated,
      ),
    );
  }
  const extraLeft = unmatchedLeft.slice(pairCount);
  const extraRight = unmatchedRight.slice(pairCount);
  const changeForExtra = truncated ? "not-comparable" : null;
  for (const item of extraLeft) {
    issues.push(
      describedIssue(
        page,
        changeForExtra ?? "resolved",
        changeForExtra ? "truncated-evidence" : "",
        item,
        undefined,
      ),
    );
  }
  for (const item of extraRight) {
    issues.push(
      describedIssue(
        page,
        changeForExtra ?? "new",
        changeForExtra ? "truncated-evidence" : "",
        undefined,
        item,
      ),
    );
  }
  return issues;
}

function sameOrigin(value: string, origin: string): boolean {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

interface Edge {
  href: string;
  state: string;
  redirect: string;
}

function edges(index: CrawlIndex, page: CrawlPage): Map<string, Edge> {
  const result = new Map<string, Edge>();
  for (const href of page.internalLinks) {
    if (!index.isInternal(href) || result.has(href)) continue;
    const targetId = index.resolved.identityByUrl.get(href) ?? href;
    const target = index.byIdentity.get(targetId);
    const record = target ?? index.byUrl.get(href)?.[0];
    let state = "not-crawled";
    if (record?.skipped) state = "skipped";
    else if (record && (record.error || (record.status != null && record.status >= 400)))
      state = "failed";
    else if (target) state = "analyzed";
    const redirect = target && pageIdentity(target) !== href ? pageIdentity(target) : "";
    result.set(href, { href, state, redirect });
  }
  return result;
}

function field(name: string, previous: string, current: string, comparable = true): ComparedField {
  return {
    field: name,
    previous,
    current,
    changed: comparable && previous !== current,
    comparable,
  };
}

function duplicateMembership(
  index: CrawlIndex,
): Map<string, { title: boolean; description: boolean }> {
  const identityOf = new Map(index.resolved.pages.map((page) => [page.url, pageIdentity(page)]));
  const membership = new Map<string, { title: boolean; description: boolean }>();
  for (const page of index.resolved.pages) {
    membership.set(pageIdentity(page), { title: false, description: false });
  }
  for (const group of duplicateGroups(index.resolved.pages)) {
    for (const url of group.urls) {
      const identity = identityOf.get(url);
      if (!identity) continue;
      const entry = membership.get(identity);
      if (!entry) continue;
      entry[group.kind] = true;
    }
  }
  return membership;
}

function incoming(index: CrawlIndex): Map<string, number> | null {
  if (index.resolved.pages.some((page) => !linksComplete(page))) return null;
  const counts = new Map<string, number>();
  for (const page of index.resolved.pages) {
    if (!index.isInternal(page.url)) continue;
    const targets = new Set<string>();
    for (const href of page.internalLinks) {
      if (!index.isInternal(href)) continue;
      targets.add(index.resolved.identityByUrl.get(href) ?? href);
    }
    for (const target of targets) counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  return counts;
}

export function compareSessions(previous: CrawlSession, current: CrawlSession): SiteComparison {
  if (previous.origin !== current.origin) return emptyComparison("origin");
  const previousIndex = indexCrawl(previous);
  const currentIndex = indexCrawl(current);
  const previousIds = new Set(previousIndex.byIdentity.keys());
  const currentIds = new Set(currentIndex.byIdentity.keys());
  const shared = [...previousIds].filter((identity) => currentIds.has(identity)).sort();
  const sharedSet = new Set(shared);
  const previousFindings = pageFindings(previousIndex);
  const currentFindings = pageFindings(currentIndex);
  const findingPages = new Set([
    ...previousFindings.byPage.keys(),
    ...currentFindings.byPage.keys(),
  ]);
  const issues: ComparedIssue[] = [];
  for (const page of findingPages) {
    const left = previousFindings.byPage.get(page) ?? [];
    const right = currentFindings.byPage.get(page) ?? [];
    const missing = previousFindings.missing.has(page) || currentFindings.missing.has(page);
    if (!sharedSet.has(page) || missing) {
      const reason = !sharedSet.has(page)
        ? currentIds.has(page)
          ? "page-not-in-previous"
          : "page-not-in-current"
        : "missing-findings";
      for (const finding of [...left, ...right]) {
        issues.push(
          describedIssue(
            page,
            "not-comparable",
            reason,
            left.includes(finding) ? finding : undefined,
            right.includes(finding) ? finding : undefined,
          ),
        );
      }
      continue;
    }
    const rules = new Set([
      ...left.map((item) => item.ruleId),
      ...right.map((item) => item.ruleId),
    ]);
    for (const ruleId of [...rules].sort()) {
      issues.push(
        ...pairRule(
          page,
          left.filter((item) => item.ruleId === ruleId),
          right.filter((item) => item.ruleId === ruleId),
        ),
      );
    }
  }
  issues.sort(
    (left, right) =>
      changeOrder(left.change) - changeOrder(right.change) ||
      left.page.localeCompare(right.page) ||
      left.ruleId.localeCompare(right.ruleId) ||
      left.key.localeCompare(right.key),
  );

  const previousDuplicates = duplicateMembership(previousIndex);
  const currentDuplicates = duplicateMembership(currentIndex);
  const previousIncoming = incoming(previousIndex);
  const currentIncoming = incoming(currentIndex);
  const pageIds = [...new Set([...previousIds, ...currentIds])].sort();
  const pages: ComparedPage[] = pageIds.map((identity) => {
    const coverage: PageCoverage = sharedSet.has(identity)
      ? "both"
      : currentIds.has(identity)
        ? "newly-observed"
        : "not-observed";
    const before = previousIndex.byIdentity.get(identity);
    const after = currentIndex.byIdentity.get(identity);
    const findingsComparable =
      coverage === "both" &&
      !!before &&
      !!after &&
      Array.isArray(before.findings) &&
      Array.isArray(after.findings);
    const fields =
      coverage === "both" && before && after
        ? [
            field(
              "title",
              before.title,
              after.title,
              !before.titleTruncated && !after.titleTruncated,
            ),
            field(
              "description",
              before.description,
              after.description,
              !before.descriptionTruncated && !after.descriptionTruncated,
            ),
            field("canonical", before.canonical, after.canonical),
            field("robots", before.robots, after.robots),
            field("indexability", before.indexability, after.indexability),
            field("h1Count", String(before.h1Count), String(after.h1Count)),
            field(
              "issueCount",
              findingsComparable ? String(before.findings?.filter(countedFinding).length ?? 0) : "",
              findingsComparable ? String(after.findings?.filter(countedFinding).length ?? 0) : "",
              findingsComparable,
            ),
            field(
              "duplicateTitle",
              previousDuplicates.get(identity)?.title ? "yes" : "no",
              currentDuplicates.get(identity)?.title ? "yes" : "no",
            ),
            field(
              "duplicateDescription",
              previousDuplicates.get(identity)?.description ? "yes" : "no",
              currentDuplicates.get(identity)?.description ? "yes" : "no",
            ),
            field(
              "incomingSources",
              previousIncoming ? String(previousIncoming.get(identity) ?? 0) : "",
              currentIncoming ? String(currentIncoming.get(identity) ?? 0) : "",
              previousIncoming != null && currentIncoming != null,
            ),
          ]
        : [];
    const comparableFields = fields.filter((item) => item.comparable);
    const status =
      coverage !== "both"
        ? "not-comparable"
        : comparableFields.some((item) => item.changed)
          ? "changed"
          : "unchanged";
    return {
      page: identity,
      coverage,
      previousState: presence(previousIndex, identity),
      currentState: presence(currentIndex, identity),
      status,
      fields,
    };
  });

  const links: ComparedLink[] = [];
  let linkPagesChanged = 0;
  let linkPagesUnchanged = 0;
  let linkPagesNotComparable = 0;
  for (const identity of shared) {
    const before = previousIndex.byIdentity.get(identity);
    const after = currentIndex.byIdentity.get(identity);
    if (!before || !after) continue;
    if (!linksComplete(before) || !linksComplete(after)) {
      linkPagesNotComparable += 1;
      links.push({
        change: "not-comparable",
        source: identity,
        target: "",
        previousState: "",
        currentState: "",
        previousRedirect: "",
        currentRedirect: "",
        reason: "source-links-incomplete",
      });
      continue;
    }
    const beforeEdges = edges(previousIndex, before);
    const afterEdges = edges(currentIndex, after);
    const beforeCount = links.length;
    for (const href of new Set([...beforeEdges.keys(), ...afterEdges.keys()])) {
      const left = beforeEdges.get(href);
      const right = afterEdges.get(href);
      if (left && right) {
        if (left.state === right.state && left.redirect === right.redirect) continue;
        links.push({
          change: "changed",
          source: identity,
          target: href,
          previousState: left.state,
          currentState: right.state,
          previousRedirect: left.redirect,
          currentRedirect: right.redirect,
          reason: "",
        });
      } else if (right) {
        links.push({
          change: "added",
          source: identity,
          target: href,
          previousState: "",
          currentState: right.state,
          previousRedirect: "",
          currentRedirect: right.redirect,
          reason: "",
        });
      } else if (left) {
        links.push({
          change: "removed",
          source: identity,
          target: href,
          previousState: left.state,
          currentState: "",
          previousRedirect: left.redirect,
          currentRedirect: "",
          reason: "",
        });
      }
    }
    if (links.length === beforeCount) linkPagesUnchanged += 1;
    else linkPagesChanged += 1;
  }
  links.sort(
    (left, right) =>
      left.change.localeCompare(right.change) ||
      left.source.localeCompare(right.source) ||
      left.target.localeCompare(right.target),
  );

  const duplicates = compareDuplicates(previousIndex, currentIndex, previousIds, currentIds);
  const counts = {
    newIssues: issues.filter((issue) => issue.change === "new").length,
    resolvedIssues: issues.filter((issue) => issue.change === "resolved").length,
    unchangedIssues: issues.filter((issue) => issue.change === "unchanged").length,
    notComparableIssues: issues.filter((issue) => issue.change === "not-comparable").length,
    addedLinks: links.filter((link) => link.change === "added").length,
    removedLinks: links.filter((link) => link.change === "removed").length,
    changedLinks: links.filter((link) => link.change === "changed").length,
    notComparableLinks: links.filter((link) => link.change === "not-comparable").length,
    linkPagesChanged,
    linkPagesUnchanged,
    linkPagesNotComparable,
  };
  return {
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    kind: "rankmiso.siteComparison",
    comparable: true,
    reason: "",
    origin: current.origin,
    coverage: {
      previousAnalyzed: previousIds.size,
      currentAnalyzed: currentIds.size,
      sharedPages: shared.length,
      newlyObserved: pages.filter((page) => page.coverage === "newly-observed").length,
      notObserved: pages.filter((page) => page.coverage === "not-observed").length,
      previousPartial: previous.partial || previous.status === "stopped",
      currentPartial: current.partial || current.status === "stopped",
    },
    counts,
    sameSession:
      previous.id !== "" && previous.id === current.id && previous.startedAt === current.startedAt,
    limitations: {
      partial:
        previous.partial ||
        current.partial ||
        previous.status === "stopped" ||
        current.status === "stopped",
      missingFindings: previousFindings.missing.size > 0 || currentFindings.missing.size > 0,
      truncatedLinks: counts.notComparableLinks > 0,
    },
    issues,
    pages,
    links,
    duplicates,
  };
}

function countedFinding(finding: CrawlFindingReference): boolean {
  return finding.status !== "UNAVAILABLE" && finding.status !== "NOT_APPLICABLE";
}

function changeOrder(change: IssueChange): number {
  if (change === "new") return 0;
  if (change === "resolved") return 1;
  if (change === "unchanged") return 2;
  return 3;
}

function compareDuplicates(
  previous: CrawlIndex,
  current: CrawlIndex,
  previousIds: Set<string>,
  currentIds: Set<string>,
): ComparedDuplicate[] {
  const groups = (index: CrawlIndex) => {
    const identityOf = new Map(index.resolved.pages.map((page) => [page.url, pageIdentity(page)]));
    const map = new Map<string, { kind: "title" | "description"; value: string; ids: string[] }>();
    for (const group of duplicateGroups(index.resolved.pages)) {
      const ids = group.urls.flatMap((url) => {
        const identity = identityOf.get(url);
        return identity ? [identity] : [];
      });
      map.set(`${group.kind}\u0000${normalizeMetadata(group.value)}`, {
        kind: group.kind,
        value: group.value,
        ids,
      });
    }
    return map;
  };
  const before = groups(previous);
  const after = groups(current);
  const result: ComparedDuplicate[] = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const left = before.get(key);
    const right = after.get(key);
    const sample = right ?? left;
    if (!sample) continue;
    const leftIds = new Set(left?.ids ?? []);
    const rightIds = new Set(right?.ids ?? []);
    const involved = new Set([...leftIds, ...rightIds]);
    const covered = [...involved].every(
      (identity) => previousIds.has(identity) && currentIds.has(identity),
    );
    let change: ComparedDuplicate["change"] = "unchanged";
    let reason = "";
    if (!covered) {
      change = "not-comparable";
      reason = "coverage";
    } else if (!left) change = "new";
    else if (!right) change = "resolved";
    else if ([...leftIds].sort().join("\n") !== [...rightIds].sort().join("\n")) change = "changed";
    if (change === "unchanged") continue;
    result.push({
      kind: sample.kind,
      value: sample.value,
      change,
      previousUrls: [...leftIds].sort(),
      currentUrls: [...rightIds].sort(),
      reason,
    });
  }
  result.sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.value.localeCompare(right.value),
  );
  return result;
}

export function compareSnapshots(previous: CrawlSnapshot, current: CrawlSnapshot): SiteComparison {
  if (
    previous.schemaVersion !== COMPARISON_SCHEMA_VERSION ||
    current.schemaVersion !== COMPARISON_SCHEMA_VERSION
  ) {
    return emptyComparison("schema");
  }
  if (!previous.rulesetVersion || previous.rulesetVersion !== current.rulesetVersion) {
    return emptyComparison("ruleset", previous.origin);
  }
  return compareSessions(previous.session, current.session);
}

export interface ComparisonFilter {
  status: "all" | IssueChange;
  severity: "all" | "error" | "warning" | "info";
  category: string;
  rule: string;
  page: string;
}

export function filterComparedIssues(
  issues: ComparedIssue[],
  filter: ComparisonFilter,
): ComparedIssue[] {
  const page = filter.page.trim().toLocaleLowerCase("und");
  const rule = filter.rule.trim().toLocaleLowerCase("und");
  return issues.filter((issue) => {
    if (filter.status !== "all" && issue.change !== filter.status) return false;
    if (filter.category !== "all" && issue.category !== filter.category) return false;
    if (filter.severity !== "all" && issue.severity.toLocaleLowerCase("und") !== filter.severity) {
      return false;
    }
    if (rule && !issue.ruleId.toLocaleLowerCase("und").includes(rule)) return false;
    if (page && !issue.page.toLocaleLowerCase("und").includes(page)) return false;
    return true;
  });
}

const CSV_HEADERS = [
  "schemaVersion",
  "recordType",
  "change",
  "reason",
  "page",
  "ruleId",
  "category",
  "severity",
  "field",
  "previous",
  "current",
  "detail",
];

export function comparisonCsv(comparison: SiteComparison): string {
  const rows: unknown[][] = [
    [COMPARISON_SCHEMA_VERSION, "schema", "", "", "", "", "", "", "", "", "", comparison.kind],
    [
      COMPARISON_SCHEMA_VERSION,
      "summary",
      comparison.comparable ? "comparable" : comparison.reason,
      comparison.reason,
      comparison.origin,
      "",
      "",
      "",
      "",
      String(comparison.coverage.previousAnalyzed),
      String(comparison.coverage.currentAnalyzed),
      JSON.stringify({
        coverage: comparison.coverage,
        counts: comparison.counts,
        limitations: comparison.limitations,
      }),
    ],
  ];
  for (const issue of comparison.issues) {
    rows.push([
      COMPARISON_SCHEMA_VERSION,
      "issue",
      issue.change,
      issue.reason,
      issue.page,
      issue.ruleId,
      issue.category,
      issue.severity,
      "",
      issue.previousStatus,
      issue.currentStatus,
      issue.evidence,
    ]);
  }
  for (const page of comparison.pages) {
    if (page.status === "unchanged") continue;
    rows.push([
      COMPARISON_SCHEMA_VERSION,
      "page",
      page.coverage,
      page.status,
      page.page,
      "",
      "",
      "",
      "",
      page.previousState,
      page.currentState,
      "",
    ]);
    for (const item of page.fields) {
      if (!item.comparable || !item.changed) continue;
      rows.push([
        COMPARISON_SCHEMA_VERSION,
        "page-field",
        "changed",
        "",
        page.page,
        "",
        "",
        "",
        item.field,
        item.previous,
        item.current,
        "",
      ]);
    }
  }
  for (const link of comparison.links) {
    rows.push([
      COMPARISON_SCHEMA_VERSION,
      "link",
      link.change,
      link.reason,
      link.source,
      "",
      "",
      "",
      "target",
      link.previousState || link.previousRedirect,
      link.currentState || link.currentRedirect,
      link.target,
    ]);
  }
  for (const group of comparison.duplicates) {
    rows.push([
      COMPARISON_SCHEMA_VERSION,
      "duplicate",
      group.change,
      group.reason,
      "",
      "",
      group.kind,
      "",
      "metadata",
      group.previousUrls.join(" "),
      group.currentUrls.join(" "),
      group.value,
    ]);
  }
  return toCsv(CSV_HEADERS, rows);
}

export function comparisonJson(comparison: SiteComparison): string {
  return JSON.stringify(comparison, null, 2);
}
