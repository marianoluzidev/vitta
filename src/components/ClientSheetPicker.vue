<template>
  <f7-sheet class="client-sheet-picker" :opened="opened" @sheet:closed="$emit('close')">
    <f7-page>
      <f7-navbar title="Elegir cliente">
        <f7-nav-right>
          <f7-link @click="close">Cerrar</f7-link>
        </f7-nav-right>
      </f7-navbar>
      <f7-block class="sheet-search-block">
        <f7-searchbar
          v-model:value="searchQuery"
          placeholder="Buscar por nombre, apellido, DNI, teléfono o email"
          :disable-button="false"
        />
        <f7-button class="sheet-new-btn" small fill @click="openCreatePopup">Agregar cliente nuevo</f7-button>
      </f7-block>
      <f7-list v-if="filteredClients.length > 0" strong inset>
        <f7-list-item
          v-for="c in filteredClients"
          :key="c.id"
          :title="displayName(c)"
          link
          @click="select(c)"
        >
          <template #after>
            <span v-if="c.dni" class="client-sheet-dni">{{ c.dni }}</span>
          </template>
        </f7-list-item>
      </f7-list>
      <f7-block v-else-if="searchQuery.trim() && !loadingClients" class="block-strong">
        <p class="text-color-gray">Ningún cliente coincide.</p>
      </f7-block>
      <f7-block v-else-if="!loadingClients" class="block-strong">
        <p class="text-color-gray">No hay clientes. Agregá uno con el botón de arriba.</p>
      </f7-block>
      <f7-block v-else class="block-strong">
        <p class="text-color-gray">Cargando...</p>
      </f7-block>
    </f7-page>
  </f7-sheet>

  <!-- Popup: crear cliente -->
  <f7-popup class="client-create-popup" :opened="createPopupOpen" @popup:closed="createPopupOpen = false">
    <f7-page>
      <f7-navbar title="Nuevo cliente">
        <f7-nav-left>
          <f7-link @click="closeCreatePopup">Cerrar</f7-link>
        </f7-nav-left>
      </f7-navbar>
      <f7-block strong inset>
        <f7-block v-if="createDuplicateDni" class="client-sheet-error-block">
          <p class="client-sheet-error">Ya existe un cliente con ese DNI.</p>
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';

defineOptions({ name: 'ClientSheetPicker' });

export interface ClientOption {
  id: string;
  dni?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

const MAX_RESULTS = 15;

const props = defineProps<{
  opened: boolean;
  tenantId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', client: ClientOption): void;
}>();

function tenantIdStr(): string {
  const t = props.tenantId;
  return Array.isArray(t) ? (t[0] ?? '') : String(t ?? '');
}

const searchQuery = ref('');
const clientsAll = ref<ClientOption[]>([]);
const loadingClients = ref(false);

const createPopupOpen = ref(false);
const createForm = ref({ dni: '', firstName: '', lastName: '', phone: '', email: '' });
const createSaving = ref(false);
const createDuplicateDni = ref(false);
const duplicateClient = ref<ClientOption | null>(null);

const filteredClients = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const list = clientsAll.value;
  if (!q) return list.slice(0, MAX_RESULTS);
  return list.filter((c) => {
    const first = (c.firstName ?? '').toLowerCase();
    const last = (c.lastName ?? '').toLowerCase();
    const dni = (c.dni ?? '').toLowerCase();
    const phone = (c.phone ?? '').toLowerCase();
    const email = (c.email ?? '').toLowerCase();
    return first.includes(q) || last.includes(q) || dni.includes(q) || phone.includes(q) || email.includes(q);
  }).slice(0, MAX_RESULTS);
});

const canCreateClient = computed(() => {
  const d = createForm.value.dni.trim();
  const first = createForm.value.firstName.trim();
  const last = createForm.value.lastName.trim();
  return d.length > 0 && (first.length > 0 || last.length > 0);
});

function displayName(c: ClientOption): string {
  const last = (c.lastName ?? '').trim();
  const first = (c.firstName ?? '').trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  return 'Sin nombre';
}

function select(c: ClientOption): void {
  emit('select', c);
  close();
}

function close(): void {
  emit('close');
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
  return { id: d.id, dni: data.dni, firstName: data.firstName, lastName: data.lastName, phone: data.phone, email: data.email };
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
    closeCreatePopup();
    emit('select', newClient);
    close();
  } catch (e) {
    console.error('Error creating client:', e);
  } finally {
    createSaving.value = false;
  }
}

function selectExistingByDni(): void {
  const c = duplicateClient.value;
  if (c) {
    closeCreatePopup();
    emit('select', c);
    close();
  }
}

async function loadClients(): Promise<void> {
  const tid = tenantIdStr();
  if (!tid) return;
  loadingClients.value = true;
  try {
    const db = getDbInstance();
    const snap = await getDocs(collection(db, 'tenants', tid, 'clients'));
    clientsAll.value = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ClientOption[];
  } catch (e) {
    console.error('Error loading clients:', e);
    clientsAll.value = [];
  } finally {
    loadingClients.value = false;
  }
}

onMounted(() => loadClients());
watch(() => [props.tenantId, props.opened], () => { if (props.opened) loadClients(); });

watch(() => props.opened, (v) => { if (!v) searchQuery.value = ''; });
</script>

<style scoped>
.sheet-search-block {
  padding: 0.5rem 1rem;
}
.sheet-new-btn {
  margin-top: 0.5rem;
}
.client-sheet-dni {
  font-size: 0.85rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.client-sheet-error-block {
  margin-bottom: 0.5rem;
}
.client-sheet-error {
  margin: 0 0 0.5rem 0;
  color: var(--f7-color-red);
  font-size: 0.95rem;
}
</style>
