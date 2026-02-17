<template>
  <f7-page>
    <f7-navbar title="Tenant deshabilitado" />
    <f7-block strong inset style="padding-top: 3rem; text-align: center;">
      <div style="max-width: 400px; margin: 0 auto;">
        <f7-icon material="block" size="64" style="color: #ff9500; margin-bottom: 1.5rem;"></f7-icon>
        <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #1c1c1e;">
          Tenant deshabilitado
        </h1>
        <p style="color: #8e8e93; margin-bottom: 2rem; line-height: 1.5;">
          Este tenant está temporalmente deshabilitado y no está disponible en este momento.
        </p>
        <f7-button large fill @click="goHome" style="background-color: #007aff; color: white;">
          Ir al inicio
        </f7-button>
      </div>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goHome = () => {
  router.push('/');
};
</script>

