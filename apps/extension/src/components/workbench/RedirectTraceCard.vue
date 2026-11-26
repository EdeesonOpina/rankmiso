<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from "vue";
import { browser } from "wxt/browser";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";
import { sitePermission } from "../../services/page-access";
import {
  hasRedirectDetails,
  observeRedirects,
  requestRedirectDetails,
} from "../../services/redirect-observer";
import {
  analyzeRedirects,
  traceRedirects,
  type RedirectTrace,
  type TraceStop,
} from "../../services/redirect-trace";
import type { AuditResult, CheckResult } from "../../types/audit";
import FindingList from "./FindingList.vue";
import WbCard from "./WbCard.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const field = useId();
const target = ref(props.audit.page.url);
const details = ref(false);
const busy = ref(false);
const message = ref("");
const trace = ref<RedirectTrace | null>(null);
const findings = ref<CheckResult[]>([]);
let controller: AbortController | null = null;

onMounted(async () => {
  details.value = await hasRedirectDetails();
});
onBeforeUnmount(() => controller?.abort());

const stopKey: Record<Exclude<TraceStop, "">, MessageKey> = {
  loop: "redirect.stop.loop",
  limit: "redirect.stop.limit",
  "left-origin": "redirect.stop.leftOrigin",
  blocked: "redirect.stop.blocked",
  unreadable: "redirect.stop.unreadable",
  timeout: "redirect.stop.timeout",
  network: "redirect.stop.network",
  aborted: "redirect.stop.aborted",
};
const stopped = computed(() =>
  trace.value?.stopped ? t(stopKey[trace.value.stopped as Exclude<TraceStop, "">]) : "",
);

async function allowDetails() {
  details.value = await requestRedirectDetails();
  if (!details.value) message.value = t("redirect.detailsDenied");
}

async function run() {
  if (busy.value) return;
  message.value = "";
  const page = sitePermission(props.audit.page.url);
  let url: URL;
  try {
    url = new URL(target.value.trim(), props.audit.page.url);
  } catch {
    message.value = t("redirect.invalid");
    return;
  }
  if (!page || url.origin !== page.origin) {
    message.value = t("redirect.sameSite");
    return;
  }
  let granted = false;
  try {
    granted = await browser.permissions.request({ origins: [page.pattern] });
  } catch {
    granted = false;
  }
  if (!granted) {
    message.value = t("redirect.denied");
    return;
  }
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  const observer = details.value ? observeRedirects(page.pattern) : null;
  try {
    trace.value = await traceRedirects(url.href, page.origin, controller.signal, observer);
    findings.value = (await analyzeRedirects(trace.value)).findings;
  } catch {
    message.value = t("redirect.failed");
  } finally {
    observer?.stop();
    busy.value = false;
  }
}
</script>

<template>
  <WbCard :title="t('redirect.title')" class="redirect-card" flat>
    <p class="hint first">{{ t("redirect.intro") }}</p>
    <label class="redirect-field" :for="field">
      <span>{{ t("redirect.url") }}</span>
      <input :id="field" v-model="target" type="url" spellcheck="false" />
    </label>
    <div class="actions-row">
      <button type="button" class="quiet" :disabled="busy" :aria-busy="busy" @click="run">
        {{ busy ? t("redirect.working") : t("redirect.action") }}
      </button>
      <button v-if="busy" type="button" class="quiet" @click="controller?.abort()">
        {{ t("compare.cancel") }}
      </button>
      <button v-if="!details" type="button" class="quiet" @click="allowDetails">
        {{ t("redirect.allowDetails") }}
      </button>
    </div>
    <p class="hint">{{ details ? t("redirect.detailsOn") : t("redirect.detailsOff") }}</p>
    <p v-if="message" class="hint" role="status">{{ message }}</p>

    <template v-if="trace">
      <ol class="redirect-steps">
        <li v-for="(hop, index) in trace.hops" :key="`${hop.url}-${index}`">
          <span class="badge" :class="hop.status === 301 || hop.status === 308 ? 'ok' : 'warn'">{{
            hop.status
          }}</span>
          <span class="url-line">{{ hop.url }}</span>
          <span aria-hidden="true">→</span>
          <span class="url-line">{{ hop.location }}</span>
        </li>
        <li v-if="trace.finalUrl">
          <span class="badge" :class="(trace.finalStatus ?? 0) >= 400 ? 'err' : 'ok'">{{
            trace.finalStatus
          }}</span>
          <span class="url-line">{{ trace.finalUrl }}</span>
          <small>{{ t("redirect.final") }}</small>
        </li>
      </ol>
      <p class="hint" role="status">
        {{
          trace.hops.length
            ? t("redirect.summary", { count: n(trace.hops.length) })
            : trace.redirected
              ? t("redirect.summaryUnknown")
              : t("redirect.none")
        }}
        {{ stopped }}
      </p>
      <FindingList :findings="findings" />
    </template>
  </WbCard>
</template>
