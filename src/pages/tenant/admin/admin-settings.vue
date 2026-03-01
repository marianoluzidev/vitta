<template>
  <f7-page class="admin-page">
    <f7-navbar title="Admin" />

    <f7-block strong inset>
      <p class="block-title">Configuración</p>
    </f7-block>
    <f7-list strong inset>
      <f7-list-item
        title="Staff"
        link
        :href="staffListUrl"
        @click.prevent="goToStaff"
      >
        <template #media>
          <f7-icon ios="f7:person_2_fill" md="material:groups" />
        </template>
      </f7-list-item>
      <f7-list-item
        title="Servicios"
        link
        :href="servicesListUrl"
        @click.prevent="goToServices"
      >
        <template #media>
          <f7-icon ios="f7:tag_fill" md="material:sell" />
        </template>
      </f7-list-item>
    </f7-list>
    <f7-block strong inset>
      <f7-button class="tenant-button" fill large @click="handleLogout">
        Cerrar sesión
      </f7-button>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { signOutUser } from '../../../auth/auth';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');

const staffListUrl = computed(() => `/t/${tenantId.value}/admin/staff/`);
const servicesListUrl = computed(() => `/t/${tenantId.value}/admin/services/`);

function goToStaff(): void {
  router.push(staffListUrl.value);
}

function goToServices(): void {
  router.push(servicesListUrl.value);
}

async function handleLogout(): Promise<void> {
  await signOutUser();
  router.push(`/t/${tenantId.value}/login/`);
}
</script>
