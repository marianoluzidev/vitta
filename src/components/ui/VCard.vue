<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VCard' });
</script>
<template>
  <div :class="['v-card', { 'v-card--error': error }]">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ error?: boolean }>();
</script>

<style scoped>
.v-card {
  background: var(--f7-block-strong-bg-color, #fff);
  border-radius: var(--ds-card-radius, 12px);
  padding: var(--ds-card-padding, 18px);
  margin-bottom: var(--ds-space-3, 24px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.v-card--error {
  background: rgba(255, 59, 48, 0.08);
}
</style>
