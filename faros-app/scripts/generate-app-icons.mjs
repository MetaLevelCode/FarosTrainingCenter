// ============================================================
// FAROS — Iconos de app (PWA) a partir del logo real de marca
// Genera public/icons/icon-192.png y icon-512.png: el logo amarillo
// (public/farosWordmark/Logo amarillo.png) centrado sobre un canvas
// cuadrado #050505, con margen suficiente para que también sirva como
// ícono "maskable" (Android recorta hasta ~80% del diámetro).
//
// Uso: node scripts/generate-app-icons.mjs
// Vuelve a correrlo si cambia el logo, y corre luego
// generate-splash-screens.mjs (usa icon-512.png como fuente).
// ============================================================

import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'public/farosWordmark/logo-amarillo.png')
const OUT_DIR = path.join(ROOT, 'public/icons')
const BG = '#050505'
const FILL_RATIO = 0.6 // el logo ocupa ~60% del lienzo — cabe en el safe-zone maskable

async function generarIcono(size) {
  const markSide = Math.round(size * FILL_RATIO)
  const mark = await sharp(SRC)
    .resize(markSide, markSide, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 3, background: BG },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT_DIR, `icon-${size}.png`))

  console.log(`✓ icon-${size}.png`)
}

async function main() {
  await generarIcono(192)
  await generarIcono(512)
}

main().catch((err) => { console.error(err); process.exit(1) })
