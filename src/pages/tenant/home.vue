<template>
  <f7-page class="tenant-home">
    <f7-navbar :title="tenantName" />

    <f7-block v-if="logoUrl" class="tenant-logo-container">
      <img
        :src="logoUrl"
        :alt="`Logo de ${tenantName}`"
        class="tenant-logo"
        @error="onLogoError"
      />
    </f7-block>


    <f7-block>
      <f7-list inset>
        <f7-list-item title="Reservar" link @click.prevent="goToBook" />
        <f7-list-item title="Mis Reservas" link @click.prevent="goToMyBookings" />
        <f7-list-item title="Tienda" link @click.prevent="goToStore" />        
      </f7-list>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTenant } from '../../tenant/tenantService';

const route = useRoute();
const router = useRouter();
const tenantId = route.params.tenantId as string;
const tenantName = ref('Tenant');
const logoError = ref(false);

// URL del logo del tenant
const logoUrl = computed(() => {
  if (logoError.value) {
    return null;
  }
  return `/branding/${tenantId}/logo.png`;
});

// Manejar error al cargar el logo
const onLogoError = () => {
  logoError.value = true;
  console.log(`Logo not found for tenant: ${tenantId}`);
};

const goToBook = () => {
  router.push(`/t/${tenantId}/book/`);
};

const goToMyBookings = () => {
  router.push(`/t/${tenantId}/my-bookings/`);
};

const goToStore = () => {
  router.push(`/t/${tenantId}/store/`);
};

onMounted(async () => {
  if (tenantId) {
    try {
      const tenant = await getTenant(tenantId);
      if (tenant) {
        tenantName.value = tenant.name || tenantId;
      }
      logoError.value = false;
    } catch (error) {
      console.error('Error cargando tenant:', error);
    }
  }
});
</script>

