<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  type Component,
} from "vue";
import { browser } from "wxt/browser";
import {
  ArrowUpRight,
  Braces,
  Check,
  Clock,
  Download,
  FileText,
  Gauge,
  Globe,
  Heading,
  Image,
  LayoutGrid,
  Link,
  Moon,
  Network,
  PanelLeft,
  PanelsTopLeft,
  PersonStanding,
  RotateCw,
  Settings,
  Share2,
  SlidersHorizontal,
  Sun,
  TextAlignStart,
  TriangleAlert,
} from "lucide-vue-next";
import { brandConfig } from "../../config/brand.config";
import { flatNav } from "../../config/navigation.config";
import { availableNavigation } from "../../config/features.config";
import { useI18n } from "../../composables/useI18n";
import { useTheme } from "../../composables/useTheme";
import { useAudit } from "../../composables/useAudit";
import { clearHighlights, highlightElements } from "../../services/inspect";
import { openSidebar, sidebarAvailable } from "../../services/sidebar";
import type { MessageKey } from "../../locales/en";
import { hostOf, workbenchKey, type IssueFocus, type Surface } from "./context";
import OverviewView from "./OverviewView.vue";
import IssuesView from "./IssuesView.vue";
import MetadataView from "./MetadataView.vue";
import ContentView from "./ContentView.vue";
import HeadingsView from "./HeadingsView.vue";
import LinksView from "./LinksView.vue";
import ImagesView from "./ImagesView.vue";
import SchemaView from "./SchemaView.vue";
import SocialView from "./SocialView.vue";
import TechnicalView from "./TechnicalView.vue";
import PerformanceView from "./PerformanceView.vue";
import InternationalView from "./InternationalView.vue";
import AccessibilityView from "./AccessibilityView.vue";
import SiteView from "./SiteView.vue";
import SitemapsView from "./SitemapsView.vue";
import HistoryView from "./HistoryView.vue";
import ExportView from "./ExportView.vue";
import SettingsView from "./SettingsView.vue";

const props = withDefaults(
  defineProps<{ surface: Surface; tabId?: number; initialSection?: string }>(),
  { initialSection: "overview" },
);
const { t } = useI18n();
const { preference, resolved, setPreference } = useTheme();
const {
  status,
  error,
  audit,
  tab,
  stale,
  probing,
  probeMessage,
  refresh,
  runSiteProbe,
  checkFreshness,
} = useAudit(props.tabId);

const icons: Record<string, Component> = {
  overview: LayoutGrid,
  issues: TriangleAlert,
  metadata: FileText,
  content: TextAlignStart,
  headings: Heading,
  links: Link,
  images: Image,
  schema: Braces,
  social: Share2,
  technical: SlidersHorizontal,
  performance: Gauge,
  international: Globe,
  accessibility: PersonStanding,
  site: PanelsTopLeft,
  sitemaps: Network,
  reports: Clock,
  export: Download,
  settings: Settings,
};

const views: Record<string, Component> = {
  overview: OverviewView,
  issues: IssuesView,
  metadata: MetadataView,
  content: ContentView,
  headings: HeadingsView,
  links: LinksView,
  images: ImagesView,
  schema: SchemaView,
  social: SocialView,
  technical: TechnicalView,
  performance: PerformanceView,
  international: InternationalView,
  accessibility: AccessibilityView,
  site: SiteView,
  sitemaps: SitemapsView,
  reports: HistoryView,
  export: ExportView,
  settings: SettingsView,
};

const available = availableNavigation();
const destinations = computed(() =>
  flatNav
    .filter((item) => item.id === "settings" || available.has(item.id))
    .map((item) => ({
      id: item.id,
      label: t(item.labelKey as MessageKey),
      short: t((item.shortLabelKey ?? item.labelKey) as MessageKey),
    })),
);
const section = ref(views[props.initialSection] ? props.initialSection : "overview");
const currentLabel = computed(
  () => destinations.value.find((item) => item.id === section.value)?.label ?? "",
);
const issueFocus = ref<IssueFocus | null>(null);
const nav = ref<HTMLElement | null>(null);
const workspace = ref<HTMLElement | null>(null);
const toastText = ref("");
const toastShown = ref(false);
let toastTimer = 0;
const canOpenSidebar = sidebarAvailable();
const tabId = computed(() => tab.value?.id ?? props.tabId);
const ready = computed(() => status.value === "ready");

