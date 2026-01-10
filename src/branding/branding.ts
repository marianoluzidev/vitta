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
 * Carga y aplica el tema para un tenant
 */
export async function loadAndApplyTheme(tenantId: string): Promise<Theme> {
  const theme = await loadTheme(tenantId);
  // theme nunca será null porque loadTheme siempre retorna un Theme válido
  applyTheme(theme);
  currentTheme = theme;
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

