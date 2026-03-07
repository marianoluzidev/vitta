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
  import { onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
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

  /**
   * En móvil, si no hay historial el botón atrás cierra la app.
   * Cuando estamos en el home del tenant y solo hay 1 entrada, añadimos otra igual
   * para que el primer "atrás" vuelva a home (misma pantalla) en lugar de cerrar.
   */
  function ensureBackGoesToHome(): void {
    const tid = route.params.tenantId as string | undefined;
    if (!tid) return;
    const path = route.path;
    const tenantRoot = `/t/${tid}/`;
    if (path !== tenantRoot) return;
    if (typeof window === 'undefined' || window.history.length > 1) return;
    nextTick(() => {
      if (window.history.length > 1) return;
      router.push({ path: tenantRoot, query: { ...route.query } });
    });
  }

  // Framework7 Parameters (sin router interno). SW con ?v= para que cada deploy use URL distinta y no cachee.
  const swPath = typeof __APP_VERSION__ !== 'undefined'
    ? `/service-worker.js?v=${__APP_VERSION__}`
    : '/service-worker.js';
  const f7params = {
    name: 'Vitta',
    theme: 'md',
    store: store,
    serviceWorker: process.env.NODE_ENV === 'production' ? {
      path: swPath,
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

  watch(
    () => [route.path, route.params.tenantId],
    () => { ensureBackGoesToHome(); },
    { immediate: true }
  );

  /** Versión de la app en build (para comparar con version.json del servidor). */
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0';

  /** Pide version.json al servidor (sin cache). Si la versión es distinta, recarga para tomar la nueva. */
  async function checkServerVersionAndReload(): Promise<void> {
    try {
      const res = await fetch('/version.json', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) return;
      const data = await res.json();
      const serverVersion = data?.version;
      if (serverVersion && serverVersion !== appVersion) {
        window.location.reload();
      }
    } catch {
      // Ignorar errores de red
    }
  }

  /** Comprueba actualizaciones del service worker y recarga cuando hay una nueva versión. */
  function setupServiceWorkerUpdates(): void {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      const onControllerChange = () => window.location.reload();
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      const checkUpdate = () => registration.update();
      checkUpdate();
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkUpdate();
          checkServerVersionAndReload();
        }
      });
      // Comprobar versión del servidor cada 15 min cuando la app está visible
      setInterval(() => {
        if (document.visibilityState === 'visible') {
          checkUpdate();
          checkServerVersionAndReload();
        }
      }, 15 * 60 * 1000);
    });
  }

  onMounted(() => {
    document.addEventListener('click', handleGlobalBackClick, true);
    checkServerVersionAndReload();
    setupServiceWorkerUpdates();
    f7ready(() => {
      applyTenantBrandingIfNeeded();
    });
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleGlobalBackClick, true);
  });
</script>