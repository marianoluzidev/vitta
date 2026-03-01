<template>
  <f7-page :page-content="false" class="admin-shell">
    <f7-page-content class="admin-shell__content">
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
    </f7-page-content>

    <f7-toolbar tabbar labels bottom>
      <f7-link tab-link="#tab-inicio" :tab-link-active="activeTab === 'inicio'" text="Inicio" icon-ios="f7:house_fill" icon-md="material:home" @click="goTab('inicio')" />
      <f7-link tab-link="#tab-agenda" :tab-link-active="activeTab === 'agenda'" text="Agenda" icon-ios="f7:calendar" icon-md="material:event" @click="goTab('agenda')" />
      <f7-link tab-link="#tab-pending" :tab-link-active="activeTab === 'pending'" text="Pendientes" icon-ios="f7:checkmark_circle_fill" icon-md="material:task_alt" @click="goTab('pending')" />
      <f7-link tab-link="#tab-clientes" :tab-link-active="activeTab === 'clientes'" text="Clientes" icon-ios="f7:person_2_fill" icon-md="material:people" @click="goTab('clientes')" />
      <f7-link tab-link="#tab-admin" :tab-link-active="activeTab === 'admin'" text="Admin" icon-ios="f7:gearshape_fill" icon-md="material:settings" @click="goTab('admin')" />
    </f7-toolbar>
  </f7-page>
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
function goTab(tab: string) {
  router.replace({ path: route.path, query: { ...route.query, tab } });
}

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