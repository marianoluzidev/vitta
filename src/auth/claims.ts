import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';

// Cache de verificación de owner por usuario
const ownerCache = new Map<string, { isOwner: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica si el usuario tiene el rol de owner consultando Firestore
 * 
 * La estructura en Firestore es:
 * - Colección: `owners`
 * - Documento ID: `uid` del usuario
 * - Si el documento existe, el usuario es owner
 */
export async function isOwner(user: User): Promise<boolean> {
  const cached = ownerCache.get(user.uid);
  const now = Date.now();
  
  // Verificar cache
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.isOwner;
  }
  
  try {
    const db = getDbInstance();
    const ownerRef = doc(db, 'owners', user.uid);
    const ownerSnap = await getDoc(ownerRef);
    
    const isOwnerResult = ownerSnap.exists();
    
    // Actualizar cache
    ownerCache.set(user.uid, {
      isOwner: isOwnerResult,
      timestamp: now
    });
    
    return isOwnerResult;
  } catch (error) {
    console.error('Error checking owner status in Firestore:', error);
    // En caso de error, retornar false por seguridad
    return false;
  }
}

/**
 * Limpia el cache de owner (útil después de actualizar roles)
 */
export function clearOwnerCache(userId?: string): void {
  if (userId) {
    ownerCache.delete(userId);
  } else {
    ownerCache.clear();
  }
}

/**
 * @deprecated Ya no se usan custom claims, se usa Firestore
 * Mantenido por compatibilidad
 */
export async function getUserClaims(user: User): Promise<any> {
  const isOwnerResult = await isOwner(user);
  return { owner: isOwnerResult };
}

