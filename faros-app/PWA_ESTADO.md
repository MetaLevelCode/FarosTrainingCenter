# Faros Training — Estado de la PWA

Registro de todo lo hecho para que la app instalada se sienta como una app nativa, y lo que falta. Corresponde a la Fase 6 del `PLAN_DE_CIERRE.md` — **fase cerrada** el 2026-08-23 (ver `PLAN_DE_CIERRE.md` sección 6.12 para el detalle completo con causas raíz).

---

## 1. Hecho

### 1.1 Manifest e instalabilidad base
`public/manifest.json`:
- `display: "standalone"` + `display_override` con `window-controls-overlay` como fallback.
- Iconos 192/512 (incluye `purpose: maskable`), regenerados desde el logo real de marca (ver 1.6).
- `shortcuts` a `/dashboard` y `/portal`.
- `theme_color` / `background_color` en `#050505`.

`src/app/layout.tsx`: `appleWebApp: { capable: true, statusBarStyle: 'black-translucent' }`, `viewport.viewportFit: 'cover'` (habilita `env(safe-area-inset-*)`).

### 1.2 Guía de instalación en iOS
`src/components/shared/InstallPrompt.tsx` detecta plataforma: Android/desktop usa el `beforeinstallprompt` nativo; iOS (sin ese evento) muestra instrucciones manuales — "Toca compartir → Agregar a inicio". Cada plataforma con su propia clave de "descartado por 14 días".

### 1.3 Splash screens de iOS
`scripts/generate-splash-screens.mjs` (sharp) genera 26 PNGs (13 perfiles de dispositivo × portrait/landscape) con el logo real centrado sobre `#050505`, y `layout.tsx` los referencia con `<link rel="apple-touch-startup-image">` por cada `media` query exacto que Safari necesita.

### 1.4 Logo/branding real
Se reemplazaron los prototipos (diamante SVG a mano, texto simulando logo) por los assets reales entregados en `public/farosWordmark/`: `FarosLogo`/`FarosWordmark` (`components/ui`), íconos de la PWA, favicon.ico (armado a mano, sin dependencia de conversor), y splash screens — todo regenerado con `scripts/generate-app-icons.mjs` / `generate-favicon.mjs`.

### 1.5 Animación de entrada (BootSplash)
Se probaron varias direcciones (faro con ripple de anillos medido píxel a píxel del logo real, con y sin imagen estática de fondo) antes de asentar en la versión actual: **marea amarilla**. Logo + wordmark a pincel (extraído de `faros-training-brush.jpeg`, un JPEG opaco de fondo negro, a PNG transparente vía histograma de luminosidad) quietos arriba; abajo, una franja de agua con la superficie ondulando en loop; al final la marea sube, cubre toda la pantalla, y sigue el mismo movimiento hacia abajo hasta salir del todo — revela la app progresivamente a medida que se retira, sin fundido aparte.

### 1.6 Service Worker (`public/sw.js`, v11) — endurecido tras varios bugs reales
Estrategia por tipo de recurso: navegaciones network-first → cache → `/offline`; `_next/static/*` cache-first; imágenes/media stale-while-revalidate; Google Fonts (incluye Material Symbols, los íconos del menú) cache-first; Firebase (Firestore/Auth) nunca interceptado.

Bugs de fondo encontrados y corregidos probando offline en real (celular + PC, no simulado):
- **`getFirebase()` con cache envenenado**: si la promesa de init fallaba una vez (sin señal), quedaba cacheada como rechazada para siempre — ninguna llamada a Firestore volvía a funcionar en toda la sesión, ni con señal de vuelta. Se limpia el cache en el catch para poder reintentar.
- **Reload forzado sin señal**: `ServiceWorkerRegister` hacía `window.location.reload()` apenas un SW nuevo tomaba control (`controllerchange`) — si eso pasaba mientras se probaba offline, la recarga forzada fallaba y el navegador mostraba su propio error nativo ("el dinosaurio"). Ahora se salta si `!navigator.onLine`.
- **Precache todo-o-nada**: `cache.addAll()` fallaba entero si UNA sola URL fallaba — ninguna quedaba cacheada, incluida `/offline`. Cambiado a `Promise.allSettled` + `add()` individual.
- **Fallback offline no calzaba (`Vary`)**: las respuestas de Next.js llevan `Vary: rsc, next-router-state-tree...`; una navegación real trae esos headers y el cache (cacheado sin ellos) no siempre calzaba en `caches.match()`. Se agregó `ignoreVary`/`ignoreSearch`, más un HTML mínimo embebido directo en el SW como último recurso absoluto — nunca más debería poder aparecer el error nativo del navegador, pase lo que pase con el cache.
- **Fuentes sin cachear rompía los íconos**: `fonts.googleapis.com`/`fonts.gstatic.com` estaban en la lista de "nunca cachear" porque el CSP solo las permitía en `font-src`, no en `connect-src` (que es lo que rige un `fetch()` del SW) — sin señal, el font de Material Symbols no cargaba y los íconos del menú se veían como texto plano ("event_busy" en vez del glifo). Se agregaron esos hosts a `connect-src` en `next.config.mjs` y pasaron a cache-first en el SW.
- **"Bypass for network" de DevTools**: no es un bug del código — ese checkbox de Chrome DevTools salta el SW aunque figure "activated and running". Anotado para no perder tiempo con esto de nuevo.

