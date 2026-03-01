<template>
  <f7-app v-bind="f7params">
    <f7-view main class="safe-areas">
      <f7-page>
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </f7-page>
    </f7-view>
  </f7-app>
</template>
<script setup lang="ts">
  import { onMounted, onBeforeUnmount, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { f7ready } from 'framework7-vue';
  import store from '@/js/store';
  import { loadAndApplyTheme, restoreDefaultBranding } from '../branding/branding';

  const route = useRoute();
  const router = useRouter();

  /** Intercepta clics en la flecha "atrás" de la navbar para que funcione con Vue Router en web. */
  function handleGlobalBackClick(e: Event): void {
    const target = (e.target as HTMLElement).closest?.('.navbar .back, .back-link');
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      router.back();
    }
  }

  // Framework7 Parameters (sin router interno)
  const f7params = {
    name: 'Vitta',
    theme: 'md',
    store: store,
    serviceWorker: process.env.NODE_ENV === 'production' ? {
      path: '/service-worker.js',
    } : {},
  };

  function applyTenantBrandingIfNeeded() {
    const tenantId = route.params.tenantId as string | undefined;
    if (tenantId && route.path.startsWith('/t/')) {
      loadAndApplyTheme(tenantId);
    } else {
      restoreDefaultBranding();
    }
  }

  watch(() => route.path, applyTenantBrandingIfNeeded, { immediate: true });

  /** Comprueba actualizaciones del service worker y recarga cuando hay una nueva versión. */
  function setupServiceWorkerUpdates(): void {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      const onControllerChange = () => window.location.reload();
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      const checkUpdate = () => registration.update();
      checkUpdate();
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkUpdate();
      });
    });
  }

  onMounted(() => {
    document.addEventListener('click', handleGlobalBackClick, true);
    setupServiceWorkerUpdates();
    f7ready(() => {
      applyTenantBrandingIfNeeded();
    });
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleGlobalBackClick, true);
  });
</script>