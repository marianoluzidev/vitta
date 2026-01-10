import { getTenantIdFromPath } from './tenant';
import { getTenant } from './tenantService';
import { waitForRouterReady } from '../router/routerReady';

/**
 * Guard para validar que el tenant existe y está activo
 * Framework7 format: (route, resolve, reject) => void
 */
export function requireTenant(route: any, resolve: any, reject: any): void {
  // Validar que resolve y reject sean funciones
  if (typeof resolve !== 'function' || typeof reject !== 'function') {
    return;
  }

  // Si route no está definido o no tiene path, permitir acceso
  if (!route || !route.path) {
    resolve();
    return;
  }

  const tenantId = getTenantIdFromPath(route.path);

  // Si no hay tenantId en la ruta, no es una ruta de tenant, permitir acceso
  if (!tenantId) {
    resolve();
    return;
  }

  // Esperar a que el router esté listo antes de validar
  waitForRouterReady().then(() => {
    // Validar tenant desde Firestore
    getTenant(tenantId)
      .then((tenant) => {
        if (!tenant) {
          reject({
            path: '/tenant-not-found/',
          });
          return;
        }

        if (tenant.isActive === false) {
          reject({
            path: '/tenant-disabled/',
          });
          return;
        }

        resolve();
      })
      .catch((error) => {
        console.error('Error validating tenant:', error);
        reject({
          path: '/tenant-not-found/',
        });
      });
  });
}

/**
 * Guard compuesto que ejecuta requireTenant y luego requireAuth
 * Para rutas que requieren tanto tenant válido como autenticación
 */
export function requireTenantAndAuth(route: any, resolve: any, reject: any): void {
  // Primero validar tenant
  requireTenant(route, 
    // Si tenant es válido, validar auth
    () => {
      // Importar requireAuth dinámicamente para evitar dependencias circulares
      import('../auth/guards').then(({ requireAuth }) => {
        requireAuth(route, resolve, reject);
      }).catch((error) => {
        console.error('Error loading requireAuth:', error);
        reject({ path: '/access-denied' });
      });
    },
    // Si tenant no es válido, rechazar directamente
    reject
  );
}

