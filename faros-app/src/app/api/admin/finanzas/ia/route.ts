// ============================================================
// POST /api/admin/finanzas/ia
// Genera (o continúa) un análisis financiero con Gemini a partir
// de los movimientos y transacciones que el admin exportó a Excel
// en /admin/finanzas.
//
// Sin persistencia: el cliente reenvía los datos + el historial de
// la conversación en cada llamada; el servidor solo arma el prompt
// y llama a Gemini. Solo accesible por admins.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/admin'
import { rateLimit, clientIp } from '@/lib/ratelimit'
import { log } from '@/lib/logger'

export const runtime = 'nodejs'

// Alias que Google mantiene apuntando al flash-lite "actual" — evita
// repetir este arreglo cada vez que deprecan una versión numerada (ej.
// 2.5-flash). La variante "lite" responde bastante más rápido y con
// menos 503 de "alta demanda" en el tier gratuito que el flash normal.
const MODELO = 'gemini-flash-lite-latest'
const MAX_FILAS = 5000
const MAX_TURNOS = 40
const MAX_TEXTO_TURNO = 800

const SYSTEM_PROMPT = `Eres un asesor financiero para Faros Training Center, un centro de entrenamiento deportivo (natación, funcional, etc.) en Colombia. Se te entrega un extracto de "Movimientos" (ingresos y egresos ya contabilizados) y "Transacciones" (pagos de alumnos, aprobados o rechazados) exportado directamente de su sistema, en JSON.

Con esos datos, genera un reporte inicial en español que:
- Señale patrones y riesgos que NO son obvios mirando las cifras crudas (concentración de ingresos en pocos alumnos o categorías, estacionalidad, gastos hormiga, categorías de egreso creciendo más rápido que los ingresos, dependencia excesiva de un tipo de plan, tasa de rechazo de pagos, etc.).
- Dé recomendaciones concretas y accionables para mejorar la situación económica del negocio, no genéricas.
- Cite cifras reales de los datos cuando respalden una afirmación.
- Responda en TEXTO PLANO puro: nunca uses #, ##, **, *, emojis ni ningún símbolo de markdown. Solo el título corto (2-4 palabras) de cada sección va en MAYÚSCULAS; el resto del texto (párrafos y viñetas) va en minúsculas normales. Las viñetas usan guion simple "-".

Después de este reporte inicial, el admin te hará preguntas puntuales sobre los mismos datos. Respóndelas con la misma precisión, en texto plano, y sin inventar cifras que no estén en los datos.`

interface Turno { rol: 'user' | 'model'; texto: string }

// Red de seguridad: modelos "lite" no siempre respetan la instrucción de
// texto plano y meten markdown (#, **, viñetas con *). La UI renderiza
// texto crudo con whitespace-pre-wrap, así que esos símbolos se verían
// literalmente en pantalla si no se limpian acá.
function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*[*•]\s+/gm, '- ')
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limited = rateLimit(req, 'finanzas:ia', { max: 20, windowMs: 5 * 60_000 })
  if (limited) return limited

  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const db = getAdminDb()
    const adminSnap = await db.collection('usuarios').doc(decoded.uid).get()
    if (adminSnap.data()?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'La IA no está configurada en el servidor (falta GEMINI_API_KEY).' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({})) as {
      movimientos?: unknown[]
      transacciones?: unknown[]
      historial?: Turno[]
    }

    const movimientos = Array.isArray(body.movimientos) ? body.movimientos.slice(0, MAX_FILAS) : []
    const transacciones = Array.isArray(body.transacciones) ? body.transacciones.slice(0, MAX_FILAS) : []
    if (movimientos.length === 0 && transacciones.length === 0) {
      return NextResponse.json({ error: 'El Excel no tiene movimientos ni transacciones para analizar.' }, { status: 400 })
    }

    const historial = (Array.isArray(body.historial) ? body.historial.slice(-MAX_TURNOS) : [])
      .filter((h): h is Turno => !!h && (h.rol === 'user' || h.rol === 'model') && typeof h.texto === 'string')
      .map((h) => ({ rol: h.rol, texto: h.texto.slice(0, MAX_TEXTO_TURNO) }))

    const datosTexto = JSON.stringify({ movimientos, transacciones })

    const contents = [
      {
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\nDATOS (JSON):\n${datosTexto}\n\nGenera el reporte inicial.` }],
      },
      ...historial.map((h) => ({ role: h.rol, parts: [{ text: h.texto }] })),
    ]

    // El tier gratuito de Gemini devuelve 503 "high demand" con frecuencia
    // aunque la key y la cuota estén bien — normalmente se resuelve solo
    // en unos segundos, así que reintentamos antes de rendirnos.
    let res: Response | null = null
    let errBody = ''
    for (let intento = 0; intento < 3; intento++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents }),
        },
      )
      if (res.ok) break
      errBody = await res.text().catch(() => '')
      if (res.status !== 503 || intento === 2) break
      await new Promise((r) => setTimeout(r, 2000 * (intento + 1)))
    }

    if (!res || !res.ok) {
      log.error({ scope: 'finanzas-ia', event: 'gemini_error', ip, status: res?.status, errBody: errBody.slice(0, 500) })
      return NextResponse.json({ error: 'No se pudo generar el reporte con IA. Intenta de nuevo.' }, { status: 502 })
    }

    const data = await res.json()
    const textoCrudo: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '').join('')
    const texto = limpiarMarkdown(textoCrudo)
    if (!texto.trim()) {
      log.error({ scope: 'finanzas-ia', event: 'sin_contenido', ip, data: JSON.stringify(data).slice(0, 500) })
      return NextResponse.json({ error: 'La IA no devolvió contenido. Intenta de nuevo.' }, { status: 502 })
    }

    log.info({ scope: 'finanzas-ia', event: 'ok', ip, uid: decoded.uid, esReporteInicial: historial.length === 0 })
    return NextResponse.json({ texto })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }
    log.error({ scope: 'finanzas-ia', event: 'error', ip, err })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
