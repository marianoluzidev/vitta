<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'VFixedFooter' });
</script>
<template>
  <div class="v-fixed-footer">
    <slot />
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.v-fixed-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--ds-space-2, 16px);
  background: var(--f7-page-bg-color, #f2f2f7);
  padding-bottom: calc(var(--ds-space-2, 16px) + env(safe-area-inset-bottom, 0px));
}
</style>
