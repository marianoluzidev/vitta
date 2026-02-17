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
  import { onMounted, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import { f7ready } from 'framework7-vue';
  import store from '@/js/store';
  import { loadAndApplyTheme, restoreDefaultBranding } from '../branding/branding';

  const route = useRoute();

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

  onMounted(() => {
    f7ready(() => {
      applyTenantBrandingIfNeeded();
    });
  });
</script>