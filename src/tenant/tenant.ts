/**
 * Extrae el tenantId de una ruta.
 * Las rutas deben seguir el formato: /t/<tenantId>/...
 * 
 * @param pathname - La ruta a analizar. Por defecto usa window.location.pathname
 * @returns El tenantId si existe, null en caso contrario
 */
export function getTenantIdFromPath(
  pathname: string = window.location.pathname
): string | null {
  // Patrón para rutas tipo /t/<tenantId>/...
  const tenantPattern = /^\/t\/([^\/]+)/;
  const match = pathname.match(tenantPattern);

  if (match && match[1]) {
    const tenantId = match[1];
    // Validar que el tenantId no esté vacío y no contenga caracteres inválidos
    if (tenantId && tenantId.trim().length > 0) {
      return tenantId;
    }
  }

  return null;
}

