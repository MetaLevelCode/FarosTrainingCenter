'use client'

// ============================================================
// FAROS — Profesor · Mensajes (pantalla completa)
// Deriva sus canales reales desde las clases del profesor: un muro
// por cada grupo que dicta, y un chat privado por cada alumno
// distinto entre todas sus clases.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { GuardedShell } from '@/components/layout/AppShell'
import { ChatShell, type CanalItem } from '@/components/shared/ChatShell'
import { getClasesProfesor, getUsuarios } from '@/lib/firestore'
import { canalGrupo, canalPrivado, enviarMensaje } from '@/lib/mensajes'
import { displayName } from '@/lib/types'
import type { Usuario } from '@/lib/types'

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

export default function MensajesProfesorPage() {
  const { authorized, loading, user } = useRoleGuard(['profesor'])
  const [cargando, setCargando] = useState(true)
  const [gruposNombres, setGruposNombres] = useState<string[]>([])
  const [alumnos, setAlumnos] = useState<Usuario[]>([])

  useEffect(() => {
    if (!user) return
    Promise.all([getClasesProfesor(user.uid), getUsuarios('estudiante')])
      .then(([clases, estudiantes]) => {
        setGruposNombres([...new Set(clases.map((c) => c.nombre_clase))])
        const inscritos = new Set(clases.flatMap((c) => c.estudiantes_inscritos ?? []))
        setAlumnos(estudiantes.filter((u) => inscritos.has(u.uid)))
      })
      .catch(console.error)
      .finally(() => setCargando(false))
  }, [user])

  const canales: CanalItem[] = useMemo(() => {
    const grupoItems: CanalItem[] = gruposNombres.map((nombre) => ({
      id: canalGrupo(nombre),
      titulo: nombre,
      subtitulo: 'Muro del grupo',
      icon: 'forum',
      vacio: 'Aún nadie ha comentado en este grupo.',
      placeholder: 'Escribe a todo el grupo…',
    }))
    const dmItems: CanalItem[] = user ? alumnos.map((a) => ({
      id: canalPrivado(user.uid, a.uid),
      titulo: displayName(a),
      subtitulo: 'Chat privado',
      icon: 'person',
      vacio: `Empieza la conversación con ${displayName(a)}.`,
      placeholder: `Escríbele a ${a.nombres.split(' ')[0]}…`,
      avatarUrl: a.foto_perfil,
    })) : []
    return [...grupoItems, ...dmItems]
  }, [gruposNombres, alumnos, user])

  async function enviar(canalId: string, texto: string) {
    if (!user) return
    await enviarMensaje(canalId, user.uid, displayName(user), 'entrenador', texto)
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
