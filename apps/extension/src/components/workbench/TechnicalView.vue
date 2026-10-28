<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import { supportsOptionalExternalChecks } from "../../config/features.config";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";
import DataRow from "./DataRow.vue";
import HtmlCompareCard from "./HtmlCompareCard.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { surface, probing, probeMessage, runSiteProbe } = useWorkbench();
const report = surface === "report";
const probeKind = ref<"site" | "more" | null>(null);
const meta = computed(() => props.audit.details.metadata);
const response = computed(() => props.audit.details.response);
const probe = computed(() => props.audit.details.site ?? null);
const category = computed(
  () => props.audit.score.categories.find((item) => item.category === "technical") ?? null,
);
const xRobots = computed(() => {
  if (!response.value.headersAvailable) return null;
  return (
    response.value.headers.find((header) => header.name.toLowerCase() === "x-robots-tag")?.value ||
    t("technical.notDeclared")
  );
});
const canonicals = computed(() => meta.value.canonicals);

async function startProbe(more = false) {
  if (!supportsOptionalExternalChecks) return;
  probeKind.value = more ? "more" : "site";
  try {
    await runSiteProbe(more);
  } finally {
    probeKind.value = null;
  }
}

function robotsLine(): string {
  const status = probe.value?.robotsStatus;
  if (status === 404) return t("technical.notFound");
  if (status == null) return t("technical.notAvailable");
  return t("technical.httpStatus", { status });
}

function sitemapLine(): string {
  const site = probe.value;
  if (!site) return "";
  if (site.sitemapUrls.length) return t("technical.sitemapUrl", { url: site.sitemapUrls[0] ?? "" });
  if (site.robotsStatus === 404) return t("technical.robotsMissingForSitemap");
  if (site.robotsStatus == null) return t("technical.notDetermined");
  return t("technical.sitemapNone");
}
</script>

