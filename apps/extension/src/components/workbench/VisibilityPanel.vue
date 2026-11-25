<script setup lang="ts">
import { computed, reactive, ref, useId } from "vue";
import { visibilityPlatforms } from "../../config/crawlers.config";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";
import { download } from "../../services/export";
import { sitePermission } from "../../services/page-access";
import {
  classifyObservation,
  exportName,
  historyFor,
  loadStore,
  newId,
  saveStore,
  VISIBILITY_LIMITS,
  visibilityCsv,
  type VisibilityObservation,
  type VisibilityQuery,
  type VisibilityStatus,
} from "../../services/visibility";
import type { AuditResult } from "../../types/audit";
import SxPanel from "./SxPanel.vue";

/**
 * Records what the user saw in AI answers. Nothing is fetched: RankMiso never queries AI
 * services, and every status describes one recorded sample.
 */
const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const ids = { query: useId(), domain: useId(), brand: useId() };
const loaded = loadStore();
const store = reactive(loaded.store);
const message = ref(loaded.damaged ? t("visibility.damaged") : "");
const draft = reactive({
  text: "",
  domain: sitePermission(props.audit.page.url)?.hostname.replace(/^www\./, "") ?? "",
  brand: "",
});
const recording = ref<string | null>(null);
const busy = ref(false);
const form = reactive({
  platformId: visibilityPlatforms[0]!.id,
  observedOn: new Date().toISOString().slice(0, 10),
  response: "",
  citations: "",
  outcome: "unknown",
  notes: "",
});

const statusKey: Record<VisibilityStatus, MessageKey> = {
  cited: "visibility.status.cited",
  mentioned: "visibility.status.mentioned",
  "not-observed": "visibility.status.notObserved",
  unknown: "visibility.status.unknown",
  "not-measured": "visibility.status.notMeasured",
};
const tone: Record<VisibilityStatus, "ok" | "warn" | "gray"> = {
  cited: "ok",
  mentioned: "ok",
  "not-observed": "gray",
  unknown: "gray",
  "not-measured": "gray",
};

const usage = computed(() =>
  t("visibility.usage", {
    count: n(store.observations.length),
    max: n(VISIBILITY_LIMITS.observations),
    kb: n(Math.ceil(JSON.stringify(store).length / 1024)),
    maxKb: n(VISIBILITY_LIMITS.bytes / 1000),
  }),
);

function persist(): boolean {
  const dropped = saveStore(store);
  if (dropped === null) {
    message.value = t("visibility.saveFailed");
    return false;
  }
  message.value = dropped > 0 ? t("visibility.dropped", { count: n(dropped) }) : "";
  return true;
}

function addQuery() {
  const text = draft.text.trim().slice(0, 300);
  const domain = draft.domain.trim().slice(0, 253);
  if (!text || !domain) {
    message.value = t("visibility.needQuery");
    return;
  }
  if (store.queries.length >= VISIBILITY_LIMITS.queries) {
    message.value = t("visibility.tooManyQueries", { max: n(VISIBILITY_LIMITS.queries) });
    return;
  }
  store.queries.unshift({
    id: newId(),
    text,
    domain,
    brand: draft.brand.trim().slice(0, 80),
    createdAt: new Date().toISOString(),
  });
  draft.text = "";
  persist();
}

function removeQuery(query: VisibilityQuery) {
  store.queries = store.queries.filter((item) => item.id !== query.id);
  store.observations = store.observations.filter((item) => item.queryId !== query.id);
  if (recording.value === query.id) recording.value = null;
  persist();
}

function removeObservation(observation: VisibilityObservation) {
  store.observations = store.observations.filter((item) => item.id !== observation.id);
  persist();
}

function startRecording(query: VisibilityQuery) {
  recording.value = recording.value === query.id ? null : query.id;
  Object.assign(form, {
    response: "",
    citations: "",
    outcome: "unknown",
    notes: "",
    observedOn: new Date().toISOString().slice(0, 10),
  });
}

