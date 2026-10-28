<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from "vue";
import { ListChecks, LoaderCircle, PanelRightOpen, RefreshCw } from "lucide-vue-next";
import { browser } from "wxt/browser";
import BrandMark from "../../src/components/BrandMark.vue";
import { openSidebar, sidebarAvailable } from "../../src/services/sidebar";
import { brandConfig } from "../../src/config/brand.config";
import { useI18n } from "../../src/composables/useI18n";
import { useTheme } from "../../src/composables/useTheme";
import { useAudit } from "../../src/composables/useAudit";
import ScoreBlock from "../../src/components/ScoreBlock.vue";
import CheckTable from "../../src/components/CheckTable.vue";
import SectionTabs from "../../src/components/SectionTabs.vue";
import StatusBadge from "../../src/components/StatusBadge.vue";
import { popupNav } from "../../src/config/navigation.config";
import PopupOverview from "../../src/components/PopupOverview.vue";
import PopupBriefs from "../../src/components/PopupBriefs.vue";
import ShareCards from "../../src/components/ShareCards.vue";
import LoadingStatus from "../../src/components/LoadingStatus.vue";
import EmptyState from "../../src/components/EmptyState.vue";

const HistoryBrief = defineAsyncComponent(() => import("../../src/components/HistoryBrief.vue"));
const { t, n } = useI18n();
useTheme();
const requestedTabId = Number(new URLSearchParams(location.search).get("tabId"));
const { status, error, audit, tab, stale, refresh } = useAudit(
  Number.isInteger(requestedTabId) && requestedTabId > 0 ? requestedTabId : undefined,
);
const canOpenSidebar = sidebarAvailable();

const pane = ref("overview");
const tabs = computed(() =>
  popupNav.map((item) => ({ id: item.id, label: t(item.labelKey as "nav.overview") })),
);

function checksFor(category: string) {
  return (audit.value?.checks ?? []).filter((check) => check.category === category);
}

onMounted(() => {
  void refresh();
});

async function openSidebarView() {
  if (!tab.value?.id) return;
  await openSidebar(tab.value.id);
  window.close();
}

async function openReport() {
  if (!tab.value?.id) return;
  await browser.tabs.create({
    url: browser.runtime.getURL(`/dashboard.html?tabId=${tab.value.id}&section=${pane.value}`),
  });
  window.close();
}

const issueCount = computed(
  () =>
    (audit.value?.checks ?? []).filter(
      (check) => check.status === "ERROR" || check.status === "WARNING",
    ).length,
);
const topFindings = computed(() =>
  (audit.value?.checks ?? [])
    .filter((check) => check.status === "ERROR" || check.status === "WARNING")
    .slice(0, 3),
);
const host = computed(() => {
  const url = audit.value?.page.url;
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
});
</script>

