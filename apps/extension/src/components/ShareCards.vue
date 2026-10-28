<script setup lang="ts">
import { computed } from "vue";
import { Info } from "lucide-vue-next";
import { sharePreviews } from "../services/share-preview";
import type { AuditResult } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import SharePreviewCard from "./SharePreviewCard.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const previews = computed(() => sharePreviews(props.audit));
</script>

<template>
  <section class="stack" aria-labelledby="share-cards-heading">
    <h2 id="share-cards-heading" class="sr-only">{{ t("social.preview") }}</h2>
    <ul class="social-facts">
      <li v-for="preview in previews" :key="preview.id">
        <span>{{ preview.id === "openGraph" ? "Facebook" : "X" }}</span>
        <span>{{ preview.title || t("metadata.untitled") }}</span>
        <span>{{ preview.titleFrom }}</span>
      </li>
    </ul>
    <div class="report-callout">
      <Info class="report-callout-icon h-4 w-4" aria-hidden="true" />
      <p class="report-copy">{{ t("social.note") }}</p>
    </div>
    <div class="social-stage">
      <SharePreviewCard v-for="preview in previews" :key="preview.id" :preview="preview" />
    </div>
  </section>
</template>