async function record(query: VisibilityQuery) {
  if (busy.value) return;
  busy.value = true;
  message.value = "";
  try {
    const result = await classifyObservation({
      domain: query.domain,
      brand: query.brand,
      response: form.response,
      citations: form.citations
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, VISIBILITY_LIMITS.citations),
      outcome: form.outcome,
    });
    store.observations.push({
      id: newId(),
      queryId: query.id,
      platformId: form.platformId,
      observedOn: /^\d{4}-\d{2}-\d{2}$/.test(form.observedOn)
        ? form.observedOn
        : new Date().toISOString().slice(0, 10),
      recordedAt: new Date().toISOString(),
      basis: result.basis,
      status: result.status,
      citations: result.citations.slice(0, VISIBILITY_LIMITS.citations),
      mentions: result.mentions,
      excerpt: form.response.trim().slice(0, VISIBILITY_LIMITS.excerpt),
      notes: form.notes.trim().slice(0, VISIBILITY_LIMITS.notes),
    });
    if (persist()) recording.value = null;
  } catch {
    message.value = t("visibility.invalidDomain");
  } finally {
    busy.value = false;
  }
}

function rows(query: VisibilityQuery) {
  return visibilityPlatforms
    .map((platform) => {
      const history = historyFor(store, query.id, platform.id);
      return { platform, history, latest: history[0], previous: history[1] };
    })
    .filter((row) => row.history.length > 0);
}

function exportJson() {
  download(exportName("json"), JSON.stringify(store, null, 2), "application/json");
}

function exportCsv() {
  download(exportName("csv"), visibilityCsv(store), "text/csv");
}

const platformName = (id: string) =>
  visibilityPlatforms.find((platform) => platform.id === id)?.name ?? id;
</script>

