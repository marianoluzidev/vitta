<template>
  <f7-page>
    <f7-navbar>
      <f7-nav-title>Vitta</f7-nav-title>
    </f7-navbar>
    
    <f7-block strong inset style="padding-top: 3rem; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #1c1c1e;">
          Bienvenido a Vitta
        </h1>
        <p style="color: #8e8e93; margin-bottom: 3rem; line-height: 1.6; font-size: 1.1rem;">
          La plataforma de gestión y reservas para tu negocio
        </p>
        
        <f7-button 
          large 
          fill 
          @click="goToControlPanelLogin"
          style="background-color: #007aff; color: white; max-width: 300px; margin: 0 auto; display: block;"
        >
          Acceder al Panel de Control
        </f7-button>
      </div>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { restoreDefaultBranding } from '../branding/branding';

const router = useRouter();

const goToControlPanelLogin = () => {
  router.push('/controlPanel/login/');
};

// Restaurar branding por defecto cuando se está en la landing
onMounted(() => {
  restoreDefaultBranding();
});
</script>

