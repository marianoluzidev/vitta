<template>
  <div class="vitta-color-picker">
    <Chrome
      :modelValue="internalColor"
      @update:modelValue="onColorChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Chrome } from '@ckpack/vue-color'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const internalColor = ref<any>({ hex: props.modelValue || '#08b8a4' })

// Watch for prop changes
watch(() => props.modelValue, (newValue) => {
  if (newValue && internalColor.value?.hex !== newValue) {
    internalColor.value = { hex: newValue }
  }
}, { immediate: true })

function onColorChange(value: any) {
  if (value && value.hex) {
    internalColor.value = value
    emit('update:modelValue', value.hex)
  }
}
</script>

<style scoped>
.vitta-color-picker {
  width: 100%;
  display: flex;
  justify-content: center;
}

.vitta-color-picker :deep(.vc-chrome) {
  width: 100%;
  font-family: inherit;
}

.vitta-color-picker :deep(.vc-chrome-active-color) {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.vitta-color-picker :deep(.vc-chrome-saturation-wrap) {
  height: 200px;
  border-radius: 6px;
  overflow: hidden;
}

.vitta-color-picker :deep(.vc-chrome-hue-wrap) {
  height: 12px;
  margin-top: 12px;
  border-radius: 6px;
  overflow: hidden;
}

.vitta-color-picker :deep(.vc-chrome-alpha-wrap) {
  height: 12px;
  margin-top: 12px;
  border-radius: 6px;
  overflow: hidden;
}

.vitta-color-picker :deep(.vc-chrome-fields) {
  margin-top: 12px;
}

.vitta-color-picker :deep(.vc-chrome-fields input) {
  font-size: 0.875rem;
  padding: 6px 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  background: var(--ion-background-color, #ffffff);
  color: var(--ion-text-color, #000000);
}

.vitta-color-picker :deep(.vc-chrome-toggle-btn) {
  width: 32px;
  height: 32px;
  border-radius: 4px;
}
</style>

