'use client'

// ============================================================
// FAROS — Estudiante · Mensajes (pantalla completa)
// Deriva sus canales reales desde sus clases: el muro del/los
// grupo(s) grupales en los que está inscrito, y un chat privado por
// cada profesor distinto con el que tiene clases.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { ChatShell, type CanalItem } from '@/components/shared/ChatShell'
import { getClasesAlumno, getUsuario } from '@/lib/firestore'
import { canalGrupo, canalPrivado, enviarMensaje } from '@/lib/mensajes'
import { displayName } from '@/lib/types'
import type { Clase, Usuario } from '@/lib/types'

const EASE = [0.22, 1, 0.36, 1] as const

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >{children}</motion.div>
  )
}

export default function MensajesPage() {
  const { authorized, loading, user } = useRoleGuard(['estudiante'])
  const [cargando, setCargando] = useState(true)
  const [grupos, setGrupos] = useState<string[]>([])
  const [profesores, setProfesores] = useState<Usuario[]>([])

  useEffect(() => {
    if (!user) return
    getClasesAlumno(user.uid)
      .then(async (clases: Clase[]) => {
        setGrupos([...new Set(clases.map((c) => c.nombre_clase))])
        const instructorIds = [...new Set(clases.map((c) => c.instructor_id).filter(Boolean))]
        const usuarios = await Promise.all(instructorIds.map((uid) => getUsuario(uid)))
        setProfesores(usuarios.filter((u): u is Usuario => !!u))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user])

  const canales: CanalItem[] = useMemo(() => {
    const grupoItems: CanalItem[] = grupos.map((nombre) => ({
      id: canalGrupo(nombre),
      titulo: nombre,
      subtitulo: 'Muro del grupo',
      icon: 'forum',
      vacio: 'Aún nadie ha comentado en este grupo.',
      placeholder: 'Comenta con tu grupo…',
    }))
    const dmItems: CanalItem[] = user ? profesores.map((p) => ({
      id: canalPrivado(p.uid, user.uid),
      titulo: displayName(p),
      subtitulo: 'Chat privado',
      icon: 'person',
      vacio: `Empieza la conversación con ${displayName(p)}.`,
      placeholder: `Escríbele a ${p.nombres.split(' ')[0]}…`,
      avatarUrl: p.foto_perfil,
    })) : []
    return [...grupoItems, ...dmItems]
  }, [grupos, profesores, user])

  async function enviar(canalId: string, texto: string) {
    if (!user) return
    await enviarMensaje(canalId, user.uid, user.nombres.split(' ')[0], 'alumno', texto)
  }

  return (
    <GuardedShell authorized={authorized} loading={loading} title="Mensajes">
      <div className="space-y-6">
        <Reveal>
          <div>
            <p className="label-caps text-[var(--color-primary-fixed)] mb-3 tracking-[0.3em]">Comunidad</p>
            <h2 className="font-display text-display-lg text-white leading-none tracking-tighter uppercase">
              Mensajes
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <ChatShell canales={canales} yoId={user?.uid ?? ''} cargando={cargando} onEnviar={enviar} />
        </Reveal>
      </div>
    </GuardedShell>
  )
}
