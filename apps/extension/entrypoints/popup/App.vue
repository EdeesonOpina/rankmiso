<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { browser } from "wxt/browser";
import { openSidebar, sidebarAvailable } from "../../src/services/sidebar";
import { clearHighlights, highlightElements } from "../../src/services/inspect";
import { useI18n } from "../../src/composables/useI18n";
import { useTheme } from "../../src/composables/useTheme";
import { useAudit } from "../../src/composables/useAudit";
import { flatNav } from "../../src/config/navigation.config";
import type { ThemePreference } from "../../src/config/theme.config";
import type { MessageKey } from "../../src/locales/en";
import PopupRail from "../../src/components/PopupRail.vue";
import OverviewScreen from "../../src/components/popup/OverviewScreen.vue";
import IssuesScreen from "../../src/components/popup/IssuesScreen.vue";
import MetadataScreen from "../../src/components/popup/MetadataScreen.vue";
import ContentScreen from "../../src/components/popup/ContentScreen.vue";
import HeadingsScreen from "../../src/components/popup/HeadingsScreen.vue";
import LinksScreen from "../../src/components/popup/LinksScreen.vue";
import ImagesScreen from "../../src/components/popup/ImagesScreen.vue";
import SchemaScreen from "../../src/components/popup/SchemaScreen.vue";
import SocialScreen from "../../src/components/popup/SocialScreen.vue";
import TechnicalScreen from "../../src/components/popup/TechnicalScreen.vue";
import PerformanceScreen from "../../src/components/popup/PerformanceScreen.vue";
import InternationalScreen from "../../src/components/popup/InternationalScreen.vue";
import AccessibilityScreen from "../../src/components/popup/AccessibilityScreen.vue";
import SiteScreen from "../../src/components/popup/SiteScreen.vue";
import SitemapsScreen from "../../src/components/popup/SitemapsScreen.vue";
import HistoryScreen from "../../src/components/popup/HistoryScreen.vue";
import ExportScreen from "../../src/components/popup/ExportScreen.vue";
import SettingsScreen from "../../src/components/popup/SettingsScreen.vue";

const { t } = useI18n();
const { preference, setPreference } = useTheme();
const requestedTabId = Number(new URLSearchParams(location.search).get("tabId"));
const {
  status,
  error,
  audit,
  tab,
  stale,
  refresh,
  inspectionMode,
  automaticAccessGranted,
  enableAutomaticChecks,
  setInspectionMode,
  revokeAutomaticAccess,
} = useAudit(Number.isInteger(requestedTabId) && requestedTabId > 0 ? requestedTabId : undefined);
const canOpenSidebar = sidebarAvailable();

const pane = ref("overview");
const focusCheck = ref("");
const menuOpen = ref(false);
const view = ref<HTMLElement | null>(null);
const menuClose = ref<HTMLButtonElement | null>(null);
const toastText = ref("");
const toastShown = ref(false);
let toastTimer = 0;

const screens = {
  overview: OverviewScreen,
  issues: IssuesScreen,
  metadata: MetadataScreen,
  content: ContentScreen,
  headings: HeadingsScreen,
  links: LinksScreen,
  images: ImagesScreen,
  schema: SchemaScreen,
  social: SocialScreen,
  technical: TechnicalScreen,
  performance: PerformanceScreen,
  international: InternationalScreen,
  accessibility: AccessibilityScreen,
  site: SiteScreen,
  sitemaps: SitemapsScreen,
  reports: HistoryScreen,
  export: ExportScreen,
  settings: SettingsScreen,
} as const;

/** The pinned footer action names the report for the current tool. */
const footLabel: Record<keyof typeof screens, MessageKey> = {
  overview: "action.openReport",
  issues: "issues.reviewReport",
  metadata: "pm.foot.metadata",
  content: "pm.foot.content",
  headings: "pm.foot.headings",
  links: "pm.foot.links",
  images: "pm.foot.images",
  schema: "pm.foot.schema",
  social: "pm.foot.social",
  technical: "pm.foot.technical",
  performance: "pm.foot.performance",
  international: "pm.foot.international",
  accessibility: "pm.foot.accessibility",
  site: "pm.foot.site",
  sitemaps: "pm.foot.sitemaps",
  reports: "pm.foot.history",
  export: "pm.foot.export",
  settings: "pm.foot.settings",
};

const destinations = computed(() =>
  flatNav.map((item) => ({
    id: item.id,
    label: t(item.labelKey as MessageKey),
    short: t((item.shortLabelKey ?? item.labelKey) as MessageKey),
  })),
);
const current = computed(
  () => (pane.value in screens ? pane.value : "overview") as keyof typeof screens,
);
const sectionName = computed(
  () => destinations.value.find((item) => item.id === current.value)?.label ?? "",
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
const pageTitle = computed(() => {
  if (!audit.value) return t("state.empty");
  return audit.value.page.title || t("metadata.untitled");
});

onMounted(() => {
  void refresh();
});

watch(status, (value) => {
  if (value !== "ready" || !tab.value?.id) return;
  void browser.runtime
    .sendMessage({ type: "rankmiso:inspection-ready", tabId: tab.value.id })
    .catch(() => undefined);
});

watch(pane, async () => {
  menuOpen.value = false;
  await nextTick();
  view.value?.scrollTo(0, 0);
});

watch(menuOpen, async (open) => {
  if (!open) return;
  await nextTick();
  menuClose.value?.focus();
});

function toast(message: string) {
  toastText.value = message;
  toastShown.value = true;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastShown.value = false;
  }, 2600);
}

