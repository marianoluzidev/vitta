import { themes } from './themes'

export { themes }

export type ThemeDefinition = {
  '--ion-color-primary': string
  '--ion-color-primary-contrast': string
  '--ion-color-primary-shade': string
  '--ion-color-primary-tint': string
  '--ion-color-secondary': string
  '--ion-color-secondary-contrast': string
  '--ion-color-secondary-shade': string
  '--ion-color-secondary-tint': string
  '--ion-background-color': string
  '--background'?: string
  '--ion-text-color': string
  '--ion-toolbar-background': string
  '--ion-toolbar-color': string
  '--ion-tab-bar-background': string
  '--ion-tab-bar-color': string
  '--ion-item-background': string
  '--ion-card-background'?: string
}

// Legacy type for backward compatibility
export type ThemeObject = ThemeDefinition

/**
 * Applies a theme definition directly
 */
export function applyThemeDefinition(theme: ThemeDefinition): void {
  const root = document.documentElement
  Object.entries(theme).forEach(([variable, value]) => {
    if (value !== undefined) {
      root.style.setProperty(variable, value)
    }
  })
}

/**
 * Applies a theme by name (predefined) or theme object
 */
export function applyTheme(themeName: keyof typeof themes): void
export function applyTheme(themeObject: ThemeDefinition): void
export function applyTheme(themeNameOrObject: keyof typeof themes | ThemeDefinition): void {
  let theme: ThemeDefinition | undefined
  
  if (typeof themeNameOrObject === 'string') {
    theme = themes[themeNameOrObject]
  } else {
    theme = themeNameOrObject
  }
  
  if (!theme) {
    return
  }
  
  applyThemeDefinition(theme)
}
