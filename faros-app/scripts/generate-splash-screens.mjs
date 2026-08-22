// ============================================================
// FAROS — Generador de splash screens para iOS
// iOS no arma un splash automático como Android: sin estas imágenes
// exactas por dispositivo, se ve un flash blanco al abrir la app
// instalada. Genera fondo #050505 + marca centrada (icon-512.png)
// para cada tamaño de pantalla, en portrait y landscape.
//
// Uso: node scripts/generate-splash-screens.mjs
// Vuelve a correrlo si cambia el logo o el color de fondo.
// ============================================================

import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ICON = path.join(ROOT, 'public/icons/icon-512.png')
const OUT_DIR = path.join(ROOT, 'public/splash')
const BG = '#050505'

// device-width x device-height (CSS px) @ device-pixel-ratio — los
// perfiles de iPhone/iPad más comunes hoy (portrait; landscape se
// genera invirtiendo w/h).
const DEVICES = [
  { name: 'iphone-se1', w: 320, h: 568, r: 2 },
  { name: 'iphone-8', w: 375, h: 667, r: 2 },
  { name: 'iphone-8-plus', w: 414, h: 736, r: 3 },
  { name: 'iphone-x', w: 375, h: 812, r: 3 },
  { name: 'iphone-xr', w: 414, h: 896, r: 2 },
  { name: 'iphone-xs-max', w: 414, h: 896, r: 3 },
  { name: 'iphone-12', w: 390, h: 844, r: 3 },
  { name: 'iphone-12-pro-max', w: 428, h: 926, r: 3 },
  { name: 'iphone-14-pro', w: 393, h: 852, r: 3 },
  { name: 'iphone-14-pro-max', w: 430, h: 932, r: 3 },
  { name: 'ipad', w: 768, h: 1024, r: 2 },
  { name: 'ipad-pro-11', w: 834, h: 1194, r: 2 },
  { name: 'ipad-pro-12', w: 1024, h: 1366, r: 2 },
]

async function generarUna(pxW, pxH, outPath) {
  const markSide = Math.round(Math.min(pxW, pxH) * 0.32)
  // fit:'contain' — el logo real no es cuadrado; un resize a secas lo
  // deformaría para llenar el cuadro.
  const mark = await sharp(ICON)
    .resize(markSide, markSide, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  await sharp({
    create: { width: pxW, height: pxH, channels: 3, background: BG },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(outPath)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const manifest = []

  for (const d of DEVICES) {
    for (const orientacion of ['portrait', 'landscape']) {
      const [cssW, cssH] = orientacion === 'portrait' ? [d.w, d.h] : [d.h, d.w]
      const pxW = cssW * d.r
      const pxH = cssH * d.r
      const file = `${d.name}-${orientacion}.png`
      await generarUna(pxW, pxH, path.join(OUT_DIR, file))
      manifest.push({ file, cssW, cssH, ratio: d.r, orientacion })
      console.log(`✓ ${file} (${pxW}x${pxH})`)
    }
  }

  console.log(`\n${manifest.length} splash screens generados en public/splash/`)
}

main().catch((err) => { console.error(err); process.exit(1) })
