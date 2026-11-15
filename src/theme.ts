import type { ProfileSettings } from './types'

export const DEFAULT_PRIMARY = '#4c91b8'
export const DEFAULT_SECONDARY = '#e58eab'
const CACHE_KEY = 'minha-vida-profile'

export const colorPresets: { name: string; primary: string; secondary: string }[] = [
  { name: 'Azul', primary: '#4c91b8', secondary: '#e58eab' },
  { name: 'Rosa', primary: '#c8567f', secondary: '#6aa9c9' },
  { name: 'Roxo', primary: '#7459b8', secondary: '#f0a35e' },
  { name: 'Verde', primary: '#3b8f78', secondary: '#f08f8f' },
  { name: 'Coral', primary: '#d86a52', secondary: '#4f9bbd' },
  { name: 'Grafite', primary: '#4a5a68', secondary: '#e58eab' },
]

export function normalizeHex(value: string | undefined) {
  const text = (value ?? '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : null
}

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number]
}

function toHex(rgb: number[]) {
  return `#${rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`
}

function mix(hex: string, other: string, amount: number) {
  const a = toRgb(hex)
  const b = toRgb(other)
  return toHex(a.map((value, index) => value + (b[index] - value) * amount))
}

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** A barra lateral usa texto branco: escurece a cor se ela for clara demais para ler. */
function readableOnWhite(hex: string) {
  let color = hex
  for (let step = 0; step < 12 && luminance(color) > 0.28; step += 1) color = mix(color, '#000000', 0.1)
  return color
}

const THEME_PROPERTIES = ['--blue', '--blue-dark', '--blue-rgb', '--sky-soft', '--coral', '--pink', '--pink-soft']

export function applyTheme(profile?: Pick<ProfileSettings, 'primary' | 'secondary'> | null) {
  const root = document.documentElement
  const primaryInput = normalizeHex(profile?.primary)
  const secondaryInput = normalizeHex(profile?.secondary)
  for (const name of THEME_PROPERTIES) root.style.removeProperty(name)
  if (primaryInput && primaryInput !== DEFAULT_PRIMARY) {
    const primary = readableOnWhite(primaryInput)
    root.style.setProperty('--blue', primary)
    root.style.setProperty('--blue-dark', mix(primary, '#000000', 0.22))
    root.style.setProperty('--blue-rgb', toRgb(primary).join(', '))
    root.style.setProperty('--sky-soft', mix(primary, '#ffffff', 0.9))
  }
  if (secondaryInput && secondaryInput !== DEFAULT_SECONDARY) {
    root.style.setProperty('--coral', secondaryInput)
    root.style.setProperty('--pink', mix(secondaryInput, '#ffffff', 0.55))
    root.style.setProperty('--pink-soft', mix(secondaryInput, '#ffffff', 0.9))
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', primaryInput ? readableOnWhite(primaryInput) : DEFAULT_PRIMARY)
}

export function readCachedProfile(): ProfileSettings | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as ProfileSettings | null
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch { return null }
}

export function cacheProfile(profile: ProfileSettings | null) {
  try {
    if (profile) localStorage.setItem(CACHE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(CACHE_KEY)
  } catch { /* ignorado */ }
}

/** Recorta a foto em quadrado e reduz para caber folgado no documento do Firestore. */
export async function compressAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if (file.size > 12 * 1024 * 1024) throw new Error('Essa foto tem mais de 12 MB. Escolha uma menor.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Não consegui abrir essa imagem. Tente uma foto em JPEG ou PNG.'))
    })
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const size = Math.min(256, side)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não consegui preparar a imagem neste aparelho.')
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= 70_000) return dataUrl
    }
    throw new Error('Essa foto não coube no tamanho permitido. Tente outra.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
