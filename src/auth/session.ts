import { User } from 'firebase/auth';
import { onAuthChanged } from './auth';

let currentUser: User | null = null;
let isReady = false;
let readyResolvers: Array<() => void> = [];
let readyPromise: Promise<void> | null = null;

/**
 * Inicializa el listener de autenticación
 */
export function setupAuthListener(): void {
  onAuthChanged((user) => {
    currentUser = user;
    if (!isReady) {
      isReady = true;
      // Resolver todas las promesas pendientes
      readyResolvers.forEach(resolve => resolve());
      readyResolvers = [];
    }
  });
}

/**
 * Espera a que la sesión esté lista (onAuthStateChanged haya disparado al menos una vez)
 */
export function requireAuthReady(): Promise<void> {
  if (isReady) {
    return Promise.resolve();
  }
  
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      readyResolvers.push(resolve);
    });
  }
  
  return readyPromise;
}

/**
 * Obtiene el usuario actual
 */
export function getCurrentUser(): User | null {
  return currentUser;
}

/**
 * Verifica si hay un usuario autenticado
 */
export function isAuthenticated(): boolean {
  return currentUser !== null;
}

/**
 * Verifica si la sesión está lista
 */
export function getIsReady(): boolean {
  return isReady;
}

