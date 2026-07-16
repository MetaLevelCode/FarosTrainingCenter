import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/contexts/AuthContext'
import { ServiceWorkerRegister } from '@/components/shared/ServiceWorkerRegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'Faros Training | Elite Performance',
  description: 'Plataforma de entrenamiento de natación de élite',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Faros',
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
    <html lang="es" className="dark" style={{ backgroundColor: '#050505' }}>
      <body style={{ backgroundColor: '#050505', color: '#f5f5f5' }}>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
