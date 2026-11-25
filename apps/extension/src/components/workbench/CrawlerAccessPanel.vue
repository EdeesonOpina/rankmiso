<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { browser } from "wxt/browser";
import { Ban, CircleCheck, CircleHelp, CircleSlash, Radar } from "lucide-vue-next";
import {
  contentUseCrawlerIds,
  crawlerById,
  MICROSOFT_PREFERENCES_URL,
  platforms,
  type CrawlerKind,
  type PlatformDefinition,
  type RobotsBehaviour,
} from "../../config/crawlers.config";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";
import {
  checkCrawlerAccess,
  type AccessCheck,
  type AgentVerdict,
  type CrawlState,
} from "../../services/crawler-access";
import { sitePermission } from "../../services/page-access";
import { crawlerAccessFor, rememberCrawlerAccess } from "../../services/ai-search-store";
import type { AuditResult } from "../../types/audit";
import SxPanel from "./SxPanel.vue";
import SxStat from "./SxStat.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
// The latest check for this page survives switching tabs or sections.
const result = ref<AccessCheck | null>(crawlerAccessFor(props.audit.page.url) ?? null);
const busy = ref(false);
const message = ref("");
let controller: AbortController | null = null;

const host = computed(() => sitePermission(props.audit.page.url)?.hostname ?? "");
const verdicts = computed(() => new Map(result.value?.report.agents.map((a) => [a.id, a]) ?? []));
const searchPlatforms = platforms.filter((item) => item.group === "search");
const aiPlatforms = platforms.filter((item) => item.group === "ai");
const contentUse = contentUseCrawlerIds.map((id) => crawlerById(id)).filter((item) => !!item);

const counts = computed(() => {
  const agents = result.value?.report.agents ?? [];
  const count = (states: CrawlState[]) =>
    n(agents.filter((agent) => states.includes(agent.crawl)).length);
  return {
    allowed: count(["allowed"]),
    disallowed: count(["disallowed"]),
    noRule: count(["no-rules", "robots-missing"]),
    unknown: count(["robots-error", "not-measured"]),
  };
});

const stateKey: Record<CrawlState, MessageKey> = {
  allowed: "access.state.allowed",
  disallowed: "access.state.disallowed",
  "no-rules": "access.state.noRules",
  "robots-missing": "access.state.robotsMissing",
  "robots-error": "access.state.robotsError",
  "not-measured": "access.state.notMeasured",
};
const useKey: Partial<Record<CrawlState, MessageKey>> = {
  allowed: "access.use.allowed",
  disallowed: "access.use.disallowed",
  "no-rules": "access.use.none",
  "robots-missing": "access.use.none",
};
const kindKey: Record<CrawlerKind, MessageKey> = {
  search: "access.kind.search",
  "ai-search": "access.kind.aiSearch",
  "ai-training": "access.kind.aiTraining",
  "user-fetch": "access.kind.userFetch",
  "content-use": "access.kind.contentUse",
};
const behaviourKey: Record<RobotsBehaviour, MessageKey> = {
  obeys: "access.behaviour.obeys",
  "may-ignore": "access.behaviour.mayIgnore",
  ignores: "access.behaviour.ignores",
  preference: "access.behaviour.preference",
  "not-stated": "access.behaviour.notStated",
};
const noteKey: Partial<Record<string, MessageKey>> = {
  brave: "access.note.brave",
  yahoo: "access.note.yahoo",
  duckduckgo: "access.note.duckduckgo",
  "google-ai": "access.note.googleAi",
  gemini: "access.note.gemini",
  copilot: "access.note.copilot",
  perplexity: "access.note.perplexity",
};
const supportKey: Partial<Record<PlatformDefinition["supportLevel"], MessageKey>> = {
  partial: "access.support.partial",
  informational: "access.support.informational",
  unsupported: "access.support.unsupported",
};

/** Content-use tokens are preferences, so their wording and tone stay neutral. */
function label(verdict: AgentVerdict | undefined, contentToken = false): string {
  if (!verdict) return t("access.state.notMeasured");
  const key = contentToken ? useKey[verdict.crawl] : undefined;
  return t(key ?? stateKey[verdict.crawl]);
}

function tone(verdict: AgentVerdict | undefined, contentToken = false): "ok" | "warn" | "gray" {
  if (!verdict || contentToken) return "gray";
  if (verdict.crawl === "disallowed" || verdict.crawl === "robots-error") return "warn";
  if (verdict.crawl === "not-measured") return "gray";
  return "ok";
}

function lead(item: PlatformDefinition): AgentVerdict | undefined {
  return item.crawlerIds[0] ? verdicts.value.get(item.crawlerIds[0]) : undefined;
}

function isPreference(id: string | undefined): boolean {
  return !!id && crawlerById(id)?.kind === "content-use";
}

function groupText(verdict: AgentVerdict): string {
  if (!verdict.group) return t("access.ev.noGroup");
  return verdict.viaWildcard ? t("access.ev.groupWildcard") : verdict.group;
}

