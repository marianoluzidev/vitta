/**
 * Interfaz para el tema de branding
 */
export interface Theme {
  name: string;
  primary: string;
  accent: string;
  background?: string;
  text?: string;
}

let currentTheme: Theme | null = null;
const themeCache = new Map<string, Theme>();

/**
 * Carga el tema de branding para un tenant
 */
export async function loadTheme(tenantId: string): Promise<Theme> {
  // Verificar cache
  if (themeCache.has(tenantId)) {
    return themeCache.get(tenantId)!;
  }

  let theme: Theme | null = null;

  // Intentar cargar el tema del tenant
  try {
    const response = await fetch(`/branding/${tenantId}/theme.json`);
    if (response.ok) {
      theme = await response.json();
    }
  } catch (error) {
    console.warn(`Failed to load theme for tenant ${tenantId}:`, error);
  }

  // Si no existe, usar el tema por defecto
  if (!theme) {
    try {
      const response = await fetch('/branding/default/theme.json');
      if (response.ok) {
        theme = await response.json();
      }
    } catch (error) {
      console.error('Failed to load default theme:', error);
      // Tema fallback si no se puede cargar nada
      theme = {
        name: 'Vitta',
        primary: '#007aff',
        accent: '#34c759',
        background: '#ffffff',
        text: '#000000',
      };
    }
  }

  // Validar que el tema tenga las propiedades requeridas
  if (!theme || !theme.name || !theme.primary || !theme.accent) {
    theme = {
      name: theme?.name || 'Vitta',
      primary: theme?.primary || '#007aff',
      accent: theme?.accent || '#34c759',
      background: theme?.background || '#ffffff',
      text: theme?.text || '#000000',
    };
  }

  // Guardar en cache (theme ya no puede ser null aquí)
  themeCache.set(tenantId, theme);
  return theme;
}

/**
 * Aplica el tema a las CSS variables del documento
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.style.setProperty('--vitta-primary', theme.primary);
  root.style.setProperty('--vitta-accent', theme.accent);
  root.style.setProperty('--vitta-background', theme.background || '#ffffff');
  root.style.setProperty('--vitta-text', theme.text || '#000000');
  root.style.setProperty('--vitta-name', `"${theme.name}"`);
}

/**
 * Carga un archivo CSS dinámicamente
 * Retorna una Promise que se resuelve cuando el CSS se ha cargado
 */
function loadCSS(href: string, id?: string, forceReload: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    // Si existe y no forzamos recarga, no hacer nada
    if (id && document.getElementById(id) && !forceReload) {
      resolve();
      return;
    }

    // Si existe y forzamos recarga, removerlo primero
    if (id && document.getElementById(id) && forceReload) {
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
      }
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // Agregar timestamp para evitar caché
    const separator = href.includes('?') ? '&' : '?';
    link.href = `${href}${separator}_t=${Date.now()}`;
    if (id) {
      link.id = id;
    }
    
    // Esperar a que el CSS se cargue
    link.onload = () => {
      console.log(`CSS loaded: ${href}`);
      resolve();
    };
    link.onerror = () => {
      console.error(`Failed to load CSS: ${href}`);
      reject(new Error(`Failed to load CSS: ${href}`));
    };
    
    document.head.appendChild(link);
  });
}

/**
 * Actualiza el manifest dinámicamente
 */
function updateManifest(manifestPath: string): void {
  const existingManifest = document.querySelector('link[rel="manifest"]');
  if (existingManifest) {
    existingManifest.setAttribute('href', manifestPath);
  } else {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestPath;
    document.head.appendChild(link);
  }
}

/**
 * Actualiza los iconos dinámicamente
 */
function updateIcons(tenantId: string, basePath: string = `/branding/${tenantId}/icons`): void {
  // Actualizar apple-touch-icon
  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon) {
    appleIcon.setAttribute('href', `${basePath}/apple-touch-icon.png`);
  } else {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = `${basePath}/apple-touch-icon.png`;
    document.head.appendChild(link);
  }

  // Actualizar favicon
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.setAttribute('href', `${basePath}/favicon.png`);
  } else {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = `${basePath}/favicon.png`;
    document.head.appendChild(link);
  }
}

/**
 * Restaura los recursos por defecto (para cuando se sale del tenant)
 */
