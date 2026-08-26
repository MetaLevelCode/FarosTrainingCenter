'use client'

// ============================================================
// FAROS — Admin · Finanzas · Gráficas
// SVG a la medida (sin librería de charts) siguiendo la skill dataviz:
// marcas delgadas, extremos redondeados, grid recesivo, leyenda para
// 2+ series, tooltip on-hover/focus. Paleta fija de la app (dark-only,
// sin toggle de tema) — ver notas de color en el plan.
// ============================================================

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui'
import type { Movimiento } from '@/lib/types'

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// Paleta categórica validada (dataviz skill) contra la superficie real de
// las cards de esta app (#141414, dark-only): 5/5 checks PASS. Orden fijo
// — nunca se reordena ni se generan tonos nuevos; el slot 9 en adelante
// se pliega a "Otros".
const PALETA_CATEGORICA = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const COLOR_OTROS = '#6b6b6b'

function claveMes(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtCompacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ── Tooltip flotante compartido por ambas gráficas ──
function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border border-white/10 bg-[#111] px-3 py-2 shadow-xl text-xs"
      style={{ left: x + 14, top: y + 14 }}
    >
      {children}
    </div>
  )
}

// ============================================================
// Barras — Ingresos vs Egresos, últimos 6 meses
// ============================================================

export function BarraIngresosEgresos({ movimientos }: { movimientos: Movimiento[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; mesLabel: string; ingreso: number; egreso: number } | null>(null)

  const meses = useMemo(() => {
    const hoy = new Date()
    const buckets: { clave: string; label: string; ingreso: number; egreso: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      buckets.push({ clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES_CORTOS[d.getMonth()], ingreso: 0, egreso: 0 })
    }
    const porClave = new Map(buckets.map((b) => [b.clave, b]))
    for (const m of movimientos) {
      const b = porClave.get(claveMes(m.fecha))
      if (!b) continue
      if (m.tipo === 'ingreso') b.ingreso += m.monto
      else b.egreso += m.monto
    }
    return buckets
  }, [movimientos])

  const max = Math.max(1, ...meses.map((m) => Math.max(m.ingreso, m.egreso)))
  // Ticks redondeados a números limpios (0 / mitad / máximo).
  const tickMax = Math.ceil(max / 100_000) * 100_000 || max
  const ticks = [0, tickMax / 2, tickMax]

  const W = 640, H = 260
  const padL = 52, padB = 28, padT = 12, padR = 12
  const plotW = W - padL - padR, plotH = H - padT - padB
  const grupoW = plotW / meses.length
  const barW = Math.min(24, grupoW * 0.28)

  const y = (v: number) => padT + plotH - (v / tickMax) * plotH

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
          Ingresos y egresos · últimos 6 meses
        </h3>
      </div>
      {/* Leyenda — 2 series, siempre visible (nunca solo color). */}
      <div className="flex items-center gap-5 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-success-emerald)' }} />
          <span className="text-xs text-[var(--color-on-surface-variant)]/70">Ingresos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-danger-crimson)' }} />
          <span className="text-xs text-[var(--color-on-surface-variant)]/70">Egresos</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Ingresos y egresos de los últimos 6 meses">
        {/* Gridlines recesivas */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="var(--color-on-surface-variant)" opacity={0.5}>
              {fmtCompacto(t)}
            </text>
          </g>
        ))}

        {meses.map((m, i) => {
          const cx = padL + i * grupoW + grupoW / 2
          const xi = cx - barW - 3
          const xe = cx + 3
          const hi = (m.ingreso / tickMax) * plotH
          const he = (m.egreso / tickMax) * plotH
          return (
            <g key={m.clave}>
              <rect
                x={xi} y={y(m.ingreso)} width={barW} height={hi} rx={4}
                fill="var(--color-success-emerald)"
                opacity={hover?.mesLabel === m.label ? 1 : 0.9}
                onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, mesLabel: m.label, ingreso: m.ingreso, egreso: m.egreso })}
                onMouseMove={(e) => setHover((h) => h && { ...h, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                tabIndex={0}
                onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ x: r.x, y: r.y, mesLabel: m.label, ingreso: m.ingreso, egreso: m.egreso }) }}
                onBlur={() => setHover(null)}
              />
              <rect
                x={xe} y={y(m.egreso)} width={barW} height={he} rx={4}
                fill="var(--color-danger-crimson)"
                opacity={hover?.mesLabel === m.label ? 1 : 0.9}
                onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, mesLabel: m.label, ingreso: m.ingreso, egreso: m.egreso })}
                onMouseMove={(e) => setHover((h) => h && { ...h, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                tabIndex={0}
                onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ x: r.x, y: r.y, mesLabel: m.label, ingreso: m.ingreso, egreso: m.egreso }) }}
                onBlur={() => setHover(null)}
              />
              <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize={10} fill="var(--color-on-surface-variant)" opacity={0.6}>
                {m.label}
              </text>
            </g>
          )
        })}
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      </svg>

      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <p className="text-white font-semibold mb-1">{hover.mesLabel}</p>
          <p className="text-[var(--color-success-emerald)]">Ingresos: <span className="font-bold">{COP.format(hover.ingreso)}</span></p>
          <p className="text-[var(--color-danger-crimson)]">Egresos: <span className="font-bold">{COP.format(hover.egreso)}</span></p>
        </Tooltip>
      )}
    </Card>
  )
}

