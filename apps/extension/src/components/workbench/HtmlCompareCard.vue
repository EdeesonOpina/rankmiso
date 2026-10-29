<script setup lang="ts">
import { computed, ref } from "vue";
import { browser } from "wxt/browser";
import { compareHtml, signalsFromAudit, type CompareRow } from "../../services/html-signals";
import type { MessageKey } from "../../locales/en";
import { useI18n } from "../../composables/useI18n";
import type { AuditResult } from "../../types/audit";
import WbCard from "./WbCard.vue";
import { useWorkbench } from "./context";

const props = defineProps<{ audit: AuditResult; network: boolean }>();
const { t } = useI18n();
const { copy } = useWorkbench();
const rows = ref<CompareRow[] | null>(null);
const source = ref<"fetch" | "file" | null>(null);
const status = ref("");
const busy = ref(false);
const hops = ref<string[]>([]);
let controller: AbortController | null = null;

const rendered = computed(() => signalsFromAudit(props.audit));

const labels: Record<CompareRow["id"], string> = {
  title: "Title",
  description: "Description",
  canonical: "Canonical",
  robots: "Meta robots",
  googlebot: "Googlebot",
  bingbot: "Bingbot",
  language: "Language",
  hreflang: "Hreflang",
  h1Count: "H1 count",
  h1: "H1",
  jsonLd: "JSON-LD",
  microdata: "Microdata",
  rdfa: "RDFa",
  internalLinks: "Internal links",
  externalLinks: "External links",
};

function reasonKey(reason: string): MessageKey {
  if (reason === "redirect") return "compare.redirect";
  if (reason === "type") return "compare.type";
  if (reason === "size") return "compare.size";
  if (reason === "timeout") return "compare.timeout";
  if (reason === "status") return "compare.status";
  if (reason === "aborted") return "compare.aborted";
  if (reason === "network") return "compare.network";
  return "compare.blocked";
}

function show(value: string, numeric: boolean): string {
  if (numeric) return value || "0";
  return value || t("compare.missing");
}

function stateLabel(state: CompareRow["state"]): string {
  if (state === "added") return t("compare.added");
  if (state === "removed") return t("compare.removed");
  if (state === "changed") return t("compare.changed");
  return t("compare.same");
}

async function compareFetched() {
  if (!props.network || busy.value) return;
  status.value = "";
  rows.value = null;
  hops.value = [];
  let origin: string;
  try {
    const url = new URL(props.audit.page.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      status.value = t("compare.blocked");
      return;
    }
    origin = url.origin;
  } catch {
    status.value = t("compare.blocked");
    return;
  }
  const originPattern = `${origin}/*`;
  const already = await browser.permissions.contains({ origins: [originPattern] });
  if (!already) {
    const granted = await browser.permissions.request({ origins: [originPattern] });
    if (!granted) {
      status.value = t("compare.denied");
      return;
    }
  }
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  try {
    const network = import.meta.env.FIREFOX ? null : await import("../../services/html-fetch");
    if (!network) return;
    const result = await network.fetchComparisonHtml(props.audit.page.url, controller.signal);
    if (!result.ok) {
      status.value = t(reasonKey(result.reason));
      return;
    }
    rows.value = compareHtml(result.html, props.audit.page.url, rendered.value);
    hops.value = result.hops;
    source.value = "fetch";
    status.value = t("compare.ready");
  } finally {
    busy.value = false;
  }
}

function cancel() {
  controller?.abort();
}

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 512_000) {
    status.value = t("compare.size");
    rows.value = null;
    return;
  }
  const html = await file.text();
  rows.value = compareHtml(html, props.audit.page.url, rendered.value);
  hops.value = [];
  source.value = "file";
  status.value = t("compare.fileReady");
}
</script>

<template>
  <WbCard :title="t('compare.title')" class="compare-card" flat>
    <template #action>
      <button
        v-if="network"
        type="button"
        class="quiet"
        :disabled="busy"
        :aria-busy="busy"
        @click="compareFetched"
      >
        {{ t("compare.action") }}
      </button>
    </template>
    <p class="hint first">{{ t("compare.intro") }}</p>
    <p class="hint">{{ t("compare.limit") }}</p>
    <div class="actions-row">
      <button v-if="busy" type="button" class="quiet" @click="cancel">
        {{ t("compare.cancel") }}
      </button>
      <label class="quiet file-button">
        {{ t("compare.file") }}
        <input class="sr-only" type="file" accept=".html,.htm,text/html" @change="onFile" />
      </label>
    </div>
    <p v-if="!network" class="hint">{{ t("compare.firefox") }}</p>
    <p v-if="busy" class="hint" role="status">{{ t("compare.working") }}</p>
    <p v-else-if="status" class="hint" role="status">{{ status }}</p>
    <p v-if="hops.length" class="hint">{{ t("compare.hops") }} {{ hops.join(" · ") }}</p>
    <div v-if="rows" class="compare-rows">
      <div v-for="row in rows" :key="row.id" class="compare-item">
        <div class="compare-head">
          <strong>{{ labels[row.id] }}</strong>
          <span class="badge" :class="row.state === 'same' ? 'ok' : 'warn'">{{
            stateLabel(row.state)
          }}</span>
        </div>
        <div class="comparison">
          <div>
            <span>{{ source === "file" ? t("compare.fileColumn") : t("compare.fetched") }}</span>
            <strong>{{ show(row.fetched, row.numeric) }}</strong>
            <button
              type="button"
              class="icon-text"
              :aria-label="t('compare.copyFetched')"
              @click="copy(show(row.fetched, row.numeric))"
            >
              {{ t("action.copy") }}
            </button>
          </div>
          <div>
            <span>{{ t("compare.rendered") }}</span>
            <strong>{{ show(row.rendered, row.numeric) }}</strong>
            <button
              type="button"
              class="icon-text"
              :aria-label="t('compare.copyRendered')"
              @click="copy(show(row.rendered, row.numeric))"
            >
              {{ t("action.copy") }}
            </button>
          </div>
        </div>
      </div>
      <details class="disclosure">
        <summary>{{ t("compare.why") }}<span aria-hidden="true">⌄</span></summary>
        <div class="details-body">
          <p>{{ t("compare.whyBody") }}</p>
        </div>
      </details>
    </div>
  </WbCard>
</template>
