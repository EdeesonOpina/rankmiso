<script setup lang="ts">
import { computed } from "vue";
import { Check, Download, Globe, LoaderCircle, Play, Plus, X } from "lucide-vue-next";
import { useI18n } from "../../composables/useI18n";
import { CRAWL_LIMITS } from "../../services/site-crawl";

/** The crawl control center. It shows state and raises intents; SiteView owns the crawl. */
const props = defineProps<{
  host: string;
  status: "running" | "complete" | "partial" | "stopped" | "error" | "idle";
  statusLabel: string;
  headline: string;
  listed: number;
  analyzed: number;
  fetched: number;
  nonHtml: number;
  redirects: number;
  failed: number;
  skipped: number;
  running: boolean;
  pending: boolean;
  saved: boolean;
  message: string;
  messageTone: "" | "ok" | "err";
  sitemap: string;
  savedCount: number;
}>();
defineEmits<{
  start: [];
  stop: [];
  save: [];
  export: [kind: "csv" | "analysis-csv" | "json"];
}>();

const { t, n } = useI18n();
const busy = computed(() => props.running || props.pending);
const hasPages = computed(() => props.listed > 0);
// The cap applies to attempted addresses; robots-blocked records do not use a crawl slot.
const share = computed(() => {
  const attempted = Math.max(0, props.listed - props.skipped);
  return CRAWL_LIMITS.maxPages > 0 ? Math.min(100, (attempted / CRAWL_LIMITS.maxPages) * 100) : 0;
});
</script>

<template>
  <section class="sx-console" :aria-label="t('site.console.kicker')">
    <div class="sx-console-top">
      <div class="sx-site">
        <span class="sx-avatar"><Globe class="ic" aria-hidden="true" /></span>
        <div>
          <div class="sx-kicker brand">{{ t("site.console.kicker") }}</div>
          <div class="sx-host">
            <span translate="no">{{ host || t("site.noOrigin") }}</span>
            <span class="sx-status status-badge" :class="status">
              <i aria-hidden="true"></i>{{ statusLabel }}
            </span>
          </div>
          <p class="sx-small">{{ t("site.console.sameOrigin") }}</p>
        </div>
      </div>
      <div class="sx-console-meta">
        <span v-if="sitemap" class="sx-chip ghost">{{ sitemap }}</span>
        <span class="sx-chip ghost">{{ t("site.console.saved", { count: n(savedCount) }) }}</span>
      </div>
    </div>
    <div class="sx-console-body">
      <div class="sx-console-main">
        <div class="sx-progress-top">
          <strong role="status">{{ headline }}</strong>
          <span>{{
            t("site.console.listed", { count: n(listed), max: n(CRAWL_LIMITS.maxPages) })
          }}</span>
        </div>
        <div
          class="sx-track"
          :class="{ live: running }"
          role="progressbar"
          :aria-label="t('site.console.cap')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(share)"
        >
          <span :style="{ width: `${share}%` }" />
        </div>
        <div class="sx-kpis">
          <div>
            <b>{{ n(analyzed) }}</b
            ><span>{{ t("site.console.analyzedHtml") }}</span>
          </div>
          <div>
            <b>{{ n(fetched) }}</b
            ><span>{{ t("site.console.responses") }}</span>
          </div>
          <div>
            <b>{{ n(redirects) }}</b
            ><span>{{ t("site.console.redirects") }}</span>
          </div>
          <div>
            <b>{{ n(failed) }}</b
            ><span>{{ t("site.failedCount") }}</span>
          </div>
          <div>
            <b>{{ n(skipped) }}</b
            ><span>{{ t("site.skippedCount") }}</span>
          </div>
        </div>
        <p class="sx-small sx-count-note">
          {{ t("site.console.countsNote", { nonHtml: n(nonHtml) }) }}
        </p>
        <div class="sx-actions">
          <button
            type="button"
            class="primary"
            :disabled="busy || !host"
            :aria-busy="busy"
            @click="$emit('start')"
          >
            <LoaderCircle v-if="busy" class="ic spin" aria-hidden="true" />
            <Play v-else class="ic" aria-hidden="true" />
            {{
              pending
                ? t("site.authorizing")
                : running
                  ? t("site.console.crawling")
                  : t("site.start")
            }}
          </button>
          <button
            type="button"
            class="secondary danger"
            :disabled="!running"
            @click="$emit('stop')"
          >
            <X class="ic" aria-hidden="true" /> {{ t("site.stop") }}
          </button>
          <button
            type="button"
            class="secondary"
            :class="{ 'is-done': saved }"
            :disabled="running || !hasPages || saved"
            @click="$emit('save')"
          >
            <Check v-if="saved" class="ic" aria-hidden="true" />
            <Plus v-else class="ic" aria-hidden="true" />
            {{ saved ? t("site.console.savedState") : t("site.compare.save") }}
          </button>
          <button
            type="button"
            class="secondary"
            :disabled="!hasPages"
            :aria-label="t('site.exportCsv')"
            :title="t('site.exportCsv')"
            @click="$emit('export', 'csv')"
          >
            <Download class="ic" aria-hidden="true" /> {{ t("site.console.csv") }}
          </button>
          <button
            type="button"
            class="secondary"
            :disabled="!hasPages"
            :aria-label="t('site.exportAnalysisCsv')"
            :title="t('site.exportAnalysisCsv')"
            @click="$emit('export', 'analysis-csv')"
          >
            <Download class="ic" aria-hidden="true" /> {{ t("site.console.analysisCsv") }}
          </button>
          <button
            type="button"
            class="secondary"
            :disabled="!hasPages"
            :aria-label="t('site.exportJson')"
            :title="t('site.exportJson')"
            @click="$emit('export', 'json')"
          >
            <Download class="ic" aria-hidden="true" /> {{ t("site.console.json") }}
          </button>
        </div>
        <p class="sx-console-last" :class="running ? '' : messageTone" role="status">
          <template v-if="running">{{ t("site.progress", { count: listed }) }}</template>
          <template v-else-if="message">{{ message }}</template>
          <template v-else>{{ t("site.lifecycle") }}</template>
        </p>
      </div>
      <div class="sx-bounds">
        <div>
          <div class="sx-kicker">{{ t("site.console.boundaries") }}</div>
          <dl>
            <div>
              <dt>{{ t("site.console.maxPages") }}</dt>
              <dd>{{ n(CRAWL_LIMITS.maxPages) }}</dd>
            </div>
            <div>
              <dt>{{ t("site.console.depth") }}</dt>
              <dd>{{ t("site.console.levels", { count: n(CRAWL_LIMITS.maxDepth) }) }}</dd>
            </div>
            <div>
              <dt>{{ t("site.console.time") }}</dt>
              <dd>
                {{ t("site.console.seconds", { count: n(CRAWL_LIMITS.maxDurationMs / 1000) }) }}
              </dd>
            </div>
            <div>
              <dt>{{ t("site.console.discovered") }}</dt>
              <dd>{{ t("site.console.maxLabel", { count: n(CRAWL_LIMITS.maxDiscovered) }) }}</dd>
            </div>
          </dl>
        </div>
        <p>{{ t("site.console.note") }}</p>
      </div>
    </div>
  </section>
</template>
