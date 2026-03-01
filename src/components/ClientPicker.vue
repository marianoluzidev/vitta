<template>
  <div class="client-picker">
    <f7-list-item title="Cliente" group-title />

    <!-- Estado: cliente seleccionado -->
    <template v-if="selectedClient">
      <f7-block class="client-picker-selected" strong inset>
        <p class="client-picker-label">Cliente seleccionado</p>
        <p class="client-picker-summary">{{ clientSummary(selectedClient) }}</p>
        <p v-if="selectedClient.dni" class="client-picker-meta">DNI {{ selectedClient.dni }}</p>
        <p v-if="selectedClient.phone || selectedClient.email" class="client-picker-meta">
          {{ [selectedClient.phone, selectedClient.email].filter(Boolean).join(' · ') }}
        </p>
        <div class="client-picker-actions">
          <f7-button small @click="showSearch">Cambiar</f7-button>
        </div>
      </f7-block>
    </template>

    <!-- Estado: buscador -->
    <template v-else>
      <f7-block strong inset>
        <f7-list-input
          label="Buscar cliente"
          type="text"
          placeholder="Apellido, nombre, DNI, teléfono o email"
          :value="searchQuery"
          @input="onSearchInput"
          clear-button
        />
        <f7-button class="client-picker-new-btn" small fill @click="openCreatePopup">Agregar cliente nuevo</f7-button>
      </f7-block>

      <!-- Resultados (máx 10) -->
      <f7-list v-if="searchResults.length > 0" strong inset class="client-picker-results">
        <f7-list-item
          v-for="c in searchResults"
          :key="c.id"
          :title="displayName(c)"
          link
          @click="selectClient(c)"
        >
          <template #after>
            <span v-if="c.dni" class="client-picker-dni">{{ c.dni }}</span>
          </template>
        </f7-list-item>
      </f7-list>
      <f7-block v-else-if="searchQuery.trim() && !loadingClients" class="block-strong">
        <p class="text-color-gray">Ningún cliente coincide.</p>
      </f7-block>
    </template>

    <!-- Popup: crear cliente -->
    <f7-popup class="client-create-popup" :opened="createPopupOpen" @popup:closed="createPopupOpen = false">
      <f7-page>
        <f7-navbar title="Nuevo cliente">
          <f7-nav-left>
            <f7-link @click="closeCreatePopup">Cerrar</f7-link>
          </f7-nav-left>
        </f7-navbar>
        <f7-block strong inset>
          <f7-block v-if="createDuplicateDni" class="client-picker-error-block">
            <p class="client-picker-error">Ya existe un cliente con ese DNI.</p>
            <f7-button small fill @click="selectExistingByDni">Seleccionar ese cliente</f7-button>
          </f7-block>
          <f7-list form>
            <f7-list-input label="DNI" type="text" placeholder="Requerido" v-model:value="createForm.dni" clear-button />
            <f7-list-input label="Nombre" type="text" placeholder="Requerido" v-model:value="createForm.firstName" clear-button />
            <f7-list-input label="Apellido" type="text" placeholder="Requerido" v-model:value="createForm.lastName" clear-button />
            <f7-list-input label="Teléfono" type="tel" v-model:value="createForm.phone" clear-button />
            <f7-list-input label="Email" type="email" v-model:value="createForm.email" clear-button />
          </f7-list>
          <f7-button v-if="!createDuplicateDni" fill :disabled="createSaving || !canCreateClient" @click="submitCreateClient">Guardar y seleccionar</f7-button>
        </f7-block>
      </f7-page>
    </f7-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

defineOptions({ name: 'ClientPicker' });
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';

