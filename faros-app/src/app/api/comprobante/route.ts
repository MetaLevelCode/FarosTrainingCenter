// ============================================================
// GET /api/comprobante?url=<firebase-storage-url>
// Proxy server-side de comprobantes — evita CORS del browser.
// Solo accesible por admins (verifica ID token en header).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/admin'

export const runtime = 'nodejs'

const STORAGE_HOST = 'firebasestorage.googleapis.com'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return new NextResponse('Sin autorización', { status: 401 })

    const decoded = await getAdminAuth().verifyIdToken(token)
    const { getAdminDb } = await import('@/lib/admin')
    const db = getAdminDb()
    const snap = await db.collection('usuarios').doc(decoded.uid).get()
    if (snap.data()?.rol !== 'admin') {
      return new NextResponse('Solo admins', { status: 403 })
    }

    const url = req.nextUrl.searchParams.get('url')
    if (!url) return new NextResponse('url requerida', { status: 400 })

    // Validar que es un URL de Firebase Storage
    const parsed = new URL(url)
    if (parsed.hostname !== STORAGE_HOST) {
      return new NextResponse('URL no permitida', { status: 400 })
    }

    const upstream = await fetch(url)
    if (!upstream.ok) {
      return new NextResponse('No se pudo obtener el archivo', { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
    const buffer = await upstream.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return new NextResponse('Token inválido', { status: 401 })
    }
    console.error('[GET /api/comprobante]', err)
    return new NextResponse('Error interno', { status: 500 })
  }
}
