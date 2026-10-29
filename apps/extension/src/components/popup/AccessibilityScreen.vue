<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { selectChecks } from "../../services/check-list";
import { useI18n } from "../../composables/useI18n";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ go: [id: string, check?: string] }>();
const { t, n } = useI18n();

const category = computed(
  () => props.audit.score.categories.find((item) => item.category === "accessibility") ?? null,
);
const measured = computed(() => Boolean(category.value?.available && category.value.value != null));
const checks = computed(() =>
  selectChecks(
    props.audit.checks.filter((check) => check.category === "accessibility"),
    { status: "all", sort: "severity" },
  ),
);
const review = computed(() =>
  checks.value.filter((check) => check.status === "ERROR" || check.status === "WARNING"),
);
const passed = computed(() => checks.value.filter((check) => check.status === "PASS"));
const notChecked = computed(
  () =>
    checks.value.filter(
      (check) => check.status === "UNAVAILABLE" || check.status === "NOT_APPLICABLE",
    ).length,
);
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.accessibility") }}</span
    ><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.accessibleFoundations") }}</h2>
    <span class="badge" :class="review.length ? 'warn' : 'ok'">{{
      review.length ? t("pm.reviewNeeded") : t("empty.issuesTitle")
    }}</span>
  </div>
  <section class="navy">
    <div class="pair" style="align-items: center">
      <div>
        <span class="tiny-label">{{ t("pm.sampledA11y") }}</span>
        <div class="metric-line" style="margin-top: 9px">
          <strong class="big nv-strong">{{ measured ? n(category?.value ?? 0) : "–" }}</strong>
          <span v-if="measured" class="nv-dim">/ 100</span>
        </div>
      </div>
      <div style="width: 85px">
        <div class="progress navy-track">
          <i
            :class="{ 'fill-amber': (category?.value ?? 0) < 90 }"
            :style="{ width: `${measured ? category?.value : 0}%` }"
          />
        </div>
        <p class="nv" style="font-size: 9px; text-align: right">
          {{ measured ? t("pm.measuredCategory") : t("status.unavailable") }}
        </p>
      </div>
    </div>
    <div class="stat-grid divide">
      <div class="stat-item">
        <strong class="nv-amber" style="font-size: 18px">{{ n(category?.warnings ?? 0) }}</strong
        ><span>{{ t("score.warningName") }}</span>
      </div>
      <div class="stat-item">
        <strong class="nv-green" style="font-size: 18px">{{ n(category?.passed ?? 0) }}</strong
        ><span>{{ t("score.passedName") }}</span>
      </div>
      <div class="stat-item">
        <strong style="font-size: 18px">{{ n(notChecked) }}</strong
        ><span>{{ t("technical.notChecked") }}</span>
      </div>
    </div>
  </section>

  <div class="title-row">
    <h2>{{ t("pm.areasToReview") }}</h2>
  </div>
  <button
    v-for="check in review"
    :key="check.id"
    type="button"
    class="row go"
    @click="emit('go', 'issues', check.id)"
  >
    <span class="mark" :class="{ error: check.status === 'ERROR' }" aria-hidden="true">!</span>
    <span class="row-content">
      <strong class="row-title">{{ check.title }}</strong>
      <span class="row-sub clamp1">{{ check.description }}</span>
    </span>
    <span class="row-side" aria-hidden="true">›</span>
  </button>
  <div v-for="check in passed" :key="check.id" class="row">
    <span class="mark green" aria-hidden="true">✓</span>
    <div class="row-content">
      <strong class="row-title">{{ check.title }}</strong>
      <p class="row-sub clamp1">{{ check.description }}</p>
    </div>
  </div>
  <p v-if="!checks.length" class="note">{{ t("status.unavailable") }}</p>
  <div class="title-row">
    <h2>{{ t("pm.whatThisMeans") }}</h2>
  </div>
  <p class="note">{{ t("pane.notWcag") }}</p>
</template>