function indexingText(verdict: AgentVerdict): string {
  if (verdict.indexingState === "not-measured") return t("access.ev.notMeasured");
  if (!verdict.indexing.length) return t("access.ev.noDirectives");
  return verdict.indexing.map((item) => `${item.value} (${item.source})`).join(", ");
}

const robotsLine = computed(() => {
  const value = result.value;
  if (!value) return "";
  const status = value.robotsStatus === null ? "" : String(value.robotsStatus);
  if (value.robotsState === "read") return t("access.robots.read", { status });
  if (value.robotsState === "missing") return t("access.robots.missing", { status });
  if (value.robotsState === "error") return t("access.robots.error", { status });
  return t("access.robots.notRead");
});

const pageLine = computed(() => {
  const report = result.value?.report;
  if (!report) return "";
  const status = report.pageStatus === null ? "" : String(report.pageStatus);
  const keys: Record<string, MessageKey> = {
    ok: "access.page.ok",
    "auth-required": "access.page.auth",
    forbidden: "access.page.forbidden",
    "not-found": "access.page.notFound",
    "rate-limited": "access.page.rateLimited",
    "server-error": "access.page.serverError",
    other: "access.page.other",
    "not-measured": "access.page.notMeasured",
  };
  return t(keys[report.pageAccess] ?? "access.page.other", { status });
});

const microsoftLines = computed(() => {
  const ms = result.value?.report.microsoft;
  if (!ms) return null;
  const show = (item: { value: string; source: string } | null) =>
    item ? `${item.value} (${item.source})` : t("access.ms.none");
  return {
    measured: ms.state === "read",
    training: show(ms.training),
    grounding: show(ms.grounding),
    timing: t(ms.inEffect ? "access.ms.now" : "access.ms.future"),
  };
});

const checkedLine = computed(() =>
  result.value
    ? t("access.checked", { time: new Date(result.value.checkedAt).toLocaleString() })
    : t("access.never"),
);

async function check() {
  if (busy.value) return;
  message.value = "";
  const permission = sitePermission(props.audit.page.url);
  if (!permission) {
    message.value = t("access.noOrigin");
    return;
  }
  let granted = false;
  try {
    // Keep the request inside the click's user-action context (Firefox requires it).
    granted = await browser.permissions.request({ origins: [permission.pattern] });
  } catch {
    message.value = t("access.unavailable");
    return;
  }
  if (!granted) {
    message.value = t("access.denied");
    return;
  }
  controller?.abort();
  controller = new AbortController();
  busy.value = true;
  try {
    const url = props.audit.page.url;
    result.value = await checkCrawlerAccess(url, controller.signal);
    rememberCrawlerAccess(url, result.value);
  } catch (error) {
    message.value = t(
      error instanceof DOMException && error.name === "AbortError"
        ? "access.cancelled"
        : "access.failed",
    );
  } finally {
    busy.value = false;
  }
}

function cancel() {
  controller?.abort();
}

onBeforeUnmount(cancel);
</script>

