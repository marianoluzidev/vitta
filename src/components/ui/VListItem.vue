<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VListItem' });
</script>
<template>
  <div
    :class="['v-list-item', { 'v-list-item--clickable': clickable }]"
    @click="clickable ? $emit('click') : undefined"
  >
    <div class="v-list-item__main">
      <slot name="default">
        <span v-if="title" class="v-list-item__title">{{ title }}</span>
        <span v-if="subtitle" class="v-list-item__subtitle">{{ subtitle }}</span>
      </slot>
    </div>
    <div v-if="$slots.after" class="v-list-item__after">
      <slot name="after" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
  clickable?: boolean;
}>();
defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.v-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  gap: var(--ds-space-2, 16px);
  padding: var(--ds-space-1, 8px) 0;
}
.v-list-item--clickable {
  cursor: pointer;
}
.v-list-item__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.v-list-item__title {
  font-size: var(--ds-font-body, 1rem);
  font-weight: var(--ds-font-weight-body, 500);
  color: var(--f7-text-color, #000);
}
.v-list-item__subtitle {
  font-size: var(--ds-font-caption, 0.8125rem);
  opacity: 0.75;
  color: var(--f7-block-strong-text-color, #8e8e93);
}
.v-list-item__after {
  flex-shrink: 0;
  font-size: 0.875rem;
  color: var(--f7-theme-color, #007aff);
  opacity: 0.9;
}
</style>
