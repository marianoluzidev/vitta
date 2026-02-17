<template>
  <f7-page class="admin-page">
    <f7-navbar title="Resumen del día" />

    <f7-block v-if="logoUrl" class="tenant-logo-container">
      <img
        :src="logoUrl"
        :alt="`Logo de ${tenantName}`"
        class="tenant-logo"
        @error="onLogoError"
      />
    </f7-block>

    <f7-block>
      <p class="admin-resumen-placeholder">Resumen del día (próximamente: turnos de hoy, alertas, etc.)</p>
    </f7-block>

    <f7-block>
      <f7-button class="tenant-button" fill large @click="handleLogout">
        Cerrar sesión
      </f7-button>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { signOutUser } from '../../../auth/auth';
import { getTenant } from '../../../tenant/tenantService';

const route = useRoute();
const router = useRouter();
const tenantId = route.params.tenantId as string;
const tenantName = ref('Tenant');
const logoError = ref(false);

const logoUrl = computed(() => {
  if (!tenantId || logoError.value) return null;
  return `/branding/${tenantId}/logo.png`;
});

function onLogoError() {
  logoError.value = true;
}

async function handleLogout() {
  await signOutUser();
  router.push(`/t/${tenantId}/login/`);
}

onMounted(async () => {
  if (tenantId) {
    try {
      const tenant = await getTenant(tenantId);
      if (tenant) tenantName.value = tenant.name || tenantId;
      logoError.value = false;
    } catch {
      logoError.value = true;
    }
  }
});
</script>
