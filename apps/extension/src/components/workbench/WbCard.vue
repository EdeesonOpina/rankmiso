<script setup lang="ts">
import { useWorkbench } from "./context";

/** A report card. With `flat`, the sidebar shows the same content without the card frame. */
defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ title?: string; flat?: boolean }>(), { title: "", flat: false });
const { surface } = useWorkbench();
</script>

<template>
  <section v-if="!(flat && surface === 'sidebar')" class="card" v-bind="$attrs">
    <div v-if="title || $slots.action" class="section-heading">
      <div>
        <h2>{{ title }}</h2>
      </div>
      <slot name="action" />
    </div>
    <slot />
  </section>
  <template v-else>
    <div v-if="title || $slots.action" class="section-heading">
      <div>
        <h2>{{ title }}</h2>
      </div>
      <slot name="action" />
    </div>
    <slot />
  </template>
</template>
