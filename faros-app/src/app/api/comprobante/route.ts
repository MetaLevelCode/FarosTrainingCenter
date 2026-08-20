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
      ?? req.nextUrl.searchParams.get('token')
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
    const buffer = Buffer.from(await upstream.arrayBuffer())

    // PDFs se devuelven tal cual
    if (contentType.includes('pdf')) {
      return new NextResponse(buffer, {
        headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, max-age=3600' },
      })
    }

    // Detectar HEIC/HEIF por magic bytes (fotos de iPhone que Chrome Mac no puede renderizar)
    // Formato ISOBMFF: bytes 4-7 == 'ftyp', bytes 8-11 indican el brand
    const isHeic = buffer.length > 12
      && buffer.slice(4, 8).toString('ascii') === 'ftyp'
      && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(
        buffer.slice(8, 12).toString('ascii'),
      )

    let jpegSource: Buffer = buffer
    if (isHeic) {
      // heic-convert no publica types
      // @ts-expect-error — sin types
      const mod = await import('heic-convert')
      const heicConvert = (mod as { default: (opts: { buffer: Buffer; format: 'JPEG'; quality: number }) => Promise<ArrayBuffer> }).default
      const converted = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 })
      jpegSource = Buffer.from(converted)
    }

    // Normalizar a JPEG con sharp para garantizar compatibilidad
    try {
      const sharp = (await import('sharp')).default
      const jpeg = await sharp(jpegSource).rotate().jpeg({ quality: 90 }).toBuffer()
      return new NextResponse(jpeg, {
        headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
      })
    } catch (sharpErr: any) {
      // Si sharp falla pero heic-convert ya produjo un JPEG, devolver ese
      if (isHeic) {
        return new NextResponse(jpegSource, {
          headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
        })
      }
      return new NextResponse(`sharp error: ${sharpErr?.message ?? String(sharpErr)}`, { status: 500 })
    }
  } catch (err: any) {
    if ((err?.code ?? '').startsWith('auth/')) {
      return new NextResponse('Token inválido', { status: 401 })
    }
    console.error('[GET /api/comprobante]', err)
    return new NextResponse('Error interno', { status: 500 })
  }
}
