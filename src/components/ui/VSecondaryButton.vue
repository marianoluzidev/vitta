<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VSecondaryButton' });
</script>
<template>
  <button
    type="button"
    class="v-secondary-btn"
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
}>();
defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.v-secondary-btn {
  padding: var(--ds-space-1, 8px) var(--ds-space-2, 16px);
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: var(--ds-input-radius, 8px);
  border: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  background: var(--f7-page-bg-color, #f2f2f7);
  color: var(--f7-text-color, #000);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.v-secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
