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
    // Inline styles: guaranteed dark background even if CSS vars
    // fail to resolve or the WebGL canvas never paints.
    <html
      lang="es"
      className={`dark ${montserrat.variable} ${hanken.variable}`}
      style={{ backgroundColor: '#050505' }}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_URL} />
      </head>
      <body style={{ backgroundColor: '#050505', color: '#f5f5f5' }}>
        <AuthProvider>{children}</AuthProvider>
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
