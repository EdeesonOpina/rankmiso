<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { browser } from "wxt/browser";
import {
  Braces,
  ExternalLink,
  FileCode2,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  Eraser,
  History,
  Languages,
  Link2,
  ListTree,
  LoaderCircle,
  TextSearch,
  Paintbrush,
  Target,
} from "lucide-vue-next";
import { brandConfig } from "../config/brand.config";
import { themeConfig } from "../config/theme.config";
import { navigationConfig } from "../config/navigation.config";
import { availableNavigation } from "../config/features.config";
import { appConfig } from "../config/app.config";
import { useI18n } from "../composables/useI18n";
import { useTheme } from "../composables/useTheme";
import { useAudit } from "../composables/useAudit";
import { clearStoredSettings, readPageSpeedApiKey, savePageSpeedApiKey } from "../adapters/storage";
import {
  clearSavedReports,
  compareAudits,
  deleteSavedReport,
  MAX_SAVED_REPORTS,
  readSavedReports,
  saveAudit,
  type SavedReport,
} from "../services/saved-reports";
import {
  clearHighlights,
  highlightElements,
  readInpCapture,
  startInpCapture,
  stopInpCapture,
  type InpCaptureSnapshot,
} from "../services/inspect";
import {
  exportAuditJson,
  exportChecksCsv,
  exportHeadingsCsv,
  exportHtmlReport,
  exportImagesCsv,
  exportLinksCsv,
} from "../services/export";
import { resolveShareImage } from "../services/share-preview";
import { requestPageSpeedInsights, type PageSpeedResult } from "../services/pagespeed";
import { openSidebar, sidebarAvailable } from "../services/sidebar";
import type { Category, CheckResult } from "../types/audit";
import BrandMark from "./BrandMark.vue";
import DataTable from "./DataTable.vue";
import EmptyState from "./EmptyState.vue";
import ScoreBlock from "./ScoreBlock.vue";
import CheckTable from "./CheckTable.vue";
import ShareCards from "./ShareCards.vue";
import JsonBlock from "./JsonBlock.vue";
import LoadingStatus from "./LoadingStatus.vue";

const props = withDefaults(
  defineProps<{ layout: "dashboard" | "sidepanel"; tabId?: number; initialSection?: string }>(),
  { initialSection: "overview" },
);
const { t, n } = useI18n();
const { preference, setPreference } = useTheme();
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
const canOpenSidebar = sidebarAvailable();
const section = ref(props.initialSection);
const linkFilter = ref("all");
const probeKind = ref<"site" | "more" | null>(null);

function imageLabel(image: { altPresent: boolean; altValue: string }): string {
  if (!image.altPresent) return t("value.altMissing");
  if (!image.altValue.trim()) return t("value.emptyAlt");
  return image.altValue;
}

function openableHref(value: string | null): string | null {
  if (!audit.value) return null;
  return resolveShareImage(audit.value.page.url, value);
}

function linkFilterLabel(kind: string) {
  if (kind === "internal") return t("links.filter.internal");
  if (kind === "external") return t("links.filter.external");
  if (kind === "nofollow") return t("links.filter.nofollow");
  return t("links.filter.all");
}
const serpMode = ref<"desktop" | "mobile">("desktop");
const previewTitle = ref("");
const previewDescription = ref("");
const copied = ref("");
const settingsNote = ref("");
const savedReports = ref<SavedReport[]>([]);
const selectedReportId = ref("");
const reportMessage = ref("");
const pageSpeedApiKey = ref("");
const pageSpeedResult = ref<PageSpeedResult | null>(null);
const pageSpeedStatus = ref<"idle" | "loading" | "error">("idle");
const pageSpeedMessage = ref("");
const inpCaptureState = ref<InpCaptureSnapshot | null>(null);
const inpCaptureMessage = ref("");
const available = availableNavigation();
const nav = navigationConfig.filter((item) => available.has(item.id));

onMounted(() => {
  void refresh();
  void loadSavedReports();
  void readPageSpeedApiKey()
    .then((key) => (pageSpeedApiKey.value = key))
    .catch(() => undefined);
  window.addEventListener("focus", () => void checkFreshness());
});

watch(
  tab,
  (current) => {
    inpCaptureState.value = null;
    inpCaptureMessage.value = "";
    if (current?.id) {
      void readInpCapture(current.id)
        .then((capture) => (inpCaptureState.value = capture))
        .catch(() => undefined);
    }
  },
  { immediate: true },
);

async function toggleInpCapture() {
  const tabId = tab.value?.id;
  if (!tabId) return;
  try {
    const capture = inpCaptureState.value?.active
      ? await stopInpCapture(tabId)
      : await startInpCapture(tabId);
    inpCaptureState.value = capture;
    if (!capture.supported) {
      inpCaptureMessage.value = t("performance.captureUnsupported");
    } else if (capture.active) {
      inpCaptureMessage.value = t("performance.captureStarted");
    } else {
      inpCaptureMessage.value = t("performance.captureStopped");
      await refresh();
    }
  } catch {
    inpCaptureMessage.value = t("performance.captureFailed");
  }
}

const selectedSavedReport = computed(
  () => savedReports.value.find((report) => report.id === selectedReportId.value) ?? null,
);
const reportDifferences = computed(() =>
  audit.value && selectedSavedReport.value
    ? compareAudits(selectedSavedReport.value.comparison, audit.value)
    : [],
);

async function loadSavedReports() {
  try {
    savedReports.value = await readSavedReports();
  } catch {
    savedReports.value = [];
  }
}

async function saveCurrentReport() {
  if (!audit.value) return;
  try {
    const saved = await saveAudit(audit.value);
    savedReports.value = [saved, ...savedReports.value].slice(0, MAX_SAVED_REPORTS);
    selectedReportId.value = saved.id;
    reportMessage.value = t("reports.saved");
  } catch {
    reportMessage.value = t("reports.saveFailed");
  }
}

async function removeSavedReport(id: string) {
  await deleteSavedReport(id);
  savedReports.value = savedReports.value.filter((report) => report.id !== id);
  if (selectedReportId.value === id) selectedReportId.value = "";
}

async function removeAllSavedReports() {
  await clearSavedReports();
  savedReports.value = [];
  selectedReportId.value = "";
  reportMessage.value = t("reports.cleared");
}

