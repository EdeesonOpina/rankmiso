<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { CircleCheck, Clock, Info, TriangleAlert } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import { selectChecks } from "../../services/check-list";
import { categoryLabelKey } from "../../services/category-label";
import {
  byTime,
  readSavedReports,
  recordsForPage,
  type SavedReport,
} from "../../services/saved-reports";
import { useI18n } from "../../composables/useI18n";
import { scoreTone, useWorkbench } from "./context";
import { actionable, badgeTone, checkTone, limitationText, statusKey } from "./checks";
import PageHeading from "./PageHeading.vue";
import DataRow from "./DataRow.vue";
import ScoreRing from "./ScoreRing.vue";
import TrendChart from "./TrendChart.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { surface, go } = useWorkbench();
const report = surface === "report";

const score = computed(() => props.audit.score);
const findings = computed(() => selectChecks(actionable(props.audit.checks), { sort: "severity" }));
const measured = computed(() =>
  score.value.categories
    .filter((item) => item.available && item.value != null)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0)),
);
const focus = computed(() => measured.value.filter((item) => (item.value ?? 0) < 100).slice(0, 3));
const unmeasured = computed(() => score.value.categories.filter((item) => !item.available));
const meta = computed(() => props.audit.details.metadata);

const saved = ref<SavedReport[]>([]);
onMounted(() => {
  if (!report) return;
  readSavedReports()
    .then((items) => (saved.value = byTime(recordsForPage(items, props.audit.page.url), "asc")))
    .catch(() => undefined);
});
const scored = computed(() =>
  saved.value.filter((item) => item.comparison.score != null).slice(-8),
);
const latestSaved = computed(() => scored.value.at(-1)?.comparison.score ?? null);
</script>

