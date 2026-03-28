<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Cliente" back-link="Atrás" :back-link-url="clientsListUrl">
      <f7-nav-right>
        <f7-link v-if="client" href="#" @click.prevent="goToEdit">Editar</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div class="ds-page-content">
      <VCard v-if="loading">
        <p class="ds-muted">Cargando...</p>
      </VCard>

      <VCard v-else-if="client">
        <VListItem title="Nombre">
          <template #after>{{ client.firstName || '—' }}</template>
        </VListItem>
        <VListItem title="Apellido">
          <template #after>{{ client.lastName || '—' }}</template>
        </VListItem>
        <VListItem title="DNI">
          <template #after>{{ client.dni || '—' }}</template>
        </VListItem>
        <VListItem title="Teléfono">
          <template #after>{{ client.phone || '—' }}</template>
        </VListItem>
        <VListItem title="Email">
          <template #after>{{ client.email || '—' }}</template>
        </VListItem>
        <VListItem v-if="client.notes" title="Notas">
          <template #after>
            <span class="client-view-notes">{{ client.notes }}</span>
          </template>
        </VListItem>
      </VCard>

      <VCard v-else-if="!loading">
        <p class="ds-muted">No se encontró el cliente.</p>
      </VCard>

      <div class="ds-spacer" />
    </div>

    <VFixedFooter v-if="client">
      <VPrimaryButton label="Editar" full-width @click="goToEdit" />
    </VFixedFooter>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import VCard from '../../../components/ui/VCard.vue';
import VListItem from '../../../components/ui/VListItem.vue';
import VPrimaryButton from '../../../components/ui/VPrimaryButton.vue';
import VFixedFooter from '../../../components/ui/VFixedFooter.vue';

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
.ds-page-content {
  padding: var(--ds-space-2) var(--ds-space-2) 100px;
}
.ds-muted {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--f7-block-strong-text-color, #8e8e93);
}
.ds-spacer {
  height: var(--ds-space-1);
}
.client-view-notes {
  white-space: pre-wrap;
  text-align: right;
  max-width: 60%;
}
:deep(.v-list-item__after) {
  color: var(--f7-text-color, #000);
  opacity: 1;
}
</style>
