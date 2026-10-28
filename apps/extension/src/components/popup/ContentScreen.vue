<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();

const content = computed(() => props.audit.metrics.content);
const terms = computed(() => content.value.terms.unigrams.slice(0, 4));
const top = computed(() => Math.max(1, ...terms.value.map((term) => term.count)));
const findings = computed(() =>
  props.audit.checks.filter(
    (check) =>
      check.category === "content" && (check.status === "ERROR" || check.status === "WARNING"),
  ),
);
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.content") }}</span><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("content.profile") }}</h2>
    <span class="badge">{{ t("pm.observedText") }}</span>
  </div>
  <section class="navy">
    <div class="kicker">{{ t("pm.readableContent") }}</div>
    <div class="metric-line">
      <strong class="big nv-strong">{{
        content.wordCount == null ? "–" : n(content.wordCount)
      }}</strong>
      <span class="nv">{{ t("pm.words") }}</span>
    </div>
    <p class="nv" style="font-size: 10px; margin: 7px 0 0">{{ t("pm.contentSource") }}</p>
    <div class="stat-grid divide">
      <div class="stat-item">
        <strong style="font-size: 20px">{{
          compact.format(content.characterCount).toLowerCase()
        }}</strong
        ><span>{{ t("content.characters") }}</span>
      </div>
      <div class="stat-item">
        <strong style="font-size: 20px">{{
          content.readingTimeMinutes == null
            ? "–"
            : t("pm.minutes", { count: n(content.readingTimeMinutes) })
        }}</strong
        ><span>{{ t("pm.readTime") }}</span>
      </div>
      <div class="stat-item">
        <strong style="font-size: 20px">{{
          content.readabilityValue == null ? "–" : n(Math.round(content.readabilityValue))
        }}</strong
        ><span>{{ t("content.readability") }}</span>
      </div>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("content.terms") }}</h2>
    <span class="micro">{{ t("pm.topTerms") }}</span>
  </div>
  <div class="surface">
    <div class="pair" style="margin-bottom: 12px">
      <span class="row-title">{{ t("pm.termDistribution") }}</span>
      <span class="tiny-label">{{ t("pm.frequency") }}</span>
    </div>
    <div v-if="terms.length" style="display: grid; gap: 12px">
      <div v-for="term in terms" :key="term.term">
        <div class="pair">
          <span class="row-title">{{ term.term }}</span><span class="badge">{{ n(term.count) }}</span>
        </div>
        <div class="progress" style="margin-top: 7px">
          <i :style="{ width: `${Math.round((term.count / top) * 100)}%` }" />
        </div>
      </div>
    </div>
    <p v-else class="row-sub">{{ t("empty.termsBody") }}</p>
  </div>

  <div class="title-row"><h2>{{ t("pm.contentObservations") }}</h2></div>
  <div v-for="check in findings" :key="check.id" class="row">
    <span class="mark" :class="{ error: check.status === 'ERROR' }" aria-hidden="true">!</span>
    <div class="row-content">
      <strong class="row-title">{{ check.title }}</strong>
      <p class="row-sub">{{ check.description }}</p>
    </div>
  </div>
  <div v-if="content.wordCount" class="row">
    <span class="mark green" aria-hidden="true">✓</span>
    <div class="row-content">
      <strong class="row-title">{{ t("pm.bodyText") }}</strong>
      <p class="row-sub">{{ t("pm.bodyTextNote") }}</p>
    </div>
  </div>
  <div class="row">
    <span class="mark blue" aria-hidden="true">i</span>
    <div class="row-content">
      <strong class="row-title">{{ t("pm.noVolume") }}</strong>
      <p class="row-sub">{{ t("content.noVolume") }}</p>
    </div>
  </div>
</template>
