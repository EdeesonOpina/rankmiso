<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Ban,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleSlash,
  FileText,
  Globe,
  Radar,
  ShieldCheck,
} from "lucide-vue-next";
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
import { useCrawlerAccess } from "../../composables/useCrawlerAccess";
import type { MessageKey } from "../../locales/en";
import type { AgentVerdict } from "../../services/crawler-access";
import type { AuditResult } from "../../types/audit";
import PlatformMark from "../PlatformMark.vue";
import SxPanel from "./SxPanel.vue";
import SxStat from "./SxStat.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
// The latest check for this page survives switching tabs or sections.
const {
  result,
  busy,
  message,
  host,
  verdicts,
  counts,
  check,
  cancel,
  label,
  tone,
  lead,
  isPreference,
} = useCrawlerAccess(() => props.audit.page.url);
const root = ref<HTMLElement | null>(null);
const allOpen = ref(false);
const searchPlatforms = platforms.filter((item) => item.group === "search");
const aiPlatforms = platforms.filter((item) => item.group === "ai");
const contentUse = contentUseCrawlerIds.map((id) => crawlerById(id)).filter((item) => !!item);

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

function toggleEvidence() {
  allOpen.value = !allOpen.value;
  root.value?.querySelectorAll<HTMLDetailsElement>(".ax-evidence").forEach((item) => {
    item.open = allOpen.value;
  });
}
</script>

<template>
  <div ref="root" class="ax-panel">
    <section class="ax-head" :aria-label="t('access.title')">
      <div>
        <h3>{{ t("access.headTitle") }}</h3>
        <p>
          <strong translate="no">{{ host || t("access.noOrigin") }}</strong> · {{ checkedLine }}
        </p>
      </div>
      <div class="ax-actions">
        <button v-if="result" type="button" class="secondary" @click="toggleEvidence">
          <FileText class="ic" aria-hidden="true" />
          {{ t(allOpen ? "access.hideEvidence" : "access.showEvidence") }}
        </button>
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

    <div v-if="result" class="sx-stats">
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

    <div class="ax-cols">
      <div class="ax-main">
        <section v-if="!result" class="ax-empty">
          <h2>{{ t("access.empty.title") }}</h2>
          <p>{{ t("access.empty.body") }}</p>
        </section>

        <template v-else>
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
                  <PlatformMark :platform-id="item.id" :name="item.name" />
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
      </div>

      <aside class="ax-aside" :aria-label="t('access.details')">
        <section v-if="result" class="ax-side">
          <h3>{{ t("access.signals") }}</h3>
          <p class="ax-side-text">{{ t("access.signalsText") }}</p>
          <ul class="ax-signals" role="list">
            <li>
              <span class="ax-signal-icon"><FileText class="ic" aria-hidden="true" /></span>
              <div>
                <a :href="result.robotsUrl" target="_blank" rel="noopener noreferrer">robots.txt</a>
                <small>{{ robotsLine }}</small>
              </div>
            </li>
            <li>
              <span class="ax-signal-icon"><Globe class="ic" aria-hidden="true" /></span>
              <div>
                <strong>{{ t("access.sig.page") }}</strong>
                <small>{{ pageLine }}</small>
              </div>
            </li>
            <li>
              <span class="ax-signal-icon"><ShieldCheck class="ic" aria-hidden="true" /></span>
              <div>
                <strong>{{ t("access.sig.path") }}</strong>
                <small>{{ t("access.pathChecked", { path: result.report.path }) }}</small>
              </div>
            </li>
          </ul>
        </section>
        <section class="ax-limits">
          <h3><CircleAlert class="ic" aria-hidden="true" />{{ t("access.limitsTitle") }}</h3>
          <p>{{ t("access.disclaimer") }}</p>
        </section>
        <section class="ax-side">
          <h3>{{ t("access.details") }}</h3>
          <dl class="ax-details">
            <div>
              <dt>{{ t("access.detail.scope") }}</dt>
              <dd translate="no">{{ audit.page.url }}</dd>
            </div>
            <div>
              <dt>{{ t("access.detail.network") }}</dt>
              <dd>{{ t("access.requests") }}</dd>
            </div>
            <div>
              <dt>{{ t("access.detail.names") }}</dt>
              <dd>{{ t("access.marks") }}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  </div>
</template>
