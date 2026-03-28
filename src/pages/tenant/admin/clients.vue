
<template>
  <f7-page class="admin-page">
    <f7-navbar title="Clientes">
      <f7-nav-right>
        <f7-link href="#" @click.prevent="goToNew">Nuevo</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div class="ds-page-content">
      <VCard>
        <f7-searchbar
          v-model:value="searchQuery"
          placeholder="Buscar por nombre, apellido o DNI"
          :disable-button="false"
          class="clients-searchbar"
        />
      </VCard>

      <VCard v-if="loading">
        <p class="ds-muted">Cargando...</p>
      </VCard>

      <VCard v-else-if="filteredClients.length > 0" class="clients-list-card">
        <div
          v-for="client in filteredClients"
          :key="client.id"
          class="clients-list-item"
        >
          <a class="clients-list-item-main" href="#" @click.prevent="goToDetail(client.id)">
            <VListItem
              :title="displayName(client)"
              :subtitle="client.dni"
            />
          </a>
          <f7-link class="clients-list-item-edit" href="#" @click.prevent="goToEdit(client.id)">
            Editar
          </f7-link>
        </div>
      </VCard>

      <VCard v-else>
        <p class="ds-muted">{{ searchQuery.trim() ? 'Ningún cliente coincide con la búsqueda.' : 'No hay clientes todavía.' }}</p>
        <f7-link v-if="!searchQuery.trim()" class="ds-link" @click="goToNew">Agregar cliente</f7-link>
      </VCard>

      <div class="ds-spacer" />
    </div>

    <VFixedFooter>
      <VPrimaryButton label="Nuevo cliente" full-width @click="goToNew" />
    </VFixedFooter>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import VCard from '../../../components/ui/VCard.vue';
import VListItem from '../../../components/ui/VListItem.vue';
import VPrimaryButton from '../../../components/ui/VPrimaryButton.vue';
import VFixedFooter from '../../../components/ui/VFixedFooter.vue';

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

function clientDetailUrl(id: string): string {
  return `/t/${tenantId.value}/admin/clientes/${id}/`;
}

function clientEditUrl(id: string): string {
  return `/t/${tenantId.value}/admin/clientes/${id}/editar/`;
}

function goToDetail(id: string): void {
  router.push(clientDetailUrl(id));
}

function goToEdit(id: string, e?: Event): void {
  e?.preventDefault();
  e?.stopPropagation();
  router.push(clientEditUrl(id));
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
.ds-page-content {
  padding: var(--ds-space-2) var(--ds-space-2) 100px;
}
.ds-muted {
  margin: 0 0 var(--ds-space-1);
  font-size: 0.9375rem;
  color: var(--f7-block-strong-text-color, #8e8e93);
}
.ds-link {
  font-size: 0.9375rem;
  margin-top: var(--ds-space-1);
  display: inline-block;
}
.ds-spacer {
  height: var(--ds-space-1);
}
.clients-searchbar {
  padding: 0;
}
.clients-list-card {
  padding: 0;
}
.clients-list-item {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  padding: 0;
}
.clients-list-item:last-child {
  border-bottom: none;
}
.clients-list-item-main {
  flex: 1;
  padding: 0 var(--ds-card-padding);
  text-decoration: none;
  color: inherit;
  min-width: 0;
}
.clients-list-item-edit {
  flex-shrink: 0;
  padding: 0 var(--ds-card-padding);
  font-size: 0.9rem;
  color: var(--f7-theme-color, #007aff);
}
.clients-list-item-edit:active {
  opacity: 0.7;
}
</style>
