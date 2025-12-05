import { themes } from './themes'

export { themes }

export function applyTheme(themeName: keyof typeof themes): void {
  const theme = themes[themeName]
  
  if (!theme) {
    return
  }
  
  Object.entries(theme).forEach(([variable, value]) => {
    document.documentElement.style.setProperty(variable, value)
  })
}

