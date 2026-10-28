<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";
import DataRow from "./DataRow.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { surface } = useWorkbench();
const report = surface === "report";
const content = computed(() => props.audit.metrics.content);
const terms = computed(() => content.value.terms.unigrams.slice(0, report ? 10 : 6));
const max = computed(() => Math.max(1, ...content.value.terms.unigrams.map((term) => term.count)));

function termNote(term: (typeof terms.value)[number]): string {
  const parts = [t("wb.ct.mentions", { count: n(term.count) })];
  if (term.density != null) parts.push(`${n(Math.round(term.density * 1000) / 10)}%`);
  if (term.inTitle) parts.push(t("wb.ct.inTitle"));
  return parts.join(" · ");
}
</script>

<template>
  <PageHeading :overline="t('wb.ct.overline')" :title="t('wb.ct.title')" :text="t('wb.ct.text')" />
  <div class="content-kpis">
    <div class="kpi">
      <strong>{{ content.wordCount == null ? "–" : n(content.wordCount) }}</strong
      ><span>{{ t("field.words") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(content.characterCount) }}</strong
      ><span>{{ t("field.characters") }}</span>
    </div>
    <div class="kpi">
      <strong>{{
        content.readingTimeMinutes == null
          ? "–"
          : t("wb.ct.minutes", { count: n(content.readingTimeMinutes) })
      }}</strong>
      <span>{{ t("field.readingTime") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ content.readabilityValue == null ? "–" : n(content.readabilityValue) }}</strong>
      <span>{{ t("field.readability") }}</span>
    </div>
  </div>
  <div :class="report ? 'content-split' : ''">
    <WbCard :title="t('content.repeatedTerms')" flat>
      <p v-if="!terms.length" class="hint">{{ t("empty.termsBody") }}</p>
      <div v-for="term in terms" :key="term.term" class="term-row">
        <div>
          <strong :title="term.term">{{ term.term }}</strong>
          <span>{{ termNote(term) }}</span>
        </div>
        <div class="track" aria-hidden="true">
          <span class="fill good" :style="{ width: `${(term.count / max) * 100}%` }" />
        </div>
      </div>
    </WbCard>
    <WbCard :title="t('wb.ct.observations')" flat>
      <div v-if="report" class="insight-block">
        <strong>{{ t("wb.ct.whatTitle") }}</strong>
        <p>{{ t("wb.ct.whatText") }}</p>
      </div>
      <DataRow
        :title="t('wb.ct.body')"
        :sub="
          content.wordCount == null
            ? t('value.unavailable')
            : t('wb.ct.bodySub', { count: n(content.wordCount) })
        "
        :tone="content.wordCount ? 'good' : 'gray'"
        :badge="content.wordCount == null ? t('status.unavailable') : t('wb.measured')"
        :badge-tone="content.wordCount == null ? 'gray' : 'ok'"
      />
      <DataRow
        :title="t('wb.ct.readability')"
        :sub="
          content.readabilityValue == null ? t('value.notCalculated') : t('wb.ct.readabilitySub')
        "
        :tone="content.readabilityValue == null ? 'gray' : 'warn'"
        :badge="content.readabilityValue == null ? t('value.notCalculated') : t('wb.approximate')"
        badge-tone="gray"
      />
      <p class="hint">{{ content.wordCountMethod }}. {{ content.readingTimeBasis }}</p>
    </WbCard>
  </div>
  <RelatedChecks :audit="audit" category="content" />
</template>