<template>
  <div class="ax-panel">
    <section class="ax-console" :aria-label="t('access.title')">
      <div>
        <strong translate="no">{{ host || t("access.noOrigin") }}</strong>
        <p>{{ checkedLine }}</p>
        <p class="ax-small">{{ t("access.requests") }}</p>
      </div>
      <div class="ax-actions">
        <button
          type="button"
          class="primary"
          :disabled="busy || !host"
          :aria-busy="busy"
          @click="check"
        >
          <Radar class="ic" aria-hidden="true" />
          {{ busy ? t("access.checking") : t("access.check") }}
        </button>
        <button v-if="busy" type="button" class="secondary" @click="cancel">
          {{ t("access.cancel") }}
        </button>
      </div>
      <p v-if="message" class="ax-message" role="status">{{ message }}</p>
    </section>

    <section v-if="!result" class="ax-empty">
      <h2>{{ t("access.empty.title") }}</h2>
      <p>{{ t("access.empty.body") }}</p>
    </section>

    <template v-else>
      <div class="sx-stats">
        <SxStat
          :label="t('access.stat.allowed')"
          :value="counts.allowed"
          :icon="CircleCheck"
          tone="success"
        />
        <SxStat
          :label="t('access.stat.disallowed')"
          :value="counts.disallowed"
          :icon="Ban"
          tone="warning"
        />
        <SxStat
          :label="t('access.stat.noRule')"
          :value="counts.noRule"
          :note="t('access.stat.noRuleNote')"
          :icon="CircleSlash"
          tone="neutral"
        />
        <SxStat
          :label="t('access.stat.unknown')"
          :value="counts.unknown"
          :icon="CircleHelp"
          tone="neutral"
        />
      </div>

      <ul class="ax-facts" role="list">
        <li>
          <a :href="result.robotsUrl" target="_blank" rel="noopener noreferrer">robots.txt</a>
          · {{ robotsLine }}
        </li>
        <li>{{ pageLine }}</li>
        <li>{{ t("access.pathChecked", { path: result.report.path }) }}</li>
      </ul>

      <SxPanel
        v-for="section in [
          {
            id: 'search',
            title: t('access.search'),
            text: t('access.searchText'),
            items: searchPlatforms,
          },
          { id: 'ai', title: t('access.ai'), text: t('access.aiText'), items: aiPlatforms },
        ]"
        :key="section.id"
        :title="section.title"
        :text="section.text"
        class="ax-section"
      >
        <ul class="ax-grid" role="list">
          <li v-for="item in section.items" :key="item.id" class="ax-card">
            <div class="ax-card-head">
              <span class="ax-mark" aria-hidden="true">{{ item.name.charAt(0) }}</span>
              <div class="ax-card-title">
                <h4>{{ item.name }}</h4>
                <span v-if="supportKey[item.supportLevel]" class="ax-support">{{
                  t(supportKey[item.supportLevel]!)
                }}</span>
              </div>
            </div>
            <p v-if="item.supportLevel === 'unsupported'" class="ax-status">
              <span class="badge gray">{{ t("access.state.unsupported") }}</span>
            </p>
            <p v-else class="ax-status">
              <span class="badge" :class="tone(lead(item), isPreference(item.crawlerIds[0]))">{{
                label(lead(item), isPreference(item.crawlerIds[0]))
              }}</span>
              <span class="ax-token" translate="no">{{
                crawlerById(item.crawlerIds[0]!)?.token
              }}</span>
            </p>
            <p v-if="noteKey[item.id]" class="ax-note">{{ t(noteKey[item.id]!) }}</p>
            <details v-if="item.crawlerIds.length" class="disclosure ax-evidence">
              <summary>{{ t("access.evidence") }}<span aria-hidden="true">⌄</span></summary>
              <div v-for="id in item.crawlerIds" :key="id" class="details-body ax-crawler">
                <template v-if="crawlerById(id) && verdicts.get(id)">
                  <dl>
                    <div>
                      <dt>{{ t("access.ev.token") }}</dt>
                      <dd translate="no">{{ crawlerById(id)!.token }}</dd>
                    </div>
                    <div>
                      <dt>{{ t("access.ev.kind") }}</dt>
                      <dd>{{ t(kindKey[crawlerById(id)!.kind]) }}</dd>
                    </div>
                    <div>
                      <dt>{{ t("access.ev.result") }}</dt>
                      <dd>{{ label(verdicts.get(id), isPreference(id)) }}</dd>
                    </div>
                    <div>
                      <dt>{{ t("access.ev.group") }}</dt>
                      <dd>{{ groupText(verdicts.get(id)!) }}</dd>
                    </div>
                    <div>
                      <dt>{{ t("access.ev.rule") }}</dt>
                      <dd>{{ verdicts.get(id)!.rule ?? t("access.ev.noRule") }}</dd>
                    </div>
                    <div v-if="!isPreference(id)">
                      <dt>{{ t("access.ev.indexing") }}</dt>
                      <dd>{{ indexingText(verdicts.get(id)!) }}</dd>
                    </div>
                  </dl>
                  <p>{{ t(behaviourKey[crawlerById(id)!.robots]) }}</p>
                  <p>
                    <a
                      :href="crawlerById(id)!.documentationUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ t("access.docs") }}</a
                    >
                    · {{ t("access.reviewed", { date: crawlerById(id)!.reviewedOn }) }}
                  </p>
                </template>
              </div>
            </details>
          </li>
        </ul>
      </SxPanel>

      <SxPanel
        :title="t('access.contentUse')"
        :text="t('access.contentUseText')"
        class="ax-section"
      >
        <ul class="ax-use" role="list">
          <li v-for="item in contentUse" :key="item.id">
            <div>
              <strong translate="no">{{ item.token }}</strong>
              <small>{{ t(kindKey[item.kind]) }}</small>
            </div>
            <span class="badge" :class="tone(verdicts.get(item.id), true)">{{
              label(verdicts.get(item.id), item.kind === "content-use")
            }}</span>
            <small class="ax-use-detail">
              {{ verdicts.get(item.id)?.rule ?? t("access.ev.noRule") }}
              <template v-if="verdicts.get(item.id)?.viaWildcard">
                · {{ t("access.wildcardNote") }}</template
              >
              ·
              <a :href="item.documentationUrl" target="_blank" rel="noopener noreferrer">{{
                t("access.docs")
              }}</a>
            </small>
          </li>
        </ul>
        <div v-if="microsoftLines" class="ax-ms">
          <h4>{{ t("access.ms.title") }}</h4>
          <p v-if="!microsoftLines.measured">{{ t("access.ms.notMeasured") }}</p>
          <dl v-else>
            <div>
              <dt>{{ t("access.ms.training") }}</dt>
              <dd>{{ microsoftLines.training }}</dd>
            </div>
            <div>
              <dt>{{ t("access.ms.grounding") }}</dt>
              <dd>{{ microsoftLines.grounding }}</dd>
            </div>
          </dl>
          <p>{{ microsoftLines.timing }} {{ t("access.ms.separate") }}</p>
          <p>
            <a :href="MICROSOFT_PREFERENCES_URL" target="_blank" rel="noopener noreferrer">{{
              t("access.docs")
            }}</a>
          </p>
        </div>
      </SxPanel>
    </template>

    <p class="ax-disclaimer">{{ t("access.disclaimer") }} {{ t("access.names") }}</p>
  </div>
</template>