// ============================================================
// Torta — Egresos por categoría, mes seleccionable
// ============================================================

export function TortaEgresosPorCategoria({ movimientos }: { movimientos: Movimiento[] }) {
  const [mes, setMes] = useState(() => claveMes(Date.now()))
  const [hover, setHover] = useState<{ x: number; y: number; nombre: string; monto: number; pct: number } | null>(null)

  const slices = useMemo(() => {
    const porCategoria = new Map<string, number>()
    for (const m of movimientos) {
      if (m.tipo !== 'egreso' || claveMes(m.fecha) !== mes) continue
      porCategoria.set(m.categoriaNombre, (porCategoria.get(m.categoriaNombre) ?? 0) + m.monto)
    }
    const ordenado = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])
    const top = ordenado.slice(0, 8).map(([nombre, monto], i) => ({ nombre, monto, color: PALETA_CATEGORICA[i] }))
    const resto = ordenado.slice(8).reduce((s, [, monto]) => s + monto, 0)
    if (resto > 0) top.push({ nombre: 'Otros', monto: resto, color: COLOR_OTROS })
    return top
  }, [movimientos, mes])

  const total = slices.reduce((s, x) => s + x.monto, 0)
  const [y, m] = mes.split('-').map(Number)

  const R = 80, CX = 100, CY = 100, GROSOR = 30
  const circunferencia = 2 * Math.PI * R
  const GAP = slices.length > 1 ? 3 : 0

  let acumulado = 0
  const arcos = slices.map((s) => {
    const pct = s.monto / total
    const largo = Math.max(0, pct * circunferencia - GAP)
    const offset = -acumulado * circunferencia
    acumulado += pct
    const anguloMedio = (acumulado - pct / 2) * 2 * Math.PI - Math.PI / 2
    return {
      ...s, pct, largo, offset,
      labelX: CX + Math.cos(anguloMedio) * (R),
      labelY: CY + Math.sin(anguloMedio) * (R),
    }
  })

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="font-display text-headline-md font-extrabold text-white uppercase tracking-tight">
          Egresos por categoría
        </h3>
        <input
          type="month"
          value={mes}
          max={claveMes(Date.now())}
          onChange={(e) => setMes(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white [color-scheme:dark]"
        />
      </div>

      {total === 0 ? (
        <div className="py-14 text-center text-sm text-[var(--color-on-surface-variant)]/50">
          Sin egresos registrados en {MESES_LARGOS[m - 1]} de {y}.
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-8">
          <svg viewBox="0 0 200 200" className="w-48 h-48 shrink-0" role="img" aria-label={`Egresos por categoría de ${MESES_LARGOS[m - 1]} ${y}`}>
            <g transform={`rotate(-90 ${CX} ${CY})`}>
              {arcos.map((a) => (
                <circle
                  key={a.nombre}
                  cx={CX} cy={CY} r={R} fill="none"
                  stroke={a.color} strokeWidth={GROSOR}
                  strokeDasharray={`${a.largo} ${circunferencia - a.largo}`}
                  strokeDashoffset={a.offset}
                  opacity={hover?.nombre === a.nombre ? 1 : 0.92}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, nombre: a.nombre, monto: a.monto, pct: a.pct })}
                  onMouseMove={(e) => setHover((h) => h && { ...h, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                  tabIndex={0}
                  onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ x: r.x, y: r.y, nombre: a.nombre, monto: a.monto, pct: a.pct }) }}
                  onBlur={() => setHover(null)}
                />
              ))}
            </g>
            {/* % directo — solo en porciones lo bastante grandes para no chocar */}
            {arcos.filter((a) => a.pct >= 0.08).map((a) => (
              <text key={a.nombre} x={a.labelX} y={a.labelY} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#fff">
                {Math.round(a.pct * 100)}%
              </text>
            ))}
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize={10} fill="var(--color-on-surface-variant)" opacity={0.6}>Total</text>
            <text x={CX} y={CY + 12} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">{fmtCompacto(total)}</text>
          </svg>

          {/* Leyenda con monto — identidad nunca solo por color */}
          <div className="flex-1 w-full space-y-2">
            {slices.map((s) => (
              <div key={s.nombre} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-[var(--color-on-surface-variant)]/80 truncate">{s.nombre}</span>
                </div>
                <span className="text-white font-semibold shrink-0">{COP.format(s.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          <p className="text-white font-semibold mb-1">{hover.nombre}</p>
          <p className="text-[var(--color-on-surface-variant)]">
            <span className="text-white font-bold">{COP.format(hover.monto)}</span> · {Math.round(hover.pct * 100)}%
          </p>
        </Tooltip>
      )}
    </Card>
  )
}
