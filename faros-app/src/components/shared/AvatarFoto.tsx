'use client'

// ============================================================
// FAROS — Avatar con foto de perfil (subir/cambiar)
// El usuario elige una imagen → se comprime en el navegador (lib/imagen)
// → se sube a Storage en perfiles/{uid}/avatar.jpg (sobreescribe, no
// acumula archivos) → se guarda solo el link en usuarios/{uid}.foto_perfil.
// Sin foto: muestra las iniciales, igual que antes.
// ============================================================

import { useRef, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { motion, AnimatePresence } from 'motion/react'
import { recortarImagen, comprimirImagen } from '@/lib/imagen'
import { updateFotoPerfil } from '@/lib/firestore'
import { getFirebase } from '@/lib/firebase'

interface Props {
  uid: string
  fotoUrl?: string | null
  iniciales: string
  onSubida?: (url: string) => void
  size?: 'md' | 'lg'
}

export function AvatarFoto({ uid, fotoUrl, iniciales, onSubida, size = 'lg' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Estados del recortador
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixelCrop, setPixelCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const dim = size === 'lg' ? 'w-20 h-20 rounded-3xl' : 'w-14 h-14 rounded-2xl'

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropImageSrc(url)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setPixelCrop(croppedAreaPixels)
  }, [])

  async function handleCrop() {
    if (!cropImageSrc || !pixelCrop) return
    setError(null)
    setSubiendo(true)
    const currentSrc = cropImageSrc
    setCropImageSrc(null) // Cerrar modal inmediatamente

    try {
      const croppedBlob = await recortarImagen(currentSrc, pixelCrop)
      // Convertir el blob a File para pasar por el flujo de comprimirImagen (por si acaso excede el tamaño, aunque el canvas ya limitó dimensiones)
      const croppedFile = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" })
      const blob = await comprimirImagen(croppedFile)
      
      setPreviewUrl(URL.createObjectURL(blob))

      const [{ storage }, { ref, uploadBytes, getDownloadURL }] = await Promise.all([
        getFirebase(), import('firebase/storage'),
      ])
      const storageRef = ref(storage, `perfiles/${uid}/avatar.jpg`)
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
      const url = await getDownloadURL(storageRef)

      await updateFotoPerfil(uid, url)
      onSubida?.(url)
    } catch (err) {
      console.error(err)
      setError('No se pudo subir la foto. Intenta con otra imagen.')
      setPreviewUrl(null)
    } finally {
      setSubiendo(false)
      URL.revokeObjectURL(currentSrc)
    }
  }

  const mostrar = previewUrl ?? fotoUrl

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className={`relative group shrink-0 ${dim} overflow-hidden bg-[var(--color-primary-fixed)] text-black flex items-center justify-center font-display text-2xl font-black disabled:cursor-wait`}
          title="Cambiar foto de perfil"
        >
          {mostrar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mostrar} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            iniciales
          )}
          <span className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${
            subiendo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <span className="material-symbols-outlined text-white text-[20px]">
              {subiendo ? 'hourglass_top' : 'photo_camera'}
            </span>
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        {error && <p className="text-[10px] text-[var(--color-danger-crimson)] max-w-[140px]">{error}</p>}
      </div>

      <AnimatePresence>
        {cropImageSrc && (
          <div className="fixed inset-0 z-[999] flex flex-col bg-black/95 backdrop-blur-sm">
            <div className="relative flex-1">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-5 md:p-8 shrink-0 flex flex-col gap-5 border-t border-white/10 bg-black">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-white/50 text-[18px]">zoom_out</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-[var(--color-primary-fixed)]"
                />
                <span className="material-symbols-outlined text-white/50 text-[18px]">zoom_in</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <button
                  type="button"
                  onClick={() => setCropImageSrc(null)}
                  className="px-6 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCrop}
                  className="flex-1 max-w-[200px] px-6 py-3 rounded-xl bg-[var(--color-primary-fixed)] text-black font-semibold hover:brightness-110 transition-colors"
                >
                  Recortar y subir
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
