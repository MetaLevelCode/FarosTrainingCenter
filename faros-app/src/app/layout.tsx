import type { Metadata, Viewport } from 'next'
import { Montserrat, Hanken_Grotesk } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { ServiceWorkerRegister } from '@/components/shared/ServiceWorkerRegister'
import { InstallPrompt } from '@/components/shared/InstallPrompt'
import './globals.css'

// Self-hosted via next/font: zero render-blocking requests, no CLS.
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken',
  display: 'swap',
})

// Material Symbols is a variable icon font — not supported by next/font,
// so it loads via <link> with preconnect. display=block avoids the
// raw-ligature-text flash while the font loads.
const MATERIAL_SYMBOLS_URL =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block'

// iOS no genera un splash automático como Android — sin estos <link>
// exactos por dispositivo se ve un flash blanco al abrir la app
// instalada. Los archivos se generan con scripts/generate-splash-screens.mjs
// (volver a correrlo si cambia el logo o el color de fondo).
const SPLASH_DEVICES = [
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
] as const

const SPLASH_LINKS = SPLASH_DEVICES.flatMap((d) => ([
  {
    href: `/splash/${d.name}-portrait.png`,
    media: `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait)`,
  },
  {
    href: `/splash/${d.name}-landscape.png`,
    media: `(device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: landscape)`,
  },
]))

export const metadata: Metadata = {
  title: {
    default: 'Faros Training | Elite Performance',
    template: '%s | Faros Training',
  },
  description:
    'Plataforma integral de entrenamiento acuático de élite. Planes, asistencia, rankings y analítica en tiempo real.',
  applicationName: 'Faros Training',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Faros',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // El <body> lleva el fondo oscuro inline: garantizado aunque las CSS
    // vars no resuelvan o el canvas WebGL no pinte nunca.
    // El <html> va en amarillo de marca a propósito: es lo que asoma al
    // scrollear más allá de los límites de la página (rubber band), donde
    // antes se veía una franja blanca.
    <html
      lang="es"
      className={`dark ${montserrat.variable} ${hanken.variable}`}
      style={{ backgroundColor: '#e6ff00' }}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_URL} />
        {SPLASH_LINKS.map((s) => (
          <link key={s.href} rel="apple-touch-startup-image" href={s.href} media={s.media} />
        ))}
      </head>
      <body style={{ backgroundColor: '#050505', color: '#f5f5f5' }}>
        <AuthProvider>{children}</AuthProvider>
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
