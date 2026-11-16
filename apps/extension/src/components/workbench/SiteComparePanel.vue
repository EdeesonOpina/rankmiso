<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowLeftRight,
  ArrowRight,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Link,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-vue-next";
import { useI18n } from "../../composables/useI18n";
import type { CheckStatus } from "../../types/audit";
import { statusKey } from "./checks";
import { categoryIcon } from "./site-icons";
import SxPanel from "./SxPanel.vue";
import SxStat from "./SxStat.vue";
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
const shownIssues = ref(8);
const shownPages = ref(8);
const shownLinks = ref(6);
const linkFilter = ref<"changes" | "added" | "removed" | "changed" | "not-comparable">("changes");

watch(
  () => props.comparison,
  () => {
    shownIssues.value = 8;
    shownPages.value = 8;
    shownLinks.value = 6;
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
  if (change === "new" || change === "added" || change === "removed") return "warn";
  if (change === "changed") return "violet";
  return "";
}

function severityLabel(severity: string): string {
  return severity in statusKey
    ? t(statusKey[severity as CheckStatus])
    : severity || t("site.severityUndefined");
}

function changeNote(change: string): string {
  if (change === "new") return t("site.compare.newNote");
  if (change === "resolved") return t("site.compare.resolvedNote");
  if (change === "unchanged") return t("site.compare.unchangedNote");
  return t("site.compare.unknownNote");
}

function linkLabel(change: string): string {
  if (change === "added") return t("site.compare.linkAdded");
  if (change === "removed") return t("site.compare.linkRemoved");
  return changeLabel(change);
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
    <div class="sx-grid-hero">
      <section class="sx-hero compare-hero" :aria-label="t('site.compare.results')">
        <div>
          <span class="sx-hero-tag">
            <ShieldCheck class="ic" aria-hidden="true" /> {{ t("site.compare.results") }}
          </span>
          <h3>{{ heroHeading }}</h3>
          <p>{{ heroDescription }}</p>
          <p
            v-if="
              sameCrawlClear &&
              (comparison.limitations.truncatedLinks || comparison.limitations.missingFindings)
            "
          >
            {{ t("site.compare.sameCrawlPartial") }}
          </p>
        </div>
        <div class="sx-hero-chips">
          <span>
            <Check class="ic" aria-hidden="true" />
            {{ t("site.compare.hero.matched", { count: n(comparison.counts.unchangedIssues) }) }}
          </span>
          <span>
            <Link class="ic" aria-hidden="true" />
            {{ t("site.compare.hero.links", { count: n(linkComparable) }) }}
          </span>
          <span>
            <ShieldCheck class="ic" aria-hidden="true" /> {{ t("site.compare.hero.local") }}
          </span>
        </div>
      </section>
      <section class="sx-cover" :aria-label="t('site.compare.coverageHeading')">
        <div class="sx-cover-top">
          <span class="sx-kicker">{{ t("site.compare.coverageHeading") }}</span>
          <span class="sx-kicker-icon"><ChartNoAxesColumn class="ic" aria-hidden="true" /></span>
        </div>
        <div class="sx-cover-number">
          {{ n(comparison.coverage.sharedPages) }}
          <span>{{ t("site.compare.ofPages", { count: n(largerCrawl) }) }}</span>
        </div>
        <p>{{ t("site.compare.sharedText") }}</p>
        <div class="sx-bar-label">
          <span>{{ t("site.compare.overlap") }}</span>
          <strong>{{ t("site.compare.matchedShare", { count: n(sharedShare) }) }}</strong>
        </div>
        <div
          class="sx-bar"
          role="img"
          :aria-label="t('site.compare.matchedShare', { count: n(sharedShare) })"
        >
          <span :style="{ width: `${sharedShare}%` }" />
        </div>
        <div class="sx-mini">
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

    <div class="sx-section-head">
      <div>
        <h3>{{ t("site.compare.movement") }}</h3>
        <p>{{ t("site.compare.movementNote") }}</p>
      </div>
    </div>
    <div class="sx-stats" role="group" :aria-label="summaryLabel">
      <SxStat
        :label="t('site.compare.new')"
        :value="n(comparison.counts.newIssues)"
        :note="t('site.compare.newNote')"
        tone="danger"
        :icon="Plus"
      />
      <SxStat
        :label="t('site.compare.resolved')"
        :value="n(comparison.counts.resolvedIssues)"
        :note="t('site.compare.resolvedNote')"
        tone="success"
        :icon="Check"
      />
      <SxStat
        :label="t('site.compare.unchanged')"
        :value="n(comparison.counts.unchangedIssues)"
        :note="t('site.compare.unchangedNote')"
        tone="neutral"
        :icon="ArrowLeftRight"
      />
      <SxStat
        :label="t('site.compare.notComparable')"
        :value="n(comparison.counts.notComparableIssues)"
        :note="t('site.compare.unknownNote')"
        tone="warning"
        :icon="Info"
      />
    </div>

    <div class="sx-grid-main wide">
      <SxPanel
        :title="t('site.compare.activity')"
        :text="t('site.compare.activityNote')"
        :badge="t('site.compare.findingsCount', { count: n(findingTotal) })"
      >
        <div class="sx-toolbar inset compare-toolbar">
          <label class="sx-search">
            <Search class="ic" aria-hidden="true" />
            <input
              v-model="pageQuery"
              type="search"
              autocomplete="off"
              :placeholder="t('site.compare.pageFilter')"
              :aria-label="t('site.compare.pageFilter')"
            />
          </label>
          <label class="sx-select">
            <span class="sr-only">{{ t("site.severity") }}</span>
            <select v-model="severity">
              <option value="all">{{ t("site.allSeverities") }}</option>
              <option value="error">{{ t("site.severity.error") }}</option>
              <option value="warning">{{ t("site.severity.warning") }}</option>
              <option value="info">{{ t("site.severity.info") }}</option>
            </select>
            <ChevronDown class="ic" aria-hidden="true" />
          </label>
          <label class="sx-select">
            <span class="sr-only">{{ t("site.category") }}</span>
            <select v-model="category">
              <option value="all">{{ t("site.allCategories") }}</option>
              <option v-for="item in categories" :key="item" :value="item">
                {{ t(`site.category.${item}`) }}
              </option>
            </select>
            <ChevronDown class="ic" aria-hidden="true" />
          </label>
          <label class="sx-select">
            <span class="sr-only">{{ t("site.compare.rule") }}</span>
            <select v-model="rule">
              <option value="all">{{ t("site.compare.allRules") }}</option>
              <option v-for="item in rules" :key="item" :value="item">{{ item }}</option>
            </select>
            <ChevronDown class="ic" aria-hidden="true" />
          </label>
        </div>
        <div class="sx-pills status-tabs" role="group" :aria-label="t('site.compare.status')">
          <button
            v-for="item in ['all', 'new', 'resolved', 'unchanged', 'not-comparable'] as const"
            :key="item"
            type="button"
            :class="{ active: status === item }"
            :aria-pressed="status === item"
            @click="
              status = item;
              shownIssues = 8;
            "
          >
            {{ item === "all" ? t("site.compare.allFindings") : changeLabel(item) }}
          </button>
        </div>
        <div v-if="!visibleIssues.length" class="sx-empty small">
          <h3>{{ t("site.compare.noIssues") }}</h3>
        </div>
        <div v-else class="sx-list compare-issue-list">
          <article
            v-for="issue in visibleIssues.slice(0, shownIssues)"
            :key="issue.key"
            class="sx-record compare-issue site-issue"
          >
            <span class="sx-symbol" :class="tone(issue.change)">
              <component :is="categoryIcon(issue.category)" class="ic" aria-hidden="true" />
            </span>
            <div class="sx-record-main">
              <h3>{{ issue.title }}</h3>
              <div class="sx-meta">
                <span class="path" :title="issue.page">{{ path(issue.page) }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ t(`site.category.${issue.category}`) }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ severityLabel(issue.severity) }}</span>
                <template
                  v-if="
                    issue.previousStatus &&
                    issue.currentStatus &&
                    issue.previousStatus !== issue.currentStatus
                  "
                >
                  <span aria-hidden="true">·</span>
                  <span
                    >{{ severityLabel(issue.previousStatus) }} →
                    {{ severityLabel(issue.currentStatus) }}</span
                  >
                </template>
              </div>
              <p v-if="reasonLabel(issue.reason)" class="sx-evidence">
                {{ reasonLabel(issue.reason) }}
              </p>
              <p v-if="issue.evidence" class="sx-evidence">{{ issue.evidence }}</p>
            </div>
            <div class="sx-record-end">
              <span class="sx-chip" :class="tone(issue.change)">{{
                changeLabel(issue.change)
              }}</span>
              <small>{{ changeNote(issue.change) }}</small>
            </div>
          </article>
        </div>
        <template #foot>
          <span>{{
            t("site.showing", {
              shown: n(Math.min(shownIssues, visibleIssues.length)),
              total: n(visibleIssues.length),
            })
          }}</span>
          <button
            type="button"
            class="sx-link"
            :disabled="visibleIssues.length <= shownIssues"
            @click="shownIssues += 12"
          >
            {{
              visibleIssues.length > shownIssues
                ? t("site.compare.moreFindings")
                : t("site.compare.allShown")
            }}
            <ChevronRight v-if="visibleIssues.length > shownIssues" class="ic" aria-hidden="true" />
          </button>
        </template>
      </SxPanel>

      <div class="sx-stack compare-side">
        <SxPanel
          :title="t('site.compare.linkIntegrity')"
          :text="t('site.compare.linkIntegrityNote')"
          :badge="t('site.compare.verifiedScope')"
        >
          <div v-if="linkTotal" class="sx-donut-row">
            <div
              class="sx-donut"
              :style="{ '--donut-a': donutStops.a, '--donut-b': donutStops.b }"
              role="img"
              :aria-label="t('site.compare.linkSummary')"
            >
              <div>
                <strong>{{ n(linkComparable) }}</strong>
                <span>{{ t("site.compare.linkComparable") }}</span>
              </div>
            </div>
            <dl class="sx-donut-legend">
              <div>
                <dt>
                  <i class="sx-swatch unchanged" aria-hidden="true"></i>
                  {{ t("site.compare.linkUnchanged") }}
                </dt>
                <dd>{{ n(comparison.counts.linkPagesUnchanged) }}</dd>
              </div>
              <div>
                <dt>
                  <i class="sx-swatch changed" aria-hidden="true"></i>
                  {{ t("site.compare.linkVerified") }}
                </dt>
                <dd>{{ n(comparison.counts.linkPagesChanged) }}</dd>
              </div>
              <div>
                <dt>
                  <i class="sx-swatch" aria-hidden="true"></i> {{ t("site.compare.linkUnable") }}
                </dt>
                <dd>{{ n(comparison.counts.linkPagesNotComparable) }}</dd>
              </div>
            </dl>
          </div>
          <div class="sx-callout" :class="{ good: !comparison.counts.linkPagesNotComparable }">
            <ShieldCheck class="ic" aria-hidden="true" />
            <div>
              <strong>{{
                comparison.counts.linkPagesNotComparable
                  ? t("site.compare.linkSomeIncomplete", {
                      count: n(comparison.counts.linkPagesNotComparable),
                    })
                  : t("site.compare.linkAllComparable")
              }}</strong>
              <p>{{ t("site.compare.linkScope") }}</p>
              <details v-if="incompleteLinkPages.length" class="sx-details">
                <summary>
                  <ChevronRight class="ic" aria-hidden="true" />
                  {{
                    t("site.compare.linkIncompleteToggle", { count: n(incompleteLinkPages.length) })
                  }}
                </summary>
                <ul class="sx-urls">
                  <li v-for="link in incompleteLinkPages" :key="link.source">
                    {{ path(link.source) }}
                    <small>{{ reasonLabel(link.reason) }}</small>
                  </li>
                </ul>
              </details>
            </div>
          </div>
          <div class="sx-panel-tools">
            <label class="sx-select">
              <span class="sr-only">{{ t("site.compare.linkFilter") }}</span>
              <select
                v-model="linkFilter"
                :aria-label="t('site.compare.linkFilter')"
                @change="shownLinks = 6"
              >
                <option value="changes">{{ t("site.compare.linkVerified") }}</option>
                <option value="added">{{ t("site.compare.linkAdded") }}</option>
                <option value="removed">{{ t("site.compare.linkRemoved") }}</option>
                <option value="changed">{{ t("site.compare.changed") }}</option>
                <option value="not-comparable">{{ t("site.compare.notComparable") }}</option>
              </select>
              <ChevronDown class="ic" aria-hidden="true" />
            </label>
            <span class="sx-count">{{ n(visibleLinks.length) }}</span>
          </div>
          <div v-if="!visibleLinks.length" class="sx-empty small">
            <h3>{{ t("site.compare.noLinks") }}</h3>
          </div>
          <div v-else class="sx-changes">
            <div
              v-for="link in visibleLinks.slice(0, shownLinks)"
              :key="`${link.change}:${link.source}:${link.target}:${link.reason}`"
              class="sx-change"
            >
              <span class="sx-chip" :class="tone(link.change)">{{ linkLabel(link.change) }}</span>
              <div>
                <strong>{{ path(link.source) }}</strong>
                <p v-if="link.target">
                  <ArrowRight class="sx-arrow" aria-hidden="true" style="vertical-align: -3px" />
                  <b>{{ path(link.target) }}</b>
                </p>
                <p v-if="link.change === 'changed'">
                  {{ link.previousState || "—" }}
                  {{ link.previousRedirect ? `→ ${path(link.previousRedirect)}` : "" }}
                  <span class="arrow">/</span>
                  {{ link.currentState || "—" }}
                  {{ link.currentRedirect ? `→ ${path(link.currentRedirect)}` : "" }}
                </p>
                <p v-if="reasonLabel(link.reason)">{{ reasonLabel(link.reason) }}</p>
              </div>
            </div>
          </div>
          <div v-if="visibleLinks.length > shownLinks" class="sx-more">
            <button type="button" class="sx-link" @click="shownLinks += 12">
              {{ t("site.moreLinks") }} <ChevronRight class="ic" aria-hidden="true" />
            </button>
          </div>
        </SxPanel>

        <SxPanel :title="t('site.compare.reliability')" :text="t('site.compare.notAScore')">
          <template #aside>
            <span class="sx-kicker-icon"><ShieldCheck class="ic" aria-hidden="true" /></span>
          </template>
          <ul class="sx-timeline compare-reliability">
            <li v-if="comparison.limitations.partial">
              <i aria-hidden="true"></i>{{ t("site.compare.partial") }}
            </li>
            <li v-if="comparison.limitations.missingFindings">
              <i aria-hidden="true"></i>{{ t("site.compare.missingFindings") }}
            </li>
            <li v-if="comparison.limitations.truncatedLinks">
              <i aria-hidden="true"></i>{{ t("site.compare.truncatedLinks") }}
            </li>
            <li
              :class="{
                ok: !(
                  comparison.counts.notComparableIssues > 0 ||
                  comparison.limitations.missingFindings
                ),
              }"
            >
              <i aria-hidden="true"></i>
              {{
                comparison.counts.notComparableIssues > 0 || comparison.limitations.missingFindings
                  ? t("site.compare.reliabilityPartial", {
                      count: n(comparison.counts.notComparableIssues),
                    })
                  : t("site.compare.reliabilityFull")
              }}
            </li>
            <li class="ok"><i aria-hidden="true"></i>{{ t("site.compare.localOnly") }}</li>
          </ul>
        </SxPanel>
      </div>
    </div>

    <div class="sx-grid-two compare-bottom">
      <SxPanel
        :title="t('site.compare.pages')"
        :text="t('site.compare.pagesNote')"
        :badge="t('site.compare.confirmedCount', { count: n(confirmedPages) })"
      >
        <div class="sx-panel-tools">
          <label class="sx-select">
            <span class="sr-only">{{ t("site.compare.pageScope") }}</span>
            <select
              v-model="pageScope"
              :aria-label="t('site.compare.pageScope')"
              @change="shownPages = 8"
            >
              <option value="changes">{{ t("site.compare.pageChanges") }}</option>
              <option value="all">{{ t("site.compare.allPages") }}</option>
            </select>
            <ChevronDown class="ic" aria-hidden="true" />
          </label>
        </div>
        <div v-if="!visiblePages.length" class="sx-empty small">
          <div class="sx-empty-icon ok"><Check class="ic" aria-hidden="true" /></div>
          <h3>{{ t("site.compare.noPages") }}</h3>
        </div>
        <div v-else class="sx-changes">
          <div v-for="item in visiblePages.slice(0, shownPages)" :key="item.page" class="sx-change">
            <span class="sx-chip" :class="item.coverage === 'both' ? tone(item.status) : 'warn'">
              {{
                item.coverage === "both"
                  ? changeLabel(item.status)
                  : t(`site.compare.coverage.${item.coverage}`)
              }}
            </span>
            <div>
              <strong>{{ path(item.page) }}</strong>
              <p v-if="item.coverage !== 'both'">
                {{
                  t("site.compare.presence", {
                    previous: item.previousState,
                    current: item.currentState,
                  })
                }}
              </p>
              <p v-for="field in item.fields.filter((entry) => entry.changed)" :key="field.field">
                {{ fieldLabel(field.field) }}: {{ field.previous || "—" }}
                <span class="arrow">→</span> <b>{{ field.current || "—" }}</b>
              </p>
            </div>
          </div>
        </div>
        <div v-if="visiblePages.length > shownPages" class="sx-more">
          <button type="button" class="sx-link" @click="shownPages += 12">
            {{ t("site.more") }} <ChevronRight class="ic" aria-hidden="true" />
          </button>
        </div>
      </SxPanel>

      <SxPanel
        :title="t('site.compare.duplicates')"
        :text="t('site.compare.duplicatesNote')"
        :badge="t('site.compare.siteWide')"
      >
        <div v-if="!comparison.duplicates.length" class="sx-empty small">
          <div class="sx-empty-icon ok"><Check class="ic" aria-hidden="true" /></div>
          <h3>{{ t("site.compare.noDuplicates") }}</h3>
        </div>
        <div v-else class="sx-changes">
          <div
            v-for="group in comparison.duplicates"
            :key="`${group.kind}:${group.value}`"
            class="sx-change"
          >
            <span class="sx-chip" :class="tone(group.change)">{{ changeLabel(group.change) }}</span>
            <div>
              <strong>{{ group.value }}</strong>
              <p>
                {{
                  group.kind === "title"
                    ? t("site.compare.field.duplicateTitle")
                    : t("site.compare.field.duplicateDescription")
                }}
                · {{ n(group.previousUrls.length) }} <span class="arrow">→</span>
                <b>{{ n(group.currentUrls.length) }}</b>
                {{ t("site.compare.pagesWord") }}
              </p>
              <p v-if="reasonLabel(group.reason)">{{ reasonLabel(group.reason) }}</p>
            </div>
          </div>
        </div>
      </SxPanel>
    </div>
  </section>
</template>
