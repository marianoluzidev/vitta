<template>
  <f7-page>
    <f7-navbar title="Tenant no encontrado" />
    <f7-block strong inset style="padding-top: 3rem; text-align: center;">
      <div style="max-width: 400px; margin: 0 auto;">
        <f7-icon material="error_outline" size="64" style="color: #ff3b30; margin-bottom: 1.5rem;"></f7-icon>
        <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #1c1c1e;">
          Tenant no encontrado
        </h1>
        <p style="color: #8e8e93; margin-bottom: 2rem; line-height: 1.5;">
          El tenant que estás intentando acceder no existe en el sistema.
        </p>
        <f7-button large fill @click="goHome" style="background-color: #007aff; color: white;">
          Ir al inicio
        </f7-button>
      </div>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { f7 } from 'framework7-vue';

const goHome = () => {
  f7.views.main.router.navigate('/');
};
</script>