watch(section, async (value) => {
  workspace.value?.scrollTo({ top: 0 });
  const url = new URL(window.location.href);
  if (url.searchParams.get("section") !== value) {
    url.searchParams.set("section", value);
    window.history.replaceState(window.history.state, "", url);
  }
  await nextTick();
  nav.value?.querySelector(`[data-nav="${value}"]`)?.scrollIntoView({ block: "nearest" });
});

function go(id: string, focus?: IssueFocus) {
  issueFocus.value = focus ?? null;
  if (views[id]) section.value = id;
}

function toast(message: string) {
  toastText.value = message;
  toastShown.value = true;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastShown.value = false), 2400);
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast(t("action.copied"));
  } catch {
    toast(t("wb.copyFailed"));
  }
}

async function highlight(kind: string) {
  if (tabId.value) await highlightElements(tabId.value, kind);
}

async function clearMarks() {
  if (tabId.value) await clearHighlights(tabId.value);
}

async function openReport(target = section.value) {
  if (!tabId.value) return;
  await browser.tabs.create({
    url: browser.runtime.getURL(`/dashboard.html?tabId=${tabId.value}&section=${target}`),
  });
}

async function openSidePanel() {
  if (tabId.value) await openSidebar(tabId.value);
}

function toggleTheme() {
  void setPreference(resolved.value === "dark" ? "light" : "dark");
}

async function onNavKeys(event: KeyboardEvent) {
  const ids = destinations.value.map((item) => item.id);
  const index = Math.max(0, ids.indexOf(section.value));
  let next = index;
  if (event.key === "ArrowDown") next = (index + 1) % ids.length;
  else if (event.key === "ArrowUp") next = (index - 1 + ids.length) % ids.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = ids.length - 1;
  else return;
  event.preventDefault();
  const id = ids[next];
  if (!id) return;
  go(id);
  await nextTick();
  nav.value?.querySelector<HTMLButtonElement>(`[data-nav="${id}"]`)?.focus();
}

const onFocus = () => void checkFreshness();
onMounted(() => {
  void refresh();
  window.addEventListener("focus", onFocus);
});
onUnmounted(() => window.removeEventListener("focus", onFocus));

provide(workbenchKey, {
  surface: props.surface,
  tabId,
  ready,
  probing,
  probeMessage,
  preference,
  issueFocus,
  go,
  toast,
  copy,
  highlight,
  clearMarks,
  refresh,
  runSiteProbe,
  setPreference,
  openReport,
});
</script>

