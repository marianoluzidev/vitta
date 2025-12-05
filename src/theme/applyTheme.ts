import { themes } from './themes'

export { themes }

export type ThemeObject = {
  '--ion-color-primary': string
  '--ion-color-secondary': string
  '--ion-background-color': string
  '--ion-text-color': string
}

export function applyTheme(themeName: keyof typeof themes): void
export function applyTheme(themeObject: ThemeObject): void
export function applyTheme(themeNameOrObject: keyof typeof themes | ThemeObject): void {
  let theme: ThemeObject | undefined
  
  if (typeof themeNameOrObject === 'string') {
    theme = themes[themeNameOrObject]
  } else {
    theme = themeNameOrObject
  }
  
  if (!theme) {
    return
  }
  
  Object.entries(theme).forEach(([variable, value]) => {
    document.documentElement.style.setProperty(variable, value)
  })
}

