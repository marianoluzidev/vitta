<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'BookingExtensionTimeline' });
</script>
<template>
  <div class="extension-timeline">
    <div class="extension-timeline__bar" :style="barStyle">
      <div class="extension-timeline__seg extension-timeline__seg--booking" :style="seg1Style" title="Turno actual" />
      <div class="extension-timeline__seg extension-timeline__seg--free" :style="seg2Style" title="Extensión" />
      <div class="extension-timeline__seg extension-timeline__seg--next" :style="seg3Style" title="Próximo bloqueo" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { parseTime } from '../services/slotEngine';

const props = withDefaults(
  defineProps<{
    startTime: string;
    currentEndTime: string;
    selectedEndTime: string;
    maxEndTime: string;
  }>(),
  {}
);

const startMin = computed(() => parseTime(props.startTime));
const currentEndMin = computed(() => parseTime(props.currentEndTime));
const selectedEndMin = computed(() => parseTime(props.selectedEndTime));
const maxEndMin = computed(() => parseTime(props.maxEndTime));

const totalRangeMin = computed(() => {
  const end = Math.max(maxEndMin.value, selectedEndMin.value) + 60;
  return Math.max(60, end - startMin.value);
});

const seg1Width = computed(() => {
  const w = currentEndMin.value - startMin.value;
  return Math.max(0, (w / totalRangeMin.value) * 100);
});
const seg2Width = computed(() => {
  const w = selectedEndMin.value - currentEndMin.value;
  return Math.max(0, (w / totalRangeMin.value) * 100);
});
const seg3Width = computed(() => {
  const rest = 100 - seg1Width.value - seg2Width.value;
  return Math.max(0, rest);
});

const barStyle = computed(() => ({}));

const seg1Style = computed(() => ({ width: `${seg1Width.value}%` }));
const seg2Style = computed(() => ({ width: `${seg2Width.value}%` }));
const seg3Style = computed(() => ({ width: `${seg3Width.value}%` }));
</script>

<style scoped>
.extension-timeline {
  width: 100%;
  margin: 0.75rem 0;
}
.extension-timeline__bar {
  display: flex;
  height: 28px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--vitta-divider, #e0d3c9);
}
.extension-timeline__seg {
  flex-shrink: 0;
  min-width: 2px;
  transition: width 0.15s ease;
}
.extension-timeline__seg--booking {
  background: var(--vitta-text, #7c6a5a);
}
.extension-timeline__seg--free {
  background: var(--vitta-accent, #b3c9b6);
}
.extension-timeline__seg--next {
  background: var(--vitta-surface, #f0e2d6);
  border-left: 1px solid var(--vitta-divider, #e0d3c9);
}
</style>
