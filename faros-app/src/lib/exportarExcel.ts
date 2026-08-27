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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface TurnoIA { rol: 'user' | 'model'; texto: string }

/**
 * Abre el reporte financiero con IA (+ preguntas de seguimiento) en una
 * pestaña aparte, lista para imprimir o "Guardar como PDF" — sin
 * dependencias de generación de PDF, el navegador hace el trabajo.
 */
export function exportarReporteIA(historial: TurnoIA[]): void {
  const ventana = window.open('', '_blank')
  if (!ventana) return

  const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const secciones = historial.map((h) => `
    <div class="turno ${h.rol}">
      <p class="etiqueta">${h.rol === 'model' ? 'Reporte / respuesta de la IA' : 'Pregunta del admin'}</p>
      <div class="texto">${escapeHtml(h.texto)}</div>
    </div>
  `).join('')

  ventana.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte financiero con IA — Faros Training Center</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 21px; margin: 0 0 4px; }
  .fecha { color: #666; font-size: 12px; margin: 0 0 32px; }
  .turno { margin-bottom: 26px; padding-bottom: 22px; border-bottom: 1px solid #ddd; }
  .turno:last-child { border-bottom: none; }
  .etiqueta { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: bold; margin: 0 0 8px; }
  .turno.user .etiqueta { color: #8a6d00; }
  .texto { white-space: pre-wrap; font-size: 13.5px; }
  @media print { body { margin: 0; padding: 24px; } }
</style>
</head>
<body>
  <h1>Faros Training Center — Reporte financiero con IA</h1>
  <p class="fecha">Generado el ${fecha}</p>
  ${secciones}
</body>
</html>`)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 300)
}