### 1.7 Offline real: alcance final (decisión: *best-effort*, no perseguir cada caso)
Cache de perfil + banner + cola de asistencia se quedan (funcionan bien cuando la lectura falla limpiamente), pero se dejó de perseguir cada fetch sin capturar del resto de la app uno por uno — la app depende de Firestore para casi todo, no está pensada para funcionar 100% sin señal.
- `src/lib/offlineCache.ts` + `AuthContext.tsx`: cada lectura exitosa de `usuarios/{uid}` se cachea; si falla, usa la copia cacheada (`offline: true`) en vez de degradar a un perfil vacío.
- `AppShell.tsx`: banner ámbar "Sin conexión — viendo tus últimos datos guardados".
- `src/lib/offlineQueue.ts` + `PendienteSync.tsx`: cola de asistencia en localStorage (iOS no soporta Background Sync API, se sincroniza a mano con el evento `online`).
- **Red de seguridad**: `src/app/error.tsx` y `global-error.tsx` (el boundary de Next) detectan `navigator.onLine` — si algo revienta por falta de señal en cualquier pantalla no cubierta explícitamente, se ve un aviso simple ("Sin conexión, conéctate y reintenta") en vez del genérico "Algo salió mal", sin necesidad de encontrar el punto exacto.

### 1.8 Detalles finos
- `overscroll-behavior-y: contain` en `html`/`body` — sin esto, tirar del scroll hasta el tope encadenaba al "pull to refresh" nativo del navegador (sobre todo Android/PWA), recargando la app de golpe. El rebote elástico propio (rubber band amarillo) se mantiene.
- `-webkit-tap-highlight-color: transparent` + `touch-action: manipulation` en elementos interactivos — sin esto, cualquier tap se veía "de página web" (flash gris + ~300ms de retraso).
- Safe-area inferior en todos los `fixed bottom-*` (FAB de `AppShell`, banners de `InstallPrompt`, dock de la landing) y superior en el header (`AppShell`, header móvil de la landing) — antes chocaban con el notch/isla dinámica arriba o la franja del gesto de inicio abajo en iPhones con home indicator.
- Header de marca en la landing para mobile: el header de escritorio va `hidden md:block` y no quedaba nada arriba en celular — se agregó una barra simple solo-mobile con el logo + wordmark centrados.

### 1.9 Bugs visuales de layout en mobile (encontrados probando en real)
En `/portal/clases` ("Mis Clases"), la cabecera de cada tarjeta tenía tres bloques compitiendo en una sola fila (fecha/hora ancha + título/sede + badge de estado largo) — el texto del medio quedaba con tan poco espacio real que se truncaba a "T...", "ES...". No alcanzaba con agregar `truncate` (eso solo evitó el choque visual, no el problema de fondo): se rediseñó la cabecera a dos filas (fecha+hora/badge arriba, título+sede abajo con todo el ancho de la tarjeta para sí solos). Se hizo un barrido por los 32 usos de `<Badge>` del proyecto y los 22 usos de `shrink-0` buscando el mismo patrón — el resto ya estaba protegido (`flex-wrap`, tablas con scroll horizontal, o un solo bloque fijo en vez de dos).

---

## 2. Falta por hacer / limitaciones conocidas

- **Offline solo cachea el perfil.** Otras vistas (planes, ranking, historial de transacciones) no tienen cache propio — si Firestore falla ahí, se ven en su estado de error/vacío normal (suavizado por el error boundary, no con datos viejos).
- **Cola de asistencia sin sincronizar entre dispositivos** — vive en `localStorage` del dispositivo, se pierde si se borran datos del sitio.
- **Sin indicador de "actualización disponible"** cuando el SW detecta una versión nueva — el usuario no se entera hasta que recarga.
- **Notificaciones push**: no evaluado en esta fase.
- **`sedes`/`grupos`/`tarifas` exigen login para leerse** pese a que el wizard de planes dice estar "abierto a invitados" — pendiente ya anotado en `PLAN_DE_CIERRE.md` sección 7, no resuelto.

---

## 3. Cómo probar

1. **Instalación**: abrir en Safari iOS, verificar que aparece el banner de instalación manual, instalar, confirmar que no hay flash blanco al abrir (splash correcto) y que se ve la marea amarilla de entrada.
2. **Offline (celular)**: con sesión iniciada y señal, abrir la app una vez (para que quede cache). Activar modo avión, **matar la app del todo** (deslizar en el multitarea, no solo mandarla a segundo plano) y reabrir desde el ícono — debe verse el perfil con datos reales + banner "Sin conexión".
3. **Offline (PC, para debug)**: Chrome DevTools → Network → marcar "Offline" (dejando "Disable cache" **desmarcado**, y confirmando que "Bypass for network" en Application → Service Workers tampoco esté marcado) → recargar. Cargar la página con señal primero, siempre, para que el service worker se instale antes de probar.
4. **Cola de asistencia**: como profesor, con modo avión, marcar asistencia → debe quedar marcada + aparecer el chip "N asistencias pendientes". Desactivar modo avión: sincroniza sola y desaparece.
