<template>
  <f7-page class="admin-page">
    <f7-navbar title="Clientes">
      <f7-nav-right>
        <f7-link @click="goToNew">Nuevo</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-searchbar
      v-model:value="searchQuery"
      placeholder="Buscar por nombre, apellido o DNI"
      :disable-button="false"
      class="clients-searchbar"
    />

    <f7-block v-if="loading" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <f7-list v-else-if="filteredClients.length > 0" strong inset class="clients-list">
      <f7-list-item
        v-for="client in filteredClients"
        :key="client.id"
        link
        :href="clientDetailUrl(client.id)"
        @click.prevent="goToDetail(client.id)"
      >
        <template #default>
          <div class="clients-list-cell">
            <span class="clients-list-title">{{ displayName(client) }}</span>
            <span v-if="client.dni" class="clients-list-dni">{{ client.dni }}</span>
          </div>
        </template>
      </f7-list-item>
    </f7-list>

    <f7-block v-else class="block-strong">
      <p>{{ searchQuery.trim() ? 'Ningún cliente coincide con la búsqueda.' : 'No hay clientes todavía.' }}</p>
      <p v-if="!searchQuery.trim()"><f7-link @click="goToNew">Agregar cliente</f7-link></p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

export interface ClientItem {
  id: string;
  dni?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const searchQuery = ref('');
const clientsList = ref<ClientItem[]>([]);
const loading = ref(true);
let unsubscribe: (() => void) | null = null;

function sortKey(c: ClientItem): string {
  const last = (c.lastName ?? '').trim().toLowerCase();
  const first = (c.firstName ?? '').trim().toLowerCase();
  if (last) return `${last} ${first}`;
  return first || 'zzz';
}

const sortedClients = computed(() => {
  return [...clientsList.value].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
});

const filteredClients = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return sortedClients.value;
  return sortedClients.value.filter((c) => {
    const first = (c.firstName ?? '').toLowerCase();
    const last = (c.lastName ?? '').toLowerCase();
    const dni = (c.dni ?? '').toLowerCase();
    return first.includes(q) || last.includes(q) || dni.includes(q);
  });
});

function displayName(c: ClientItem): string {
  const last = (c.lastName ?? '').trim();
  const first = (c.firstName ?? '').trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  return 'Sin nombre';
}

function clientDetailUrl(clientId: string): string {
  return `/t/${tenantId.value}/admin/clientes/${clientId}/`;
}

function goToDetail(clientId: string): void {
  router.push(clientDetailUrl(clientId));
}

function goToNew(): void {
  router.push(`/t/${tenantId.value}/admin/clientes/new/`);
}

onMounted(() => {
  const tid = tenantId.value;
  if (!tid) {
    loading.value = false;
    return;
  }
  const db = getDbInstance();
  const clientsRef = collection(db, 'tenants', tid, 'clients');
  unsubscribe = onSnapshot(
    clientsRef,
    (snapshot) => {
      clientsList.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ClientItem[];
      loading.value = false;
    },
    (err) => {
      console.error('Clients onSnapshot error:', err);
      loading.value = false;
    }
  );
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.clients-searchbar {
  padding: 0.5rem;
}
.clients-list-cell {
  display: flex;
  flex-direction: column;
  padding: 0.35rem 0;
}
.clients-list-title {
  font-weight: 500;
}
.clients-list-dni {
  font-size: 0.85rem;
  color: var(--f7-block-title-color, #6d6d72);
  margin-top: 0.2rem;
}
</style>
