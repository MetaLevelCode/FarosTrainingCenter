# Faros Training — Estado de la PWA

Registro de todo lo hecho para que la app instalada se sienta como una app nativa, y lo que falta. Corresponde a la Fase 6 del `PLAN_DE_CIERRE.md`.

Última actualización: commit `54aa1f5` (offline support) — **committeado y pusheado, pendiente de deploy/prueba en celular real**.

---

## 1. Hecho

### 1.1 Manifest e instalabilidad base
`public/manifest.json` — ya existía antes de esta fase, verificado:
- `display: "standalone"` + `display_override` con `window-controls-overlay` como fallback.
- Iconos 192/512 (incluye `purpose: maskable`).
- `shortcuts` a `/dashboard` y `/portal` (accesos directos desde el icono en Android/desktop).
- `theme_color` / `background_color` en `#050505` (coincide con el fondo real de la app, sin flash de color).

`src/app/layout.tsx` — metadata de Next:
- `appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Faros' }`.
- `viewport.viewportFit: 'cover'` — habilita `env(safe-area-inset-*)` en CSS.

### 1.2 Guía de instalación en iOS (crítico)
iOS Safari no dispara `beforeinstallprompt`, así que sin esto no había forma de que un usuario de iPhone supiera que puede instalar la app.

`src/components/shared/InstallPrompt.tsx` — reescrito para detectar plataforma:
- **Android/desktop**: usa el evento nativo `beforeinstallprompt` → botón real de instalación.
- **iOS** (detecta UA + el caso iPad-que-se-reporta-como-Mac): banner con instrucciones manuales — "Toca compartir → Agregar a inicio".
- Cada plataforma tiene su propia clave de "descartado por 14 días" en localStorage, para no repetir el banner a cada rato.

### 1.3 Splash screens de iOS
iOS no genera un splash automático a partir del manifest (a diferencia de Android) — sin esto, abrir la app instalada muestra un flash de pantalla en blanco antes de pintar el primer frame.

- `scripts/generate-splash-screens.mjs`: script con `sharp` que genera 26 PNGs (13 perfiles de dispositivo × portrait/landscape) en `public/splash/`, centrando el icono 512 sobre un canvas `#050505` del tamaño real de pantalla de cada dispositivo (iPhone SE hasta 14 Pro Max, iPad, iPad Pro 11/12).
- `src/app/layout.tsx`: por cada dispositivo/orientación se agrega un `<link rel="apple-touch-startup-image">` con el `media` query exacto (`device-width`, `device-height`, `-webkit-device-pixel-ratio`, `orientation`) que Safari necesita para elegir el splash correcto.
- Si cambia el logo o el color de fondo, hay que volver a correr el script.

### 1.4 Service Worker (`public/sw.js`, v6)
Ya existía, con estrategia por tipo de recurso:
- Navegaciones (HTML): network-first con fallback a cache y luego a `/offline`.
- `_next/static/*`: cache-first (son inmutables, van hasheados).
- Imágenes/media/iconos propios: stale-while-revalidate, con un tope de 60 entradas.
- Firebase (Firestore/Auth) y Google Fonts: **nunca interceptados** — pasan directo a red (evita romper auth y evita que el CSP bloquee fetches de fonts que deberían ir por `font-src`).
- En cada deploy que deba invalidar cache vieja hay que subir el número de `VERSION`.

### 1.5 CSP corregido para imágenes de Firebase Storage
`next.config.mjs` — `img-src` no incluía `https://firebasestorage.googleapis.com`, lo que rompía las fotos de perfil después de recargar (se veían como icono roto). Corregido.

### 1.6 Offline real: cache de perfil + cola de asistencia (commit `54aa1f5`)
Alcance acotado a lo que el usuario definió como crítico: **ver datos ya cargados sin señal** + **que un profesor pueda seguir marcando asistencia sin señal**. iOS no soporta la Background Sync API, así que la sincronización se hace "a mano" escuchando el evento estándar `online`.

