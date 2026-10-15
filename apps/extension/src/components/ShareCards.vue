<script setup lang="ts">
import { computed } from "vue";
import { sharePreviews } from "../services/share-preview";
import type { AuditResult } from "../types/audit";
import { useI18n } from "../composables/useI18n";
import SharePreviewCard from "./SharePreviewCard.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const previews = computed(() => sharePreviews(props.audit));
</script>

<template>
  <section class="space-y-6" aria-labelledby="share-cards-heading">
    <h2 id="share-cards-heading" class="sr-only">{{ t("social.preview") }}</h2>
    <p class="m-0 text-[12px] text-muted">{{ t("social.note") }}</p>
    <SharePreviewCard v-for="preview in previews" :key="preview.id" :preview="preview" />
  </section>
</template>
