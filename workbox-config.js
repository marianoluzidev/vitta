module.exports = {
  globDirectory: 'www/',
  globPatterns: ['**/*.{woff,woff2,js,css,png,jpg,svg,html}'],
  globIgnores: [],
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  swDest: 'www/service-worker.js',
  // Que la nueva versión del SW se active de inmediato y tome control de las pestañas
  skipWaiting: true,
  clientsClaim: true,
};