<template>
  <a class="skip-link" href="#workspace">{{ t("nav.skip") }}</a>
  <div class="wb" :class="surface">
    <aside class="nav-pane" :aria-label="t('wb.destinations')">
      <div v-if="surface === 'sidebar'" class="brand-mini">
        <span><img :src="brandConfig.assets.icon" alt="" /></span>
      </div>
      <div v-else class="brand-wide">
        <img :src="brandConfig.assets.icon" alt="" />
        <div>
          <strong>{{ brandConfig.identity.name }}</strong>
          <small>{{ brandConfig.identity.tagline }}</small>
        </div>
      </div>
      <nav ref="nav" class="nav-links" :aria-label="t('wb.tools')" @keydown="onNavKeys">
        <button
          v-for="item in destinations"
          :key="item.id"
          type="button"
          class="nav-button"
          :data-nav="item.id"
          :title="item.label"
          :aria-label="item.label"
          :aria-current="section === item.id ? 'page' : undefined"
          :tabindex="section === item.id ? 0 : -1"
          @click="go(item.id)"
        >
          <component :is="icons[item.id]" class="ic" aria-hidden="true" />
          <span>{{ item.short }}</span>
        </button>
      </nav>
      <div class="nav-bottom">
        <button
          type="button"
          :aria-label="t('wb.preferences')"
          :aria-current="section === 'settings' ? 'page' : undefined"
          @click="go('settings')"
        >
          <Settings class="ic" aria-hidden="true" />
          <span>{{ t("wb.preferences") }}</span>
        </button>
      </div>
    </aside>

    <div class="main-pane">
      <header class="main-topbar">
        <div style="min-width: 0">
          <div class="overline">
            {{ surface === "sidebar" ? t("wb.sidebarEyebrow") : t("wb.reportEyebrow") }} ·
            <span>{{ currentLabel }}</span>
          </div>
          <div class="top-title" :title="audit?.page.title || undefined">
            {{ audit ? audit.page.title || t("metadata.untitled") : t("state.empty") }}
          </div>
          <div class="subtitle">
            <template v-if="audit">
              <span :title="audit.page.url">{{ hostOf(audit.page.url) }}</span>
              &nbsp;·&nbsp; {{ t("wb.localAudit") }}
            </template>
            <template v-else>{{ t("wb.noAudit") }}</template>
          </div>
        </div>
        <div class="top-actions">
          <span class="top-pill" role="status">
            <Check v-if="ready" class="ic" aria-hidden="true" />
            {{
              status === "loading"
                ? t("state.loading")
                : ready
                  ? t("wb.auditAvailable")
                  : t("wb.auditUnavailable")
            }}
          </span>
          <button
            type="button"
            class="icon-button"
            :title="resolved === 'dark' ? t('wb.useLight') : t('wb.useDark')"
            :aria-label="resolved === 'dark' ? t('wb.useLight') : t('wb.useDark')"
            @click="toggleTheme"
          >
            <Sun v-if="resolved === 'dark'" class="ic" aria-hidden="true" />
            <Moon v-else class="ic" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="icon-button"
            :title="t('wb.refresh')"
            :aria-label="t('wb.refresh')"
            :aria-busy="status === 'loading'"
            :disabled="status === 'loading'"
            @click="refresh"
          >
            <RotateCw class="ic" :class="{ spin: status === 'loading' }" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="workspace" ref="workspace" class="main-scroll" tabindex="-1">
        <p v-if="status === 'loading' && !audit" class="callout" role="status">
          {{ t("state.loading") }}
        </p>
        <p v-else-if="status === 'error'" class="callout is-error" role="status">{{ error }}</p>
        <p v-else-if="stale" class="callout" role="status" style="margin: 0 0 18px">
          {{ t("state.stale") }}
        </p>
        <component
          :is="views[section]"
          v-if="audit || section === 'settings'"
          :key="section"
          :audit="audit"
        />
      </main>

      <footer class="footer">
        <template v-if="surface === 'sidebar'">
          <button type="button" class="primary" :disabled="!tabId" @click="openReport()">
            {{ t("action.openReport") }} <ArrowUpRight class="ic" aria-hidden="true" />
          </button>
        </template>
        <template v-else>
          <span class="footer-note">{{ t("wb.footerNote") }}</span>
          <button v-if="canOpenSidebar" type="button" class="secondary" @click="openSidePanel">
            <PanelLeft class="ic" aria-hidden="true" /> {{ t("action.openSidebar") }}
          </button>
          <button
            type="button"
            class="primary"
            :disabled="status === 'loading'"
            :aria-busy="status === 'loading'"
            @click="refresh"
          >
            <RotateCw class="ic" aria-hidden="true" /> {{ t("action.refresh") }}
          </button>
        </template>
      </footer>
    </div>
  </div>
  <div class="toast" :class="{ active: toastShown }" role="status" aria-live="polite">
    {{ toastText }}
  </div>
</template>
