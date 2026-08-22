// ============================================================
// FAROS — Compresión de imágenes en el cliente
// El usuario sube la foto que sea (a veces varios MB desde el celular);
// la comprimimos ANTES de subirla a Storage para que el archivo final
// pese poco (foto de perfil no necesita más de ~500px de lado).
// Firestore solo guarda el link (foto_perfil), nunca el binario.
// ============================================================

/**
 * Redimensiona (lado más largo a `maxLado`) y recomprime una imagen a
 * JPEG. Usa <canvas>, no requiere librerías externas. Devuelve un Blob
 * listo para subir a Storage.
 */
export async function comprimirImagen(
  archivo: File,
  { maxLado = 512, calidad = 0.82 }: { maxLado?: number; calidad?: number } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen en este navegador.')
  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
  if (!blob) throw new Error('No se pudo comprimir la imagen.')
  return blob
}
