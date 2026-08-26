// ============================================================
// FAROS — Exportar finanzas a Excel
// 100% en el cliente (SheetJS) — sin endpoint, sin subir datos a
// ningún lado. Dos hojas: Movimientos y Transacciones, con todo lo
// que ya está cargado en /admin/finanzas (sin recorte).
// ============================================================

import type { Movimiento, Transaccion } from './types'

function fechaLegible(ts: number): string {
  return new Date(ts).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ESTADO_TX_LABEL: Record<Transaccion['estado'], string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
}

export async function exportarFinanzasExcel(
  movimientos: Movimiento[],
  transacciones: Transaccion[],
): Promise<void> {
  const XLSX = await import('xlsx')

  const hojaMovimientos = movimientos.map((m) => ({
    Fecha: fechaLegible(m.fecha),
    Descripción: m.descripcion,
    Categoría: m.categoriaNombre,
    Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso',
    Monto: m.monto,
  }))

  const hojaTransacciones = transacciones.map((t) => ({
    Usuario: t.nombre_usuario ?? t.usuarioId,
    Plan: t.nombre_plan ?? t.planId,
    Fecha: fechaLegible(t.fecha_solicitud),
    Monto: t.monto,
    Estado: ESTADO_TX_LABEL[t.estado],
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaMovimientos), 'Movimientos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaTransacciones), 'Transacciones')

  const fechaArchivo = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `faros-finanzas-${fechaArchivo}.xlsx`)
}