async function savePageSpeedKey() {
  try {
    await savePageSpeedApiKey(pageSpeedApiKey.value);
    pageSpeedMessage.value = t("performance.psiSaved");
  } catch {
    pageSpeedMessage.value = t("performance.psiFailed");
  }
}

async function runPageSpeed() {
  if (!audit.value || pageSpeedStatus.value === "loading") return;
  pageSpeedMessage.value = "";
  pageSpeedResult.value = null;
  if (!pageSpeedApiKey.value.trim()) {
    pageSpeedStatus.value = "error";
    pageSpeedMessage.value = t("performance.psiNeedsKey");
    return;
  }
  try {
    const granted = await browser.permissions.request({
      origins: ["https://www.googleapis.com/*"],
    });
    if (!granted) {
      pageSpeedStatus.value = "error";
      pageSpeedMessage.value = t("performance.psiPermission");
      return;
    }
    pageSpeedStatus.value = "loading";
    pageSpeedResult.value = await requestPageSpeedInsights(
      audit.value.page.url,
      pageSpeedApiKey.value.trim(),
    );
  } catch {
    pageSpeedStatus.value = "error";
    pageSpeedMessage.value = t("performance.psiFailed");
  } finally {
    if (pageSpeedStatus.value === "loading") pageSpeedStatus.value = "idle";
  }
}

const metadata = computed(() => audit.value?.details.metadata);
const siteProbe = computed(() => audit.value?.details.site ?? null);
const technicalScore = computed(
  () => audit.value?.score.categories.find((category) => category.category === "technical") ?? null,
);
watch(
  audit,
  (current) => {
    previewTitle.value = current?.details.metadata.title || "";
    previewDescription.value = current?.details.metadata.description || "";
  },
  { immediate: true },
);
const actionable = computed(() =>
  (audit.value?.checks ?? []).filter(
    (check) => check.status === "ERROR" || check.status === "WARNING",
  ),
);

function checks(category: Category): CheckResult[] {
  return (audit.value?.checks ?? []).filter((check) => check.category === category);
}

const links = computed(() => {
  const rows = audit.value?.details.links ?? [];
  if (linkFilter.value === "all") return rows;
  if (linkFilter.value === "nofollow") return rows.filter((link) => link.nofollow);
  return rows.filter((link) => link.classification === linkFilter.value);
});

async function copy(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  copied.value = label;
}

async function highlight(kind: string) {
  if (!tab.value?.id) return;
  await highlightElements(tab.value.id, kind);
}

async function clearMarks() {
  if (!tab.value?.id) return;
  await clearHighlights(tab.value.id);
}

async function startSiteProbe(more = false) {
  probeKind.value = more ? "more" : "site";
  try {
    await runSiteProbe(more);
  } finally {
    probeKind.value = null;
  }
}

async function openSidePanel() {
  if (!tab.value?.id) return;
  await openSidebar(tab.value.id);
}

const pendingExport = ref<string | null>(null);

const reportActions = [
  ["json", "action.exportJson", FileJson2],
  ["checks", "action.exportChecks", FileSpreadsheet],
  ["links", "action.exportLinks", Link2],
  ["headings", "action.exportHeadings", ListTree],
  ["images", "action.exportImages", FileImage],
  ["html", "action.exportHtml", FileCode2],
] as const;

function confirmExport() {
  if (!audit.value || !pendingExport.value) return;
  const current = audit.value;
  const action = pendingExport.value;
  pendingExport.value = null;
  if (action === "json") exportAuditJson(current);
  else if (action === "checks") exportChecksCsv(current);
  else if (action === "links") exportLinksCsv(current);
  else if (action === "headings") exportHeadingsCsv(current);
  else if (action === "images") exportImagesCsv(current);
  else exportHtmlReport(current);
}