export interface ClientOption {
  id: string;
  dni?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

const props = defineProps<{
  tenantId: string;
}>();

function tenantIdStr(): string {
  const t = props.tenantId;
  return Array.isArray(t) ? (t[0] ?? '') : String(t ?? '');
}

const emit = defineEmits<{
  (e: 'select', client: ClientOption | null): void;
}>();

const MAX_RESULTS = 10;
const DEBOUNCE_MS = 280;
const CLIENTS_LIMIT = 500;

const selectedClient = ref<ClientOption | null>(null);
const searchQuery = ref('');
const searchQueryDebounced = ref('');
const clientsAll = ref<ClientOption[]>([]);
const loadingClients = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const createPopupOpen = ref(false);
const createForm = ref({
  dni: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
});
const createSaving = ref(false);
const createDuplicateDni = ref(false);
const duplicateClient = ref<ClientOption | null>(null);

function displayName(c: ClientOption): string {
  const last = (c.lastName ?? '').trim();
  const first = (c.firstName ?? '').trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  return 'Sin nombre';
}

function clientSummary(c: ClientOption): string {
  const parts = [(c.firstName ?? '').trim(), (c.lastName ?? '').trim()].filter(Boolean);
  return parts.join(' ') || 'Sin nombre';
}

const searchResults = computed(() => {
  const q = searchQueryDebounced.value.trim().toLowerCase();
  if (!q) return [];
  const list = clientsAll.value;
  const filtered = list.filter((c) => {
    const first = (c.firstName ?? '').toLowerCase();
    const last = (c.lastName ?? '').toLowerCase();
    const dni = (c.dni ?? '').toLowerCase();
    const phone = (c.phone ?? '').toLowerCase();
    const email = (c.email ?? '').toLowerCase();
    return first.includes(q) || last.includes(q) || dni.includes(q) || phone.includes(q) || email.includes(q);
  });
  return filtered.slice(0, MAX_RESULTS);
});

const canCreateClient = computed(() => {
  const d = createForm.value.dni.trim();
  const first = createForm.value.firstName.trim();
  const last = createForm.value.lastName.trim();
  return d.length > 0 && (first.length > 0 || last.length > 0);
});

function onSearchInput(e: Event): void {
  const v = (e.target as HTMLInputElement).value ?? '';
  searchQuery.value = v;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchQueryDebounced.value = v;
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

function selectClient(c: ClientOption): void {
  selectedClient.value = { id: c.id, dni: c.dni, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email };
  searchQuery.value = '';
  searchQueryDebounced.value = '';
  emit('select', selectedClient.value);
}

function showSearch(): void {
  selectedClient.value = null;
  emit('select', null);
}

function openCreatePopup(): void {
  createForm.value = { dni: '', firstName: '', lastName: '', phone: '', email: '' };
  createDuplicateDni.value = false;
  duplicateClient.value = null;
  createPopupOpen.value = true;
}

function closeCreatePopup(): void {
  createPopupOpen.value = false;
}

async function checkDniExists(dni: string): Promise<ClientOption | null> {
  const tid = tenantIdStr();
  if (!tid || !dni.trim()) return null;
  const db = getDbInstance();
  const q = query(collection(db, 'tenants', tid, 'clients'), where('dni', '==', dni.trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    dni: data.dni,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: data.email,
  };
}

async function submitCreateClient(): Promise<void> {
  const tid = tenantIdStr();
  if (!tid || createSaving.value || !canCreateClient.value) return;
  const dni = createForm.value.dni.trim();
  createDuplicateDni.value = false;
  duplicateClient.value = null;
  const existing = await checkDniExists(dni);
  if (existing) {
    createDuplicateDni.value = true;
    duplicateClient.value = existing;
    return;
  }
  createSaving.value = true;
  try {
    const db = getDbInstance();
    const ref = collection(db, 'tenants', tid, 'clients');
    const docRef = await addDoc(ref, {
      dni: createForm.value.dni.trim(),
      firstName: createForm.value.firstName.trim(),
      lastName: createForm.value.lastName.trim(),
      phone: createForm.value.phone.trim(),
      email: createForm.value.email.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const newClient: ClientOption = {
      id: docRef.id,
      dni: createForm.value.dni.trim(),
      firstName: createForm.value.firstName.trim(),
      lastName: createForm.value.lastName.trim(),
      phone: createForm.value.phone.trim(),
      email: createForm.value.email.trim(),
    };
    clientsAll.value = [...clientsAll.value, newClient];
    selectedClient.value = newClient;
    closeCreatePopup();
    emit('select', newClient);
  } catch (e) {
    console.error('Error creating client:', e);
  } finally {
    createSaving.value = false;
  }
}

function selectExistingByDni(): void {
  const c = duplicateClient.value;
  if (c) {
    selectedClient.value = c;
    closeCreatePopup();
    emit('select', c);
  }
}

async function loadClients(): Promise<void> {
  const tid = tenantIdStr();
  if (!tid) return;
  loadingClients.value = true;
  try {
    const db = getDbInstance();
    const snap = await getDocs(collection(db, 'tenants', tid, 'clients'));
    clientsAll.value = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ClientOption[];
  } catch (e) {
    console.error('Error loading clients:', e);
    clientsAll.value = [];
  } finally {
    loadingClients.value = false;
  }
}

onMounted(() => loadClients());
watch(() => tenantIdStr(), loadClients);

defineExpose({ showSearch, setSelected: (c: ClientOption | null) => { selectedClient.value = c; } });
</script>

<style scoped>
.client-picker-selected {
  margin-top: 0;
}
.client-picker-label {
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}
.client-picker-summary {
  margin: 0;
  font-size: 1rem;
}
.client-picker-meta {
  margin: 0.2rem 0 0 0;
  font-size: 0.9rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.client-picker-actions {
  margin-top: 0.75rem;
}
.client-picker-new-btn {
  margin-top: 0.5rem;
}
.client-picker-results .list-item {
  cursor: pointer;
}
.client-picker-dni {
  font-size: 0.85rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.client-picker-error-block {
  margin-bottom: 0.5rem;
}
.client-picker-error {
  margin: 0 0 0.5rem 0;
  color: var(--f7-color-red);
  font-size: 0.95rem;
}
</style>