<template>
  <main class="popup-shell bg-background text-foreground">
    <header class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="m-0 flex items-center gap-2 text-[12px] text-muted">
          <BrandMark />
          <span>{{ brandConfig.identity.name }}</span>
          <span v-if="host">· {{ host }}</span>
        </p>
        <h1 class="popup-title" :title="audit?.page.title || undefined">
          {{ audit?.page.title || t("state.empty") }}
        </h1>
      </div>
      <button
        type="button"
        class="popup-icon"
        :disabled="status === 'loading'"
        :aria-busy="status === 'loading'"
        :aria-label="t('action.refresh')"
        @click="refresh"
      >
        <LoaderCircle v-if="status === 'loading'" class="h-4 w-4 animate-spin" aria-hidden="true" />
        <RefreshCw v-else class="h-4 w-4" aria-hidden="true" />
      </button>
    </header>
    <SectionTabs
      :items="tabs"
      :current="pane"
      :label="t('nav.report')"
      panel-id="popup-panel"
      @select="pane = $event"
    />
    <LoadingStatus v-if="status === 'loading'" class="mb-4" :label="t('state.loading')" />
    <p
      v-else-if="status === 'error' || stale"
      role="status"
      aria-live="polite"
      class="mb-4 text-[13px] leading-relaxed"
    >
      <span v-if="status === 'error'" class="text-danger">{{ error }}</span>
      <span v-else>{{ t("state.stale") }}</span>
    </p>
    <div
      v-if="audit"
      id="popup-panel"
      role="tabpanel"
      :aria-labelledby="`tab-${pane}`"
      class="stack"
    >
      <div v-if="pane === 'overview'" class="stack">
        <ScoreBlock :score="audit.score" :disclaimer="false" />
        <section v-if="issueCount" class="inspector-block">
          <div class="card-heading">
            <h2 class="m-0 text-[13px] font-semibold">{{ t("overview.priority") }}</h2>
            <span>{{ n(issueCount) }}</span>
          </div>
          <ul class="m-0 list-none p-0">
            <li v-for="check in topFindings" :key="check.id">
              <button type="button" class="finding-row" @click="pane = 'issues'">
                <StatusBadge :status="check.status" />
                <span>{{ check.title }}</span>
              </button>
            </li>
          </ul>
          <button type="button" class="popup-text" @click="pane = 'issues'">
            {{ t("action.allIssues", { count: issueCount }) }}
          </button>
          <p class="mb-0 mt-3 text-[12px] leading-relaxed text-muted">
            {{ audit.score.disclaimer }}
          </p>
        </section>
        <EmptyState v-else :title="t('empty.issuesTitle')" :description="t('empty.issuesBody')">
          <ListChecks class="h-4 w-4" />
        </EmptyState>
        <PopupOverview :audit="audit" mode="essentials" />
      </div>
      <div v-else-if="pane === 'issues'" class="inspector-block">
        <p class="mb-3 text-[12px] leading-relaxed text-muted">{{ t("issues.note") }}</p>
        <CheckTable :checks="audit.checks" show-category :title="t('nav.issues')" />
      </div>
      <div v-else-if="pane === 'metadata'">
        <PopupOverview :audit="audit" mode="details" />
      </div>
      <div v-else-if="pane === 'content'" class="inspector-block stack">
        <dl class="essentials">
          <div>
            <dt>{{ t("popup.words") }}</dt>
            <dd>
              {{
                audit.metrics.content.wordCount == null
                  ? t("popup.notAvailable")
                  : n(audit.metrics.content.wordCount)
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t("field.readingTime") }}</dt>
            <dd>
              {{
                audit.metrics.content.readingTimeMinutes == null
                  ? t("popup.notAvailable")
                  : n(audit.metrics.content.readingTimeMinutes)
              }}
            </dd>
          </div>
        </dl>
        <CheckTable :checks="checksFor('content')" :title="t('nav.content')" />
      </div>
      <div
        v-else-if="pane === 'headings' || pane === 'links' || pane === 'images'"
        class="inspector-block"
      >
        <PopupBriefs :audit="audit" :kind="pane" />
      </div>
      <div v-else-if="pane === 'schema'" class="inspector-block">
        <PopupBriefs :audit="audit" kind="jsonld" />
      </div>
      <ShareCards v-else-if="pane === 'social'" :audit="audit" />
      <div
        v-else-if="
          pane === 'technical' ||
          pane === 'performance' ||
          pane === 'international' ||
          pane === 'accessibility'
        "
        class="inspector-block"
      >
        <CheckTable
          :checks="checksFor(pane)"
          :title="t(popupNav.find((item) => item.id === pane)?.labelKey as 'nav.overview')"
        />
      </div>
      <p
        v-else-if="pane === 'sitemaps'"
        class="inspector-block m-0 text-[13px] leading-relaxed text-muted"
      >
        {{ t("sitemap.intro") }}
      </p>
      <HistoryBrief v-else-if="pane === 'reports'" :page-url="audit?.page.url ?? ''" />
      <div v-else-if="pane === 'site'" class="inspector-block stack">
        <h2 class="m-0 text-[14px] font-semibold">{{ t("site.title") }}</h2>
        <p class="m-0 text-[13px] leading-relaxed text-muted">{{ t("site.intro") }}</p>
        <p class="m-0 text-[13px]">{{ host }}</p>
        <button type="button" class="inspector-action is-primary" @click="openReport">
          {{ t("site.explore") }}
        </button>
      </div>
      <div class="popup-actions">
        <button type="button" class="popup-primary" @click="openReport">
          {{ t("action.openReport") }}
        </button>
        <div v-if="canOpenSidebar" class="popup-secondary">
          <button type="button" :disabled="!tab?.id" @click="openSidebarView">
            <PanelRightOpen class="h-4 w-4" aria-hidden="true" />
            {{ t("action.openSidebar") }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
