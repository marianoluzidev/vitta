<template>
  <f7-page>
    <f7-navbar title="Panel de Control" style="background-color: #e5e5ea;" />
    
    <f7-block strong inset>
      <!-- Estadísticas -->
      <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 120px; padding: 1rem; background: #f0f0f0; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: #007aff;">{{ stats.total }}</div>
          <div style="color: #8e8e93; font-size: 0.9rem;">Total</div>
        </div>
        <div style="flex: 1; min-width: 120px; padding: 1rem; background: #e8f5e9; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: #34c759;">{{ stats.active }}</div>
          <div style="color: #8e8e93; font-size: 0.9rem;">Activos</div>
        </div>
        <div style="flex: 1; min-width: 120px; padding: 1rem; background: #fff3e0; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: #ff9500;">{{ stats.inactive }}</div>
          <div style="color: #8e8e93; font-size: 0.9rem;">Deshabilitados</div>
        </div>
      </div>
    </f7-block>

    <!-- Lista de Tenants -->
    <f7-block-title>Tenants ({{ tenants.length }})</f7-block-title>
    <f7-block>
      <f7-button
        fill
        @click="goToCreateTenant"
        style="background-color: #007aff; color: white;"
      >
        Crear Tenant
      </f7-button>
    </f7-block>
    <f7-list>
      <f7-list-item
        v-for="tenant in tenants"
        :key="tenant.tenantId"
        :title="tenant.name || tenant.tenantId"
        :subtitle="`ID: ${tenant.tenantId}`"
        @click="goToEditTenant(tenant.tenantId)"
      >
        <template #after>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span
              :style="{
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                backgroundColor: tenant.isActive ? '#e8f5e9' : '#fff3e0',
                color: tenant.isActive ? '#34c759' : '#ff9500',
              }"
            >
              {{ tenant.isActive ? 'Activo' : 'Deshabilitado' }}
            </span>
          </div>
        </template>
        <template #footer>
          <div style="font-size: 0.75rem; color: #8e8e93; margin-top: 0.25rem;">
            Creado: {{ formatDate(tenant.createdAt) }}
          </div>
        </template>
      </f7-list-item>
      
      <f7-list-item v-if="tenants.length === 0 && !loading">
        <div style="text-align: center; padding: 2rem; color: #8e8e93;">
          No hay tenants creados aún
        </div>
      </f7-list-item>
      
      <f7-list-item v-if="loading && tenants.length === 0">
        <div style="text-align: center; padding: 2rem; color: #8e8e93;">
          Cargando...
        </div>
      </f7-list-item>
    </f7-list>
    
    <!-- Botón de Logout -->
    <f7-block>
      <f7-button
        outline
        @click="handleLogout"
        :disabled="loggingOut"
        style="border-color: #ff3b30; color: #ff3b30; width: 100%;"
      >
        Cerrar Sesión
      </f7-button>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { listTenants, type TenantDoc } from '../../tenant/tenantAdmin';
import { Timestamp } from 'firebase/firestore';
import { signOutUser } from '../../auth/auth';

const router = useRouter();
const route = useRoute();

const loading = ref(false);
const loggingOut = ref(false);
const tenants = ref<TenantDoc[]>([]);

// Estadísticas computadas
const stats = computed(() => {
  const total = tenants.value.length;
  const active = tenants.value.filter(t => t.isActive).length;
  const inactive = total - active;
  return { total, active, inactive };
});

// Formatear fecha
const formatDate = (timestamp: Timestamp | null | undefined): string => {
  if (!timestamp) return 'N/A';
  try {
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return 'N/A';
  }
};

// Cargar lista de tenants
const loadTenants = async () => {
  loading.value = true;
  try {
    console.log('Cargando tenants...');
    const loadedTenants = await listTenants(50);
    console.log('Tenants cargados:', loadedTenants.length, loadedTenants);
    tenants.value = loadedTenants;
  } catch (error: any) {
    console.error('Error cargando tenants:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
  } finally {
    loading.value = false;
  }
};

// Navegación
const goToCreateTenant = () => {
  router.push('/controlPanel/tenant/new/');
};

const goToEditTenant = (tenantId: string) => {
  router.push(`/controlPanel/tenant/${tenantId}/edit/`);
};

// Cargar tenants al montar
onMounted(() => {
  loadTenants();
});

// Recargar datos cuando se vuelve a esta página (detecta cambios en la ruta)
watch(() => route.path, (newPath) => {
  if (newPath === '/controlPanel/') {
    loadTenants();
  }
});

// Logout
const handleLogout = async () => {
  loggingOut.value = true;
  try {
    await signOutUser();
    router.push('/controlPanel/login/');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  } finally {
    loggingOut.value = false;
  }
};
</script>

