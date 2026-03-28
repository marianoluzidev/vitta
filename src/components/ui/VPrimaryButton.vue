<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VPrimaryButton' });
</script>
<template>
  <button
    type="button"
    :class="['v-primary-btn', { 'v-primary-btn--full': fullWidth }]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  label?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}>();
defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.v-primary-btn {
  padding: 16px 24px;
  font-size: 1.0625rem;
  font-weight: 600;
  border-radius: var(--ds-btn-radius, 14px);
  border: none;
  background: var(--f7-theme-color, #007aff);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.2s;
}
.v-primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.v-primary-btn--full {
  width: 100%;
}
</style>