<template>
  <div class="ax-panel vis">
    <section class="ax-console" :aria-label="t('visibility.title')">
      <div>
        <strong>{{ t("visibility.title") }}</strong>
        <p>{{ t("visibility.intro") }}</p>
        <p class="ax-small">{{ usage }}</p>
      </div>
      <div class="ax-actions">
        <button
          type="button"
          class="secondary"
          :disabled="!store.observations.length"
          @click="exportCsv"
        >
          {{ t("visibility.exportCsv") }}
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="!store.queries.length"
          @click="exportJson"
        >
          {{ t("visibility.exportJson") }}
        </button>
      </div>
      <p v-if="message" class="ax-message" role="status">{{ message }}</p>
    </section>

    <SxPanel :title="t('visibility.addTitle')" :text="t('visibility.addText')" class="ax-section">
      <form class="vis-form" @submit.prevent="addQuery">
        <label :for="ids.query">
          <span>{{ t("visibility.query") }}</span>
          <input :id="ids.query" v-model="draft.text" maxlength="300" required />
        </label>
        <label :for="ids.domain">
          <span>{{ t("visibility.domain") }}</span>
          <input :id="ids.domain" v-model="draft.domain" maxlength="253" required />
        </label>
        <label :for="ids.brand">
          <span>{{ t("visibility.brand") }}</span>
          <input :id="ids.brand" v-model="draft.brand" maxlength="80" />
        </label>
        <button type="submit" class="primary">{{ t("visibility.add") }}</button>
      </form>
    </SxPanel>

    <section v-if="!store.queries.length" class="ax-empty">
      <h2>{{ t("visibility.empty.title") }}</h2>
      <p>{{ t("visibility.empty.body") }}</p>
    </section>

    <SxPanel
      v-for="query in store.queries"
      :key="query.id"
      :title="query.text"
      :text="t('visibility.queryMeta', { domain: query.domain })"
      class="ax-section vis-query"
    >
      <template #aside>
        <div class="ax-actions">
          <button type="button" class="secondary" @click="startRecording(query)">
            {{ t("visibility.record") }}
          </button>
          <button
            type="button"
            class="icon-text"
            :aria-label="t('visibility.deleteQuery', { query: query.text })"
            @click="removeQuery(query)"
          >
            {{ t("visibility.delete") }}
          </button>
        </div>
      </template>

      <form
        v-if="recording === query.id"
        class="vis-form vis-record"
        @submit.prevent="record(query)"
      >
        <label>
          <span>{{ t("visibility.platform") }}</span>
          <select v-model="form.platformId">
            <option v-for="platform in visibilityPlatforms" :key="platform.id" :value="platform.id">
              {{ platform.name }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ t("visibility.date") }}</span>
          <input v-model="form.observedOn" type="date" required />
        </label>
        <label class="vis-wide">
          <span>{{ t("visibility.response") }}</span>
          <textarea v-model="form.response" rows="4" maxlength="20000"></textarea>
        </label>
        <label class="vis-wide">
          <span>{{ t("visibility.citations") }}</span>
          <textarea v-model="form.citations" rows="3"></textarea>
        </label>
        <label>
          <span>{{ t("visibility.outcome") }}</span>
          <select v-model="form.outcome">
            <option value="cited">{{ t("visibility.status.cited") }}</option>
            <option value="mentioned">{{ t("visibility.status.mentioned") }}</option>
            <option value="not-observed">{{ t("visibility.status.notObserved") }}</option>
            <option value="unknown">{{ t("visibility.status.unknown") }}</option>
          </select>
        </label>
        <label>
          <span>{{ t("visibility.notes") }}</span>
          <input v-model="form.notes" maxlength="500" />
        </label>
        <p class="ax-small vis-wide">{{ t("visibility.outcomeNote") }}</p>
        <p class="ax-small vis-wide">
          <a
            :href="visibilityPlatforms.find((p) => p.id === form.platformId)?.homeUrl"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t("visibility.open", { platform: platformName(form.platformId) }) }}</a
          >
        </p>
        <div class="ax-actions vis-wide">
          <button type="submit" class="primary" :disabled="busy">{{ t("visibility.save") }}</button>
          <button type="button" class="secondary" @click="recording = null">
            {{ t("compare.cancel") }}
          </button>
        </div>
      </form>

      <p v-if="!rows(query).length" class="ax-small vis-none">{{ t("visibility.noSamples") }}</p>
      <ul v-else class="ax-findings vis-rows" role="list">
        <li v-for="row in rows(query)" :key="row.platform.id" class="ax-finding">
          <span class="ax-mark" aria-hidden="true">{{ row.platform.name.charAt(0) }}</span>
          <div class="ax-finding-main">
            <div class="ax-finding-head">
              <h4>{{ row.platform.name }}</h4>
              <span class="badge" :class="tone[row.latest!.status]">{{
                t(statusKey[row.latest!.status])
              }}</span>
            </div>
            <p>
              {{
                t("visibility.latest", {
                  date: row.latest!.observedOn,
                  count: n(row.history.length),
                })
              }}
              <template v-if="row.previous && row.previous.status !== row.latest!.status">
                {{
                  t("visibility.changed", {
                    status: t(statusKey[row.previous.status]),
                    date: row.previous.observedOn,
                  })
                }}
              </template>
            </p>
            <details class="disclosure ax-evidence">
              <summary>{{ t("visibility.history") }}<span aria-hidden="true">⌄</span></summary>
              <ol class="details-body vis-history">
                <li v-for="item in row.history" :key="item.id">
                  <div class="vis-history-head">
                    <strong>{{ item.observedOn }} · {{ t(statusKey[item.status]) }}</strong>
                    <small>{{
                      t(
                        item.basis === "pasted"
                          ? "visibility.basis.pasted"
                          : "visibility.basis.manual",
                      )
                    }}</small>
                    <button
                      type="button"
                      class="icon-text"
                      :aria-label="t('visibility.deleteSample', { date: item.observedOn })"
                      @click="removeObservation(item)"
                    >
                      {{ t("visibility.delete") }}
                    </button>
                  </div>
                  <p
                    v-for="citation in item.citations.filter((c) => c.onDomain)"
                    :key="citation.url"
                    class="url-line"
                  >
                    {{ t("visibility.citedAt", { order: n(citation.order), url: citation.url }) }}
                  </p>
                  <p v-for="mention in item.mentions" :key="mention">“{{ mention }}”</p>
                  <p v-if="item.notes">{{ item.notes }}</p>
                </li>
              </ol>
            </details>
          </div>
        </li>
      </ul>
    </SxPanel>

    <p class="ax-disclaimer">{{ t("visibility.disclaimer") }} {{ t("access.names") }}</p>
  </div>
</template>