async function resetSettings() {
  await clearStoredSettings();
  await setPreference(themeConfig.defaultPreference);
  settingsNote.value = t("settings.cleared");
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
</script>

<template>
  <div
    class="bg-background text-foreground"
    :class="layout === 'sidepanel' ? 'min-h-full text-[13px]' : 'min-h-screen'"
  >
    <div
      class="grid"
      :class="layout === 'sidepanel' ? 'min-h-full' : 'min-h-screen'"
      :style="
        layout === 'dashboard' ? { gridTemplateColumns: 'var(--sidebar-width) 1fr' } : undefined
      "
    >
      <aside
        class="border-r border-border bg-surface p-3"
        :class="layout === 'sidepanel' ? 'hidden' : ''"
      >
        <p class="m-0 flex items-center gap-2 text-[13px] font-semibold">
          <BrandMark />
          {{ brandConfig.identity.name }}
        </p>
        <p class="mb-3 mt-1 text-[12px] text-muted">{{ brandConfig.identity.tagline }}</p>
        <nav :aria-label="t('nav.report')">
          <button
            v-for="item in nav"
            :key="item.id"
            type="button"
            class="mb-1 block w-full rounded-panel px-3 py-2 text-left text-[13px]"
            :class="
              section === item.id
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted hover:bg-background hover:text-foreground'
            "
            :aria-current="section === item.id ? 'page' : undefined"
            @click="section = item.id"
          >
            {{ t(item.labelKey as "nav.overview") }}
          </button>
        </nav>
      </aside>
      <main class="min-w-0" :class="layout === 'sidepanel' ? 'px-4 pb-6' : 'p-6'">
        <header
          class="flex justify-between gap-3"
          :class="
            layout === 'sidepanel'
              ? 'sticky top-0 z-10 -mx-4 mb-4 items-center border-b border-border bg-background px-4 py-3'
              : 'mb-6 flex-wrap items-start gap-4'
          "
        >
          <div class="min-w-0">
            <p class="m-0 flex items-center gap-2 text-[12px] text-muted">
              <BrandMark />
              {{ brandConfig.identity.name }}
            </p>
            <h1 class="m-0 truncate text-[18px] font-semibold">
              {{ audit?.page.title || t("state.empty") }}
            </h1>
            <p v-if="audit" class="mb-0 mt-1 break-all text-[12px] text-muted">
              {{ audit.page.url }}
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-panel border border-border bg-surface px-3 text-[13px] disabled:opacity-60"
              :disabled="status === 'loading'"
              :aria-busy="status === 'loading'"
              @click="refresh"
            >
              <LoaderCircle
                v-if="status === 'loading'"
                class="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              {{ t("action.refresh") }}
            </button>
            <button
              v-if="canOpenSidebar && layout !== 'sidepanel'"
              type="button"
              class="h-9 shrink-0 whitespace-nowrap rounded-panel border border-border bg-surface px-3 text-[13px]"
              @click="openSidePanel"
            >
              {{ t("action.sidebar") }}
            </button>
          </div>
        </header>
        <div
          v-if="layout === 'sidepanel'"
          class="report-tabs mb-5 flex gap-1.5 overflow-x-auto border-b border-border pb-2"
          role="tablist"
        >
          <button
            v-for="item in nav"
            :key="item.id"
            type="button"
            role="tab"
            class="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] transition-colors"
            :class="
              section === item.id
                ? 'report-tab-active font-semibold'
                : 'border-transparent text-muted hover:bg-surface'
            "
            :aria-selected="section === item.id"
            @click="section = item.id"
          >
            {{ t(item.labelKey as "nav.overview") }}
          </button>
        </div>
        <LoadingStatus v-if="status === 'loading'" class="mb-4" :label="t('state.loading')" />
        <p
          v-else-if="status === 'error' || stale"
          role="status"
          aria-live="polite"
          class="mb-4 text-[13px]"
        >
          <span v-if="status === 'error'" class="text-danger">{{ error }}</span>
          <span v-else class="text-warning">{{ t("state.stale") }}</span>
        </p>

        <template v-if="audit && metadata">
          <section v-show="section === 'overview'" class="report-section">
            <ScoreBlock :score="audit.score" />
            <CheckTable :checks="actionable" :title="t('overview.priority')" />
            <h2 class="text-[15px]">{{ t("limitations.title") }}</h2>
            <ul class="text-[13px] text-muted">
              <li v-for="item in audit.source.limitations" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section v-show="section === 'metadata'" class="report-section">
            <div class="rounded-panel border border-border bg-surface p-4">
              <div class="mb-3 grid gap-3">
                <label class="space-y-1 text-[13px]">
                  <span>{{ t("serp.editTitle") }}</span>
                  <input
                    v-model="previewTitle"
                    class="block w-full rounded-panel border border-border bg-background px-3 py-2"
                  />
                </label>
                <label class="space-y-1 text-[13px]">
                  <span>{{ t("serp.editDescription") }}</span>
                  <textarea
                    v-model="previewDescription"
                    rows="3"
                    class="block w-full rounded-panel border border-border bg-background px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  class="justify-self-start rounded-panel border border-border px-3 py-1.5 text-[12px]"
                  @click="
                    previewTitle = metadata.title || '';
                    previewDescription = metadata.description || '';
                  "
                >
                  {{ t("serp.resetPreview") }}
                </button>
              </div>
              <div class="mb-3 flex gap-2">
                <button
                  type="button"
                  class="rounded-full border px-3 py-1 text-[12px]"
                  :class="serpMode === 'desktop' ? 'bg-primary text-primary-contrast' : ''"
                  @click="serpMode = 'desktop'"
                >
                  {{ t("serp.desktop") }}
                </button>
                <button
                  type="button"
                  class="rounded-full border px-3 py-1 text-[12px]"
                  :class="serpMode === 'mobile' ? 'bg-primary text-primary-contrast' : ''"
                  @click="serpMode = 'mobile'"
                >
                  {{ t("serp.mobile") }}
                </button>
              </div>
              <div
                class="rounded-panel bg-background p-4"
                :class="serpMode === 'mobile' ? 'max-w-[360px]' : ''"
              >
                <p class="m-0 text-[12px] text-success">{{ host(audit.page.url) }}</p>
                <p class="m-0 text-[18px] text-info">
                  {{ previewTitle || t("metadata.untitled") }}
                </p>
                <p class="mb-0 text-[13px] text-muted">
                  {{ previewDescription || t("metadata.noDescription") }}
                </p>
              </div>
              <p class="mb-0 mt-2 text-[12px] text-muted">{{ t("serp.disclaimer") }}</p>
              <button
                v-if="metadata.title"
                type="button"
                class="metadata-copy-button mt-3 w-full"
                @click="copy(metadata.title || '', 'title')"
              >
                {{ copied === "title" ? t("action.copied") : t("action.copyTitle") }}
              </button>
            </div>
            <div class="metadata-details">
              <h2>{{ t("metadata.details") }}</h2>
              <dl class="metadata-grid">
                <div>
                  <dt class="font-medium">{{ t("field.titleLength") }}</dt>
                  <dd>
                    {{
                      t("content.titleLengthDetail", {
                        count: metadata.titleLength,
                        pixels: metadata.titlePixelEstimate,
                      })
                    }}
                  </dd>
                </div>
                <div>
                  <dt class="font-medium">{{ t("field.pixelEstimate") }}</dt>
                  <dd class="text-muted">{{ metadata.titlePixelBasis }}</dd>
                </div>
                <div>
                  <dt class="font-medium">{{ t("field.descriptionLength") }}</dt>
                  <dd>{{ n(metadata.descriptionLength) }} {{ t("content.charactersUnit") }}</dd>
                </div>
                <div class="metadata-detail metadata-detail-wide">
                  <dt class="font-medium">{{ t("field.robots") }}</dt>
                  <dd>{{ metadata.robots.join(", ") || t("metadata.none") }}</dd>
                </div>
                <div class="metadata-detail metadata-detail-wide">
                  <dt class="font-medium">{{ t("field.googlebot") }}</dt>
                  <dd>{{ metadata.googlebot.join(", ") || t("metadata.none") }}</dd>
                </div>
                <div class="metadata-detail metadata-detail-wide">
                  <dt class="font-medium">{{ t("field.canonical") }}</dt>
                  <dd class="break-all">{{ metadata.canonicals.join(" ") || t("value.none") }}</dd>
                </div>
                <div>
                  <dt class="font-medium">{{ t("field.language") }}</dt>
                  <dd>{{ metadata.language || t("international.notDeclared") }}</dd>
                </div>
                <div>
                  <dt class="font-medium">{{ t("field.charset") }}</dt>
                  <dd>{{ metadata.charset || t("value.charsetMissing") }}</dd>
                </div>
                <div class="metadata-detail metadata-detail-wide">
                  <dt class="font-medium">{{ t("field.viewport") }}</dt>
                  <dd>{{ metadata.viewport || t("metadata.missing") }}</dd>
                </div>
              </dl>
            </div>
            <CheckTable :checks="checks('metadata')" />
          </section>

          <section v-show="section === 'content'" class="report-section">
            <p class="text-[13px] text-muted">{{ t("content.note") }}</p>
            <dl class="grid grid-cols-2 gap-3 text-[13px]">
              <div class="rounded-panel border border-border bg-surface p-3">
                <dt class="text-muted">{{ t("field.words") }}</dt>
                <dd class="text-lg font-semibold">
                  {{
                    audit.metrics.content.wordCount == null
                      ? t("value.unavailable")
                      : n(audit.metrics.content.wordCount)
                  }}
                </dd>
              </div>
              <div class="rounded-panel border border-border bg-surface p-3">
                <dt class="text-muted">{{ t("field.characters") }}</dt>
                <dd class="text-lg font-semibold">{{ n(audit.metrics.content.characterCount) }}</dd>
              </div>
              <div class="rounded-panel border border-border bg-surface p-3">
                <dt class="text-muted">{{ t("field.readingTime") }}</dt>
                <dd>
                  {{
                    audit.metrics.content.readingTimeMinutes == null
                      ? t("value.unavailable")
                      : n(audit.metrics.content.readingTimeMinutes)
                  }}
                  {{ t("content.minutes") }}
                </dd>
              </div>
              <div class="rounded-panel border border-border bg-surface p-3">
                <dt class="text-muted">{{ t("field.readability") }}</dt>
                <dd>
                  {{
                    audit.metrics.content.readabilityValue == null
                      ? t("value.notCalculated")
                      : n(audit.metrics.content.readabilityValue)
                  }}
                </dd>
              </div>
            </dl>
            <p class="text-[12px] text-muted">
              {{ audit.metrics.content.wordCountMethod }}.
              {{ audit.metrics.content.readingTimeBasis }}
            </p>
            <p v-if="audit.metrics.content.readabilityMethod" class="text-[12px] text-muted">
              {{ audit.metrics.content.readabilityMethod }}
            </p>
            <h2 class="text-[15px]">{{ t("content.repeatedTerms") }}</h2>
            <EmptyState
              v-if="audit.metrics.content.terms.unigrams.length === 0"
              :title="t('empty.termsTitle')"
              :description="t('empty.termsBody')"
            >
              <TextSearch class="h-4 w-4" />
            </EmptyState>
            <DataTable
              v-else
              :caption="t('content.singleWordTerms')"
              :columns="[
                { label: t('field.term'), width: 46 },
                { label: t('field.count'), width: 16 },
                { label: t('field.share'), width: 18 },
                { label: t('field.inTitle'), width: 20 },
              ]"
            >
              <tr v-for="term in audit.metrics.content.terms.unigrams" :key="term.term">
                <td :title="term.term">{{ term.term }}</td>
                <td>{{ n(term.count) }}</td>
                <td>{{ term.density == null ? "–" : n(term.density) }}</td>
                <td>{{ term.inTitle ? t("value.yes") : t("value.no") }}</td>
              </tr>
            </DataTable>
            <CheckTable :checks="checks('content')" />
          </section>

          <section v-show="section === 'headings'" class="report-section">
            <div class="flex flex-wrap gap-2" role="group" :aria-label="t('action.headingActions')">
              <button
                type="button"
                class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-primary bg-primary px-4 py-2 text-[13px] font-semibold text-primary-contrast shadow-sm transition hover:brightness-95 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                @click="highlight('headings')"
              >
                <Paintbrush :size="15" aria-hidden="true" />
                {{ t("action.highlightHeadings") }}
              </button>
              <button
                type="button"
                class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-primary/40 bg-surface px-4 py-2 text-[13px] font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-primary/5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                @click="highlight('h1')"
              >
                <Target :size="15" aria-hidden="true" />
                {{ t("action.highlightH1") }}
              </button>
              <button
                type="button"
                class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-[13px] font-semibold text-foreground shadow-sm transition hover:border-muted hover:bg-surface active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                @click="clearMarks"
              >
                <Eraser :size="15" aria-hidden="true" />
                {{ t("action.clearHighlights") }}
              </button>
            </div>
            <ol class="space-y-3 text-[13px]">
              <li
                v-for="(heading, index) in audit.details.headings"
                :key="`${heading.location}-${index}`"
                class="flex items-baseline gap-3"
                :style="{ marginLeft: `${(heading.level - 1) * 16}px` }"
              >
                <span class="font-mono text-[11px] text-muted">H{{ heading.level }}</span>
                <span>{{ heading.text || t("value.empty") }}</span>
              </li>
            </ol>
            <CheckTable :checks="checks('headings')" />
          </section>

          <section v-show="section === 'links'" class="report-section">
            <p class="report-summary">
              {{
                t("popup.linkSplit", {
                  internal: audit.metrics.counts.internalLinks,
                  external: audit.metrics.counts.externalLinks,
                })
              }}
            </p>
            <div class="link-controls">
              <div class="link-control-group">
                <span>{{ t("links.filters") }}</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="kind in ['all', 'internal', 'external', 'nofollow']"
                    :key="kind"
                    type="button"
                    class="rounded-full border border-border px-3 py-1 text-[12px] transition-colors"
                    :class="
                      linkFilter === kind
                        ? 'border-primary bg-primary text-primary-contrast'
                        : 'bg-surface text-muted hover:text-foreground'
                    "
                    :aria-pressed="linkFilter === kind"
                    @click="linkFilter = kind"
                  >
                    {{ linkFilterLabel(kind) }}
                  </button>
                </div>
              </div>
              <div class="link-control-group">
                <span>{{ t("links.actions") }}</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-panel border px-3 py-1 text-[12px]"
                    @click="highlight('internal')"
                  >
                    {{ t("action.highlightInternal") }}
                  </button>
                  <button
                    type="button"
                    class="rounded-panel border px-3 py-1 text-[12px]"
                    @click="highlight('external')"
                  >
                    {{ t("action.highlightExternal") }}
                  </button>
                  <button
                    type="button"
                    class="rounded-panel border px-3 py-1 text-[12px]"
                    @click="highlight('nofollow')"
                  >
                    {{ t("action.highlightNofollow") }}
                  </button>
                  <button
                    type="button"
                    class="rounded-panel border px-3 py-1 text-[12px]"
                    @click="clearMarks"
                  >
                    {{ t("action.clearHighlights") }}
                  </button>
                </div>
              </div>
            </div>
            <EmptyState
              v-if="links.length === 0"
              :title="linkFilter === 'all' ? t('empty.linksTitle') : t('empty.linksFilterTitle')"
              :description="
                linkFilter === 'all' ? t('empty.linksBody') : t('empty.linksFilterBody')
              "
            >
              <Link2 class="h-4 w-4" />
            </EmptyState>
            <DataTable
              v-else
              :caption="t('links.caption')"
              :columns="[
                { label: t('field.name'), width: 28 },
                { label: t('field.class'), width: 18 },
                { label: t('field.url'), width: 54 },
              ]"
            >
              <tr v-for="(link, index) in links.slice(0, 200)" :key="`${link.location}-${index}`">
                <td :title="link.accessibleName || t('value.noName')">
                  {{ link.accessibleName || t("value.noName") }}
                </td>
                <td>
                  {{ link.classification
                  }}<span v-if="link.nofollow"> · {{ t("links.nofollow") }}</span>
                </td>
                <td>
                  <a
                    v-if="openableHref(link.resolvedUrl || link.href)"
                    :href="openableHref(link.resolvedUrl || link.href) ?? undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block truncate underline"
                    :title="openableHref(link.resolvedUrl || link.href) ?? undefined"
                  >
                    {{ openableHref(link.resolvedUrl || link.href) }}
                  </a>
                  <p v-else class="m-0 truncate" :title="link.href">{{ link.href }}</p>
                </td>
              </tr>
            </DataTable>
            <CheckTable :checks="checks('links')" />
          </section>

          <section v-show="section === 'images'" class="report-section">
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-panel border px-3 py-2 text-[13px]"
                @click="highlight('missing-alt')"
              >
                {{ t("action.missingAlt") }}
              </button>
              <button
                type="button"
                class="rounded-panel border px-3 py-2 text-[13px]"
                @click="highlight('broken-images')"
              >
                {{ t("action.broken") }}
              </button>
              <button
                type="button"
                class="rounded-panel border px-3 py-2 text-[13px]"
                @click="clearMarks"
              >
                {{ t("action.clearHighlights") }}
              </button>
            </div>
            <ul class="space-y-3">
              <li
                v-for="(image, index) in audit.details.images.slice(0, 100)"
                :key="`${image.location}-${index}`"
                class="flex items-start gap-3 rounded-panel border border-border bg-surface p-3"
              >
                <img
                  v-if="image.src"
                  :src="image.src"
                  alt=""
                  class="h-12 w-12 shrink-0 rounded object-cover"
                />
                <div class="min-w-0 flex-1">
                  <p class="m-0 truncate text-[13px] font-semibold" :title="imageLabel(image)">
                    {{ imageLabel(image) }}
                  </p>
                  <a
                    v-if="openableHref(image.src)"
                    :href="openableHref(image.src) ?? undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mb-0 mt-2 block truncate text-[12px] underline"
                    :title="openableHref(image.src) ?? undefined"
                  >
                    {{ openableHref(image.src) }}
                  </a>
                  <p
                    v-else
                    class="mb-0 mt-2 truncate text-[12px] text-muted"
                    :title="image.src || undefined"
                  >
                    {{ image.src || t("value.noSource") }}
                  </p>
                </div>
              </li>
            </ul>
            <CheckTable :checks="checks('images')" />
          </section>

          <section v-show="section === 'technical'" class="report-section">
            <div v-if="technicalScore" class="report-panel technical-score-card">
              <div class="technical-score-heading">
                <div>
                  <h2>{{ t("technical.scoreTitle") }}</h2>
                  <p>{{ t("technical.scoreNote") }}</p>
                </div>
                <p class="technical-score-value">
                  {{
                    technicalScore.available && technicalScore.value != null
                      ? n(technicalScore.value)
                      : "–"
                  }}
                  <span>/100</span>
                </p>
              </div>
              <div class="technical-score-counts">
                <span>{{ t("score.errors", { count: technicalScore.errors }) }}</span>
                <span>{{ t("score.warnings", { count: technicalScore.warnings }) }}</span>
                <span>{{ t("score.passed", { count: technicalScore.passed }) }}</span>
              </div>
              <div class="technical-score-actions">
                <button
                  type="button"
                  class="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-panel bg-primary px-3 text-[13px] text-primary-contrast disabled:opacity-60"
                  :disabled="probing"
                  :aria-busy="probing && probeKind === 'site'"
                  @click="startSiteProbe()"
                >
                  <LoaderCircle
                    v-if="probing && probeKind === 'site'"
                    class="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  {{ t("technical.siteCheck") }}
                </button>
                <button
                  v-if="
                    (audit.details.site?.linksTotal ?? 0) > (audit.details.site?.linksChecked ?? 0)
                  "
                  type="button"
                  class="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-panel border border-border bg-surface px-3 text-[13px] disabled:opacity-60"
                  :disabled="probing"
                  :aria-busy="probing && probeKind === 'more'"
                  @click="startSiteProbe(true)"
                >
                  <LoaderCircle
                    v-if="probing && probeKind === 'more'"
                    class="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  {{ t("technical.siteMore") }}
                </button>
              </div>
              <LoadingStatus
                v-if="probing"
                :label="
                  probeMessage ||
                  (probeKind === 'more'
                    ? t('technical.siteCheckingMore')
                    : t('technical.siteChecking'))
                "
              />
              <p
                v-else-if="probeMessage"
                role="status"
                class="m-0 text-[12px] leading-relaxed text-muted"
              >
                {{ probeMessage }}
              </p>
            </div>
            <div class="report-section-block">
              <div class="technical-section-heading">
                <h2>{{ t("technical.navigationTitle") }}</h2>
                <p>{{ t("technical.navigationNote") }}</p>
              </div>
              <dl class="technical-stats">
                <div class="report-panel technical-stat">
                  <dt>{{ t("field.status") }}</dt>
                  <dd>{{ audit.details.response.status ?? t("value.notExposed") }}</dd>
                </div>
                <div class="report-panel technical-stat">
                  <dt>{{ t("field.redirects") }}</dt>
                  <dd>
                    {{
                      audit.details.response.redirectCount == null
                        ? t("value.notExposed")
                        : n(audit.details.response.redirectCount)
                    }}
                  </dd>
                </div>
                <div class="report-panel technical-stat">
                  <dt>{{ t("field.contentType") }}</dt>
                  <dd>{{ audit.details.response.contentType || t("value.unknown") }}</dd>
                </div>
              </dl>
            </div>
            <section v-if="siteProbe?.requested" class="technical-results">
              <div class="technical-section-heading">
                <h2>{{ t("technical.resultsTitle") }}</h2>
                <p>{{ t("technical.resultsNote") }}</p>
              </div>
              <div class="technical-result-grid">
                <article class="report-panel technical-result">
                  <h3>{{ t("technical.robots") }}</h3>
                  <p class="technical-result-value">
                    {{
                      siteProbe.robotsStatus === 404
                        ? t("technical.notFound")
                        : siteProbe.robotsStatus == null
                          ? t("technical.notAvailable")
                          : t("technical.httpStatus", { status: siteProbe.robotsStatus })
                    }}
                  </p>
                  <details v-if="siteProbe.robotsBody" class="technical-raw-details">
                    <summary>{{ t("technical.viewRobots") }}</summary>
                    <pre>{{ siteProbe.robotsBody.slice(0, 6000) }}</pre>
                    <p v-if="siteProbe.robotsBody.length > 6000">
                      {{ t("technical.robotsTruncated") }}
                    </p>
                  </details>
                </article>
                <article class="report-panel technical-result">
                  <h3>{{ t("technical.sitemap") }}</h3>
                  <p class="technical-result-value">
                    {{
                      siteProbe.sitemapUrls.length
                        ? t("technical.sitemapUrl", { url: siteProbe.sitemapUrls[0] ?? "" })
                        : siteProbe.robotsStatus === 404
                          ? t("technical.robotsMissingForSitemap")
                          : siteProbe.robotsStatus == null
                            ? t("technical.notDetermined")
                            : t("technical.sitemapNone")
                    }}
                  </p>
                  <p v-if="siteProbe.sitemapStatus != null" class="technical-result-detail">
                    {{ t("technical.httpStatus", { status: siteProbe.sitemapStatus }) }}
                    <span v-if="siteProbe.sitemapUrlCount != null">
                      · {{ t("technical.sitemapEntries", { count: n(siteProbe.sitemapUrlCount) }) }}
                    </span>
                  </p>
                  <p v-if="siteProbe.sitemapContainsPage != null" class="technical-result-detail">
                    {{
                      siteProbe.sitemapContainsPage
                        ? t("technical.sitemapContains")
                        : t("technical.sitemapNotContains")
                    }}
                  </p>
                </article>
                <article class="report-panel technical-result">
                  <h3>{{ t("technical.linkResults") }}</h3>
                  <p class="technical-result-value">
                    {{
                      siteProbe.linksTotal === 0
                        ? t("technical.noPublicLinks")
                        : t("technical.linkCounts", {
                            checked: n(siteProbe.linksChecked),
                            total: n(siteProbe.linksTotal),
                          })
                    }}
                  </p>
                  <p v-if="siteProbe.linksChecked" class="technical-result-detail">
                    {{
                      t("technical.linkOutcomes", {
                        broken: n(siteProbe.linksBroken),
                        unreachable: n(siteProbe.linksUnreachable),
                        blocked: n(siteProbe.linksBlocked),
                      })
                    }}
                  </p>
                </article>
                <article class="report-panel technical-result">
                  <h3>{{ t("technical.hreflang") }}</h3>
                  <p class="technical-result-value">
                    {{
                      siteProbe.hreflangChecked
                        ? t("technical.hreflangCounts", {
                            checked: n(siteProbe.hreflangChecked),
                            missing: n(siteProbe.hreflangMissing),
                          })
                        : t("technical.noAlternates")
                    }}
                  </p>
                </article>
              </div>
              <div class="report-section-block">
                <h2>{{ t("technical.headers") }}</h2>
                <ul v-if="audit.details.response.headersAvailable" class="space-y-3">
                  <li
                    v-for="header in audit.details.response.headers"
                    :key="header.name"
                    class="report-panel p-4"
                  >
                    <p class="m-0 text-[12px] font-semibold">{{ header.name }}</p>
                    <p class="mb-0 mt-2 break-all text-[12px] leading-relaxed text-muted">
                      {{ header.value }}
                    </p>
                  </li>
                </ul>
                <p v-else class="technical-result-detail">{{ t("technical.noHeaders") }}</p>
              </div>
              <div class="report-section-block">
                <h2>{{ t("technical.hops") }}</h2>
                <ul v-if="siteProbe.redirectHops.length" class="space-y-2 text-[13px] text-muted">
                  <li
                    v-for="hop in siteProbe.redirectHops"
                    :key="hop"
                    class="report-panel break-all p-3"
                  >
                    {{ hop }}
                  </li>
                </ul>
                <p v-else class="technical-result-detail">{{ t("technical.noHops") }}</p>
              </div>
              <ul v-if="siteProbe.notes.length" class="report-panel technical-probe-notes">
                <li v-for="note in siteProbe.notes" :key="note">{{ note }}</li>
              </ul>
            </section>
            <CheckTable :checks="checks('technical')" />
          </section>

          <section v-show="section === 'schema'" class="report-section max-w-3xl">
            <p class="m-0 text-[13px] leading-relaxed text-muted">{{ t("schema.note") }}</p>
            <EmptyState
              v-if="audit.details.structuredData.length === 0"
              :title="t('empty.schemaTitle')"
              :description="t('empty.schemaBody')"
            >
              <Braces class="h-4 w-4" />
            </EmptyState>
            <JsonBlock
              v-for="(block, index) in audit.details.structuredData"
              :key="index"
              :raw="block.raw"
              :valid="block.validJson"
              :error="block.error"
            />
            <aside class="space-y-3 rounded-panel border border-border bg-surface p-4 shadow-sm">
              <div class="flex items-start gap-3">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  aria-hidden="true"
                >
                  <Braces :size="19" :stroke-width="1.8" />
                </span>
                <div class="min-w-0">
                  <h2 class="m-0 text-[14px] font-semibold">
                    {{ t("schema.validatorTitle") }}
                  </h2>
                  <p class="mb-0 mt-1 text-[12px] leading-relaxed text-muted">
                    {{ t("schema.validatorDescription") }}
                  </p>
                </div>
              </div>
              <a
                href="https://search.google.com/test/rich-results"
                target="_blank"
                rel="noreferrer"
                class="schema-validator-link inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-contrast transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {{ t("schema.validator") }}
                <ExternalLink :size="15" aria-hidden="true" />
              </a>
            </aside>
            <CheckTable :checks="checks('structuredData')" />
          </section>

          <section v-show="section === 'social'" class="report-section max-w-xl">
            <ShareCards :audit="audit" />
            <CheckTable :checks="checks('social')" />
          </section>

          <section v-show="section === 'performance'" class="report-section">
            <p class="report-note">{{ t("performance.note") }}</p>
            <div class="space-y-2 rounded-panel border border-border bg-surface p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <h2 class="m-0 text-[14px] font-semibold">
                    {{ t("performance.captureTitle") }}
                  </h2>
                  <p class="mb-0 mt-1 text-[12px] text-muted">
                    {{ t("performance.captureHelp") }}
                  </p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-full border border-border bg-background px-3 py-2 text-[12px] font-medium hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="inpCaptureState?.supported === false"
                  @click="toggleInpCapture"
                >
                  {{
                    inpCaptureState?.active
                      ? t("performance.captureStop")
                      : t("performance.captureStart")
                  }}
                </button>
              </div>
              <p v-if="inpCaptureMessage" class="m-0 text-[12px] text-muted" role="status">
                {{ inpCaptureMessage }}
              </p>
              <p
                v-else-if="inpCaptureState?.active"
                class="m-0 text-[12px] text-muted"
                role="status"
              >
                {{ t("performance.captureRunning") }}
              </p>
            </div>
            <dl class="grid grid-cols-2 gap-3 text-[13px]">
              <div class="rounded-panel border bg-surface p-3">
                <dt>{{ t("field.lcp") }}</dt>
                <dd>
                  {{
                    audit.details.performance.lcpMs == null
                      ? t("value.unavailable")
                      : n(audit.details.performance.lcpMs)
                  }}
                </dd>
              </div>
              <div class="rounded-panel border bg-surface p-3">
                <dt>{{ t("field.cls") }}</dt>
                <dd>
                  {{
                    audit.details.performance.cls == null
                      ? t("value.unavailable")
                      : n(audit.details.performance.cls)
                  }}
                </dd>
              </div>
              <div class="rounded-panel border bg-surface p-3">
                <dt>{{ t("field.inp") }}</dt>
                <dd>
                  {{
                    audit.details.performance.inpMs == null
                      ? t("value.unavailable")
                      : n(audit.details.performance.inpMs)
                  }}
                </dd>
              </div>
              <div class="rounded-panel border bg-surface p-3">
                <dt>{{ t("field.resources") }}</dt>
                <dd>
                  {{
                    audit.details.performance.resourceCount == null
                      ? t("value.unavailable")
                      : n(audit.details.performance.resourceCount)
                  }}
                </dd>
              </div>
            </dl>
            <ul class="text-[12px] text-muted">
              <li v-for="note in audit.details.performance.notes" :key="note">{{ note }}</li>
            </ul>
            <CheckTable :checks="checks('performance')" />
            <div class="space-y-3 rounded-panel border border-border bg-surface p-4">
              <h2 class="m-0 text-[15px] font-semibold">{{ t("performance.psiTitle") }}</h2>
              <p class="m-0 text-[13px] text-muted">{{ t("performance.psiPrivacy") }}</p>
              <label class="block space-y-1 text-[13px]">
                <span>{{ t("performance.psiKey") }}</span>
                <input
                  v-model="pageSpeedApiKey"
                  type="password"
                  autocomplete="off"
                  class="block w-full rounded-panel border border-border bg-background px-3 py-2"
                />
                <a
                  href="https://developers.google.com/speed/docs/insights/v5/get-started"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-block underline"
                >
                  {{ t("performance.psiKeyHelp") }}
                </a>
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-panel border border-border px-3 py-2 text-[13px]"
                  @click="savePageSpeedKey"
                >
                  {{ t("performance.psiSaveKey") }}
                </button>
                <button
                  type="button"
                  class="rounded-panel bg-primary px-3 py-2 text-[13px] text-primary-contrast disabled:opacity-60"
                  :disabled="pageSpeedStatus === 'loading'"
                  @click="runPageSpeed"
                >
                  {{
                    t(
                      pageSpeedStatus === "loading"
                        ? "performance.psiRunning"
                        : "performance.psiRun",
                    )
                  }}
                </button>
              </div>
              <p v-if="pageSpeedMessage" role="status" class="m-0 text-[13px]">
                {{ pageSpeedMessage }}
              </p>
              <div v-if="pageSpeedResult" class="space-y-2 text-[13px]">
                <h3 class="m-0 font-semibold">{{ t("performance.psiMetrics") }}</h3>
                <p class="m-0">
                  {{ t("performance.psiScore") }}:
                  {{ pageSpeedResult.performanceScore ?? t("value.unavailable") }}
                </p>
                <p class="m-0">
                  {{ t("performance.psiLcp") }}:
                  {{
                    pageSpeedResult.lcpMs == null
                      ? t("value.unavailable")
                      : `${n(pageSpeedResult.lcpMs)} ${t("performance.milliseconds")}`
                  }}
                </p>
                <p class="m-0">
                  {{ t("performance.psiCls") }}: {{ pageSpeedResult.cls ?? t("value.unavailable") }}
                </p>
                <p class="m-0 text-[12px] text-muted">{{ t("performance.psiAttribution") }}</p>
              </div>
            </div>
          </section>

          <section v-show="section === 'international'" class="report-section">
            <p class="text-[13px]">
              {{ t("international.documentLanguage") }}:
              {{ metadata.language || t("international.notDeclared") }}
            </p>
            <EmptyState
              v-if="audit.details.hreflang.length === 0"
              :title="t('empty.hreflangTitle')"
              :description="t('empty.hreflangBody')"
            >
              <Languages class="h-4 w-4" />
            </EmptyState>
            <DataTable
              v-else
              :caption="t('international.caption')"
              :columns="[
                { label: t('field.language'), width: 22 },
                { label: t('field.url'), width: 58 },
                { label: t('field.syntax'), width: 20 },
              ]"
            >
              <tr v-for="link in audit.details.hreflang" :key="`${link.lang}-${link.href}`">
                <td>{{ link.lang }}</td>
                <td>
                  <a
                    v-if="openableHref(link.href)"
                    :href="openableHref(link.href) ?? undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block truncate underline"
                    :title="openableHref(link.href) ?? undefined"
                  >
                    {{ openableHref(link.href) }}
                  </a>
                  <span v-else class="block truncate" :title="link.href">{{ link.href }}</span>
                </td>
                <td>{{ link.validSyntax ? t("value.recognized") : t("value.invalid") }}</td>
              </tr>
            </DataTable>
            <CheckTable :checks="checks('international')" />
          </section>

          <section v-show="section === 'accessibility'" class="report-section">
            <p class="text-[13px] text-muted">{{ t("a11y.note") }}</p>
            <CheckTable :checks="checks('accessibility')" />
          </section>

          <section v-show="section === 'reports'" class="report-section max-w-xl">
            <div class="report-feature">
              <div class="report-feature-heading">
                <div class="report-feature-icon">
                  <History class="h-5 w-5" aria-hidden="true" />
                </div>
                <div class="min-w-0">
                  <p class="report-feature-kicker">{{ t("reports.localLabel") }}</p>
                  <h2>{{ t("reports.compareTitle") }}</h2>
                  <p class="report-feature-copy">{{ t("reports.privacy") }}</p>
                </div>
              </div>
              <div class="report-feature-footer">
                <p role="status" class="report-feature-status">
                  {{
                    reportMessage ||
                    (savedReports.length === 0
                      ? t("reports.empty")
                      : t("reports.savedCount", { count: savedReports.length }))
                  }}
                </p>
                <button
                  type="button"
                  class="report-feature-save"
                  :disabled="!audit || status !== 'ready'"
                  @click="saveCurrentReport"
                >
                  {{ t("reports.saveCurrent") }}
                </button>
              </div>
            </div>
            <div v-if="savedReports.length" class="report-panel report-saved-panel">
              <div class="report-subheading">
                <h2>{{ t("reports.savedReports") }}</h2>
                <button type="button" class="report-text-action" @click="removeAllSavedReports">
                  {{ t("reports.deleteAll") }}
                </button>
              </div>
              <label class="report-select-label">
                <span>{{ t("reports.choose") }}</span>
                <select v-model="selectedReportId">
                  <option value="">{{ t("reports.selectPlaceholder") }}</option>
                  <option v-for="report in savedReports" :key="report.id" :value="report.id">
                    {{ report.comparison.title || t("metadata.untitled") }} ·
                    {{ report.comparison.url }} · {{ new Date(report.savedAt).toLocaleString() }}
                  </option>
                </select>
              </label>
              <template v-if="selectedSavedReport && audit">
                <p class="report-compare-caption">
                  {{ t("reports.comparing", { url: selectedSavedReport.comparison.url }) }}
                </p>
                <p v-if="reportDifferences.length === 0" class="report-no-differences">
                  {{ t("reports.noChanges") }}
                </p>
                <div v-else class="overflow-x-auto">
                  <table class="report-differences">
                    <thead>
                      <tr>
                        <th>{{ t("reports.field") }}</th>
                        <th>{{ t("reports.savedValue") }}</th>
                        <th>{{ t("reports.current") }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="difference in reportDifferences" :key="difference.label">
                        <th>{{ t(difference.label) }}</th>
                        <td>{{ difference.previous }}</td>
                        <td>{{ difference.current }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  class="report-text-action mt-3"
                  @click="removeSavedReport(selectedSavedReport.id)"
                >
                  {{ t("reports.deleteSelected") }}
                </button>
              </template>
            </div>
            <section class="report-exports" aria-labelledby="report-exports-heading">
              <div class="report-exports-heading">
                <div>
                  <h2 id="report-exports-heading">{{ t("reports.exports") }}</h2>
                  <p>{{ t("reports.exportNote") }}</p>
                </div>
              </div>
              <div class="report-export-grid">
                <div v-for="item in reportActions" :key="item[0]" class="report-export-item">
                  <button
                    type="button"
                    class="report-export-button"
                    :aria-expanded="pendingExport === item[0]"
                    @click="pendingExport = pendingExport === item[0] ? null : item[0]"
                  >
                    <span class="report-export-icon">
                      <component :is="item[2]" class="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span class="min-w-0">{{ t(item[1]) }}</span>
                  </button>
                  <div v-if="pendingExport === item[0]" class="report-export-confirm">
                    <p>{{ t("export.confirm") }}</p>
                    <div class="flex gap-2">
                      <button type="button" class="report-confirm-button" @click="confirmExport">
                        {{ t("export.confirmAction") }}
                      </button>
                      <button
                        type="button"
                        class="report-cancel-button"
                        @click="pendingExport = null"
                      >
                        {{ t("export.cancel") }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </section>

          <section v-show="section === 'settings'" class="report-section">
            <fieldset class="space-y-2">
              <legend class="text-[14px] font-medium">{{ t("settings.theme") }}</legend>
              <label
                v-for="option in ['system', 'light', 'dark']"
                :key="option"
                class="flex items-center gap-2 text-[13px]"
              >
                <input
                  type="radio"
                  name="theme"
                  :value="option"
                  :checked="preference === option"
                  @change="setPreference(option as 'system' | 'light' | 'dark')"
                />
                {{
                  t(
                    option === "system"
                      ? "settings.system"
                      : option === "light"
                        ? "settings.light"
                        : "settings.dark",
                  )
                }}
              </label>
            </fieldset>
            <button
              type="button"
              class="rounded-panel border px-3 py-2 text-[13px]"
              @click="resetSettings"
            >
              {{ t("settings.clear") }}
            </button>
            <p role="status" class="text-[13px]">{{ settingsNote }}</p>
            <p class="text-[13px] text-muted">{{ t("settings.privacy") }}</p>
            <div class="space-y-2">
              <p class="m-0 text-[16px] font-semibold">{{ brandConfig.identity.name }}</p>
              <p class="m-0 text-[13px] leading-relaxed text-muted">
                {{ t("settings.ecosystem", { ecosystem: brandConfig.identity.ecosystem }) }}
              </p>
              <p class="m-0 text-[12px] text-muted">
                {{
                  t("settings.version", {
                    version: appConfig.version,
                    rules: audit.rulesetVersion,
                  })
                }}
              </p>
            </div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>
