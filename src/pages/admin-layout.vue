<template>
  <f7-page :page-content="false" class="admin-shell">
    <f7-page-content class="admin-shell__content">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </f7-page-content>

    <f7-toolbar tabbar labels bottom>
      <f7-link
        tab-link="#tab-inicio"
        :tab-link-active="activeTab === 'inicio'"
        text="Inicio"
        icon-ios="f7:house_fill"
        icon-md="material:home"
        @click="goTab('inicio')"
      />
      <f7-link
        tab-link="#tab-agenda"
        :tab-link-active="activeTab === 'agenda'"
        text="Agenda"
        icon-ios="f7:calendar"
        icon-md="material:event"
        @click="goTab('agenda')"
      />
      <f7-link
        tab-link="#tab-pending"
        :tab-link-active="activeTab === 'pending'"
        text="Pendientes"
        icon-ios="f7:checkmark_circle_fill"
        icon-md="material:task_alt"
        @click="goTab('pending')"
      />
      <f7-link
        tab-link="#tab-clientes"
        :tab-link-active="activeTab === 'clientes'"
        text="Clientes"
        icon-ios="f7:person_2_fill"
        icon-md="material:people"
        @click="goTab('clientes')"
      />
      <f7-link
        tab-link="#tab-admin"
        :tab-link-active="activeTab === 'admin'"
        text="Admin"
        icon-ios="f7:gearshape_fill"
        icon-md="material:settings"
        @click="goTab('admin')"
      />
    </f7-toolbar>
  </f7-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const tenantId = computed(() => route.params.tenantId as string);

const activeTab = computed(() => {
  const path = route.path;
  if (path.includes('admin/clientes')) return 'clientes';
  if (path.includes('admin/agenda')) return 'agenda';
  if (path.includes('admin/staff') || path.includes('admin/services')) return 'admin';
  const tab = route.query.tab as string;
  const valid = ['inicio', 'agenda', 'pending', 'admin', 'clientes'];
  if (tab === 'staff' || tab === 'services') return 'admin';
  return tab && valid.includes(tab) ? tab : 'inicio';
});

function goTab(tab: string) {
  router.push({ path: `/t/${tenantId.value}/`, query: { ...route.query, tab } });
}
</script>
