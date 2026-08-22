'use client'

// ============================================================
// FAROS — Avatar con foto de perfil (subir/cambiar)
// El usuario elige una imagen → se comprime en el navegador (lib/imagen)
// → se sube a Storage en perfiles/{uid}/avatar.jpg (sobreescribe, no
// acumula archivos) → se guarda solo el link en usuarios/{uid}.foto_perfil.
// Sin foto: muestra las iniciales, igual que antes.
// ============================================================

import { useRef, useState } from 'react'
import { comprimirImagen } from '@/lib/imagen'
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

  const dim = size === 'lg' ? 'w-20 h-20 rounded-3xl' : 'w-14 h-14 rounded-2xl'

  async function seleccionar(file: File) {
    setError(null)
    setSubiendo(true)
    try {
      const blob = await comprimirImagen(file)
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
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const mostrar = previewUrl ?? fotoUrl

  return (
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
        onChange={(e) => { const f = e.target.files?.[0]; if (f) seleccionar(f) }}
      />
      {error && <p className="text-[10px] text-[var(--color-danger-crimson)] max-w-[140px]">{error}</p>}
    </div>
  )
}
