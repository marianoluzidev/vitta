/**
 * Advanced theme generation from images using Vibrant.js
 */
import { Vibrant } from 'node-vibrant/browser'
import type { ThemeDefinition } from './applyTheme'
import {
  getReadableTextColor,
  lighten,
  darken,
  adjustLuminance,
  mix,
  rgbArrayToHex,
} from './utils'

/**
 * Generates a complete ThemeDefinition from an image using Vibrant.js
 * Extracts vibrant colors and creates a cohesive theme with proper contrast
 */
export async function generateFullThemeFromImage(
  image: HTMLImageElement
): Promise<ThemeDefinition> {
  // Extract color palette using Vibrant.js
  const vibrant = new Vibrant(image)
  const palette = await vibrant.getPalette()

  // Extract colors from palette
  const vibrantColor = palette.Vibrant?.hex
  const mutedColor = palette.Muted?.hex
  const darkVibrantColor = palette.DarkVibrant?.hex
  const lightVibrantColor = palette.LightVibrant?.hex
  const darkMutedColor = palette.DarkMuted?.hex
  const lightMutedColor = palette.LightMuted?.hex

  // Choose primary color: prefer Vibrant, fallback to DarkVibrant or first available
  const primary =
    vibrantColor ||
    darkVibrantColor ||
    lightVibrantColor ||
    mutedColor ||
    '#08b8a4' // fallback

  // Choose secondary color: prefer LightVibrant or Muted, fallback to complementary
  const secondary =
    lightVibrantColor ||
    mutedColor ||
    lightMutedColor ||
    darkVibrantColor ||
    adjustLuminance(primary, 0.2) // fallback: lighter version of primary

  // Determine background color based on luminosity of the largest vibrant/muted color
  const candidateColors = [
    { color: vibrantColor, population: palette.Vibrant?.population || 0 },
    { color: mutedColor, population: palette.Muted?.population || 0 },
    { color: darkVibrantColor, population: palette.DarkVibrant?.population || 0 },
    { color: lightVibrantColor, population: palette.LightVibrant?.population || 0 },
    { color: darkMutedColor, population: palette.DarkMuted?.population || 0 },
    { color: lightMutedColor, population: palette.LightMuted?.population || 0 },
  ]
    .filter((item): item is { color: string; population: number } => !!item.color)
    .sort((a, b) => b.population - a.population)

  // Get the most prominent color
  const dominantColor = candidateColors[0]?.color || primary

  // Calculate average luminosity of dominant colors
  const colorsForLuminance = candidateColors.slice(0, 3).map((c) => c.color)
  let totalLuminance = 0
  let count = 0

  for (const color of colorsForLuminance) {
    if (color) {
      const [r, g, b] = parseHex(color)
      // Simple luminance calculation
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      totalLuminance += lum
      count++
    }
  }

  const avgLuminance = count > 0 ? totalLuminance / count : 0.5

  // Generate background based on average luminosity
  // If average is dark, use light background; if light, use slightly tinted background
  let background: string
  if (avgLuminance < 0.4) {
    // Dark colors dominate -> use light background with slight tint
    background = lighten(dominantColor, 0.85)
  } else if (avgLuminance > 0.7) {
    // Light colors dominate -> use very light background
    background = lighten(dominantColor, 0.9)
  } else {
    // Medium colors -> use neutral light background with subtle tint
    background = mix('#ffffff', dominantColor, 0.1)
  }

  // Ensure background is light enough for readability
  const bgLuminance = getLuminanceFromHex(background)
  if (bgLuminance < 0.85) {
    background = lighten(background, 0.3)
  }

  // Auto-adjust text color based on background
  const textColor = getReadableTextColor(background)

  // Generate Ionic-specific colors
  const primaryContrast = getReadableTextColor(primary)
  const primaryShade = darken(primary, 0.15)
  const primaryTint = lighten(primary, 0.15)

  const secondaryContrast = getReadableTextColor(secondary)
  const secondaryShade = darken(secondary, 0.15)
  const secondaryTint = lighten(secondary, 0.15)

  // Generate toolbar background: use primary or a slightly darker variant
  const toolbarBackground = primary
  const toolbarColor = primaryContrast

  // Generate tab bar: use background with primary accent
  const tabBarBackground = background
  const tabBarColor = primary

  // Generate item background: slightly lighter than main background for subtle contrast
  const itemBackground = bgLuminance > 0.95 ? background : lighten(background, 0.02)

  // Generate card background: white or very light tint
  const cardBackground = bgLuminance > 0.95 ? '#ffffff' : lighten(background, 0.05)

  // Build complete theme definition
  const theme: ThemeDefinition = {
    '--ion-color-primary': primary,
    '--ion-color-primary-contrast': primaryContrast,
    '--ion-color-primary-shade': primaryShade,
    '--ion-color-primary-tint': primaryTint,
    '--ion-color-secondary': secondary,
    '--ion-color-secondary-contrast': secondaryContrast,
    '--ion-color-secondary-shade': secondaryShade,
    '--ion-color-secondary-tint': secondaryTint,
    '--ion-background-color': background,
    '--background': background,
    '--ion-text-color': textColor,
    '--ion-toolbar-background': toolbarBackground,
    '--ion-toolbar-color': toolbarColor,
    '--ion-tab-bar-background': tabBarBackground,
    '--ion-tab-bar-color': tabBarColor,
    '--ion-item-background': itemBackground,
    '--ion-card-background': cardBackground,
  }

  return theme
}

/**
 * Helper function to parse hex color to RGB
 */
function parseHex(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ]
}

/**
 * Helper function to calculate luminance from hex
 */
function getLuminanceFromHex(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

