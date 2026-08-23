'use client'

// ============================================================
// FAROS — Chat de pantalla completa (estilo WhatsApp/Instagram)
// Lista de conversaciones + hilo activo, uno al lado del otro en
// desktop; en mobile la lista y el hilo se turnan la pantalla
// completa (tocar una conversación la abre a ancho completo con
// botón de volver, como cualquier app de mensajería nativa).
// Reutilizado por /dashboard/mensajes y /portal/mensajes — cada uno
// solo arma su propia lista de canales (CanalItem[]) según su rol.
// ============================================================

import { useEffect, useState } from 'react'
import { Conversacion } from '@/components/shared/Conversacion'
import { useCanalMensajes } from '@/hooks/useCanalMensajes'
import { Spinner } from '@/components/ui'

export interface CanalItem {
  id: string
  titulo: string
  subtitulo: string
  icon: string
  vacio: string
  placeholder: string
  avatarUrl?: string | null
}

export function ChatShell({ canales, yoId, cargando, onEnviar }: {
  canales: CanalItem[]
  yoId: string
  cargando: boolean
  onEnviar: (canalId: string, texto: string) => Promise<void>
}) {
  const [activoId, setActivoId] = useState<string | null>(null)
  const [verHilo, setVerHilo] = useState(false) // controla el swap de pantalla en mobile

  useEffect(() => {
    if (canales.length > 0 && !canales.some((c) => c.id === activoId)) {
      setActivoId(canales[0].id)
    }
  }, [canales, activoId])

  const activo = canales.find((c) => c.id === activoId) ?? null
  const { mensajes } = useCanalMensajes(activo?.id ?? null)

  function abrir(id: string) {
    setActivoId(id)
    setVerHilo(true)
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[480px] rounded-[2rem] overflow-hidden border border-white/10 bg-white/[0.02]">
      {/* ── Lista de conversaciones ── */}
      <div className={`${verHilo ? 'hidden' : 'flex'} md:flex w-full md:w-[340px] shrink-0 flex-col border-r border-white/10 bg-black/20`}>
        <div className="px-5 py-4 border-b border-white/10 shrink-0">
          <h3 className="font-display text-lg font-black text-white uppercase tracking-tight">Chats</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {cargando ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : canales.length === 0 ? (
            <p className="text-center text-sm text-white/40 px-6 py-10">Aún no tienes conversaciones.</p>
          ) : canales.map((c) => {
            const seleccionada = c.id === activoId
            return (
              <button
                key={c.id}
                onClick={() => abrir(c.id)}
                aria-pressed={seleccionada}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-white/5 transition-colors ${
                  seleccionada ? 'bg-[rgba(230,255,0,0.08)]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <Avatar url={c.avatarUrl} icon={c.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{c.titulo}</p>
                  <p className="text-[11px] text-white/40 truncate">{c.subtitulo}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Hilo activo ── */}
      <div className={`${verHilo ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 min-h-0`}>
        {!activo ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-white/40 text-center">
              {cargando ? '' : 'Aún no tienes clases asignadas.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
              <button
                onClick={() => setVerHilo(false)}
                aria-label="Volver a la lista"
                className="md:hidden w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <Avatar url={activo.avatarUrl} icon={activo.icon} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{activo.titulo}</p>
                <p className="text-[10px] text-white/40 truncate">{activo.subtitulo}</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 px-5 pb-5">
              <Conversacion
                mensajes={mensajes}
                yoId={yoId}
                onEnviar={(texto) => onEnviar(activo.id, texto)}
                placeholder={activo.placeholder}
                vacio={activo.vacio}
                alto="flex-1 min-h-0"
                className="h-full"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Avatar({ url, icon, size = 'md' }: { url?: string | null; icon: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'
  return (
    <span className={`relative ${dim} rounded-full bg-white/10 overflow-hidden flex items-center justify-center shrink-0`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="material-symbols-outlined text-[18px] text-white/60">{icon}</span>
      )}
    </span>
  )
}
