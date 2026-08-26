'use client'

// ============================================================
// FAROS — Grupo de un plan personalizado compartido
// (pareja/familia/reducido). Muestra el código para invitar a los
// demás (solo al jefe) y la lista de quiénes ya están inscritos —
// visible para cualquier miembro, no solo el jefe.
// ============================================================

import { useEffect, useState } from 'react'
import { Card, Badge, Spinner } from '@/components/ui'
import { getFirebase } from '@/lib/firebase'
import type { GrupoPersonalizado as Grupo } from '@/lib/types'

export function GrupoPersonalizado({ grupoId, esJefe }: { grupoId: string; esJefe: boolean }) {
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let cancelado = false
    let unsub = () => {}
    ;(async () => {
      try {
        const [{ db }, { doc, onSnapshot }] = await Promise.all([
          getFirebase(), import('firebase/firestore'),
        ])
        if (cancelado) return
        unsub = onSnapshot(
          doc(db, 'grupos_personalizados', grupoId),
          (snap) => {
            setGrupo(snap.exists() ? ({ id: snap.id, ...snap.data() } as Grupo) : null)
            setCargando(false)
          },
          (err) => { console.error(err); setCargando(false) },
        )
      } catch (err) {
        console.error(err)
        setCargando(false)
      }
    })()
    return () => { cancelado = true; unsub() }
  }, [grupoId])

  async function copiarCodigo() {
    if (!grupo) return
    try {
      await navigator.clipboard.writeText(grupo.codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  if (cargando) {
    return <div className="flex justify-center py-6"><Spinner size="sm" /></div>
  }
  if (!grupo) return null

  const cuposLibres = Math.max(0, grupo.personasMax - grupo.miembros.length)

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-tight">
          Tu grupo
        </h3>
        <Badge variant="default">{grupo.miembros.length} / {grupo.personasMax}</Badge>
      </div>

      {esJefe && (
        <div className="mb-5 p-4 rounded-2xl border border-white/5 bg-white/[0.03]">
          <p className="label-caps text-[9px] text-[var(--color-on-surface-variant)]/50 mb-2">
            Código para invitar
          </p>
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-black text-[var(--color-primary-fixed)] tracking-[0.2em]">
              {grupo.codigo}
            </span>
            <button
              onClick={copiarCodigo}
              className="text-xs text-[var(--color-on-surface-variant)]/70 hover:text-white transition-colors duration-200 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copiado ? 'check' : 'content_copy'}
              </span>
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)]/50 mt-2">
            {cuposLibres > 0
              ? `Comparte este código para que se unan hasta ${cuposLibres} persona${cuposLibres === 1 ? '' : 's'} más — es gratis, ya está incluido en tu plan.`
              : 'Tu grupo ya está completo.'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {grupo.miembros.map((m) => (
          <div key={m.uid} className="flex items-center justify-between gap-3 px-1 py-1.5">
            <span className="text-sm text-white">{m.nombre}</span>
            {m.uid === grupo.jefeId && <Badge variant="primary">Jefe</Badge>}
          </div>
        ))}
      </div>
    </Card>
  )
}