<template>
  <PageHeading :overline="t('wb.te.overline')" :title="t('wb.te.title')" :text="t('wb.te.text')" />
  <div class="tech-grid">
    <WbCard :title="t('technical.indexTitle')" flat>
      <DataRow
        :title="t('wb.te.metaRobots')"
        :sub="meta.robots.join(', ') || t('technical.notDeclared')"
        :tone="meta.robots.length ? 'good' : 'gray'"
        :badge="meta.robots.length ? t('wb.observed') : t('technical.notDeclared')"
        :badge-tone="meta.robots.length ? 'ok' : 'gray'"
      />
      <DataRow
        :title="t('field.canonical')"
        :sub="canonicals.join(' · ') || t('technical.notDeclared')"
        :tone="canonicals.length === 1 ? 'good' : 'warn'"
        :badge="
          canonicals.length === 0
            ? t('wb.missing')
            : canonicals.length > 1
              ? t('wb.te.multiple', { count: n(canonicals.length) })
              : t('wb.present')
        "
        :badge-tone="canonicals.length === 1 ? 'ok' : 'warn'"
      />
      <DataRow
        title="Googlebot"
        :sub="meta.googlebot.join(', ') || t('technical.notDeclared')"
        tone="gray"
        :badge="meta.googlebot.length ? t('wb.observed') : t('technical.notDeclared')"
        :badge-tone="meta.googlebot.length ? 'ok' : 'gray'"
      />
      <DataRow
        title="Bingbot"
        :sub="meta.bingbot.join(', ') || t('technical.notDeclared')"
        tone="gray"
        :badge="meta.bingbot.length ? t('wb.observed') : t('technical.notDeclared')"
        :badge-tone="meta.bingbot.length ? 'ok' : 'gray'"
      />
      <DataRow
        :title="t('technical.xRobots')"
        :sub="xRobots ?? t('technical.notChecked')"
        :tone="xRobots ? 'good' : 'gray'"
        :badge="xRobots ? t('wb.observed') : t('status.unavailable')"
        :badge-tone="xRobots ? 'ok' : 'gray'"
      />
      <DataRow
        :title="t('technical.googleIndex')"
        :sub="t('technical.unknown')"
        tone="gray"
        :badge="t('technical.unknown')"
      />
    </WbCard>

    <HtmlCompareCard :audit="audit" :network="supportsOptionalExternalChecks" />

    <WbCard :title="t('wb.te.redirects')" flat>
      <div class="step-row">
        <b>1</b> {{ t("wb.te.response") }}
        <small>{{ response.status ?? t("value.notExposed") }}</small>
      </div>
      <div class="step-row">
        <b>2</b> {{ t("field.redirects") }}
        <small>{{
          response.redirectCount == null ? t("value.notExposed") : n(response.redirectCount)
        }}</small>
      </div>
      <div v-for="(hop, index) in probe?.redirectHops ?? []" :key="hop" class="step-row">
        <b>{{ index + 3 }}</b> <span class="url-line">{{ hop }}</span>
      </div>
      <div class="step-row">
        <b>{{ (probe?.redirectHops.length ?? 0) + 3 }}</b> {{ t("wb.te.final") }}
        <small class="url-line">{{ audit.page.url }}</small>
      </div>
      <div class="properties">
        <div class="property">
          <span>{{ t("field.contentType") }}</span
          ><strong>{{ response.contentType || t("value.unknown") }}</strong>
        </div>
        <div class="property">
          <span>{{ t("technical.metaRefresh") }}</span
          ><strong>{{ meta.refresh || t("technical.noRefresh") }}</strong>
        </div>
      </div>
    </WbCard>
  </div>

  <WbCard :title="t('wb.te.siteCheck')" :class="{ 'tech-wide': report }">
    <template #action>
      <span v-if="category" class="badge gray">
        {{
          t("wb.te.score", {
            score: category.available && category.value != null ? n(category.value) : "–",
          })
        }}
      </span>
    </template>
    <p class="hint first">{{ t("technical.resultsNote") }}</p>
    <div v-if="supportsOptionalExternalChecks" class="actions-row">
      <button
        type="button"
        class="quiet"
        :disabled="probing"
        :aria-busy="probing && probeKind === 'site'"
        @click="startProbe()"
      >
        {{ t("technical.siteCheck") }}
      </button>
      <button
        v-if="(probe?.linksTotal ?? 0) > (probe?.linksChecked ?? 0)"
        type="button"
        class="quiet"
        :disabled="probing"
        :aria-busy="probing && probeKind === 'more'"
        @click="startProbe(true)"
      >
        {{ t("technical.siteMore") }}
      </button>
    </div>
    <p v-else class="hint" role="note">{{ t("technical.firefoxChecksDisabled") }}</p>
    <p v-if="probing" class="hint" role="status">
      {{
        probeMessage ||
        (probeKind === "more" ? t("technical.siteCheckingMore") : t("technical.siteChecking"))
      }}
    </p>
    <p v-else-if="probeMessage" class="hint" role="status">{{ probeMessage }}</p>
    <template v-if="probe?.requested">
      <div class="properties">
        <div class="property">
          <span>{{ t("technical.robots") }}</span
          ><strong>{{ robotsLine() }}</strong>
          <details v-if="probe.robotsBody" class="disclosure">
            <summary>{{ t("technical.viewRobots") }}<span aria-hidden="true">⌄</span></summary>
            <pre class="raw-code">{{ probe.robotsBody.slice(0, 6000) }}</pre>
            <p v-if="probe.robotsBody.length > 6000" class="hint">
              {{ t("technical.robotsTruncated") }}
            </p>
          </details>
        </div>
        <div class="property">
          <span>{{ t("technical.sitemap") }}</span
          ><strong>{{ sitemapLine() }}</strong>
          <small v-if="probe.sitemapStatus != null">
            {{ t("technical.httpStatus", { status: probe.sitemapStatus }) }}
            <template v-if="probe.sitemapUrlCount != null">
              · {{ t("technical.sitemapEntries", { count: n(probe.sitemapUrlCount) }) }}
            </template>
          </small>
          <small v-if="probe.sitemapContainsPage != null">
            {{
              probe.sitemapContainsPage
                ? t("technical.sitemapContains")
                : t("technical.sitemapNotContains")
            }}
          </small>
        </div>
        <div class="property">
          <span>{{ t("technical.linkResults") }}</span>
          <strong>
            {{
              probe.linksTotal === 0
                ? t("technical.noPublicLinks")
                : t("technical.linkCounts", {
                    checked: n(probe.linksChecked),
                    total: n(probe.linksTotal),
                  })
            }}
          </strong>
          <small v-if="probe.linksChecked">
            {{
              t("technical.linkOutcomes", {
                broken: n(probe.linksBroken),
                unreachable: n(probe.linksUnreachable),
                blocked: n(probe.linksBlocked),
              })
            }}
          </small>
        </div>
        <div class="property">
          <span>{{ t("technical.hreflang") }}</span>
          <strong>
            {{
              probe.hreflangChecked || probe.hreflangSkipped
                ? t("technical.hreflangCounts", {
                    checked: n(probe.hreflangChecked),
                    missing: n(probe.hreflangMissing),
                    skipped: n(probe.hreflangSkipped ?? 0),
                  })
                : t("technical.noAlternates")
            }}
          </strong>
        </div>
      </div>
      <details class="disclosure">
        <summary>{{ t("technical.headers") }}<span aria-hidden="true">⌄</span></summary>
        <div class="details-body">
          <dl v-if="response.headersAvailable" class="evidence">
            <div v-for="header in response.headers" :key="header.name">
              <dt>{{ header.name }}</dt>
              <dd>{{ header.value }}</dd>
            </div>
          </dl>
          <p v-else>{{ t("technical.noHeaders") }}</p>
        </div>
      </details>
      <p v-for="note in probe.notes" :key="note" class="hint">{{ note }}</p>
    </template>
  </WbCard>
  <RelatedChecks :audit="audit" category="technical" />
</template>