export function restoreDefaultBranding(): void {
  // Remover CSS del tenant si existe
  const tenantCSS = document.getElementById('tenant-css');
  if (tenantCSS) {
    tenantCSS.remove();
  }
  const defaultCSS = document.getElementById('default-tenant-css');
  if (defaultCSS) {
    defaultCSS.remove();
  }

  // Restaurar variables CSS por defecto
  const root = document.documentElement;
  root.style.setProperty('--vitta-primary', '#007aff');
  root.style.setProperty('--vitta-accent', '#34c759');
  root.style.setProperty('--vitta-background', '#ffffff');
  root.style.setProperty('--vitta-text', '#000000');
  root.style.setProperty('--vitta-name', '"Vitta"');
  currentTheme = null;

  // Restaurar manifest por defecto
  updateManifest('/manifest.json');

  // Restaurar iconos por defecto
  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon) {
    appleIcon.setAttribute('href', 'icons/apple-touch-icon.png');
  }
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.setAttribute('href', 'icons/favicon.png');
  }
}

/**
 * Carga y aplica el tema para un tenant
 */
export async function loadAndApplyTheme(tenantId: string): Promise<Theme> {
  const theme = await loadTheme(tenantId);
  // theme nunca será null porque loadTheme siempre retorna un Theme válido
  
  // Aplicar el tema PRIMERO (define las variables CSS)
  applyTheme(theme);
  currentTheme = theme;
  console.log(`[Branding] Theme applied for tenant ${tenantId}:`, theme);
  console.log(`[Branding] CSS Variables:`, {
    primary: getComputedStyle(document.documentElement).getPropertyValue('--vitta-primary'),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--vitta-accent'),
  });

  // Cargar CSS del tenant DESPUÉS de aplicar el tema
  // El CSS del tenant solo debe usar las variables, no definirlas
  try {
    // Primero remover CSS anterior si existe (tanto tenant-css como default-tenant-css)
    const existingTenantCSS = document.getElementById('tenant-css');
    if (existingTenantCSS) {
      console.log('[Branding] Removing existing tenant CSS');
      existingTenantCSS.remove();
    }
    const existingDefaultCSS = document.getElementById('default-tenant-css');
    if (existingDefaultCSS) {
      console.log('[Branding] Removing existing default CSS');
      existingDefaultCSS.remove();
    }

    // Intentar cargar CSS del tenant específico
    const cssUrl = `/branding/${tenantId}/tenant.css?_t=${Date.now()}`;
    console.log(`[Branding] Attempting to load CSS from: ${cssUrl}`);
    const cssResponse = await fetch(cssUrl);
    if (cssResponse.ok) {
      await loadCSS(`/branding/${tenantId}/tenant.css`, 'tenant-css', true);
      console.log(`[Branding] ✅ Loaded CSS for tenant: ${tenantId}`);
      
      // Verificar que el CSS se cargó
      const loadedCSS = document.getElementById('tenant-css');
      if (loadedCSS) {
        console.log('[Branding] ✅ CSS element found in DOM:', loadedCSS.href);
      } else {
        console.error('[Branding] ❌ CSS element NOT found in DOM after loading');
      }
    } else {
      // Si no existe, usar CSS por defecto
      console.log(`[Branding] Tenant CSS not found (${cssResponse.status}), using default`);
      await loadCSS('/branding/default/tenant.css', 'tenant-css', true);
      console.log(`[Branding] Using default CSS for tenant: ${tenantId}`);
    }
  } catch (error) {
    console.error(`[Branding] ❌ Failed to load CSS for tenant ${tenantId}:`, error);
    try {
      await loadCSS('/branding/default/tenant.css', 'tenant-css', true);
      console.log('[Branding] Fallback: Loaded default CSS');
    } catch (defaultError) {
      console.error('[Branding] ❌ Failed to load default CSS:', defaultError);
    }
  }

  // Cargar manifest del tenant
  try {
    const manifestResponse = await fetch(`/branding/${tenantId}/manifest.json`);
    if (manifestResponse.ok) {
      updateManifest(`/branding/${tenantId}/manifest.json`);
    } else {
      updateManifest('/manifest.json');
    }
  } catch (error) {
    console.warn(`Failed to load manifest for tenant ${tenantId}, using default:`, error);
    updateManifest('/manifest.json');
  }

  // Actualizar iconos del tenant
  try {
    const iconResponse = await fetch(`/branding/${tenantId}/icons/favicon.png`);
    if (iconResponse.ok) {
      updateIcons(tenantId);
    } else {
      // Restaurar iconos por defecto si no existen
      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (appleIcon) {
        appleIcon.setAttribute('href', 'icons/apple-touch-icon.png');
      }
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.setAttribute('href', 'icons/favicon.png');
      }
    }
  } catch (error) {
    console.warn(`Failed to load icons for tenant ${tenantId}, using default:`, error);
  }

  return theme;
}

/**
 * Obtiene el tema actual
 */
export function getCurrentTheme(): Theme | null {
  return currentTheme;
}

/**
 * Limpia el cache de temas
 */
export function clearThemeCache(): void {
  themeCache.clear();
  currentTheme = null;
}