<template>
  <PageHeading :overline="t('wb.ov.overline')" :title="t('wb.ov.title')" :text="t('wb.ov.text')" />
  <div :class="report ? 'dashboard-grid' : ''">
    <div :class="report ? 'dashboard-primary' : ''">
      <section class="hero" :aria-label="t('wb.ov.health')">
        <div class="hero-top">
          <div>
            <span class="hero-tag">{{ t("wb.ov.healthTag") }}</span>
            <div class="score-figure">
              {{ score.available && score.value != null ? n(score.value) : "–" }}
              <span>/ 100</span>
            </div>
            <p>
              {{ t("score.measured", { count: score.applicableChecks }) }}
              <span class="hero-dot">·</span>
              {{ t("wb.ov.notMeasured", { count: n(score.unavailable) }) }}
            </p>
          </div>
          <ScoreRing :value="score.available ? score.value : null" />
        </div>
        <div class="hero-stats">
          <div class="kpi">
            <strong>{{ n(score.errors) }}</strong
            ><span>{{ t("score.errorName") }}</span>
          </div>
          <div class="kpi">
            <strong>{{ n(score.warnings) }}</strong
            ><span>{{ t("score.warningName") }}</span>
          </div>
          <div class="kpi">
            <strong>{{ n(score.passed) }}</strong
            ><span>{{ t("score.passedName") }}</span>
          </div>
        </div>
      </section>

      <component :is="report ? 'section' : 'div'" :class="report ? 'card dash-issues' : ''">
        <div class="section-heading">
          <div>
            <h2>{{ report ? t("wb.ov.priority") : t("overview.fixNext") }}</h2>
          </div>
          <button
            v-if="!report || findings.length"
            type="button"
            class="subtle-btn"
            @click="go('issues')"
          >
            {{ t("wb.ov.findingsLink", { count: n(findings.length) }) }} →
          </button>
        </div>
        <div class="list">
          <DataRow
            v-for="check in findings.slice(0, 3)"
            :key="check.id"
            link
            :title="check.title"
            :sub="check.description"
            :tone="checkTone(check.status)"
            :badge="t(statusKey[check.status])"
            :badge-tone="badgeTone(check.status)"
            @open="go('issues', { check: check.id })"
          />
          <DataRow
            v-if="!findings.length"
            :title="t('empty.issuesTitle')"
            :sub="t('empty.issuesBody')"
          />
        </div>
      </component>

      <section v-if="report" class="card">
        <div class="section-heading">
          <div>
            <h2>{{ t("wb.ov.categories") }}</h2>
          </div>
        </div>
        <div class="category-grid">
          <div v-for="item in measured" :key="item.category" class="category-item">
            <div>
              <strong>{{ t(categoryLabelKey[item.category]) }}</strong>
              <span>{{ n(item.value ?? 0) }}</span>
            </div>
            <div class="track" aria-hidden="true">
              <span
                class="fill"
                :class="scoreTone(item.value)"
                :style="{ width: `${item.value}%` }"
              />
            </div>
          </div>
          <div v-for="item in unmeasured" :key="item.category" class="category-item">
            <div>
              <strong>{{ t(categoryLabelKey[item.category]) }}</strong>
              <span>{{ t("status.unavailable") }}</span>
            </div>
            <div class="track" aria-hidden="true" />
          </div>
        </div>
      </section>

      <template v-if="!report">
        <div class="section-heading">
          <div>
            <h2>{{ t("wb.ov.focus") }}</h2>
          </div>
          <button type="button" class="subtle-btn" @click="go('issues')">
            {{ t("overview.allCategories") }} →
          </button>
        </div>
        <div v-if="focus.length" class="focus-mini">
          <div v-for="item in focus" :key="item.category">
            <strong :class="`tone-${scoreTone(item.value)}`">{{ n(item.value ?? 0) }}</strong>
            <span>{{ t(categoryLabelKey[item.category]) }}</span>
          </div>
        </div>
        <p v-else class="hint">{{ t("wb.ov.noFocus") }}</p>
        <p class="hint">{{ t("wb.ov.disclaimer") }}</p>
      </template>
    </div>

    <div v-if="report" class="dashboard-secondary">
      <section class="card">
        <div class="section-heading">
          <div>
            <h2>{{ t("wb.ov.essentials") }}</h2>
          </div>
        </div>
        <div class="properties">
          <div class="property">
            <span>{{ t("wb.ov.pageTitle") }}</span>
            <strong>{{ meta.title || t("metadata.untitled") }}</strong>
          </div>
          <div class="property">
            <span>{{ t("popup.canonical") }}</span>
            <strong>{{ meta.canonicals.join(" · ") || t("value.none") }}</strong>
          </div>
          <div class="property">
            <span>{{ t("wb.ov.robots") }}</span>
            <strong>{{ meta.robots.join(", ") || t("technical.notDeclared") }}</strong>
          </div>
          <div class="property">
            <span>{{ t("wb.ov.language") }}</span>
            <strong>{{ meta.language || t("international.notDeclared") }}</strong>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div>
            <h2>{{ t("wb.ov.history") }}</h2>
          </div>
        </div>
        <div class="spark-tile">
          <div>
            <strong>{{ latestSaved == null ? "–" : n(latestSaved) }}</strong>
            <span>{{ t("wb.ov.latestSaved") }}</span>
          </div>
          <span class="badge gray">{{ t("wb.ov.savedCount", { count: n(saved.length) }) }}</span>
        </div>
        <TrendChart
          v-if="scored.length > 1"
          :values="scored.map((item) => item.comparison.score ?? 0)"
          :label="t('wb.ov.trendLabel')"
        />
        <p class="hint">
          {{ saved.length ? t("wb.ov.historyHint") : t("wb.ov.historyEmpty") }}
          <button type="button" class="subtle-btn" @click="go('reports')">
            {{ t("nav.history") }} →
          </button>
        </p>
      </section>

      <section class="card">
        <div class="section-heading">
          <div>
            <h2>{{ t("wb.ov.coverage") }}</h2>
          </div>
        </div>
        <div class="note-row">
          <CircleCheck class="ic" aria-hidden="true" />
          <span>{{ t("wb.ov.coverageAudit", { count: n(score.applicableChecks) }) }}</span>
        </div>
        <div class="note-row">
          <TriangleAlert class="ic" aria-hidden="true" />
          <span>{{ t("wb.ov.coverageFindings", { count: n(findings.length) }) }}</span>
        </div>
        <div class="note-row">
          <Clock class="ic" aria-hidden="true" />
          <span>{{ t("wb.ov.coverageHistory") }}</span>
        </div>
        <div v-for="item in audit.source.limitations" :key="item" class="note-row is-muted">
          <Info class="ic" aria-hidden="true" />
          <span>{{ limitationText(item, t) }}</span>
        </div>
        <p class="hint">{{ audit.score.disclaimer }}</p>
      </section>
    </div>
  </div>
</template>
