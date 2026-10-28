<script setup lang="ts">
import { computed, ref } from "vue";
import { browser } from "wxt/browser";
import { compareHtml, signalsFromAudit, type CompareRow } from "../services/html-signals";
import type { MessageKey } from "../locales/en";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";
import LoadingStatus from "./LoadingStatus.vue";
import type { AuditResult } from "../types/audit";

const props = defineProps<{ audit: AuditResult; network: boolean }>();
const { t } = useI18n();
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
    const network = import.meta.env.FIREFOX ? null : await import("../services/html-fetch");
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
  <section class="report-section-block" aria-labelledby="html-compare-title">
    <div class="technical-section-heading">
      <h2 id="html-compare-title">{{ t("compare.title") }}</h2>
      <p>{{ t("compare.intro") }}</p>
    </div>
    <p class="report-note" role="note">{{ t("compare.limit") }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-if="network"
        type="button"
        class="inline-flex h-9 items-center rounded-panel bg-primary px-3 text-[13px] text-primary-contrast disabled:opacity-60"
        :disabled="busy"
        :aria-busy="busy"
        @click="compareFetched"
      >
        {{ t("compare.action") }}
      </button>
      <button v-if="busy" type="button" class="inspector-action" @click="cancel">
        {{ t("compare.cancel") }}
      </button>
      <label class="inspector-action inline-flex cursor-pointer items-center">
        {{ t("compare.file") }}
        <input class="sr-only" type="file" accept=".html,.htm,text/html" @change="onFile" />
      </label>
    </div>
    <p v-if="!network" class="report-note" role="note">{{ t("compare.firefox") }}</p>
    <LoadingStatus v-if="busy" :label="t('compare.working')" />
    <p v-else-if="status" role="status" class="m-0 text-[13px] text-muted">{{ status }}</p>
    <p v-if="hops.length" class="m-0 text-[12px] text-muted">
      {{ t("compare.hops") }} {{ hops.join(" · ") }}
    </p>
    <ul v-if="rows" class="compare-list">
      <li v-for="row in rows" :key="row.id" class="compare-row">
        <p class="compare-property">{{ labels[row.id] }}</p>
        <p class="compare-value">
          <span>{{ source === "file" ? t("compare.fileColumn") : t("compare.fetched") }}</span>
          {{ show(row.fetched, row.numeric) }}
          <CopyButton
            :value="show(row.fetched, row.numeric)"
            :accessible-name="t('compare.copyFetched')"
          />
        </p>
        <p class="compare-value">
          <span>{{ t("compare.rendered") }}</span>
          {{ show(row.rendered, row.numeric) }}
          <CopyButton
            :value="show(row.rendered, row.numeric)"
            :accessible-name="t('compare.copyRendered')"
          />
        </p>
        <p class="compare-state">{{ stateLabel(row.state) }}</p>
        <details class="compare-why">
          <summary>{{ t("compare.why") }}</summary>
          <p>{{ t("compare.whyBody") }}</p>
        </details>
      </li>
    </ul>
  </section>
</template>
