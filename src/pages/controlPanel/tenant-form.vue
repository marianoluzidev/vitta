<template>
  <f7-page>
    <f7-navbar style="background-color: #e5e5ea;">
      <f7-nav-left>
        <f7-link @click.prevent="goBack" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </f7-link>
      </f7-nav-left>
      <f7-nav-title>{{ isEdit ? 'Editar Tenant' : 'Crear Tenant' }}</f7-nav-title>
    </f7-navbar>
    
    <f7-block strong inset>
      <f7-list no-hairlines-md>
        <f7-list-input
          label="Tenant ID"
          type="text"
          placeholder="ej: mi-tenant"
          v-model:value="formData.tenantId"
          :disabled="loading || isEdit"
          info="Solo letras minúsculas, números y guiones"
        />
        <f7-list-input
          label="Nombre"
          type="text"
          placeholder="Nombre del tenant"
          v-model:value="formData.name"
          :disabled="loading"
        />
      </f7-list>
      
      <f7-block v-if="errorMessage" style="margin-top: 1rem; padding: 0.75rem; background-color: #ffebee; border-radius: 8px;">
        <p style="color: #ff3b30; font-size: 0.9rem; margin: 0;">{{ errorMessage }}</p>
      </f7-block>
      
      <f7-button
        fill
        @click="handleSave"
        :disabled="loading || !formData.tenantId"
        style="margin-top: 1.5rem; background-color: #007aff; color: white;"
      >
        {{ isEdit ? 'Guardar' : 'Crear' }}
      </f7-button>
      
      <f7-button
        v-if="isEdit"
        outline
        @click="handleToggleActive"
        :disabled="loading"
        :style="{
          marginTop: '1rem',
          borderColor: currentTenant?.isActive ? '#ff9500' : '#34c759',
          color: currentTenant?.isActive ? '#ff9500' : '#34c759',
        }"
      >
        {{ currentTenant?.isActive ? 'Desactivar' : 'Activar' }}
      </f7-button>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getCurrentUser } from '../../auth/session';
import { 
  createTenant, 
  updateTenantName,
  toggleTenantActive,
  validateTenantId,
  normalizeTenantId,
  type TenantDoc,
  type CreateTenantData
} from '../../tenant/tenantAdmin';
import { getTenant, clearTenantCacheFor } from '../../tenant/tenantService';

const router = useRouter();
const route = useRoute();
const loading = ref(false);
const errorMessage = ref('');
const currentTenant = ref<TenantDoc | null>(null);

const tenantId = route.params.tenantId as string;
const isEdit = computed(() => !!tenantId && tenantId !== 'new');

const formData = ref<CreateTenantData>({
  tenantId: '',
  name: '',
});

const goBack = () => {
  // Siempre ir al panel de control
  router.push('/controlPanel/');
};

// Cargar tenant si es edición
onMounted(async () => {
  if (isEdit.value) {
    loading.value = true;
    try {
      // Limpiar cache para asegurar datos frescos
      clearTenantCacheFor(tenantId);
      
      const tenant = await getTenant(tenantId);
      if (tenant) {
        // Leer isActive directamente - debe ser explícitamente false para ser false
        const isActiveValue = tenant.isActive === false ? false : true;
        
        console.log('Cargando tenant para edición:', {
          tenantId: tenant.id,
          isActiveFromTenant: tenant.isActive,
          isActiveValue: isActiveValue,
        });
        
        currentTenant.value = {
          tenantId: tenant.id,
          name: tenant.name || tenant.id,
          isActive: isActiveValue,
          createdAt: null,
          createdBy: null,
        } as TenantDoc;
        formData.value = {
          tenantId: tenant.id,
          name: tenant.name || tenant.id,
        };
        
        console.log('currentTenant después de asignar:', currentTenant.value);
      } else {
        errorMessage.value = 'Tenant no encontrado';
        setTimeout(() => {
          router.push('/controlPanel/');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error cargando tenant:', error);
      errorMessage.value = error.message || 'Error al cargar el tenant';
    } finally {
      loading.value = false;
    }
  }
});

const handleSave = async () => {
  if (!formData.value.tenantId) {
    errorMessage.value = 'El Tenant ID es requerido';
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    errorMessage.value = 'Debes estar autenticado';
    return;
  }

  // Validar tenantId
  const validation = validateTenantId(formData.value.tenantId);
  if (!validation.valid) {
    errorMessage.value = validation.error || 'TenantId inválido';
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    if (isEdit.value) {
      // Editar nombre del tenant (el tenantId no se puede cambiar)
      if (!currentTenant.value) {
        errorMessage.value = 'Error: tenant no encontrado';
        return;
      }
      
      await updateTenantName(currentTenant.value.tenantId, formData.value.name);
      
      // Volver a la página anterior (panel de control)
      router.back();
    } else {
      // Crear nuevo tenant
      const normalizedId = normalizeTenantId(formData.value.tenantId);
      const tenantData: CreateTenantData = {
        tenantId: normalizedId,
        name: formData.value.name || normalizedId,
      };

      await createTenant(tenantData, user.uid);
      
      // Volver a la página anterior (panel de control)
      router.back();
    }
  } catch (error: any) {
    console.error('Error guardando tenant:', error);
    errorMessage.value = error.message || 'Error al guardar el tenant';
  } finally {
    loading.value = false;
  }
};

const handleToggleActive = async () => {
  if (!currentTenant.value) return;
  
  const newStatus = !currentTenant.value.isActive;
  loading.value = true;
  errorMessage.value = '';

  try {
    await toggleTenantActive(currentTenant.value.tenantId, newStatus);
    
    // Volver a la página anterior (panel de control)
    router.back();
  } catch (error: any) {
    console.error('Error al cambiar estado:', error);
    errorMessage.value = error.message || 'Error al cambiar el estado del tenant';
  } finally {
    loading.value = false;
  }
};
</script>

