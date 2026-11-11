<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowLeftRight, Check, Info, Plus, Shield } from "lucide-vue-next";
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
const largerCrawl = computed(() =>
  Math.max(props.comparison.coverage.previousAnalyzed, props.comparison.coverage.currentAnalyzed),
);
const sharedShare = computed(() => {
  const larger = largerCrawl.value;
  if (!larger) return 0;
  return Math.round((props.comparison.coverage.sharedPages / larger) * 100);
});
const heroHeading = computed(() => {
  const counts = props.comparison.counts;
  if (sameCrawlClear.value) return t("site.compare.hero.same");
  if (counts.newIssues > 0 && counts.resolvedIssues > 0) return t("site.compare.hero.mixed");
  if (counts.newIssues > 0) return t("site.compare.hero.new");
  if (counts.resolvedIssues > 0) return t("site.compare.hero.resolved");
  const pageChanged = props.comparison.pages.some((item) =>
    item.fields.some((field) => field.changed),
  );
  if (pageChanged || counts.addedLinks > 0 || counts.removedLinks > 0 || counts.changedLinks > 0) {
    return t("site.compare.hero.mixed");
  }
  if (counts.notComparableIssues > 0 || props.comparison.limitations.partial) {
    return t("site.compare.hero.partial");
  }
  return t("site.compare.hero.none");
});
const heroDescription = computed(() => {
  if (sameCrawlClear.value) return t("site.compare.sameCrawl");
  if (props.comparison.limitations.partial) return t("site.compare.partial");
  return t("site.compare.notAScore");
});
const linkTotal = computed(
  () =>
    props.comparison.counts.linkPagesChanged +
    props.comparison.counts.linkPagesUnchanged +
    props.comparison.counts.linkPagesNotComparable,
);
const linkComparable = computed(
  () => props.comparison.counts.linkPagesChanged + props.comparison.counts.linkPagesUnchanged,
);
const donutStops = computed(() => {
  const total = linkTotal.value;
  if (!total) return { a: "0deg", b: "0deg" };
  const unchanged = props.comparison.counts.linkPagesUnchanged / total;
  const changed =
    (props.comparison.counts.linkPagesUnchanged + props.comparison.counts.linkPagesChanged) / total;
  return { a: `${unchanged * 360}deg`, b: `${changed * 360}deg` };
});
const confirmedPages = computed(
  () => props.comparison.pages.filter((item) => item.fields.some((field) => field.changed)).length,
);
const findingTotal = computed(
  () =>
    props.comparison.counts.newIssues +
    props.comparison.counts.resolvedIssues +
    props.comparison.counts.unchangedIssues +
    props.comparison.counts.notComparableIssues,
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
    <p class="sr-only">{{ summaryLabel }}</p>
    <div class="compare-hero-grid">
      <section class="compare-hero" :aria-label="t('site.compare.results')">
        <div>
          <p class="compare-hero-tag">
            <Shield class="ic" aria-hidden="true" /> {{ t("site.compare.reliability") }}
          </p>
          <h3 class="compare-hero-heading">{{ heroHeading }}</h3>
          <p class="compare-hero-copy">{{ heroDescription }}</p>
          <p
            v-if="
              sameCrawlClear &&
              (comparison.limitations.truncatedLinks || comparison.limitations.missingFindings)
            "
            class="compare-hero-copy"
          >
            {{ t("site.compare.sameCrawlPartial") }}
          </p>
        </div>
        <div class="compare-hero-chips">
          <span class="compare-chip">
            <Check class="ic" aria-hidden="true" />
            {{ t("site.compare.hero.matched", { count: n(comparison.counts.unchangedIssues) }) }}
          </span>
          <span class="compare-chip">
            {{ t("site.compare.hero.links", { count: n(comparison.counts.linkPagesUnchanged) }) }}
          </span>
          <span class="compare-chip">{{ t("site.compare.hero.local") }}</span>
        </div>
      </section>
      <section class="compare-coverage" :aria-label="t('site.compare.coverageHeading')">
        <div class="compare-kicker">
          <span>{{ t("site.compare.coverageHeading") }}</span>
        </div>
        <p class="compare-coverage-number">
          {{ n(comparison.coverage.sharedPages) }}
          <span>/ {{ n(largerCrawl) }}</span>
        </p>
        <p class="compare-coverage-text">{{ t("site.compare.sharedText") }}</p>
        <div class="compare-bar-label">
          <span>{{ t("site.compare.coverageHeading") }}</span>
          <strong>{{ t("site.compare.matchedShare", { count: n(sharedShare) }) }}</strong>
        </div>
        <div
          class="compare-bar"
          role="img"
          :aria-label="t('site.compare.matchedShare', { count: n(sharedShare) })"
        >
          <span :style="{ width: `${sharedShare}%` }" />
        </div>
        <div class="compare-mini">
          <div>
            <strong>{{ n(comparison.coverage.previousAnalyzed) }}</strong>
            <span>{{ t("site.compare.previousPages") }}</span>
          </div>
          <div>
            <strong>{{ n(comparison.coverage.currentAnalyzed) }}</strong>
            <span>{{ t("site.compare.currentPages") }}</span>
          </div>
          <div>
            <strong>{{ n(comparison.coverage.newlyObserved) }}</strong>
            <span>{{ t("site.compare.newlyObserved") }}</span>
          </div>
          <div>
            <strong>{{ n(comparison.coverage.notObserved) }}</strong>
            <span>{{ t("site.compare.notObserved") }}</span>
          </div>
        </div>
      </section>
    </div>

    <div class="compare-section-head">
      <div>
        <h3>{{ t("site.compare.movement") }}</h3>
        <p>{{ t("site.compare.movementNote") }}</p>
      </div>
    </div>
    <div class="compare-metrics" role="group" :aria-label="summaryLabel">
      <article class="compare-metric" data-tone="danger">
        <div class="compare-metric-top">
          <span>{{ t("site.compare.new") }}</span>
          <Plus class="ic" aria-hidden="true" />
        </div>
        <strong>{{ n(comparison.counts.newIssues) }}</strong>
        <p>{{ t("site.compare.newNote") }}</p>
      </article>
      <article class="compare-metric" data-tone="success">
        <div class="compare-metric-top">
          <span>{{ t("site.compare.resolved") }}</span>
          <Check class="ic" aria-hidden="true" />
        </div>
        <strong>{{ n(comparison.counts.resolvedIssues) }}</strong>
        <p>{{ t("site.compare.resolvedNote") }}</p>
      </article>
      <article class="compare-metric" data-tone="neutral">
        <div class="compare-metric-top">
          <span>{{ t("site.compare.unchanged") }}</span>
          <ArrowLeftRight class="ic" aria-hidden="true" />
        </div>
        <strong>{{ n(comparison.counts.unchangedIssues) }}</strong>
        <p>{{ t("site.compare.unchangedNote") }}</p>
      </article>
      <article class="compare-metric" data-tone="warning">
        <div class="compare-metric-top">
          <span>{{ t("site.compare.notComparable") }}</span>
          <Info class="ic" aria-hidden="true" />
        </div>
        <strong>{{ n(comparison.counts.notComparableIssues) }}</strong>
        <p>{{ t("site.compare.unknownNote") }}</p>
      </article>
    </div>

    <div class="compare-main">
      <section class="compare-panel" :aria-label="t('site.compare.activity')">
        <div class="compare-panel-head">
          <div>
            <h3>{{ t("site.compare.activity") }}</h3>
            <p>{{ t("site.compare.activityNote") }}</p>
          </div>
          <span class="count-badge">{{
            t("site.compare.findingsCount", { count: n(findingTotal) })
          }}</span>
        </div>
        <div class="filter-tools compare-toolbar">
          <label class="search">
            <span class="sr-only">{{ t("site.compare.pageFilter") }}</span>
            <input v-model="pageQuery" type="search" :aria-label="t('site.compare.pageFilter')" />
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
        </div>
        <div class="status-tabs" role="group" :aria-label="t('site.compare.status')">
          <button
            v-for="item in ['all', 'new', 'resolved', 'unchanged', 'not-comparable'] as const"
            :key="item"
            type="button"
            :class="{ active: status === item }"
            :aria-pressed="status === item"
            @click="status = item"
          >
            {{ item === "all" ? t("site.filterAll") : changeLabel(item) }}
          </button>
        </div>
        <p v-if="!visibleIssues.length" class="compare-empty">{{ t("site.compare.noIssues") }}</p>
        <div v-else class="compare-issue-list">
          <article
            v-for="issue in visibleIssues.slice(0, shownIssues)"
            :key="issue.key"
            class="compare-issue site-issue"
          >
            <div class="finding-type">
              <span class="badge" :class="tone(issue.change)">{{ changeLabel(issue.change) }}</span>
              <span>{{ issue.severity || t("site.severityUndefined") }}</span>
              <span>{{ t(`site.category.${issue.category}`) }}</span>
            </div>
            <h3>{{ issue.title }}</h3>
            <p class="compare-url">{{ path(issue.page) }}</p>
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
      </section>

      <div class="compare-side">
        <section class="compare-panel" :aria-label="t('site.compare.linkIntegrity')">
          <div class="compare-panel-head">
            <div>
              <h3>{{ t("site.compare.linkIntegrity") }}</h3>
              <p>{{ t("site.compare.linkIntegrityNote") }}</p>
            </div>
          </div>
          <div v-if="linkTotal" class="compare-links">
            <div
              class="compare-donut"
              :style="{ '--donut-a': donutStops.a, '--donut-b': donutStops.b }"
              role="img"
              :aria-label="t('site.compare.linkSummary')"
            >
              <div>
                <strong>{{ n(linkComparable) }}</strong>
                <span>{{ t("site.compare.linkComparable") }}</span>
              </div>
            </div>
            <div class="compare-legend">
              <p>
                <span>{{ t("site.compare.linkUnchanged") }}</span>
                <b>{{ n(comparison.counts.linkPagesUnchanged) }}</b>
              </p>
              <p>
                <span>{{ t("site.compare.linkVerified") }}</span>
                <b>{{ n(comparison.counts.linkPagesChanged) }}</b>
              </p>
              <p>
                <span>{{ t("site.compare.linkUnable") }}</span>
                <b>{{ n(comparison.counts.linkPagesNotComparable) }}</b>
              </p>
            </div>
          </div>
          <p v-else class="compare-empty">{{ t("site.compare.noLinks") }}</p>
          <div class="compare-callout" :class="{ good: !comparison.counts.linkPagesNotComparable }">
            <p>
              <strong>{{
                comparison.counts.linkPagesNotComparable
                  ? t("site.compare.linkSomeIncomplete", {
                      count: n(comparison.counts.linkPagesNotComparable),
                    })
                  : t("site.compare.linkAllComparable")
              }}</strong>
            </p>
            <p>{{ t("site.compare.linkScope") }}</p>
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
          <p v-if="!visibleLinks.length" class="compare-empty">{{ t("site.compare.noLinks") }}</p>
          <div v-else class="compare-issue-list">
            <article
              v-for="link in visibleLinks.slice(0, shownLinks)"
              :key="`${link.change}:${link.source}:${link.target}:${link.reason}`"
              class="compare-issue"
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
        </section>

        <section class="compare-panel" :aria-label="t('site.compare.reliability')">
          <div class="compare-panel-head">
            <div>
              <h3>{{ t("site.compare.reliability") }}</h3>
              <p>{{ t("site.compare.notAScore") }}</p>
            </div>
          </div>
          <ul class="compare-reliability">
            <li v-if="comparison.limitations.partial">{{ t("site.compare.partial") }}</li>
            <li v-if="comparison.limitations.missingFindings">
              {{ t("site.compare.missingFindings") }}
            </li>
            <li v-if="comparison.limitations.truncatedLinks">
              {{ t("site.compare.truncatedLinks") }}
            </li>
            <li>
              {{
                comparison.counts.notComparableIssues > 0 || comparison.limitations.missingFindings
                  ? t("site.compare.reliabilityPartial", {
                      count: n(comparison.counts.notComparableIssues),
                    })
                  : t("site.compare.reliabilityFull")
              }}
            </li>
          </ul>
        </section>
      </div>
    </div>

    <div class="compare-bottom">
      <section class="compare-panel" :aria-label="t('site.compare.pages')">
        <div class="compare-panel-head">
          <div>
            <h3>{{ t("site.compare.pages") }}</h3>
            <p>{{ t("site.compare.pagesNote") }}</p>
          </div>
          <span class="count-badge">{{
            t("site.compare.confirmedCount", { count: n(confirmedPages) })
          }}</span>
        </div>
        <label class="select-field">
          <span>{{ t("site.compare.pageScope") }}</span>
          <select v-model="pageScope">
            <option value="changes">{{ t("site.compare.pageChanges") }}</option>
            <option value="all">{{ t("site.filterAll") }}</option>
          </select>
        </label>
        <p v-if="!visiblePages.length" class="compare-empty">{{ t("site.compare.noPages") }}</p>
        <div v-else class="compare-issue-list">
          <article
            v-for="item in visiblePages.slice(0, shownPages)"
            :key="item.page"
            class="compare-issue"
          >
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
                t("site.compare.presence", {
                  previous: item.previousState,
                  current: item.currentState,
                })
              }}
            </p>
            <p
              v-for="field in item.fields.filter((entry) => entry.changed)"
              :key="field.field"
              class="hint"
            >
              {{ fieldLabel(field.field) }}: {{ field.previous || "—" }} →
              {{ field.current || "—" }}
            </p>
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
      </section>

      <section class="compare-panel" :aria-label="t('site.compare.duplicates')">
        <div class="compare-panel-head">
          <div>
            <h3>{{ t("site.compare.duplicates") }}</h3>
            <p>{{ t("site.compare.duplicatesNote") }}</p>
          </div>
        </div>
        <p v-if="!comparison.duplicates.length" class="compare-empty">
          {{ t("site.compare.noDuplicates") }}
        </p>
        <div v-else class="compare-issue-list">
          <article
            v-for="group in comparison.duplicates"
            :key="`${group.kind}:${group.value}`"
            class="compare-issue"
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
    </div>
  </section>
</template>
