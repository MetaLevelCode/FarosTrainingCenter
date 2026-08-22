/** @type {import('next').NextConfig} */

const ES_DEV = process.env.NODE_ENV !== 'production'

// Endpoints con los que el navegador SÍ puede hablar. Todo lo demás
// queda bloqueado: si algún día se cuela un script malicioso, no puede
// mandar los datos de los alumnos a un servidor ajeno.
const FIREBASE_ENDPOINTS = [
  'https://*.googleapis.com',
  'https://*.firebaseio.com',
  'https://*.firebaseapp.com',
  'https://*.cloudfunctions.net',
  'wss://*.firebaseio.com',
].join(' ')

// Content-Security-Policy.
// Nota honesta: script-src necesita 'unsafe-inline' porque Next inyecta
// scripts en línea para hidratar. Endurecerlo con nonce exige middleware;
// queda anotado como siguiente paso. Aun así frame-ancestors, object-src,
// base-uri y form-action ya cierran los abusos más comunes.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${ES_DEV ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // firebasestorage.googleapis.com: fotos de comprobantes y de perfil.
  "img-src 'self' data: blob: https://*.googleusercontent.com https://firebasestorage.googleapis.com",
  "media-src 'self'",
  `connect-src 'self' ${FIREBASE_ENDPOINTS}${ES_DEV ? ' ws://localhost:* http://localhost:*' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  // Nadie puede meter la app en un <iframe> (clickjacking).
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Los formularios solo pueden enviarse a nuestro propio origen.
  "form-action 'self'",
  "object-src 'none'",
  ...(ES_DEV ? [] : ['upgrade-insecure-requests']),
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  // Refuerzo de frame-ancestors para navegadores viejos.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Impide que el navegador "adivine" tipos MIME y ejecute lo que no debe.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No filtrar la ruta (que puede llevar ids) hacia sitios externos.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // La app no usa estos permisos: se niegan de entrada.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...SECURITY_HEADERS,
          // HSTS solo en producción: en local se sirve por http y
          // forzar https dejaría el dev server inaccesible.
          ...(ES_DEV
            ? []
            : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}
export default nextConfig
