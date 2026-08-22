// ============================================================
// FAROS — favicon.ico a partir del logo real
// No hay ninguna dependencia de conversión ICO en el proyecto —
// arma el contenedor .ico a mano (formato documentado: ICONDIR +
// ICONDIRENTRY por tamaño + los PNG crudos concatenados), algo
// soportado por todos los navegadores desde hace años.
//
// Uso: node scripts/generate-favicon.mjs
// ============================================================

import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'public/farosWordmark/logo-amarillo.png')
const OUT = path.join(ROOT, 'src/app/favicon.ico')
const BG = '#050505'
const SIZES = [16, 32, 48]
const FILL_RATIO = 0.7

async function pngParaTamano(size) {
  const markSide = Math.round(size * FILL_RATIO)
  const mark = await sharp(SRC)
    .resize(markSide, markSide, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  return sharp({ create: { width: size, height: size, channels: 3, background: BG } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
}

function armarIco(pngBuffers) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(pngBuffers.length, 4)

  const entries = []
  let offset = 6 + pngBuffers.length * 16
  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(buf.length, 8) // size of image data
    entry.writeUInt32LE(offset, 12) // offset
    offset += buf.length
    entries.push(entry)
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)])
}

async function main() {
  const pngBuffers = []
  for (const size of SIZES) {
    pngBuffers.push({ size, buf: await pngParaTamano(size) })
  }
  await writeFile(OUT, armarIco(pngBuffers))
  console.log(`✓ favicon.ico (${SIZES.join(', ')})`)
}

main().catch((err) => { console.error(err); process.exit(1) })
