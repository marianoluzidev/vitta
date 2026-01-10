<template>
  <f7-page>
    <f7-navbar title="Book" />
    <f7-block v-if="checkingTenant">
      <div style="text-align: center; padding: 2rem;">
        <p>Cargando...</p>
      </div>
    </f7-block>
    <f7-block v-else>
      <h1 style="text-align: center; font-size: 2.5rem; margin-top: 2rem;">
        Book
      </h1>
      <div style="text-align: center; margin-top: 3rem;">
        <f7-button
          large
          outline
          @click="handleLogout"
          :disabled="loading"
          style="margin-top: 2rem; border-color: #ff3b30; color: #ff3b30;"
        >
          Cerrar Sesión
        </f7-button>
      </div>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { f7 } from 'framework7-vue';
import { signOutUser } from '../auth/auth';
import { getTenantIdFromPath } from '../tenant/tenant';
import { getTenant } from '../tenant/tenantService';

const loading = ref(false);
const tenantValid = ref(false);
const checkingTenant = ref(true);

onMounted(async () => {
  // Validar tenant también desde el componente por si el guard no se ejecutó
  const tenantId = getTenantIdFromPath(window.location.pathname);
  
  if (tenantId) {
    try {
      const tenant = await getTenant(tenantId);
      
      if (!tenant) {
        f7.views.main.router.navigate('/tenant-not-found/');
        return;
      }
      
      if (tenant.isActive === false) {
        f7.views.main.router.navigate('/tenant-disabled/');
        return;
      }
      
      tenantValid.value = true;
    } catch (error: any) {
      console.error('Error checking tenant:', error);
      
      // Si es error de permisos, permitir acceso (las reglas deberían estar configuradas)
      if (error?.code === 'permission-denied' || error?.message?.includes('permissions')) {
        tenantValid.value = true;
      } else {
        f7.views.main.router.navigate('/tenant-not-found/');
        return;
      }
    }
  } else {
    tenantValid.value = true;
  }
  
  checkingTenant.value = false;
});

const handleLogout = async () => {
  if (loading.value) return;
  
  try {
    loading.value = true;
    const tenantId = getTenantIdFromPath(window.location.pathname);
    await signOutUser();
    
    const loginPath = tenantId ? `/t/${tenantId}/login/` : '/login/';
    f7.views.main.router.navigate(loginPath);
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    loading.value = false;
  }
};
</script>

