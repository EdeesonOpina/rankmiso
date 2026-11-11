<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "../../composables/useI18n";
import {
  filterComparedIssues,
  type IssueChange,
  type SiteComparison,
} from "../../services/site-compare";

const props = defineProps<{ comparison: SiteComparison }>();
const { t, n } = useI18n();
const status = ref<"all" | IssueChange>("all");
const severity = ref<"all" | "error" | "warning" | "info">("all");
const category = ref("all");
const rule = ref("all");
const pageQuery = ref("");
const pageScope = ref<"changes" | "all">("changes");
const shownIssues = ref(40);
const shownPages = ref(40);
const shownLinks = ref(40);
const linkFilter = ref<"changes" | "added" | "removed" | "changed" | "not-comparable">("changes");

watch(
  () => props.comparison,
  () => {
    shownIssues.value = 40;
    shownPages.value = 40;
    shownLinks.value = 40;
  },
);

const categories = computed(() => [
  ...new Set(props.comparison.issues.map((issue) => issue.category)),
]);
const rules = computed(() =>
  [...new Set(props.comparison.issues.map((issue) => issue.ruleId))].sort(),
);
const visibleIssues = computed(() =>
  filterComparedIssues(props.comparison.issues, {
    status: status.value,
    severity: severity.value,
    category: category.value,
    rule: rule.value === "all" ? "" : rule.value,
    page: pageQuery.value,
  }),
);
const visiblePages = computed(() =>
  props.comparison.pages.filter((item) => pageScope.value === "all" || item.status !== "unchanged"),
);
const changedLinks = computed(() =>
  props.comparison.links.filter((link) => link.change !== "not-comparable"),
);
const visibleLinks = computed(() => {
  const links =
    linkFilter.value === "changes"
      ? changedLinks.value
      : props.comparison.links.filter((link) => link.change === linkFilter.value);
  return links;
});
const incompleteLinkPages = computed(() =>
  props.comparison.links.filter((link) => link.change === "not-comparable"),
);
const sameCrawlClear = computed(
  () =>
    props.comparison.sameSession &&
    props.comparison.counts.newIssues === 0 &&
    props.comparison.counts.resolvedIssues === 0 &&
    props.comparison.counts.addedLinks === 0 &&
    props.comparison.counts.removedLinks === 0 &&
    props.comparison.counts.changedLinks === 0 &&
    !props.comparison.pages.some((page) => page.status === "changed"),
);
const summaryLabel = computed(() =>
  t("site.compare.summaryLabel", {
    previous: n(props.comparison.coverage.previousAnalyzed),
    current: n(props.comparison.coverage.currentAnalyzed),
    fresh: n(props.comparison.counts.newIssues),
    resolved: n(props.comparison.counts.resolvedIssues),
    unchanged: n(props.comparison.counts.unchangedIssues),
    unverified: n(props.comparison.counts.notComparableIssues),
  }),
);

function tone(change: string): string {
  if (change === "resolved") return "ok";
  if (change === "new" || change === "added" || change === "removed" || change === "changed")
    return "warn";
  return "gray";
}

function changeLabel(change: string): string {
  if (change === "new" || change === "added") return t("site.compare.new");
  if (change === "resolved" || change === "removed") return t("site.compare.resolved");
  if (change === "unchanged") return t("site.compare.unchanged");
  if (change === "changed") return t("site.compare.changed");
  return t("site.compare.notComparable");
}

function reasonLabel(reason: string): string {
  if (reason === "page-not-in-current") return t("site.compare.reason.pageNotInCurrent");
  if (reason === "page-not-in-previous") return t("site.compare.reason.pageNotInPrevious");
  if (reason === "missing-findings") return t("site.compare.reason.missingFindings");
  if (reason === "source-links-incomplete") return t("site.compare.reason.linksIncomplete");
  if (reason === "coverage") return t("site.compare.reason.coverage");
  if (reason === "evidence-changed") return t("site.compare.reason.evidenceChanged");
  if (reason === "truncated-evidence") return t("site.compare.reason.truncatedEvidence");
  return "";
}

