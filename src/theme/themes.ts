import type { ThemeDefinition } from './applyTheme'
import { darkenColor, lightenColor, getContrastColor } from './utils'

function createTheme(
  primary: string,
  secondary: string,
  background: string = '#ffffff',
  textColor: string = '#222222'
): ThemeDefinition {
  return {
    '--ion-color-primary': primary,
    '--ion-color-primary-contrast': getContrastColor(primary),
    '--ion-color-primary-shade': darkenColor(primary, 0.15),
    '--ion-color-primary-tint': lightenColor(primary, 0.15),
    '--ion-color-secondary': secondary,
    '--ion-color-secondary-contrast': getContrastColor(secondary),
    '--ion-color-secondary-shade': darkenColor(secondary, 0.15),
    '--ion-color-secondary-tint': lightenColor(secondary, 0.15),
    '--ion-background-color': background,
    '--ion-text-color': textColor,
    '--ion-toolbar-background': primary,
    '--ion-toolbar-color': getContrastColor(primary),
    '--ion-tab-bar-background': background,
    '--ion-tab-bar-color': textColor,
    '--ion-item-background': background,
    '--ion-card-background': background,
  }
}

export const themes: Record<string, ThemeDefinition> = {
  vitta: createTheme('#08b8a4', '#0ec4b0', '#ffffff', '#222222'),
  lavanda: createTheme('#8e7bef', '#bca6ff', '#ffffff', '#222222'),
  rosa: createTheme('#ff7ba5', '#ff9bc0', '#ffffff', '#222222'),
  dark: createTheme('#1fdfd4', '#3fffe9', '#121212', '#f5f5f5'),
  aquaFull: {
    '--ion-color-primary': '#08b8a4',
    '--ion-color-primary-contrast': '#ffffff',
    '--ion-color-primary-shade': '#079a8c',
    '--ion-color-primary-tint': '#1ac2af',
    '--ion-color-secondary': '#006d5f',
    '--ion-color-secondary-contrast': '#ffffff',
    '--ion-color-secondary-shade': '#00554a',
    '--ion-color-secondary-tint': '#1f8577',
    '--ion-background-color': '#e6f8f4',
    '--background': '#e6f8f4',
    '--ion-text-color': '#222222',
    '--ion-toolbar-background': '#08b8a4',
    '--ion-toolbar-color': '#ffffff',
    '--ion-tab-bar-background': '#ffffff',
    '--ion-tab-bar-color': '#08b8a4',
    '--ion-item-background': '#ffffff',
    '--ion-card-background': '#ffffff',
  },
}
