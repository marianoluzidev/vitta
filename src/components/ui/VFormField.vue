<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VFormField' });
</script>
<template>
  <div class="v-form-field">
    <label v-if="label" class="v-form-field__label">{{ label }}</label>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ label?: string }>();
</script>

<style scoped>
.v-form-field {
  margin-bottom: var(--ds-space-2, 16px);
}
.v-form-field:last-child {
  margin-bottom: 0;
}
.v-form-field__label {
  display: block;
  margin-bottom: var(--ds-space-1, 8px);
  font-size: var(--ds-font-title, 0.9375rem);
  font-weight: var(--ds-font-weight-body, 500);
  color: var(--f7-text-color, #000);
}
</style>
