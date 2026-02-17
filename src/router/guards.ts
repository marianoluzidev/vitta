import { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { requireAuthReady, isAuthenticated, getCurrentUser } from '../auth/session';
import { isOwner } from '../auth/claims';
import { getTenantIdFromPath } from '../tenant/tenant';
import { getTenant } from '../tenant/tenantService';

/**
 * Guard para rutas protegidas (requieren autenticación)
 */
export async function requireAuth(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  await requireAuthReady();
  
  if (!isAuthenticated()) {
    const redirect = encodeURIComponent(to.fullPath);
    const tenantId = getTenantIdFromPath(to.path);
    const loginPath = tenantId 
      ? `/t/${tenantId}/login/?redirect=${redirect}`
      : `/controlPanel/login/?redirect=${redirect}`;
    
    next(loginPath);
    return;
  }
  
  next();
}

/**
 * Guard para rutas que requieren rol de owner
 */
export async function requireOwner(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  await requireAuthReady();
  
  if (!isAuthenticated()) {
    const redirect = encodeURIComponent(to.fullPath);
    next(`/controlPanel/login/?redirect=${redirect}`);
    return;
  }
  
  const user = getCurrentUser();
  if (!user) {
    const redirect = encodeURIComponent(to.fullPath);
    next(`/controlPanel/login/?redirect=${redirect}`);
    return;
  }
  
  try {
    const userIsOwner = await isOwner(user);
    if (!userIsOwner) {
      next('/access-denied/');
    } else {
      next();
    }
  } catch (error) {
    console.error('Error checking owner status:', error);
    next('/access-denied/');
  }
}

/**
 * Guard para validar que el tenant existe y está activo
 */
export async function requireTenant(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const tenantId = to.params.tenantId as string;
  
  if (!tenantId) {
    next();
    return;
  }
  
  try {
    const tenant = await getTenant(tenantId);
    
    if (!tenant) {
      next('/tenant-not-found/');
      return;
    }
    
    if (tenant.isActive === false) {
      next('/tenant-disabled/');
      return;
    }
    
    next();
  } catch (error) {
    console.error('Error validating tenant:', error);
    next('/tenant-not-found/');
  }
}

/**
 * Guard compuesto que ejecuta requireTenant y luego requireAuth
 */
export async function requireTenantAndAuth(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  // Primero validar tenant
  const tenantId = to.params.tenantId as string;
  
  if (!tenantId) {
    next();
    return;
  }
  
  try {
    const tenant = await getTenant(tenantId);
    
    if (!tenant) {
      next('/tenant-not-found/');
      return;
    }
    
    if (tenant.isActive === false) {
      next('/tenant-disabled/');
      return;
    }
    
    // Tenant válido, ahora validar auth
    await requireAuth(to, from, next);
  } catch (error) {
    console.error('Error validating tenant:', error);
    next('/tenant-not-found/');
  }
}

