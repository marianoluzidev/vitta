<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VBadge' });
</script>
<template>
  <span :class="['v-badge', `v-badge--${variant}`]">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'default' | 'success' | 'danger' | 'warning' }>(),
  { variant: 'default' }
);
</script>

<style scoped>
.v-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
}
.v-badge--default {
  background: var(--f7-list-item-border-color, #e5e5ea);
  color: var(--f7-text-color, #000);
}
.v-badge--success {
  background: rgba(52, 199, 89, 0.2);
  color: var(--f7-color-green, #34c759);
}
.v-badge--danger {
  background: rgba(255, 59, 48, 0.15);
  color: var(--f7-color-red, #ff3b30);
}
.v-badge--warning {
  background: rgba(255, 204, 0, 0.2);
  color: var(--f7-color-orange, #ff9500);
}
</style>
