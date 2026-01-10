/**
 * Utilidad para esperar a que el router de Framework7 esté listo
 */

let routerReady = false;
let routerReadyResolvers: Array<() => void> = [];
let routerReadyPromise: Promise<void> | null = null;

/**
 * Marca el router como listo (llamar desde app.vue cuando f7ready)
 */
export function setRouterReady(): void {
  if (routerReady) return;
  
  routerReady = true;
  routerReadyResolvers.forEach(resolve => resolve());
  routerReadyResolvers = [];
}

/**
 * Espera a que el router esté listo
 */
export function waitForRouterReady(): Promise<void> {
  if (routerReady) {
    return Promise.resolve();
  }
  
  if (!routerReadyPromise) {
    routerReadyPromise = new Promise((resolve) => {
      routerReadyResolvers.push(resolve);
    });
  }
  
  return routerReadyPromise;
}

/**
 * Verifica si el router está listo
 */
export function isRouterReady(): boolean {
  return routerReady;
}

