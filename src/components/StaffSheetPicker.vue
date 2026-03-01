<template>
  <f7-sheet class="staff-sheet-picker" :opened="opened" @sheet:closed="$emit('close')">
    <f7-page>
      <f7-navbar title="Elegir staff">
        <f7-nav-right>
          <f7-link @click="close">Cerrar</f7-link>
        </f7-nav-right>
      </f7-navbar>
      <f7-block class="sheet-search-block">
        <f7-searchbar
          v-model:value="searchQuery"
          placeholder="Buscar por nombre o apellido"
          :disable-button="false"
        />
      </f7-block>
      <f7-list v-if="filteredStaff.length > 0" strong inset>
        <f7-list-item
          v-for="s in filteredStaff"
          :key="s.id"
          :title="fullName(s)"
          link
          @click="select(s)"
        />
      </f7-list>
      <f7-block v-else-if="searchQuery.trim()" class="block-strong">
        <p class="text-color-gray">Ningún staff coincide.</p>
      </f7-block>
      <f7-block v-else class="block-strong">
        <p class="text-color-gray">Cargando...</p>
      </f7-block>
    </f7-page>
  </f7-sheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

defineOptions({ name: 'StaffSheetPicker' });

export interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  active?: boolean;
}

const props = defineProps<{
  opened: boolean;
  staffList: StaffOption[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', staff: StaffOption): void;
}>();

const searchQuery = ref('');

const filteredStaff = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const list = props.staffList ?? [];
  if (!q) return list;
  return list.filter((s) => {
    const first = (s.firstName ?? '').toLowerCase();
    const last = (s.lastName ?? '').toLowerCase();
    return first.includes(q) || last.includes(q);
  });
});

function fullName(s: StaffOption): string {
  return [s.firstName, s.lastName].filter(Boolean).join(' ') || 'Sin nombre';
}

function select(s: StaffOption): void {
  emit('select', s);
  close();
}

function close(): void {
  emit('close');
}

watch(() => props.opened, (v) => {
  if (!v) searchQuery.value = '';
});
</script>

<style scoped>
.sheet-search-block {
  padding: 0.5rem 1rem;
}
</style>
