<template>
  <f7-page>
    <f7-navbar title="Panel Owner" />
    
    <f7-block strong inset>
      <!-- Estadísticas -->
      <div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
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

      <!-- Formulario Crear Tenant -->
      <f7-block-title>Crear Tenant</f7-block-title>
      <f7-list no-hairlines-md>
        <f7-list-input
          label="Tenant ID"
          type="text"
          placeholder="ej: mi-tenant"
          v-model:value="newTenant.tenantId"
          :disabled="loading"
          info="Solo letras minúsculas, números y guiones"
        />
        <f7-list-input
          label="Nombre"
          type="text"
          placeholder="Nombre del tenant"
          v-model:value="newTenant.name"
          :disabled="loading"
        />
      </f7-list>
      
      <f7-block v-if="createError" style="margin-top: 1rem; padding: 0.75rem; background-color: #ffebee; border-radius: 8px;">
        <p style="color: #ff3b30; font-size: 0.9rem; margin: 0;">{{ createError }}</p>
      </f7-block>
      
      <f7-button
        large
        fill
        @click="handleCreateTenant"
        :disabled="loading || !newTenant.tenantId"
        style="margin-top: 1rem; background-color: #007aff; color: white;"
      >
        Crear Tenant
      </f7-button>
    </f7-block>

    <!-- Lista de Tenants -->
    <f7-block-title>Tenants ({{ tenants.length }})</f7-block-title>
    <f7-list>
      <f7-list-item
        v-for="tenant in tenants"
        :key="tenant.tenantId"
        :title="tenant.name || tenant.tenantId"
        :subtitle="`ID: ${tenant.tenantId}`"
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
            <f7-button
              small
              @click="handleToggleTenant(tenant)"
              :disabled="loading"
              :style="{
                backgroundColor: tenant.isActive ? '#ff9500' : '#34c759',
                color: 'white',
                minWidth: '100px',
              }"
            >
              {{ tenant.isActive ? 'Desactivar' : 'Activar' }}
            </f7-button>
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
  </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { f7 } from 'framework7-vue';
import { getCurrentUser } from '../auth/session';
import { 
  createTenant, 
  listTenants, 
  toggleTenantActive,
  validateTenantId,
  normalizeTenantId,
  type TenantDoc,
  type CreateTenantData
} from '../tenant/tenantAdmin';
import { Timestamp } from 'firebase/firestore';

const loading = ref(false);
const tenants = ref<TenantDoc[]>([]);
const createError = ref('');
const newTenant = ref<CreateTenantData>({
  tenantId: '',
  name: '',
});

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
    tenants.value = await listTenants(50);
  } catch (error: any) {
    console.error('Error cargando tenants:', error);
    f7.dialog.alert('Error al cargar la lista de tenants: ' + (error.message || 'Error desconocido'));
  } finally {
    loading.value = false;
  }
};

// Crear nuevo tenant
const handleCreateTenant = async () => {
  if (!newTenant.value.tenantId) {
    createError.value = 'El Tenant ID es requerido';
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    createError.value = 'Debes estar autenticado';
    return;
  }

  // Validar tenantId
  const validation = validateTenantId(newTenant.value.tenantId);
  if (!validation.valid) {
    createError.value = validation.error || 'TenantId inválido';
    return;
  }

  loading.value = true;
  createError.value = '';

  try {
    // Normalizar tenantId antes de crear
    const normalizedId = normalizeTenantId(newTenant.value.tenantId);
    const tenantData: CreateTenantData = {
      tenantId: normalizedId,
      name: newTenant.value.name || normalizedId,
    };

    await createTenant(tenantData, user.uid);
    
    // Limpiar formulario
    newTenant.value = {
      tenantId: '',
      name: '',
    };
    
    // Recargar lista
    await loadTenants();
    
    f7.toast.create({
      text: `Tenant "${normalizedId}" creado exitosamente`,
      position: 'center',
      closeTimeout: 2000,
    }).open();
  } catch (error: any) {
    console.error('Error creando tenant:', error);
    createError.value = error.message || 'Error al crear el tenant';
  } finally {
    loading.value = false;
  }
};

// Toggle activar/desactivar tenant
const handleToggleTenant = async (tenant: TenantDoc) => {
  const newStatus = !tenant.isActive;
  const action = newStatus ? 'activar' : 'desactivar';
  
  loading.value = true;
  
  try {
    await toggleTenantActive(tenant.tenantId, newStatus);
    
    // Actualizar estado local
    tenant.isActive = newStatus;
    
    f7.toast.create({
      text: `Tenant "${tenant.tenantId}" ${action === 'activar' ? 'activado' : 'desactivado'} exitosamente`,
      position: 'center',
      closeTimeout: 2000,
    }).open();
  } catch (error: any) {
    console.error(`Error al ${action} tenant:`, error);
    f7.dialog.alert(`Error al ${action} el tenant: ${error.message || 'Error desconocido'}`);
  } finally {
    loading.value = false;
  }
};

// Cargar tenants al montar
onMounted(() => {
  loadTenants();
});
</script>
