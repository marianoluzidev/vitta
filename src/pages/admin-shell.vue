<template>
  <f7-tabs>
    <f7-tab id="tab-inicio" :tab-active="activeTab === 'inicio'">
      <AdminHomePage />
    </f7-tab>
    <f7-tab id="tab-agenda" :tab-active="activeTab === 'agenda'">
      <AdminAgendaPage />
    </f7-tab>
    <f7-tab id="tab-pending" :tab-active="activeTab === 'pending'">
      <AdminPendingPage />
    </f7-tab>
    <f7-tab id="tab-admin" :tab-active="activeTab === 'admin'">
      <AdminSettingsPage />
    </f7-tab>
    <f7-tab id="tab-clientes" :tab-active="activeTab === 'clientes'">
      <AdminClientsPage />
    </f7-tab>
  </f7-tabs>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const AdminHomePage = defineAsyncComponent(() => import('./tenant/admin/home.vue'));
const AdminAgendaPage = defineAsyncComponent(() => import('./tenant/admin/agenda.vue'));
const AdminPendingPage = defineAsyncComponent(() => import('./tenant/admin/pending.vue'));
const AdminSettingsPage = defineAsyncComponent(() => import('./tenant/admin/admin-settings.vue'));
const AdminClientsPage = defineAsyncComponent(() => import('./tenant/admin/clients.vue'));

const route = useRoute();
const router = useRouter();
const activeTab = computed(() => {
  const tab = route.query.tab as string;
  const valid = ['inicio', 'agenda', 'pending', 'admin', 'clientes'];
  if (tab === 'staff' || tab === 'services') return 'admin'; // legacy: Staff y Servicios ahora dentro de Admin
  return tab && valid.includes(tab) ? tab : 'inicio';
});

// Redirigir URLs legacy ?tab=staff o ?tab=services a ?tab=admin
watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'staff' || tab === 'services') {
      router.replace({ path: route.path, query: { ...route.query, tab: 'admin' } });
    }
  },
  { immediate: true }
);
</script>