import { requireAuthReady, isAuthenticated, getCurrentUser } from './session';
import { isOwner } from './claims';
import { getTenantIdFromPath } from '../tenant/tenant';
import { waitForRouterReady } from '../router/routerReady';

/**
 * Rutas públicas (no requieren autenticación)
 */
const publicRoutes = [
  '/',
  '/login',
  '/access-denied',
];

/**
 * Verifica si una ruta es pública
 */
export function isPublicRoute(path: string): boolean {
  // Rutas que empiezan con /t/:tenantId/book, /t/:tenantId/confirm, etc son públicas
  if (path.match(/^\/t\/[^\/]+\/(book|confirm|my-bookings|store|login)$/)) {
    return true;
  }
  
  // Rutas exactas públicas
  return publicRoutes.includes(path);
}

/**
 * Guard para rutas protegidas (requieren autenticación)
 * Framework7 format: (route, resolve, reject) => void
 */
export function requireAuth(route: any, resolve: any, reject: any): void {
  if (typeof resolve !== 'function' || typeof reject !== 'function') {
    return;
  }

  Promise.all([waitForRouterReady(), requireAuthReady()]).then(() => {
    if (!isAuthenticated()) {
      const redirect = encodeURIComponent(route.path || '/');
      const tenantId = getTenantIdFromPath(route.path);
      const loginPath = tenantId 
        ? `/t/${tenantId}/login/?redirect=${redirect}`
        : `/login/?redirect=${redirect}`;
      
      reject({
        path: loginPath,
      });
    } else {
      resolve();
    }
  });
}

/**
 * Guard para rutas que requieren rol de owner
 * Framework7 format: (route, resolve, reject) => void
 */
export function requireOwner(route: any, resolve: any, reject: any): void {
  if (typeof resolve !== 'function' || typeof reject !== 'function') {
    return;
  }

  Promise.all([waitForRouterReady(), requireAuthReady()])
    .then(async () => {
      if (!isAuthenticated()) {
        const redirect = encodeURIComponent(route.path || '/');
        reject({
          path: `/login/?redirect=${redirect}`,
        });
        return;
      }
      
      // Verificar si es owner
      const user = getCurrentUser();
      if (!user) {
        const redirect = encodeURIComponent(route.path || '/');
        reject({
          path: `/login/?redirect=${redirect}`,
        });
        return;
      }
      
      try {
        const userIsOwner = await isOwner(user);
        if (!userIsOwner) {
          reject({
            path: '/access-denied',
          });
        } else {
          resolve();
        }
      } catch (error) {
        console.error('Error checking owner status:', error);
        // Verificar que reject sigue siendo una función
        if (typeof reject === 'function') {
          reject({
            path: '/access-denied',
          });
        }
      }
    })
    .catch((error) => {
      console.error('Error in requireOwner guard:', error);
      const redirect = encodeURIComponent(route.path || '/');
      if (typeof reject === 'function') {
        reject({
          path: `/login/?redirect=${redirect}`,
        });
      }
    });
}

