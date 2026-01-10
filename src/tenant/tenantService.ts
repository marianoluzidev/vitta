import { doc, getDoc, DocumentSnapshot } from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';

/**
 * Interfaz para el documento de tenant en Firestore
 */
export interface Tenant {
  id: string;
  isActive: boolean;
  name?: string;
  [key: string]: any; // Permitir campos adicionales
}

/**
 * Cache simple en memoria por tenantId
 */
const tenantCache = new Map<string, { tenant: Tenant | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene un tenant desde Firestore por su ID
 * @param tenantId ID del tenant
 * @returns Tenant si existe y está activo, null si no existe
 */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  if (!tenantId || tenantId.trim().length === 0) {
    return null;
  }

  // Verificar cache
  const cached = tenantCache.get(tenantId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.tenant;
  }

  try {
    const db = getDbInstance();
    const tenantRef = doc(db, 'tenants', tenantId);
    const tenantSnap: DocumentSnapshot = await getDoc(tenantRef);

    let tenant: Tenant | null = null;

    if (tenantSnap.exists()) {
      const data = tenantSnap.data();
      tenant = {
        id: tenantSnap.id,
        ...data,
      } as Tenant;
    }

    // Guardar en cache (incluso si es null para evitar consultas repetidas)
    tenantCache.set(tenantId, {
      tenant,
      timestamp: now,
    });

    return tenant;
  } catch (error) {
    console.error(`Error fetching tenant ${tenantId}:`, error);
    // En caso de error, no cachear para permitir reintentos
    return null;
  }
}

/**
 * Limpia el cache de tenants
 */
export function clearTenantCache(): void {
  tenantCache.clear();
}

/**
 * Limpia el cache de un tenant específico
 */
export function clearTenantCacheFor(tenantId: string): void {
  tenantCache.delete(tenantId);
}

