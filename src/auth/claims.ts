import { User, getIdTokenResult } from 'firebase/auth';

// Cache de claims por usuario
const claimsCache = new Map<string, { claims: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene los custom claims del usuario (con cache)
 */
export async function getUserClaims(user: User): Promise<any> {
  const cached = claimsCache.get(user.uid);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.claims;
  }
  
  try {
    const tokenResult = await getIdTokenResult(user, true); // forceRefresh = true
    const claims = tokenResult.claims || {};
    
    claimsCache.set(user.uid, {
      claims,
      timestamp: now
    });
    
    return claims;
  } catch (error) {
    console.error('Error getting user claims:', error);
    return {};
  }
}

/**
 * Verifica si el usuario tiene el rol de owner
 */
export async function isOwner(user: User): Promise<boolean> {
  const claims = await getUserClaims(user);
  return claims.owner === true;
}

/**
 * Limpia el cache de claims (útil después de actualizar roles)
 */
export function clearClaimsCache(userId?: string): void {
  if (userId) {
    claimsCache.delete(userId);
  } else {
    claimsCache.clear();
  }
}

