module.exports = {
  globDirectory: 'www/',
  globPatterns: ['**/*.{woff,woff2,js,css,png,jpg,svg,html}'],
  // No precachear branding (iconos/manifest por tenant; evita mezclar tenants en caché — patrón GymWox)
  globIgnores: ['**/branding/**'],
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  swDest: 'www/service-worker.js',
  // Que la nueva versión del SW se active de inmediato y tome control de las pestañas
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/branding/'),
      handler: 'NetworkOnly',
      options: {
        cacheName: 'branding-bypass',
      },
    },
  ],
};
