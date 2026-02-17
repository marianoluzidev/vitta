<template>
  <f7-page>
    <f7-navbar title="Acceso Denegado" />
    <f7-block>
      <div style="text-align: center; padding: 2rem;">
        <f7-icon material="lock" size="64" color="red" style="margin-bottom: 1rem;"></f7-icon>
        <h2>Acceso Denegado</h2>
        <p style="color: #8e8e93; margin-top: 1rem;">
          No tienes permisos para acceder a esta sección.
        </p>
        <f7-button
          fill
          @click="goHome"
          style="margin-top: 2rem;"
        >
          Volver al inicio
        </f7-button>
      </div>
    </f7-block>
  </f7-page>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { signOutUser } from '../auth/auth';

const router = useRouter();

const goHome = () => {
  router.push('/');
};

onMounted(async () => {
  // Cerrar sesión automáticamente cuando se muestra esta página
  try {
    await signOutUser();
    console.log('Sesión cerrada automáticamente por acceso denegado');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
});
</script>

