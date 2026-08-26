// ============================================================
// FAROS — Racha semanal, cálculo server-side (Admin SDK)
// Para uso exclusivo de Route Handlers — nunca importar desde
// componentes cliente (mismo criterio que lib/admin.ts).
//
// calcularRacha() necesita leer asistencias/clases/cancelaciones del
// alumno; las reglas de Firestore solo dejan al propio dueño (o
// admin/profesor para asistencias) leerlas — por eso el cálculo para
// OTRO usuario (ej. el ranking) no puede hacerse desde el cliente.
// Este helper recalcula y persiste el resultado en
// usuarios/{uid}.estadisticas.{racha,rachaSemana} para que no haya que
// repetir las 3 lecturas en cada vista — ver GET /api/ranking.
// ============================================================

import type { getAdminDb } from './admin'
import { calcularRacha, inicioSemana } from './racha'

export async function recalcularYGuardarRacha(
  db: ReturnType<typeof getAdminDb>,
  uid: string,
): Promise<number> {
  const [asistSnap, clasesSnap, cancelSnap] = await Promise.all([
    db.collection('asistencias')
      .where('usuarioId', '==', uid)
      .orderBy('fecha_registro', 'desc')
      .limit(60)
      .get(),
    db.collection('clases')
      .where('estudiantes_inscritos', 'array-contains', uid)
      .where('estado', 'in', ['programada', 'en_curso', 'finalizada'])
      .get(),
    db.collection('cancelaciones')
      .where('usuarioId', '==', uid)
      .limit(60)
      .get(),
  ])

  const ahora = Date.now()
  const racha = calcularRacha({
    asistencias: asistSnap.docs.map((d) => d.data() as { asistio: boolean; fecha_registro: number }),
    clasesHistoricas: clasesSnap.docs.map((d) => d.data() as { fecha_hora_inicio: number }),
    cancelaciones: cancelSnap.docs.map((d) => d.data() as { fecha_hora_clase: number }),
  }, ahora)

  await db.collection('usuarios').doc(uid).update({
    'estadisticas.racha': racha,
    'estadisticas.rachaSemana': inicioSemana(ahora),
  })

  return racha
}
