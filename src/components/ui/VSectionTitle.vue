<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VSectionTitle' });
</script>
<template>
  <component :is="tag" class="v-section-title">
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ tag?: 'h1' | 'h2' | 'h3' }>(),
  { tag: 'h2' }
);
</script>

<style scoped>
.v-section-title {
  margin: 0 0 var(--ds-space-2, 16px);
  font-size: var(--ds-font-title, 0.9375rem);
  font-weight: var(--ds-font-weight-title, 600);
  color: var(--f7-block-title-color, var(--vitta-text, #7C6A5A));
  letter-spacing: 0.01em;
}
</style>
