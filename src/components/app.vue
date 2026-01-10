<template>
  <f7-app v-bind="f7params">
    <!-- Your main view, should have "view-main" class -->
    <f7-view main class="safe-areas"></f7-view>
  </f7-app>
</template>
<script>
  import { onMounted } from 'vue';
  import { f7ready } from 'framework7-vue';
  import routes from '../js/routes.js';
  import store from '../js/store';

  export default {
    setup() {
      // Framework7 Parameters
      const f7params = {
        name: 'Vitta',
        theme: 'auto',
        router: {
          pushState: true,
          pushStateSeparator: '',
          allowDuplicateUrls: true,
          animate: true,
          reloadPages: false,
          reloadPrevious: false,
        },
        store: store,
        routes: routes,
        serviceWorker: process.env.NODE_ENV === 'production' ? {
          path: '/service-worker.js',
        } : {},
      };

      onMounted(() => {
        f7ready(() => {
          // Marcar router como listo
          import('../router/routerReady').then(({ setRouterReady }) => {
            setRouterReady();
          });
        });
      });

      return {
        f7params,
      };
    }
  }
</script>