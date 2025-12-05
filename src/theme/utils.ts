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

