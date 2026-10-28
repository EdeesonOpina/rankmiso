<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "../composables/useI18n";
import { resolveShareImage } from "../services/share-preview";
import CopyButton from "./CopyButton.vue";

const props = defineProps<{ src: string | null; alt: string }>();
const { t } = useI18n();
const failed = ref(false);
const href = computed(() => (props.src ? resolveShareImage(props.src, props.src) : null));

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <figure class="inspector-row m-0">
    <div class="inspector-thumb grid place-items-center">
      <img
        v-if="src && !failed"
        :src="src"
        :alt="alt"
        class="h-full w-full object-cover"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="failed = true"
      />
      <p v-else class="m-0 px-1 text-center text-[11px] leading-snug text-muted">
        {{ failed ? t("social.imageFailed") : t("social.noImage") }}
      </p>
    </div>
    <figcaption class="m-0 flex min-w-0 flex-1 items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="m-0 truncate text-[13px] font-semibold leading-relaxed" :title="alt">{{ alt }}</p>
        <a
          v-if="href"
          :href="href"
          target="_blank"
          rel="noopener noreferrer"
          class="mb-0 mt-2 block truncate text-[12px] leading-relaxed underline"
          :title="href"
        >
          {{ href }}
        </a>
        <p
          v-else-if="src"
          class="mb-0 mt-2 truncate text-[12px] leading-relaxed text-muted"
          :title="src"
        >
          {{ src }}
        </p>
      </div>
      <CopyButton v-if="src" :value="src" />
    </figcaption>
  </figure>
</template>
