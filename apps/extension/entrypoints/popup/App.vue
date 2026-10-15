<script setup lang="ts">
import { onMounted, ref } from "vue";
import { LoaderCircle, PanelRightOpen, RefreshCw } from "lucide-vue-next";
import { browser } from "wxt/browser";
import BrandMark from "../../src/components/BrandMark.vue";
import { openSidebar, sidebarAvailable } from "../../src/services/sidebar";
import { brandConfig } from "../../src/config/brand.config";
import { useI18n } from "../../src/composables/useI18n";
import { useTheme } from "../../src/composables/useTheme";
import { useAudit } from "../../src/composables/useAudit";
import ScoreBlock from "../../src/components/ScoreBlock.vue";
import StatusBadge from "../../src/components/StatusBadge.vue";
import PopupOverview from "../../src/components/PopupOverview.vue";
import PopupBriefs from "../../src/components/PopupBriefs.vue";
import ShareCards from "../../src/components/ShareCards.vue";
import LoadingStatus from "../../src/components/LoadingStatus.vue";

const { t } = useI18n();
useTheme();
const { status, error, audit, tab, stale, refresh } = useAudit();
const canOpenSidebar = sidebarAvailable();

const panes = [
  ["overview", "nav.overview"],
  ["jsonld", "popup.jsonld"],
  ["headings", "nav.headings"],
  ["links", "nav.links"],
  ["images", "nav.images"],
  ["social", "popup.social"],
] as const;

type PopupPane = (typeof panes)[number][0];
const pane = ref<PopupPane>("overview");

const reportSection: Record<PopupPane, string> = {
  overview: "overview",
  jsonld: "schema",
  headings: "headings",
  links: "links",
  images: "images",
  social: "social",
};

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
    url: browser.runtime.getURL(
      `/dashboard.html?tabId=${tab.value.id}&section=${reportSection[pane.value]}`,
    ),
  });
}

const topFindings = () =>
  (audit.value?.checks ?? [])
    .filter((check) => check.status === "ERROR" || check.status === "WARNING")
    .slice(0, 3);
</script>

<template>
  <main class="bg-background p-4 text-foreground">
    <div class="sticky top-0 z-10 -mx-4 mb-4 bg-background px-4 pb-1">
      <header class="mb-3 flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="m-0 flex items-center gap-2 text-[12px] font-semibold">
            <BrandMark />
            {{ brandConfig.identity.name }}
          </p>
          <h1 class="m-0 truncate text-[15px]">
            {{ audit?.page.title || t("state.empty") }}
          </h1>
        </div>
        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-panel border border-border bg-surface px-2.5 text-[12px] disabled:opacity-60"
          :disabled="status === 'loading'"
          :aria-busy="status === 'loading'"
          @click="refresh"
        >
          <LoaderCircle
            v-if="status === 'loading'"
            class="h-3.5 w-3.5 shrink-0 animate-spin"
            aria-hidden="true"
          />
          <RefreshCw v-else class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {{ t("action.refresh") }}
        </button>
      </header>
      <button
        v-if="canOpenSidebar"
        type="button"
        class="mb-3 flex w-full items-center justify-center gap-2 rounded-panel bg-primary px-3 py-2.5 text-[13px] text-primary-contrast disabled:opacity-60"
        :disabled="!tab?.id"
        @click="openSidebarView"
      >
        <PanelRightOpen class="h-4 w-4 shrink-0" aria-hidden="true" />
        {{ t("action.openSidebar") }}
      </button>
    </div>
    <div class="-mx-4 mb-5 flex gap-5 overflow-x-auto border-b border-border px-4" role="tablist">
      <button
        v-for="item in panes"
        :key="item[0]"
        type="button"
        role="tab"
        class="shrink-0 whitespace-nowrap border-b-2 pb-2 pt-1 text-[13px]"
        :class="
          pane === item[0]
            ? 'border-primary font-medium text-foreground'
            : 'border-transparent text-muted'
        "
        :aria-selected="pane === item[0]"
        @click="pane = item[0]"
      >
        {{ t(item[1]) }}
      </button>
    </div>
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
    <template v-if="audit">
      <template v-if="pane === 'overview'">
        <ScoreBlock :score="audit.score" />
        <div class="mt-4">
          <PopupOverview :audit="audit" />
        </div>
        <ul v-if="topFindings().length" class="mt-4 space-y-3">
          <li
            v-for="check in topFindings()"
            :key="check.id"
            class="rounded-panel border border-border bg-surface p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="m-0 text-[13px] font-medium leading-relaxed">{{ check.title }}</p>
              <StatusBadge :status="check.status" />
            </div>
            <p class="mb-0 mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted">
              {{ check.description }}
            </p>
          </li>
        </ul>
      </template>
      <PopupBriefs
        v-else-if="
          pane === 'jsonld' || pane === 'headings' || pane === 'links' || pane === 'images'
        "
        :audit="audit"
        :kind="pane"
      />
      <ShareCards v-else :audit="audit" />
      <button
        type="button"
        class="mt-4 w-full rounded-panel border border-border bg-surface px-3 py-2.5 text-[13px]"
        @click="openReport"
      >
        {{ t("action.openReport") }}
      </button>
    </template>
  </main>
</template>