async function revokeAccess() {
  const removed = await revokeAutomaticAccess();
  toast(t(removed ? "permission.accessRevoked" : "permission.revokeError"));
}

function go(id: string, check = "") {
  focusCheck.value = check;
  pane.value = id;
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast(t("action.copied"));
  } catch {
    toast(t("pm.copyFailed"));
  }
}

async function highlight(kind: string) {
  if (!tab.value?.id) return;
  try {
    if (kind === "clear") await clearHighlights(tab.value.id);
    else await highlightElements(tab.value.id, kind);
    toast(t(kind === "clear" ? "pm.highlightCleared" : "pm.highlighted"));
  } catch {
    toast(t("pm.highlightFailed"));
  }
}

async function openSidebarView() {
  if (!canOpenSidebar) {
    toast(t("action.sidebarUnavailable"));
    return;
  }
  await openSidebar(tab.value?.id);
  window.close();
}

async function openReport(section = current.value as string) {
  if (!tab.value?.id) return;
  await browser.tabs.create({
    url: browser.runtime.getURL(`/dashboard.html?tabId=${tab.value.id}&section=${section}`),
  });
  window.close();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && menuOpen.value) {
    event.preventDefault();
    menuOpen.value = false;
  }
}

const THEME_ORDER: ThemePreference[] = ["light", "dark", "system"];
const themeKey: Record<ThemePreference, MessageKey> = {
  light: "settings.light",
  dark: "settings.dark",
  system: "settings.system",
};
</script>

<template>
  <div class="app" @keydown="onKeydown">
    <a class="skip-link" href="#main">{{ t("nav.skip") }}</a>
    <PopupRail
      :items="destinations"
      :current="current"
      :label="t('nav.tools')"
      :menu-label="t('nav.allTools')"
      :menu-open="menuOpen"
      @select="go($event)"
      @more="menuOpen = true"
    />
    <div class="work">
      <header class="app-head">
        <div>
          <div class="eyebrow">{{ t("overview.contextNamed", { section: sectionName }) }}</div>
          <h1 class="page-title" :title="audit?.page.title || undefined">{{ pageTitle }}</h1>
          <p v-if="host" class="domain" :title="audit?.page.url">{{ host }}</p>
        </div>
        <button
          type="button"
          class="refresh"
          :class="{ busy: status === 'loading' }"
          :disabled="status === 'loading'"
          :aria-busy="status === 'loading'"
          :aria-label="t('action.refresh')"
          :title="t('action.refresh')"
          @click="refresh()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2 5.5M20 4v7h-7" />
          </svg>
        </button>
      </header>
      <main id="main" ref="view" class="view" tabindex="-1">
        <p v-if="status === 'loading' && !audit" class="note" role="status">
          {{ t("state.loading") }}
        </p>
        <p v-else-if="status === 'error'" class="note status-red" role="status">{{ error }}</p>
        <p v-else-if="stale" class="note" role="status" style="margin-bottom: 14px">
          {{ t("state.stale") }}
        </p>
        <component
          :is="screens[current]"
          v-if="audit"
          :audit="audit"
          :focus-id="focusCheck"
          :preference="preference"
          :inspection-mode="inspectionMode"
          :automatic-access-granted="automaticAccessGranted"
          @go="go"
          @report="openReport"
          @copy="copy"
          @toast="toast"
          @highlight="highlight"
          @theme="setPreference"
          @automatic="enableAutomaticChecks"
          @inspection-mode="setInspectionMode"
          @revoke-access="revokeAccess"
        />
      </main>
      <footer class="foot">
        <button type="button" class="main-btn" :disabled="!tab?.id" @click="openReport()">
          {{ t(footLabel[current]) }} <span aria-hidden="true">↗</span>
        </button>
        <button
          type="button"
          class="sidebar-trigger"
          :title="t('action.openSidebar')"
          @click="openSidebarView"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16M13 9h4M13 13h4" />
          </svg>
          <span>{{ t("action.sidebar") }}</span>
        </button>
      </footer>
    </div>
    <div
      class="tools-menu"
      :class="{ open: menuOpen }"
      role="presentation"
      @click.self="menuOpen = false"
    >
      <div
        v-if="menuOpen"
        class="menu-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="t('pm.allToolsTitle')"
      >
        <div class="pair" style="margin-bottom: 12px">
          <strong style="font-size: 14px">{{ t("pm.allToolsTitle") }}</strong>
          <button
            ref="menuClose"
            type="button"
            class="icon-btn"
            :aria-label="t('pm.closeTools')"
            @click="menuOpen = false"
          >
            ✕
          </button>
        </div>
        <div class="menu-grid">
          <button
            v-for="item in destinations"
            :key="item.id"
            type="button"
            :aria-current="current === item.id ? 'page' : undefined"
            @click="go(item.id)"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="micro" style="margin-top: 12px">{{ t("pm.allToolsNote") }}</p>
        <div class="theme-controls">
          <strong>{{ t("settings.theme") }}</strong>
          <div class="segmented" :aria-label="t('settings.theme')">
            <button
              v-for="option in THEME_ORDER"
              :key="option"
              type="button"
              class="segment"
              :aria-pressed="preference === option"
              @click="setPreference(option as ThemePreference)"
            >
              {{ t(themeKey[option as ThemePreference]) }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div role="status" aria-live="polite" class="toast" :class="{ show: toastShown }">
      {{ toastText }}
    </div>
  </div>
</template>
