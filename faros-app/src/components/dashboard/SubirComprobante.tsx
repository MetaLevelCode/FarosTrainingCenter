'use client'

// ============================================================
// FAROS — SubirComprobante
// Flujo de dos pasos: el alumno selecciona la imagen y ve un
// preview; luego confirma para iniciar el upload a Storage.
// Path: comprobantes/{uid}/{transaccionId}.{ext}
// Al terminar llama onSubido(url) para que el padre actualice la UI.
// ============================================================

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { getFirebase } from '@/lib/firebase'
import { updateComprobanteTransaccion } from '@/lib/firestore'
import { Button, Spinner } from '@/components/ui'

interface Props {
  transaccionId: string
  uid: string
  nombreUsuario?: string
  onSubido: (url: string) => void
}

const EASE = [0.22, 1, 0.36, 1] as const
const MAX_MB = 10

export function SubirComprobante({ transaccionId, uid, nombreUsuario, onSubido }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function seleccionarArchivo(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera los ${MAX_MB} MB permitidos.`)
      return
    }
    setError(null)
    setArchivo(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function resetear() {
    setArchivo(null)
    setPreview(null)
    setError(null)
    setProgreso(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function confirmarYSubir() {
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    setProgreso(0)

    try {
      const { storage } = await getFirebase()
      const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage')

      const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const storageRef = ref(storage, `comprobantes/${uid}/${transaccionId}.${ext}`)
      const task = uploadBytesResumable(storageRef, archivo, { contentType: archivo.type })

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => setProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        )
      })

      const url = await getDownloadURL(storageRef)
      await updateComprobanteTransaccion(transaccionId, url, uid, nombreUsuario)
      onSubido(url)
    } catch {
      setError('No se pudo subir el comprobante. Intenta de nuevo.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Información bancaria */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-2">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-[var(--color-primary-fixed)]">account_balance</span>
          <h3 className="text-sm font-semibold text-white">Realiza tu transferencia a:</h3>
        </div>
        <div className="space-y-2 text-sm text-[var(--color-on-surface-variant)]">
          <p><strong className="text-white">Bancolombia (Ahorros):</strong> 000-000000-00</p>
          <p><strong className="text-white">Nequi:</strong> 300 000 0000</p>
          <p className="text-xs opacity-70 mt-2">Titular: Faros Training Center</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) seleccionarArchivo(f) }}
      />

      {/* Zona de selección / preview */}
      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[rgba(230,255,0,0.3)] transition-colors duration-300 p-10 flex flex-col items-center gap-4 text-center"
        >
          <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]/40 text-[40px]">upload_file</span>
          <div>
            <p className="text-sm font-semibold text-white">Toca para adjuntar el comprobante</p>
            <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-1">
              PNG · JPG · PDF — máx. {MAX_MB} MB
            </p>
          </div>
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]"
        >
          {archivo?.type === 'application/pdf' ? (
            <div className="flex items-center gap-4 p-6">
              <span className="material-symbols-outlined text-[var(--color-primary-fixed)] text-[32px]">picture_as_pdf</span>
              <div>
                <p className="text-sm font-semibold text-white truncate max-w-[200px]">{archivo.name}</p>
                <p className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/50 mt-0.5">
                  {(archivo.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
          ) : (
            <img
              src={preview}
              alt="Vista previa del comprobante"
              className="w-full max-h-56 object-contain"
            />
          )}
        </motion.div>
      )}

      {/* Barra de progreso durante el upload */}
      {subiendo && (
        <div className="space-y-2">
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[var(--color-primary-fixed)] shadow-[0_0_12px_rgba(230,255,0,0.5)]"
              animate={{ width: `${progreso}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Spinner size="sm" />
            <span className="label-caps text-[10px] text-[var(--color-on-surface-variant)]/60">
              Enviando… {progreso}%
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--color-danger-crimson)] text-center">{error}</p>
      )}

      {/* Acciones: Confirmar o cambiar imagen */}
      {archivo && !subiendo && (
        <div className="flex gap-3">
          <Button fullWidth size="md" onClick={confirmarYSubir}>
            <span className="material-symbols-outlined text-[16px]">send</span>
            Enviar comprobante
          </Button>
          <Button size="md" variant="ghost" onClick={resetear}>
            Cambiar
          </Button>
        </div>
      )}
    </div>
  )
}