- `src/lib/offlineCache.ts`: guarda en localStorage la última respuesta buena de una key dada (`{ data, guardadoEn }`).
- `src/contexts/AuthContext.tsx`: cada lectura exitosa de `usuarios/{uid}` se cachea. Si la lectura falla (sin señal), en vez de degradar a un perfil vacío tipo "usuario nuevo", usa la copia cacheada y marca `offline: true` en el contexto — así dashboard/portal siguen mostrando datos reales (suscripción, estadísticas, etc.) en vez de una pantalla inconsistente.
- `src/components/layout/AppShell.tsx`: banner ámbar "Sin conexión — viendo tus últimos datos guardados" cuando `offline` es true. Visible en toda la app porque cuelga del shell común.
- `src/lib/offlineQueue.ts`: cola en localStorage para acciones de asistencia (`encolarAsistencia`, `cantidadPendientes`, `sincronizarCola`) — reintenta cada item contra Firestore y deja en cola solo las que vuelven a fallar.
- `src/components/shared/PendienteSync.tsx`: chip flotante con la cantidad de asistencias pendientes; se monta una vez en `AppShell` y sincroniza sola al volver la señal (evento `online`) y al montar.
- `CalendarioEntrenador.tsx` y `app/portal/clases/page.tsx`: al marcar asistencia, si `navigator.onLine` es falso (o la llamada falla por conectividad), se encola en vez de revertir el estado optimista de la UI. Errores reales (no de red) siguen revirtiendo como antes.

**Pendiente de esta parte:** deploy a producción y prueba en celular real con modo avión (el usuario pidió explícitamente probar así, no con localhost/DevTools).

---

## 2. Falta por hacer

### 2.1 Detalles finos de "no se siente una web" (Task pendiente, no iniciada)
- **Safe-areas**: solo `body` tiene `padding-bottom: env(safe-area-inset-bottom)`. Falta revisar el header sticky (notch/isla dinámica arriba), el FAB flotante (`bottom-8 right-8` fijo, no respeta el inset en dispositivos con barra de gestos), y cualquier modal/sheet que se pegue a un borde.
- **Overscroll / pull-to-refresh**: no hay `overscroll-behavior` configurado — al hacer scroll hasta el tope puede disparar el pull-to-refresh nativo del navegador dentro de la PWA, que se ve "de navegador". Definir si se bloquea (`overscroll-behavior-y: contain`) o si se implementa un pull-to-refresh propio.
- **Transiciones de página**: las transiciones actuales (`AnimatePresence` con fade+slide en `AppShell`) son genéricas; falta pulir timing/curvas para que se sientan como push/pop nativo en vez de fade de SPA.
- **Feedback táctil**: revisar que todos los elementos interactivos tengan área mínima de 44px (ya se corrigió al menos en "Salir") y estados `:active` consistentes (algunos botones ya usan `active:scale-[0.96]`, no todos).

### 2.2 Offline — limitaciones conocidas del alcance actual
- Solo se cachea el perfil de usuario (`usuarios/{uid}`). Otras vistas (planes, ranking, historial de transacciones) no tienen cache propio — si Firestore falla, esas pantallas seguirán mostrando su estado de error/vacío normal, no datos viejos.
- La cola de asistencia vive en `localStorage` del dispositivo/navegador — no hay sincronización entre dispositivos ni recuperación si el usuario borra datos del sitio.
- No hay indicador de "actualización disponible" cuando el Service Worker detecta una versión nueva (`v7`, etc.) — el usuario no se entera de que hay una versión más reciente hasta que recarga.

### 2.3 Cosas fuera del alcance de "Fase 6" pero relacionadas
- Notificaciones push (no evaluado en esta fase).
- Reglas de Firestore para `sedes`/`grupos`/`tarifas` siguen exigiendo `isAuthenticated()`, lo cual choca con la idea original de que el wizard de planes fuera visible para invitados (pendiente ya anotado en `PLAN_DE_CIERRE.md` sección 7, no resuelto).

---

## 3. Cómo probar lo ya hecho
1. Deploy a Firebase App Hosting (código) — **las reglas/índices de Firestore se despliegan aparte**, no con el rollout de app.
2. En un iPhone real: abrir en Safari, verificar que aparece el banner de instalación manual, instalar, confirmar que no hay flash blanco al abrir (splash correcto).
3. Con la app instalada y con sesión iniciada, activar modo avión, cerrar y reabrir la app: debe verse el perfil con datos reales + banner "Sin conexión".
4. Como profesor, con modo avión activo, marcar asistencia: debe quedar marcada en la UI y aparecer el chip "N asistencias pendientes de sincronizar". Desactivar modo avión: el chip debe sincronizar solo y desaparecer.
