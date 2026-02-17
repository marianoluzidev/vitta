import { 
  doc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';

/**
 * Interfaz para el documento de tenant en Firestore
 */
export interface TenantDoc {
  tenantId: string;
  name: string;
  isActive: boolean;
  createdAt: Timestamp | null;
  createdBy: string | null;
  [key: string]: any;
}

/**
 * Interfaz para crear un nuevo tenant
 */
export interface CreateTenantData {
  tenantId: string;
  name: string;
}

/**
 * Normaliza el tenantId: lowercase y solo permite [a-z0-9-]
 */
export function normalizeTenantId(tenantId: string): string {
  return tenantId.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
}

/**
 * Valida que el tenantId sea válido
 */
export function validateTenantId(tenantId: string): { valid: boolean; error?: string } {
  const normalized = normalizeTenantId(tenantId);
  
  if (!tenantId || tenantId.trim().length === 0) {
    return { valid: false, error: 'El tenantId es requerido' };
  }
  
  if (normalized.length === 0) {
    return { valid: false, error: 'El tenantId debe contener al menos un carácter válido (a-z, 0-9, -)' };
  }
  
  if (normalized !== tenantId.toLowerCase().trim()) {
    return { valid: false, error: 'El tenantId solo puede contener letras minúsculas, números y guiones' };
  }
  
  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    return { valid: false, error: 'El tenantId no puede empezar ni terminar con guión' };
  }
  
  if (normalized.length > 50) {
    return { valid: false, error: 'El tenantId no puede tener más de 50 caracteres' };
  }
  
  return { valid: true };
}

/**
 * Verifica si un tenant existe
 */
export async function tenantExists(tenantId: string): Promise<boolean> {
  const normalized = normalizeTenantId(tenantId);
  const db = getDbInstance();
  const tenantRef = doc(db, 'tenants', normalized);
  const tenantSnap = await getDoc(tenantRef);
  return tenantSnap.exists();
}

/**
 * Crea un nuevo tenant en Firestore
 */
export async function createTenant(
  data: CreateTenantData,
  createdBy: string
): Promise<TenantDoc> {
  const normalizedId = normalizeTenantId(data.tenantId);
  
  // Validar tenantId
  const validation = validateTenantId(data.tenantId);
  if (!validation.valid) {
    throw new Error(validation.error || 'TenantId inválido');
  }
  
  // Verificar que no exista
  const exists = await tenantExists(normalizedId);
  if (exists) {
    throw new Error(`El tenant "${normalizedId}" ya existe`);
  }
  
  const db = getDbInstance();
  const tenantRef = doc(db, 'tenants', normalizedId);
  
  const tenantData: Omit<TenantDoc, 'tenantId'> = {
    name: data.name || normalizedId,
    isActive: true,
    createdAt: serverTimestamp() as any,
    createdBy: createdBy,
  };
  
  await setDoc(tenantRef, tenantData);
  
  // Obtener el documento creado para retornarlo
  const tenantSnap = await getDoc(tenantRef);
  if (!tenantSnap.exists()) {
    throw new Error('Error al crear el tenant');
  }
  
  return {
    tenantId: normalizedId,
    ...tenantSnap.data(),
  } as TenantDoc;
}

/**
 * Actualiza el nombre de un tenant
 */
export async function updateTenantName(tenantId: string, name: string): Promise<void> {
  const normalizedId = normalizeTenantId(tenantId);
  const db = getDbInstance();
  const tenantRef = doc(db, 'tenants', normalizedId);
  
  // Verificar que existe
  const exists = await tenantExists(normalizedId);
  if (!exists) {
    throw new Error(`El tenant "${normalizedId}" no existe`);
  }
  
  await updateDoc(tenantRef, {
    name: name || normalizedId,
  });
}

/**
 * Actualiza el estado isActive de un tenant
 */
export async function toggleTenantActive(tenantId: string, isActive: boolean): Promise<void> {
  const normalizedId = normalizeTenantId(tenantId);
  const db = getDbInstance();
  const tenantRef = doc(db, 'tenants', normalizedId);
  
  // Verificar que existe
  const exists = await tenantExists(normalizedId);
  if (!exists) {
    throw new Error(`El tenant "${normalizedId}" no existe`);
  }
  
  await updateDoc(tenantRef, {
    isActive: isActive,
  });
}

/**
 * Lista todos los tenants ordenados por fecha de creación (más recientes primero)
 */
export async function listTenants(limitCount: number = 50): Promise<TenantDoc[]> {
  const db = getDbInstance();
  const tenantsRef = collection(db, 'tenants');
  
  try {
    // Intentar con orderBy primero
    const q = query(tenantsRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    const tenants: TenantDoc[] = [];
    
    querySnapshot.forEach((docSnap) => {
      tenants.push({
        tenantId: docSnap.id,
        ...docSnap.data(),
      } as TenantDoc);
    });
    
    return tenants;
  } catch (error: any) {
    // Si falla por falta de índice, intentar sin orderBy
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.warn('Índice de createdAt no encontrado, cargando sin ordenar...');
      const q = query(tenantsRef, limit(limitCount));
      const querySnapshot = await getDocs(q);
      const tenants: TenantDoc[] = [];
      
      querySnapshot.forEach((docSnap) => {
        tenants.push({
          tenantId: docSnap.id,
          ...docSnap.data(),
        } as TenantDoc);
      });
      
      // Ordenar manualmente por createdAt si existe
      tenants.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      
      return tenants;
    }
    
    // Si es otro error, relanzarlo
    throw error;
  }
}

