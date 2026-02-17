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
        <f7-tab id="tab-staff" :tab-active="activeTab === 'staff'">
          <AdminStaffPage />
        </f7-tab>
        <f7-tab id="tab-services" :tab-active="activeTab === 'services'">
          <AdminServicesPage />
        </f7-tab>
      </f7-tabs>
    </f7-page-content>

    <f7-toolbar tabbar labels bottom>
      <f7-link tab-link="#tab-inicio" :tab-link-active="activeTab === 'inicio'" text="Inicio" icon-ios="f7:house_fill" icon-md="material:home" @click="goTab('inicio')" />
      <f7-link tab-link="#tab-agenda" :tab-link-active="activeTab === 'agenda'" text="Agenda" icon-ios="f7:calendar" icon-md="material:event" @click="goTab('agenda')" />
      <f7-link tab-link="#tab-pending" :tab-link-active="activeTab === 'pending'" text="Pendientes" icon-ios="f7:checkmark_circle_fill" icon-md="material:task_alt" @click="goTab('pending')" />
      <f7-link tab-link="#tab-staff" :tab-link-active="activeTab === 'staff'" text="Staff" icon-ios="f7:person_2_fill" icon-md="material:groups" @click="goTab('staff')" />
      <f7-link tab-link="#tab-services" :tab-link-active="activeTab === 'services'" text="Servicios" icon-ios="f7:tag_fill" icon-md="material:sell" @click="goTab('services')" />
    </f7-toolbar>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const AdminHomePage = defineAsyncComponent(() => import('./tenant/admin/home.vue'));
const AdminAgendaPage = defineAsyncComponent(() => import('./tenant/admin/agenda.vue'));
const AdminPendingPage = defineAsyncComponent(() => import('./tenant/admin/pending.vue'));
const AdminStaffPage = defineAsyncComponent(() => import('./tenant/admin/staff.vue'));
const AdminServicesPage = defineAsyncComponent(() => import('./tenant/admin/services.vue'));

const route = useRoute();
const router = useRouter();
const activeTab = computed(() => {
  const tab = route.query.tab as string;
  const valid = ['inicio', 'agenda', 'pending', 'staff', 'services'];
  return tab && valid.includes(tab) ? tab : 'inicio';
});
function goTab(tab: string) {
  router.replace({ path: route.path, query: { ...route.query, tab } });
}
</script>