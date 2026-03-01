<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Cliente" back-link="Atrás" :back-link-url="clientsListUrl">
      <f7-nav-right>
        <f7-link @click="goToEdit">Editar</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block v-if="loading" strong inset>
      <p>Cargando...</p>
    </f7-block>

    <f7-block v-else-if="client" strong inset>
      <f7-list>
        <f7-list-item title="Nombre" :after="client.firstName || '—'" />
        <f7-list-item title="Apellido" :after="client.lastName || '—'" />
        <f7-list-item title="DNI" :after="client.dni || '—'" />
        <f7-list-item title="Teléfono" :after="client.phone || '—'" />
        <f7-list-item title="Email" :after="client.email || '—'" />
        <f7-list-item v-if="client.notes" title="Notas">
          <template #after>
            <span class="client-view-notes">{{ client.notes }}</span>
          </template>
        </f7-list-item>
      </f7-list>
    </f7-block>

    <f7-block v-else-if="!loading" strong inset>
      <p>No se encontró el cliente.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

interface ClientData {
  firstName?: string;
  lastName?: string;
  dni?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const clientId = computed(() => (route.params.clientId as string) ?? '');
const clientsListUrl = computed(() => `/t/${tenantId.value}/?tab=clientes`);

const client = ref<ClientData | null>(null);
const loading = ref(true);

function editUrl(): string {
  return `/t/${tenantId.value}/admin/clientes/${clientId.value}/editar/`;
}

function goToEdit(): void {
  router.push(editUrl());
}

function loadClient(): void {
  const tid = tenantId.value;
  const cid = clientId.value;
  if (!tid || !cid) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const db = getDbInstance();
  getDoc(doc(db, 'tenants', tid, 'clients', cid))
    .then((snap) => {
      if (snap.exists()) {
        client.value = snap.data() as ClientData;
      } else {
        client.value = null;
      }
    })
    .catch((err) => {
      console.error('Error loading client:', err);
      client.value = null;
    })
    .finally(() => {
      loading.value = false;
    });
}

onMounted(loadClient);
watch([tenantId, clientId], loadClient);
</script>

<style scoped>
.client-view-notes {
  white-space: pre-wrap;
  text-align: right;
  max-width: 60%;
}
</style>
