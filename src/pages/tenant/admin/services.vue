<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Servicios" back-link="Atrás" :back-link-url="adminSettingsUrl">
      <f7-nav-right>
        <f7-link @click="goToNew">Nuevo</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block v-if="loading" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <f7-list v-else-if="serviceList.length > 0" strong inset>
      <f7-list-item
        v-for="service in serviceList"
        :key="service.id"
        :title="service.name"
        link
        @click.prevent="goToEdit(service.id)"
      >
        <template #after>
          <span v-if="!service.active" class="badge color-red" style="margin-right: 0.5rem;">Inactivo</span>
          <span>{{ service.durationMinutes }} min · {{ formatPrice(service.price) }}</span>
        </template>
      </f7-list-item>
    </f7-list>

    <f7-block v-else class="block-strong">
      <p>No hay servicios. Usa Nuevo para agregar.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const adminSettingsUrl = computed(() => `/t/${tenantId.value}/?tab=admin`);
const serviceList = ref<Service[]>([]);
const loading = ref(true);
let unsubscribe: (() => void) | null = null;

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(price);
}

function goToNew(): void {
  router.push(`/t/${tenantId.value}/admin/services/new/`);
}

function goToEdit(serviceId: string): void {
  router.push(`/t/${tenantId.value}/admin/services/${serviceId}/`);
}

onMounted(() => {
  const tid = tenantId.value;
  if (!tid) {
    loading.value = false;
    return;
  }
  const db = getDbInstance();
  const servicesRef = collection(db, 'tenants', tid, 'services');
  unsubscribe = onSnapshot(
    servicesRef,
    (snapshot) => {
      serviceList.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Service[];
      loading.value = false;
    },
    (err) => {
      console.error('Services onSnapshot error:', err);
      loading.value = false;
    }
  );
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
});
</script>
