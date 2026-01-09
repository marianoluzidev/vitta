/**
 * Helper functions for color manipulation
 */

/**
 * Converts hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] {
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
 * Converts RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Darkens a color by a percentage (0-1)
 */
export function darkenColor(hex: string, amount: number = 0.15): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.max(0, r * (1 - amount)),
    Math.max(0, g * (1 - amount)),
    Math.max(0, b * (1 - amount))
  )
}

/**
 * Lightens a color by a percentage (0-1)
 */
export function lightenColor(hex: string, amount: number = 0.15): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(
    Math.min(255, r + (255 - r) * amount),
    Math.min(255, g + (255 - g) * amount),
    Math.min(255, b + (255 - b) * amount)
  )
}

/**
 * Gets a contrasting color (black or white) for text on a background
 */
export function getContrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

/**
 * Calculates relative luminance according to WCAG 2.1
 * Returns a value between 0 (black) and 1 (white)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculates contrast ratio between two colors according to WCAG 2.1
 */
function getContrastRatio(color1: string, color2: string): number {
  const [r1, g1, b1] = hexToRgb(color1)
  const [r2, g2, b2] = hexToRgb(color2)
  const lum1 = getLuminance(r1, g1, b1)
  const lum2 = getLuminance(r2, g2, b2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Determines readable text color (black or white) based on WCAG contrast requirements
 * Uses a contrast ratio threshold of 4.5:1 for normal text
 */
export function getReadableTextColor(backgroundColor: string): string {
  const blackContrast = getContrastRatio(backgroundColor, '#000000')
  const whiteContrast = getContrastRatio(backgroundColor, '#ffffff')
  
  // Prefer white if both meet minimum contrast, otherwise choose the one with better contrast
  if (whiteContrast >= 4.5 && blackContrast < 4.5) {
    return '#ffffff'
  }
  if (blackContrast >= 4.5 && whiteContrast < 4.5) {
    return '#000000'
  }
  // If both meet minimum, choose the one with better contrast
  return whiteContrast > blackContrast ? '#ffffff' : '#000000'
}

/**
 * Lightens a color by a percentage (0-1)
 * Alias for lightenColor for consistency
 */
export function lighten(hex: string, percent: number): string {
  return lightenColor(hex, percent)
}

/**
 * Darkens a color by a percentage (0-1)
 * Alias for darkenColor for consistency
 */
export function darken(hex: string, percent: number): string {
  return darkenColor(hex, percent)
}

/**
 * Adjusts the luminance of a color by a specific amount
 * Positive values lighten, negative values darken
 * Amount is typically between -1 and 1
 */
export function adjustLuminance(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const currentLum = getLuminance(r, g, b)
  const targetLum = Math.max(0, Math.min(1, currentLum + amount))
  
  // If target is same as current, return original
  if (Math.abs(targetLum - currentLum) < 0.01) {
    return hex
  }
  
  // Binary search to find RGB values that match target luminance
  let low = 0
  let high = 255
  let bestRgb: [number, number, number] = [r, g, b]
  let bestDiff = Math.abs(getLuminance(r, g, b) - targetLum)
  
  // Try to adjust all channels proportionally
  const factor = targetLum / currentLum
  const newR = Math.max(0, Math.min(255, r * factor))
  const newG = Math.max(0, Math.min(255, g * factor))
  const newB = Math.max(0, Math.min(255, b * factor))
  
  // Refine by adjusting each channel
  const channels: Array<'r' | 'g' | 'b'> = ['r', 'g', 'b']
  const rgb: { r: number; g: number; b: number } = { r: newR, g: newG, b: newB }
  
  for (const channel of channels) {
    let low = 0
    let high = 255
    let best = rgb[channel]
    let bestDiff = Math.abs(getLuminance(rgb.r, rgb.g, rgb.b) - targetLum)
    
    // Binary search for this channel
    for (let i = 0; i < 8; i++) {
      const mid = (low + high) / 2
      rgb[channel] = mid
      const lum = getLuminance(rgb.r, rgb.g, rgb.b)
      const diff = Math.abs(lum - targetLum)
      
      if (diff < bestDiff) {
        bestDiff = diff
        best = mid
      }
      
      if (lum < targetLum) {
        low = mid
      } else {
        high = mid
      }
    }
    
    rgb[channel] = best
  }
  
  return rgbToHex(Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b))
}

/**
 * Mixes two colors by a percentage
 * Percent is 0-1, where 0 = color1, 1 = color2
 */
export function mix(color1: string, color2: string, percent: number): string {
  const [r1, g1, b1] = hexToRgb(color1)
  const [r2, g2, b2] = hexToRgb(color2)
  
  const r = Math.round(r1 + (r2 - r1) * percent)
  const g = Math.round(g1 + (g2 - g1) * percent)
  const b = Math.round(b1 + (b2 - b1) * percent)
  
  return rgbToHex(r, g, b)
}

/**
 * Converts RGB array to hex string
 */
export function rgbArrayToHex(rgb: [number, number, number]): string {
  return rgbToHex(rgb[0], rgb[1], rgb[2])
}