function path(url: string): string {
  try {
    const value = new URL(url);
    return `${value.pathname}${value.search}` || "/";
  } catch {
    return url;
  }
}

function fieldLabel(field: string): string {
  if (field === "title") return t("site.compare.field.title");
  if (field === "description") return t("site.compare.field.description");
  if (field === "canonical") return t("site.compare.field.canonical");
  if (field === "robots") return t("site.compare.field.robots");
  if (field === "indexability") return t("site.compare.field.indexability");
  if (field === "h1Count") return t("site.compare.field.h1Count");
  if (field === "issueCount") return t("site.compare.field.issueCount");
  if (field === "duplicateTitle") return t("site.compare.field.duplicateTitle");
  if (field === "duplicateDescription") return t("site.compare.field.duplicateDescription");
  if (field === "incomingSources") return t("site.compare.field.incomingSources");
  return field;
}
</script>

<template>
  <section class="site-compare" aria-labelledby="site-compare-heading">
    <h2 id="site-compare-heading" class="sr-only">{{ t("site.compare.results") }}</h2>
    <p class="hint">{{ t("site.compare.notAScore") }}</p>
    <p v-if="sameCrawlClear" class="callout">{{ t("site.compare.sameCrawl") }}</p>
    <p
      v-if="
        sameCrawlClear &&
        (comparison.limitations.truncatedLinks || comparison.limitations.missingFindings)
      "
      class="hint"
    >
      {{ t("site.compare.sameCrawlPartial") }}
    </p>
    <h3>{{ t("site.compare.coverageHeading") }}</h3>
    <div class="crawl-metrics" role="group" :aria-label="summaryLabel">
      <div class="kpi">
        <strong>{{ n(comparison.coverage.previousAnalyzed) }}</strong>
        <span>{{ t("site.compare.previousPages") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.coverage.currentAnalyzed) }}</strong>
        <span>{{ t("site.compare.currentPages") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.coverage.newlyObserved) }}</strong>
        <span>{{ t("site.compare.newlyObserved") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.coverage.notObserved) }}</strong>
        <span>{{ t("site.compare.notObserved") }}</span>
      </div>
    </div>
    <h3>{{ t("site.compare.issues") }}</h3>
    <div class="crawl-metrics">
      <div class="kpi">
        <strong>{{ n(comparison.counts.newIssues) }}</strong>
        <span>{{ t("site.compare.new") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.counts.resolvedIssues) }}</strong>
        <span>{{ t("site.compare.resolved") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.counts.unchangedIssues) }}</strong>
        <span>{{ t("site.compare.unchanged") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.counts.notComparableIssues) }}</strong>
        <span>{{ t("site.compare.notComparable") }}</span>
      </div>
    </div>
    <h3>{{ t("site.compare.reliability") }}</h3>
    <p v-if="comparison.limitations.partial" class="callout">{{ t("site.compare.partial") }}</p>
    <p v-if="comparison.limitations.missingFindings" class="callout">
      {{ t("site.compare.missingFindings") }}
    </p>
    <p v-if="comparison.limitations.truncatedLinks" class="callout">
      {{ t("site.compare.truncatedLinks") }}
    </p>
    <p class="hint">
      {{
        comparison.counts.notComparableIssues > 0 || comparison.limitations.missingFindings
          ? t("site.compare.reliabilityPartial", {
              count: n(comparison.counts.notComparableIssues),
            })
          : t("site.compare.reliabilityFull")
      }}
    </p>
    <p class="sr-only">{{ summaryLabel }}</p>

    <h3>{{ t("site.compare.issueList") }}</h3>
    <div class="filter-tools">
      <label class="select-field">
        <span>{{ t("site.compare.status") }}</span>
        <select v-model="status">
          <option value="all">{{ t("site.filterAll") }}</option>
          <option value="new">{{ t("site.compare.new") }}</option>
          <option value="resolved">{{ t("site.compare.resolved") }}</option>
          <option value="unchanged">{{ t("site.compare.unchanged") }}</option>
          <option value="not-comparable">{{ t("site.compare.notComparable") }}</option>
        </select>
      </label>
      <label class="select-field">
        <span>{{ t("site.severity") }}</span>
        <select v-model="severity">
          <option value="all">{{ t("site.allSeverities") }}</option>
          <option value="error">{{ t("site.severity.error") }}</option>
          <option value="warning">{{ t("site.severity.warning") }}</option>
          <option value="info">{{ t("site.severity.info") }}</option>
        </select>
      </label>
      <label class="select-field">
        <span>{{ t("site.category") }}</span>
        <select v-model="category">
          <option value="all">{{ t("site.allCategories") }}</option>
          <option v-for="item in categories" :key="item" :value="item">
            {{ t(`site.category.${item}`) }}
          </option>
        </select>
      </label>
      <label class="select-field">
        <span>{{ t("site.compare.rule") }}</span>
        <select v-model="rule">
          <option value="all">{{ t("site.filterAll") }}</option>
          <option v-for="item in rules" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label class="search">
        <span class="sr-only">{{ t("site.compare.pageFilter") }}</span>
        <input v-model="pageQuery" type="search" :aria-label="t('site.compare.pageFilter')" />
      </label>
    </div>
    <p v-if="!visibleIssues.length" class="callout">{{ t("site.compare.noIssues") }}</p>
    <div v-else class="finding-list">
      <article
        v-for="issue in visibleIssues.slice(0, shownIssues)"
        :key="issue.key"
        class="finding site-issue"
      >
        <div class="finding-type">
          <span class="badge" :class="tone(issue.change)">{{ changeLabel(issue.change) }}</span>
          <span>{{ issue.severity || t("site.severityUndefined") }}</span>
          <span>{{ t(`site.category.${issue.category}`) }}</span>
        </div>
        <h3>{{ issue.title }}</h3>
        <p>{{ path(issue.page) }}</p>
        <p v-if="issue.previousStatus || issue.currentStatus" class="hint">
          {{ issue.previousStatus || "—" }} → {{ issue.currentStatus || "—" }}
        </p>
        <p v-if="reasonLabel(issue.reason)" class="hint">{{ reasonLabel(issue.reason) }}</p>
        <p v-if="issue.evidence" class="hint">{{ issue.evidence }}</p>
      </article>
    </div>
    <button
      v-if="visibleIssues.length > shownIssues"
      type="button"
      class="subtle-btn more-btn"
      @click="shownIssues += 40"
    >
      {{ t("site.moreIssues") }} →
    </button>

    <h3>{{ t("site.compare.pages") }}</h3>
    <label class="select-field">
      <span>{{ t("site.compare.pageScope") }}</span>
      <select v-model="pageScope">
        <option value="changes">{{ t("site.compare.pageChanges") }}</option>
        <option value="all">{{ t("site.filterAll") }}</option>
      </select>
    </label>
    <p v-if="!visiblePages.length" class="callout">{{ t("site.compare.noPages") }}</p>
    <div v-else class="finding-list">
      <article v-for="item in visiblePages.slice(0, shownPages)" :key="item.page" class="finding">
        <div class="finding-type">
          <span
            class="badge"
            :class="tone(item.status === 'not-comparable' ? 'not-comparable' : item.status)"
          >
            {{
              item.coverage === "both"
                ? changeLabel(item.status)
                : t(`site.compare.coverage.${item.coverage}`)
            }}
          </span>
        </div>
        <h3>{{ path(item.page) }}</h3>
        <p class="hint">
          {{
            t("site.compare.presence", { previous: item.previousState, current: item.currentState })
          }}
        </p>
        <div v-if="item.fields.some((field) => field.changed)" class="properties">
          <div
            v-for="field in item.fields.filter((entry) => entry.changed)"
            :key="field.field"
            class="property"
          >
            <span>{{ fieldLabel(field.field) }}</span>
            <strong>{{ field.previous || "—" }}</strong>
            <strong>{{ field.current || "—" }}</strong>
          </div>
        </div>
      </article>
    </div>
    <button
      v-if="visiblePages.length > shownPages"
      type="button"
      class="subtle-btn more-btn"
      @click="shownPages += 40"
    >
      {{ t("site.more") }} →
    </button>

    <h3>{{ t("site.compare.links") }}</h3>
    <p class="hint">{{ t("site.compare.linkScope") }}</p>
    <div class="crawl-metrics" role="group" :aria-label="t('site.compare.linkSummary')">
      <div class="kpi">
        <strong>{{ n(comparison.counts.linkPagesChanged) }}</strong>
        <span>{{ t("site.compare.linkVerified") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.counts.linkPagesUnchanged) }}</strong>
        <span>{{ t("site.compare.linkUnchanged") }}</span>
      </div>
      <div class="kpi">
        <strong>{{ n(comparison.counts.linkPagesNotComparable) }}</strong>
        <span>{{ t("site.compare.linkUnable") }}</span>
      </div>
    </div>
    <details v-if="incompleteLinkPages.length" class="disclosure">
      <summary>
        {{ t("site.compare.linkIncompleteToggle", { count: n(incompleteLinkPages.length) }) }}
      </summary>
      <div class="list">
        <p v-for="link in incompleteLinkPages" :key="link.source" class="note-row">
          {{ path(link.source) }} — {{ reasonLabel(link.reason) }}
        </p>
      </div>
    </details>
    <label class="select-field">
      <span>{{ t("site.compare.linkFilter") }}</span>
      <select v-model="linkFilter">
        <option value="changes">{{ t("site.compare.linkVerified") }}</option>
        <option value="added">{{ t("site.compare.new") }}</option>
        <option value="removed">{{ t("site.compare.resolved") }}</option>
        <option value="changed">{{ t("site.compare.changed") }}</option>
        <option value="not-comparable">{{ t("site.compare.notComparable") }}</option>
      </select>
    </label>
    <p v-if="!visibleLinks.length" class="callout">{{ t("site.compare.noLinks") }}</p>
    <div v-else class="finding-list">
      <article
        v-for="link in visibleLinks.slice(0, shownLinks)"
        :key="`${link.change}:${link.source}:${link.target}:${link.reason}`"
        class="finding"
      >
        <div class="finding-type">
          <span class="badge" :class="tone(link.change)">{{ changeLabel(link.change) }}</span>
        </div>
        <h3>{{ path(link.source) }}</h3>
        <p>{{ link.target ? path(link.target) : t("site.compare.notComparable") }}</p>
        <p v-if="link.change === 'changed'" class="hint">
          {{ link.previousState || "—" }}
          {{ link.previousRedirect ? `→ ${path(link.previousRedirect)}` : "" }}
          /
          {{ link.currentState || "—" }}
          {{ link.currentRedirect ? `→ ${path(link.currentRedirect)}` : "" }}
        </p>
        <p v-if="reasonLabel(link.reason)" class="hint">{{ reasonLabel(link.reason) }}</p>
      </article>
    </div>
    <button
      v-if="visibleLinks.length > shownLinks"
      type="button"
      class="subtle-btn more-btn"
      @click="shownLinks += 40"
    >
      {{ t("site.moreLinks") }} →
    </button>

    <h3>{{ t("site.compare.duplicates") }}</h3>
    <p v-if="!comparison.duplicates.length" class="callout">{{ t("site.compare.noDuplicates") }}</p>
    <div v-else class="finding-list">
      <article
        v-for="group in comparison.duplicates"
        :key="`${group.kind}:${group.value}`"
        class="finding"
      >
        <div class="finding-type">
          <span class="badge" :class="tone(group.change)">{{ changeLabel(group.change) }}</span>
          <span>{{ group.kind }}</span>
        </div>
        <h3>{{ group.value }}</h3>
        <p v-if="reasonLabel(group.reason)" class="hint">{{ reasonLabel(group.reason) }}</p>
      </article>
    </div>
  </section>
</template>
