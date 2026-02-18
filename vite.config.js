
import path from 'path';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'fs';

const SRC_DIR = path.resolve(__dirname, './src');
const PUBLIC_DIR = path.resolve(__dirname, './public');
const BUILD_DIR = path.resolve(__dirname, './www',);
const ROOT_DIR = path.resolve(__dirname, './');

export default async () => {
  return {
    plugins: [
      vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.includes('swiper-') } } }),
      {
        name: 'spa-fallback',
        configureServer(server) {
          // Ejecutar después de que Vite configure sus middlewares
          return () => {
            // Agregar middleware al final de la cadena
            server.middlewares.use((req, res, next) => {
              const url = req.url || '';
              const urlPath = url.split('?')[0];
              
              // Si tiene extensión de archivo, dejar que Vite lo maneje
              if (/\.\w+$/.test(urlPath)) {
                return next();
              }
              
              // Si es para recursos especiales de Vite, dejar pasar
              if (url.startsWith('/@') || url.startsWith('/node_modules/')) {
                return next();
              }
              
              // Si es para recursos públicos, dejar pasar
              if (url.startsWith('/branding/') || url.startsWith('/icons/') || url === '/manifest.json') {
                return next();
              }
              
              // Para rutas de la app, servir index.html
              try {
                const indexHtml = readFileSync(path.join(SRC_DIR, 'index.html'), 'utf-8');
                res.setHeader('Content-Type', 'text/html');
                res.end(indexHtml);
              } catch (error) {
                next();
              }
            });
          };
        },
      },
    ],
    root: SRC_DIR,
    envDir: ROOT_DIR, // Especificar dónde buscar el archivo .env
    base: '/',
    publicDir: PUBLIC_DIR,
    build: {
      outDir: BUILD_DIR,
      assetsInlineLimit: 0,
      emptyOutDir: true,
      rollupOptions: {
        treeshake: false,
      },
    },
    resolve: {
      alias: {
        '@': SRC_DIR,
      },
    },
    server: {
      host: true,
      // Configurar para SPA: todas las rutas sirven index.html
      fs: {
        strict: false,
      },
    },
    // Configurar para SPA en build
    preview: {
      port: 4173,
    },
  };
};
