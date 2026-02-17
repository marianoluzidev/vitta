<template>
  <f7-page :page-content="false" class="admin-shell">
    <f7-navbar :title="`Admin · ${tenantId}`" />

    <f7-page-content class="admin-shell__content">
      <f7-tabs>
        <f7-tab id="tab-inicio" tab-active>
          <AdminHomePage />
        </f7-tab>
        <f7-tab id="tab-agenda">
          <AdminAgendaPage />
        </f7-tab>
        <f7-tab id="tab-pending">
          <AdminPendingPage />
        </f7-tab>
        <f7-tab id="tab-staff">
          <AdminStaffPage />
        </f7-tab>
        <f7-tab id="tab-services">
          <AdminServicesPage />
        </f7-tab>
      </f7-tabs>
    </f7-page-content>

    <f7-toolbar tabbar labels bottom>
      <f7-link tab-link="#tab-inicio" tab-link-active text="Inicio" icon-ios="f7:house_fill" icon-md="material:home" />
      <f7-link tab-link="#tab-agenda" text="Agenda" icon-ios="f7:calendar" icon-md="material:event" />
      <f7-link tab-link="#tab-pending" text="Pendientes" icon-ios="f7:checkmark_circle_fill" icon-md="material:task_alt" />
      <f7-link tab-link="#tab-staff" text="Staff" icon-ios="f7:person_2_fill" icon-md="material:groups" />
      <f7-link tab-link="#tab-services" text="Servicios" icon-ios="f7:tag_fill" icon-md="material:sell" />
    </f7-toolbar>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';

const AdminHomePage = defineAsyncComponent(() => import('./tenant/admin/home.vue'));
const AdminAgendaPage = defineAsyncComponent(() => import('./tenant/admin/agenda.vue'));
const AdminPendingPage = defineAsyncComponent(() => import('./tenant/admin/pending.vue'));
const AdminStaffPage = defineAsyncComponent(() => import('./tenant/admin/staff.vue'));
const AdminServicesPage = defineAsyncComponent(() => import('./tenant/admin/services.vue'));

const route = useRoute();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
</script>