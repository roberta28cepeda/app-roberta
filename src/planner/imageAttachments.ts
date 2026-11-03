import type { WishlistAttachment } from '../types'

export const MAX_WISHLIST_ATTACHMENTS = 3
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_DATA_URL_CHARS = 185_000

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function compressWishlistImage(file: File): Promise<WishlistAttachment> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Esse print tem mais de 12 MB. Escolha uma imagem menor.')

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Não consegui abrir essa imagem. Tente um print em PNG ou JPEG.'))
    })

    const maxSides = [1280, 1040, 840, 680]
    const qualities = [0.76, 0.64, 0.52, 0.40]
    for (const maxSide of maxSides) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Não consegui preparar a imagem neste aparelho.')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        if (dataUrl.length <= MAX_DATA_URL_CHARS) {
          const originalName = file.name.trim().slice(0, 72) || 'print'
          return { id: makeId(), name: originalName, dataUrl }
        }
      }
    }
    throw new Error('Esse print não coube no tamanho permitido mesmo após a compressão.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
