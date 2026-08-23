# Plan de Cierre — Faros Training Center

**Fecha:** 2026-08-09 (última auditoría: 2026-08-21 — ver sección 6)
**Rama:** `frontend-nextjs`
**Stack:** Next.js 15 (App Router) · React 19 · Firebase 11 · Zustand · Motion · Tailwind v4

---

## 1. Estado actual (auditoría)

Snapshot de qué está terminado vs. qué falta para poder desplegar en producción.

| Área | Estado | Detalle |
|---|---|---|
| Auth + registro estudiante | ✅ Listo | Signup con schema definitivo; `AuthContext` conectado a Firebase |
| Auth registro profesor (código de invitación) | 🟢 Removido | El código de invitación nunca se conectó a ninguna UI de registro — se quitó todo (ver 6.4). Flujo real: se registra como estudiante y el admin lo promueve a profesor desde `/admin/usuarios` |
| Dashboard estudiante — lectura | ✅ Listo | Suscripción, ranking, historial de asistencia leen Firestore real |
| Dashboard estudiante — **comprar plan** | ✅ Listo | Wizard → API → precio server-side con tarifas reales de Firestore (bug de precio hardcodeado corregido, ver 6.1) |
| Dashboard estudiante — **subir comprobante** | ✅ Listo | Storage + preview + progreso |
| Dashboard estudiante — **inscripción a clase** | ✅ Listo | Control de cupo por clase Y por alumno (sesiones se descuentan al inscribirse, ver 6.3) |
| Portal profesor — clases + asistencia | ✅ Listo (real) | `/portal` (home) reconectado a Firestore 2026-08-21 — antes usaba datos sintéticos sin persistencia pese a verse funcional (ver 6.2). `/portal/clases` sigue disponible como vista alterna en el menú |
| Portal profesor — plan de clase | ✅ Listo | Campo `plan` con función de escritura real (`updateClasePlan`) — antes no existía pese a que las rules ya lo permitían |
| Admin — dashboard KPIs | ✅ Listo | Reales desde Firestore, con rango de fecha (ya no un tope fijo de cantidad que se truncaba en silencio, ver 6.5) |
| Admin — finanzas (aprobar/rechazar) | ✅ Listo | `aprobarTransaccion()` crea suscripción + movimiento en tx atómica |
| Admin — planes CRUD | ✅ Listo | Sedes/Grupos/Tarifas/Plantillas persisten a Firestore de verdad |
| Admin — usuarios CRUD | ✅ Listo | Rol, suspensión; bug crítico de `uid` en cambio de rol corregido (ver 6.6) |
| Foto de perfil | ✅ Listo | Comprimida en el navegador (`lib/imagen.ts`, Canvas, ~18 KB por foto) antes de subir a Storage; Firestore solo guarda el link. En `/registro` (opcional) y en ambos perfiles (ver 6.10) |
| Mensajería | ✅ Listo | `mensajes/{canalId}/items` real con `onSnapshot` (ver Fase 5 y 6.14) — muro persistente por grupo + DM alumno↔profesor |
| Cloud Functions | 🔴 No existen | Sin directorio `functions/`; lógica sensible corre en API Routes (decisión ya tomada, ver Fase 1) |
| PWA / Service Worker | 🟡 Parcial | `sw.js` presente, sin precache completo ni background sync |
| Firestore Rules | ✅ Hardened | whitelist create, `activoOk()`, cross-check precio, validación instructor |
| Landing + Login | ✅ Auditado | Sin bugs de fondo — contenido de marketing estático, guard de open-redirect en `?next=` bien hecho, suspensión de cuenta confirmada como diseño intencional (ver 6.9) |
| Deploy config | 🟡 Funcional pero manual | `apphosting.yaml` OK, pero `ABIU: Disabled` — sin auto-deploy al hacer push, cada fix requiere rollout manual. Además, `apphosting:rollouts:create` NO despliega `firestore.rules`/`storage.rules` — es un paso aparte (`firebase deploy --only firestore:rules,storage`) que se venía olvidando (ver 6.10 y 7) |
| Dependencias (GitHub Dependabot) | 🟡 Parcial | De 14 bajado a 8 (ver 6.8). Las 8 restantes solo se resuelven con un upgrade mayor (Next 15→16) o no tienen fix real disponible aún (`firebase-admin`) |

---

## 2. Bloqueadores para producción

Los tres flujos sin los cuales la app no genera valor:

1. **Compra de plan end-to-end** (estudiante paga → admin aprueba → suscripción activa)
2. **Inscripción a clase** (con control atómico de cupo)
3. **CRUD de admin** (planes + usuarios) — sin esto el negocio no puede operar

---

## 3. Plan de ejecución por fases

Cada fase es independientemente desplegable. Orden por criticidad de negocio.

### Fase 1 — API Routes base (backend server-side) ✅ COMPLETADA

Se optó por Next.js Route Handlers en lugar de Firebase Cloud Functions, ya que el proyecto
usa Firebase App Hosting: el backend ya es un servidor Node.js y no necesita desplegar Functions aparte.

- [x] Instalar `firebase-admin` en `package.json`
- [x] Crear `src/lib/admin.ts` — init Admin SDK (ADC en prod, service account en dev)
- [x] Configurar `FIREBASE_SERVICE_ACCOUNT_KEY` en `.env.local`
- [x] Crear `src/app/api/transacciones/route.ts` — POST: calcula precio server-side y crea transacción
  - Verifica ID token de Firebase Auth
  - Valida rol=estudiante y activo!=false
  - Calcula precio con `calcularPrecio()` en el servidor (cliente nunca declara el monto)
  - Crea doc en Firestore con Admin SDK
- [x] ~~Crear `src/app/api/invitaciones/route.ts` — POST: verifica y consume código atómicamente~~ **removido 2026-08-21** — nunca se conectó a una UI real, ver 6.4
- [x] ~~Conectar `verificarCodigoEnServidor()` en `src/lib/registro.ts` a la API Route~~ **removido 2026-08-21** — el archivo completo era código muerto, ver 6.4
- [x] Fix `src/app/dashboard/planes/page.tsx`:
  - `solicitar()` ahora llama `POST /api/transacciones` con ID token en header
  - Estado `solicitando` + error display en UI
- [x] ~~Añadir `codigos_invitacion` a `firestore.rules`~~ **removido 2026-08-21**
- [x] Cambiar `transacciones` `allow create: if false` (creación solo vía Admin SDK)
- [x] Admin finanzas — selector de plan de Firestore antes de aprobar transacción
- [x] `src/lib/types.ts` — `Transaccion.seleccion`, `monto_disponible` (`CodigoInvitacion` removido 2026-08-21)
- [x] **2026-08-21**: `/api/transacciones` calculaba el precio con `TARIFAS_FALLBACK` (hardcodeado) en vez de leer `tarifas/actual` de Firestore — bug crítico corregido (ver 6.1)

### Fase 2 — Compra de plan end-to-end ✅ COMPLETADA

- [x] Habilitar Firebase Storage; añadir a `firebase.json` + `storage.rules`
- [x] `storage.rules`: dueño escribe su carpeta, cualquier auth puede leer (URL no adivinable)
- [x] `src/lib/firebase.ts`: `getFirebase()` ahora devuelve también `storage`
- [x] `src/lib/firestore.ts`: `getTransaccionesUsuario()`, `updateComprobanteTransaccion()`
- [x] `src/components/dashboard/SubirComprobante.tsx`:
  - Preview antes de confirmar (flujo de 2 pasos)
  - Upload con `uploadBytesResumable` + barra de progreso
  - Soporta imagen y PDF; max 10 MB
  - Al terminar llama `updateComprobanteTransaccion()` y dispara `onSubido(url)`
- [x] `dashboard/planes`: flujo completo wizard → SubirComprobante → éxito final
  - Al abrir la página, detecta tx pendiente sin comprobante y salta el wizard
  - `solicitar()` guarda `transaccionId` devuelto por la API
- [x] `dashboard/page.tsx`: banner de estado de transacción pendiente
  - "Falta el comprobante" (amarillo) o "Pago en revisión" (gris)
  - Enlace directo a la página de upload
- [x] `firestore.rules`: estudiante puede actualizar SOLO `comprobante_url` en su tx pendiente

### Fase 3 — Inscripción a clase con control de cupo ✅ COMPLETADA

- [x] `POST /api/clases/[claseId]/inscribir` — transacción atómica:
  - Valida suscripción activa + sesionesRestantes > 0 + cupo disponible + clase programada
  - arrayUnion uid en estudiantes_inscritos; incrementa estadisticas.clasesReservadas
- [x] `POST /api/clases/[claseId]/cancelar` — cancelación con ventana de 2 horas:
  - Valida que uid esté inscrito + clase programada + >2h antes del inicio
  - arrayRemove uid; decrementa clasesReservadas
- [x] `dashboard/asistencia/page.tsx` — refactoring completo:
  - Sección "Clases disponibles": query estado='programada' + fecha futura, filtro client-side
  - Botón "Inscribirse" llama API, actualización optimista de estado local
  - Botón "Cancelar" llama API (ya no es mock local), muestra "< 2h" cuando no se puede
  - Banner de aviso si suscripción vencida o sin sesiones
  - Error display dismissible para errores de acción
- [x] `firestore.indexes.json`: índice compuesto clases [estado + fecha_hora_inicio] + transacciones [usuarioId + creadoEn]

### Fase 4 — Admin CRUD ✅ COMPLETADA (auditada y con bugs corregidos 2026-08-21, ver sección 6)

- [x] `lib/firestore.ts`: `crearPlan`, `actualizarPlan`, `archivarPlan`, `setUsuarioRol` (`crearCodigoInvitacion`/`getCodigosInvitacion` removidos 2026-08-21, ver 6.4)
- [x] `admin/page.tsx`: KPIs reales desde Firestore; gráfico de ingresos últimos 6 meses; cola de pagos pendientes con enlace a finanzas. **2026-08-21**: el rango de 6 meses usaba `getMovimientos(200)` (tope de cantidad, no de fecha) — corregido con `getMovimientosDesde()` (ver 6.5)
- [x] `admin/planes/page.tsx`: tabs Sedes/Grupos/Tarifas/Plantillas con CRUD real sobre Firestore. **2026-08-21**: bug de `docToId` causaba duplicados al editar sedes/grupos, y el formulario de "nuevo" quedaba invisible sin scroll — ambos corregidos
- [x] `admin/usuarios/page.tsx`:
  - Selector de rol (estudiante ↔ profesor) por fila. **2026-08-21**: bug crítico — `getUsuario(s)` nunca fijaba `uid` real, así que cambiar el rol de un usuario podía afectar a OTRA cuenta (la primera de la lista, ej. el propio admin) — corregido (ver 6.6)
  - ~~Sección de códigos de invitación~~ **removida 2026-08-21** (ver 6.4)

### Fase 5 — Mensajería ✅ COMPLETADA (2026-08-23, ver 6.14)

- [x] `Conversacion.tsx`: consume Firestore con `onSnapshot` sobre `mensajes/{canalId}/items`
- [x] Reglas de mensajería en `firestore.rules` (miembros del canal leen/escriben)
- [x] Muro grupal persistente + DM alumno↔profesor en `/dashboard` y `/portal`
- [ ] Function opcional para notificaciones push cuando hay mensaje nuevo — post-lanzamiento (ver sección 8)

### Fase 6 — PWA hardening ✅ COMPLETADA (2026-08-23, ver sección 6.12)

- [x] Service worker: precache de rutas críticas y assets estáticos
- [x] Fallback offline para dashboard con última data cacheada (perfil — alcance
  final acotado a *best-effort*, ver 6.12)
- [x] Cola de asistencia offline (sin Background Sync API real — iOS no la
  soporta — sincroniza a mano con el evento `online`)
- [x] Verificar `InstallPrompt` en iOS Safari y Chrome Android

### Fase 7 — QA + deploy (2-3 días)

- [ ] Migrar datos seed a un proyecto Firebase de staging
- [ ] Prueba E2E manual de cada rol (estudiante, profesor, admin)
- [ ] Auditoría de `firestore.rules` con Emulator Suite (tests unitarios de reglas)
- [ ] Configurar variables de entorno en App Hosting (secrets para API keys)
- [ ] Deploy a producción, monitorear Crashlytics/Analytics primeras 48h
- [ ] Verificar el guard `NODE_ENV` en `AuthContext` — no debe caer a mock en producción

---

## 6. Auditoría 2026-08-21 — bugs críticos encontrados y resueltos

Sesión de auditoría fase por fase (1-4 + portal del profesor) buscando bugs escondidos
detrás de checkmarks ✅ que resultaron no ser tan sólidos como parecían. Todo lo listado
aquí ya está corregido, comiteado y desplegado a producción.

### 6.1 — Precio hardcodeado en `/api/transacciones`
`calcularPrecio(seleccion)` se llamaba sin pasar `tarifas`, así que SIEMPRE usaba
`TARIFAS_FALLBACK` (precios de fábrica) sin importar lo que el admin configurara en
Tarifas. El wizard mostraba el precio correcto (sí lee Firestore), pero el servidor
congelaba la transacción con el precio viejo. Corregido leyendo `tarifas/actual` vía
Admin SDK antes de calcular.

### 6.2 — Calendario del profesor (`/portal`) no conectado a Firestore
El front construyó `CalendarioEntrenador.tsx` con datos sintéticos (`lib/agenda.ts`,
ahora borrado) mientras el back se hacía por separado — nunca se conectaron. Se veía
y se sentía funcional (guardar plan, marcar asistencia) pero todo vivía en estado
local de React: se perdía al recargar. Mientras tanto `/portal/clases` sí era real,
pero su link de navegación se había quitado a propósito asumiendo que el calendario
"ya cubría lo mismo". Corregido: el calendario ahora usa `getClasesProfesor`,
`getAsistenciasClase`, `registrarAsistencia`, `updateClasePlan` y
`updateObservacionesClase` reales, con sección de Observaciones/finalizar clase
agregada. `/portal/clases` se restauró en el menú como vista alterna.

### 6.3 — Sobre-reserva de clases (control de cupo por alumno)
`inscribir` solo validaba `sesionesRestantes > 0` pero nunca descontaba nada — el
descuento real ocurría en `registrarAsistencia` (al marcar asistencia). Un alumno con
1 sola sesión podía inscribirse en N clases futuras y "asistir" a todas, topando el
saldo en 0 sin bloquear nada. Corregido: la sesión se descuenta al INSCRIBIRSE (tope en
`sesionesCompradas`), `/cancelar` la devuelve, y `registrarAsistencia` ya no toca el
saldo (solo estadísticas de asistencia).

### 6.4 — Sistema de código de invitación para profesores (removido)
Backend completo (`/api/invitaciones`, `crearCodigoInvitacion`/`getCodigosInvitacion`,
`lib/registro.ts` — 272 líneas) que **nunca se conectó a ninguna UI**: `/registro`
(la única página real de signup) solo crea cuentas de estudiante. El admin podía
"Generar código" y verlo en una lista, pero no había dónde usarlo. El flujo real
confirmado con el usuario: todos se registran como estudiante, el admin promueve a
profesor desde `/admin/usuarios` (`setUsuarioRol`, ya funcional). Se quitó todo el
sistema (rutas, funciones, UI, reglas, tipos).

### 6.5 — Techo silencioso en KPIs (`getMovimientos(200)`)
Traía los 200 movimientos MÁS RECIENTES de toda la historia (no un rango de fecha).
Si el club supera ese volumen en 6 meses, "Ingresos del mes" y el gráfico quedan
truncados sin ningún error visible. `admin/finanzas` tenía el mismo problema peor
(tope de 50, sin filtro de fecha en absoluto pese a llamarse `ingresosMes`). Corregido
con `getMovimientosDesde(fecha)` — filtra por rango real, sin tope de cantidad.

### 6.6 — `uid` de `Usuario` siempre `undefined` (bug crítico)
`getUsuario`/`getUsuarios` usaban el `docToId` genérico, que solo fija `id: snap.id`
— pero `Usuario` usa `uid` como campo de identidad, y el whitelist de creación en
`firestore.rules` no permite guardar `uid` dentro de los datos del doc (solo vive
como el path `usuarios/{uid}`). Resultado: **todo usuario real tenía `uid: undefined`**
en cualquier lista. Reproducido en vivo: al cambiar el rol de un usuario en
`/admin/usuarios`, el diálogo de confirmación mostraba el nombre de OTRA cuenta (la
primera de la lista, alfabéticamente — en la práctica, terminaba señalando al admin).
Corregido con `docToUsuario`, que fuerza `uid: snap.id` siempre.

### 6.7 — Otros fixes menores
- `tasaAsistencia` se guarda como fracción (0-1) pero se mostraba directo como `%` sin
  multiplicar por 100 (dashboard del alumno, ranking, `/portal/alumnos`) — corregido.
- Botones sin funcionalidad real quitados: "Solicitar cambio de días" y "Pagar y
  activar" en el dashboard del alumno (llamaban a funciones vacías que no guardaban
  nada, dejando la falsa impresión de éxito).
- `clasesDadas` (perfil del profesor) nunca se incrementaba — ahora sube al finalizar
  una clase.
- `docToId` (usado por sedes/grupos/etc.) dejaba que un campo `id` corrupto dentro del
  documento pisara el id real del path — causaba duplicados al editar en
  `admin/planes`. Corregido invirtiendo el orden del spread.
- `/portal/alumnos` mostraba TODOS los estudiantes del club a cualquier profesor —
  acotado a "mis alumnos" (inscritos en clases donde el profesor es `instructor_id`);
  el admin sigue viendo a todos.

### 6.8 — Dependencias vulnerables (Dependabot): 14 → 8
`npm audit fix` (sin `--force`) resolvió `brace-expansion`, `js-yaml`, `nanoid` y
`gaxios` sin tocar nada mayor. Se subió `eslint` 9.18.0 → 9.39.5 (misma major,
resuelve el ReDoS de `@eslint/plugin-kit`) — herramienta de desarrollo, no va al
bundle de producción. Quedan 8 (5 moderadas, 3 altas), ambas solo resolubles con
un upgrade mayor real:
- **`next` 15→16** — única forma de resolver `postcss` (empaquetado dentro de
  `next`) y `sharp`. Riesgo práctico bajo hoy: se revisó dónde se usa `next/image`
  en la app y solo procesa assets estáticos propios (`/media/*.jpg`), nunca
  imágenes subidas por usuarios (los comprobantes van directo a Firebase Storage).
  El upgrade en sí es grande y merece su propia sesión de pruebas dedicada, dado
  el historial de fragilidad de esta app con hydration/chunks del service worker.
- **`firebase-admin`** — el único "fix" que sugiere `npm audit` es bajar a 10.3.0
  (más vieja que la actual, 14.2.0) — se descartó por ser una regresión real a
  cambio de una vulnerabilidad de `uuid` (buffer manual) que no aplica a cómo la
  usamos. No hay versión más nueva disponible todavía que lo resuelva.

### 6.9 — Landing + Login auditados
Sin bugs de fondo. La landing (`page.tsx`) es 100% contenido de marketing estático
(hero, misión, "+500 atletas", media, testimonios) — sin lógica de datos que pudiera
romperse. `login/page.tsx`: el guard de `?next=` contra open-redirect está bien hecho
(solo acepta rutas internas). Se verificó que `signIn()` no chequea `activo` antes de
dejar entrar, pero es diseño intencional — `CuentaSuspendida` envuelve todas las
rutas autenticadas y bloquea el contenido si `activo === false`, y las reglas de
Firestore rechazan cualquier escritura igual. Único hallazgo real: el usuario mock
de desarrollo (`estudiante@faros.com`) tenía `tasaAsistencia: 87` (entero) en vez de
`0.87` (fracción) — efecto colateral del fix de 6.7, solo visible en modo demo local
— corregido.

### 6.10 — Feature: foto de perfil + hallazgo de proceso en deploy
Se agregó subida de foto de perfil (`/registro` opcional, y editable en
`/dashboard/perfil` y `/portal/perfil`). El usuario sube la imagen que sea; se
comprime en el navegador con `<canvas>` (`lib/imagen.ts` — redimensiona a máx.
512px de lado, JPEG calidad ~0.82, sin librerías nuevas) antes de subirla a
Storage (`perfiles/{uid}/avatar.jpg`, sobreescribe en vez de acumular). Firestore
solo guarda el link (`foto_perfil`), nunca el binario — una foto comprimida pesa
~18 KB, prácticamente nada frente al límite de 1 MB por documento (que de todas
formas no aplica: ahí solo va el link).

**Hallazgo de proceso importante:** al probarlo salió `Missing or insufficient
permissions` en Firestore pese a que la regla de `usuarios/{uid}` ya permitía el
campo. La causa: `firebase apphosting:rollouts:create` (el comando que usamos
para TODOS los deploys de esta sesión) **solo despliega el código de la app —
nunca `firestore.rules` ni `storage.rules`**. Esos requieren su propio comando
(`firebase deploy --only firestore:rules,storage`), que no se había corrido en
toda la sesión de hoy. Esto significa que varios cambios de reglas de días
anteriores (ej. remover `codigos_invitacion` de 6.4) tampoco estaban desplegados
hasta ahora. Ya se corrió ese deploy y quedó al día.

**Segundo bug encontrado (usuario, en pruebas manuales):** la foto se subía bien,
pero al recargar la página se veía como ícono roto (fondo amarillo del botón
asomando detrás). Causa: el CSP (`next.config.mjs`) tiene `img-src` — la
directiva que rige un `<img src>` — separada de `connect-src` (la que rige
fetch/XHR, usada por el SDK al subir). `connect-src` ya permitía
`firebasestorage.googleapis.com`, pero `img-src` solo tenía
`googleusercontent.com` (para avatares de Google Sign-In) — nunca se agregó el
dominio de Storage. Corregido; de paso se conectó `foto_perfil` en los dos
avatares que aún mostraban solo iniciales: el header de `AppShell` y la tabla
de `admin/usuarios`.

### 6.11 — Cupos disponibles reales + índice faltante tumbaba todo el catálogo
El wizard mostraba `"Cupo máximo N"` (la capacidad total del grupo, fija) en vez
de cupos disponibles reales. Se agregó `GET /api/grupos/cupos` (Admin SDK):
cuenta suscripciones activas y no vencidas por `grupoId` — no se puede hacer
desde el cliente porque `firestore.rules` no deja que un alumno lea las
suscripciones de otros. El wizard ahora muestra "N cupos disponibles" y
bloquea la selección de un grupo lleno.

**Bug más grave descubierto al verificarlo:** los números seguían siendo los
viejos hardcodeados (4, 6...) pese al fix. Causa: `getSedes()` no tenía el
índice compuesto (`activo`+`orden`) que su propia query necesita, y estaba
metido en un `Promise.all([getSedes(), getGrupos(), getTarifas()])` — al
fallar sedes, **rechaza el `Promise.all` completo**, así que grupos y tarifas
también caían al catálogo hardcodeado de `lib/planes.ts` aunque esas dos
consultas sí hubieran funcionado solas. Corregido: se agregó el índice a
`firestore.indexes.json` (desplegado), y las tres llamadas se separaron con su
propio `.catch()` cada una, para que una futura falla aislada no vuelva a
arrastrar a las otras dos.

**Hallazgo aparte, sin tocar:** `sedes`/`grupos`/`tarifas` requieren
`isAuthenticated()` para leerse, pero el wizard dice estar "abierto a
invitados" — un visitante sin cuenta caería siempre al catálogo hardcodeado
sin darse cuenta, incluyendo precios viejos. Ver pendiente en sección 7.

### 6.12 — Fase 6: PWA hardening completa (2026-08-22/23)

Ver `PWA_ESTADO.md` para el detalle completo con código y razones; acá el
resumen de lo que se encontró probando **en dispositivos reales** (celular +
PC), no simulado — varios bugs de fondo solo aparecían así.

**Instalación, splash, branding:** `InstallPrompt` reescrito para iOS (sin
`beforeinstallprompt`, instrucciones manuales) vs Android (nativo). Splash
screens de iOS generados por dispositivo. Se reemplazaron los prototipos de
logo (SVG a mano, texto simulando marca) por los assets reales entregados —
íconos de la PWA, favicon, splash, todo regenerado desde el logo real.

**Animación de entrada:** se iteró bastante (faro con ripple de anillos,
llegando a medir la geometría exacta píxel a píxel del PNG real) antes de
asentar en la versión final — una marea amarilla simple que sube, cubre la
pantalla y baja revelando la app.

**Service worker — bugs reales encontrados probando offline:**
1. `getFirebase()` cacheaba la promesa de init para siempre, incluso si
   fallaba — un solo fallo sin señal rompía Firestore para toda la sesión,
   aunque volviera la conexión.
2. `ServiceWorkerRegister` forzaba `window.location.reload()` apenas un SW
   nuevo tomaba control, sin chequear `navigator.onLine` — si eso coincidía
   con la prueba offline, la recarga fallaba y aparecía el error nativo del
   navegador (el "dinosaurio" de Chrome).
3. `cache.addAll()` en el install del SW es todo-o-nada: si una URL fallaba,
   ninguna quedaba cacheada, incluida `/offline` (el propio fallback).
4. El fallback offline no siempre calzaba en `caches.match()` por los headers
   `Vary` que agrega Next.js (`rsc`, `next-router-state-tree`...) — se agregó
   `ignoreVary` más un HTML mínimo embebido directo en el SW como última red
   de seguridad.
5. Las fuentes de Google (incluye Material Symbols, los íconos del menú)
   estaban excluidas del cache del SW por un choque con el CSP
   (`font-src` las permitía, `connect-src` no) — sin señal, los íconos se
   veían como texto plano ("event_busy"). Se corrigió el CSP y se cachean
   cache-first.
6. Falso positivo: el checkbox "Bypass for network" de Chrome DevTools salta
   el SW aunque figure "activated and running" — no es un bug, pero costó
   una vuelta completa de debugging descartarlo.

**Decisión de alcance — offline como *best-effort*:** después de perseguir
varios de estos bugs uno por uno, se decidió no seguir cazando cada fetch sin
capturar de cada pantalla (la app depende de Firestore para casi todo). Se
dejó el cache de perfil + banner + cola de asistencia (que sí funcionan bien)
y se agregó una red de seguridad genérica: `error.tsx`/`global-error.tsx`
detectan `navigator.onLine` y muestran un aviso simple en vez del error
genérico cuando algo revienta por falta de señal en una pantalla no cubierta
explícitamente.

**Detalles finos:** `overscroll-behavior-y: contain` (evita que el scroll en
el tope encadene al pull-to-refresh nativo), `-webkit-tap-highlight-color` +
`touch-action: manipulation` (quita el flash gris y el retraso de tap "de
página web"), safe-area en todos los `fixed` (headers y FABs que faltaban),
header de marca para la landing en mobile (el de escritorio va `hidden
md:block` y no quedaba nada arriba en celular).

**Bugs de layout en mobile:** en `/portal/clases`, la cabecera de cada
tarjeta de clase tenía tres bloques compitiendo en una fila (fecha/hora +
título/sede + badge de estado) — el texto del medio se truncaba a "T...",
"ES...". Agregar `truncate` solo tapó el síntoma; el fix real fue
reestructurar la cabecera a dos filas. Se hizo un barrido por los 32 usos de
`<Badge>` y 22 usos de `shrink-0` del proyecto buscando el mismo patrón — no
apareció en ningún otro lado (ya estaban protegidos por `flex-wrap` o tablas
con scroll horizontal).

### 6.13 — Auditoría 2026-08-23 — barrido de datos hardcodeados vs. Firestore

Se pidió confirmar si quedaba algo en el frontend sin conectar a Firestore, más allá
de lo ya sabido de Mensajería. Barrido completo de `src/`: portal profesor, dashboard
alumno, admin, componentes compartidos.

**Resultado: prácticamente todo ya está conectado.** Dos hallazgos reales:

- **`VELOCIDAD` en `dashboard/page.tsx`** (línea ~39-42): el gráfico "Tendencia de
  velocidad" del alumno usa un array hardcodeado de porcentajes inventados (`S1..S6`),
  no datos derivados de asistencia/rendimiento real. No estaba documentado antes.
- **Mensajería** (`lib/mensajes.ts`): confirma lo ya sabido — sigue siendo demo local
  (`mensajesSemilla()`), sin colección `mensajes` en Firestore ni rutas API. Ver Fase 5.

**Código muerto encontrado de paso:** `ROSTER`/`AtletaRoster`/`pctAsistencia` en
`lib/planes.ts` (~línea 384) no tienen ningún importador en todo `src/` — candidato a
eliminar en una futura limpieza, no es algo que requiera "conectarse".

Todo lo demás (portal/alumnos, portal/clases, portal/perfil, dashboard completo,
admin completo, CalendarioEntrenador, SolicitudesPendientes, SolicitudPersonalizada)
ya lee/escribe Firestore real. Lo estático intencional (landing, testimonios, footer,
CTAs) es contenido de marketing, correctamente sin tocar.

### 6.14 — Fase 5: Mensajería real sobre Firestore (2026-08-23)

Reemplazado el chat semilla (`mensajesSemilla()`, `COACH_ID` inventado,
`claseId` falso = id de la suscripción) por mensajería real:
`mensajes/{canalId}/items/{id}`, leída en tiempo real con `onSnapshot`
(primer uso de realtime en el proyecto — `src/hooks/useCanalMensajes.ts`).

**El problema de fondo:** `clases/{id}` es una SESIÓN puntual (una
fecha/hora con su propio `estudiantes_inscritos`), no un curso persistente.
Un alumno de "Grupal 2x/semana" tiene DOS docs de clase distintos con el
mismo `nombre_clase` (martes y jueves). Decisión de producto tomada con el
usuario: el "muro de la clase" debe seguir vivo semana a semana, no
reiniciarse en cada sesión — así que la identidad del canal grupal es un
slug estable de `nombre_clase` (`canalGrupo()`, `lib/mensajes.ts`), no el id
de una sesión.

**Por qué hay un doc de control `mensajes/{canalId}` con `participantes`
denormalizado:** las reglas de Firestore solo pueden `get()` un documento
puntual por path, no "busca todas las clases de este grupo" — mismo límite
que ya forzó el precedente de `asistencias` (`get()` sobre `clases`, ver
6.x). Por eso `/api/clases/[claseId]/inscribir` y `/cancelar` (las únicas
rutas que ya tocaban `estudiantes_inscritos`, dentro de su propia
`runTransaction()`) ahora también mantienen `mensajes/{canalGrupo}.participantes`:
`arrayUnion` al inscribirse; al cancelar, una query transaccional adicional
verifica si el alumno sigue inscrito en OTRA sesión del mismo grupo antes de
sacarlo del muro (si cancela el martes pero sigue yendo el jueves, no pierde
el hilo).

El DM alumno↔profesor no tiene este problema — `instructor_id` ya es un id
estable — así que su canal (`dm:<coachId>:<alumnoId>`) no necesita doc de
control: la membresía se valida parseando el propio `canalId` en las
reglas.

**Componentes reescritos:** `MensajesAlumno.tsx` ahora deriva sus canales
reales consultando `clases` (`estudiantes_inscritos array-contains uid`) en
vez de recibir `claseId`/`claseNombre` falsos por props — muestra una tab de
muro por cada grupo y una tab de DM por cada profesor distinto con el que
el alumno realmente tiene clases. `CalendarioEntrenador.tsx` usa el `uid`
real del profesor logueado en vez de `COACH_ID`.

**Pendiente de verificación antes de producción:** la nueva query de
`cancelar` (`where('nombre_clase','==',...) + where('estudiantes_inscritos','array-contains',uid)`)
sigue el mismo patrón (array-contains + una igualdad) que ya usa
`dashboard/asistencia` sin tener una entrada explícita en
`firestore.indexes.json` — no se agregó un índice nuevo asumiendo que
Firestore lo resuelve igual que el caso existente, pero dado el antecedente
de 6.11 (un índice faltante tumbó todo el catálogo en silencio), **hay que
probar el flujo de cancelar contra Firestore real antes de dar esto por
cerrado** — si tira `FAILED_PRECONDITION`, la consola de Firebase da el
link directo para crear el índice compuesto.

**Fuera de alcance (anotado a propósito, no es un olvido):** editar/borrar
mensajes propios, notificaciones push, contador de no leídos.

**Bugs reales encontrados al probarlo (mismo día, corregidos):**
- El muro grupal no dejaba enviar mensajes para NINGÚN alumno inscrito antes
  del deploy — exactamente la consecuencia del backfill pendiente de arriba.
  Se agregó `POST /api/mensajes/backfill` (admin, botón en `/admin`) que
  recorre todas las `clases` y reconstruye `participantes` desde
  `estudiantes_inscritos`/`instructor_id` reales. Idempotente, correrlo una
  vez tras el deploy.
- `cancelar` fallaba con error genérico en clases cuyo canal de grupo
  todavía no existía (nadie se había inscrito a ese grupo desde el deploy):
  usaba `tx.update()` sobre el doc del canal, que lanza si el doc no
  existe. Cambiado a `tx.set(..., { merge: true })`, igual que ya hacía
  `inscribir`.
- El chat no tenía apartado propio en el menú — vivía anidado dentro del
  dashboard del alumno y dentro de cada tarjeta de clase del profesor, sin
  forma de encontrarlo sin saber que estaba ahí. Se agregó "Mensajes" al
  menú de ambos roles: `/dashboard/mensajes` (reusa `MensajesAlumno`) y
  `/portal/mensajes` (nueva página: mismo patrón de tabs, pero listando
  todos los grupos que dicta el profesor + un DM por cada alumno distinto
  entre sus clases, no solo los de la clase abierta en el calendario).

---

## 7. Pendientes actuales (post-auditoría 2026-08-21)

- [ ] **Verificar en producción** que el commit desplegado se comporta igual que en
  las pruebas locales — todo se probó en `localhost`, no en producción.
- [ ] **Incluir `firestore:rules,storage` en el checklist de deploy**: no se
  despliegan con `apphosting:rollouts:create` (ver 6.10) — hay que acordarse de
  correrlo aparte cada vez que se toque `firestore.rules` o `storage.rules`.
- [x] ~~Revisar las 14 vulnerabilidades de Dependabot~~ — bajado a 8, ver 6.8. Las
  8 restantes quedan pendientes de un upgrade mayor de Next (decisión aparte).
- [x] ~~Decidir el alcance de `/portal/alumnos`~~ — resuelto 2026-08-21: se acotó a
  "mis alumnos" (inscritos en clases donde el profesor es `instructor_id`); el admin
  sigue viendo a todos. No existe campo "profesor asignado" en `Usuario`, así que la
  relación se deriva de `Clase.estudiantes_inscritos`.
- [x] ~~Auditar landing page + login~~ — resuelto 2026-08-21, ver 6.9. Sin bugs de
  fondo; se corrigió el mock de desarrollo con `tasaAsistencia` mal formateada.
- [ ] **Deploy manual**: `apphosting.yaml` está bien, pero `ABIU: Disabled` — no hay
  auto-deploy al hacer push a GitHub. Cada fix requiere correr el rollout a mano
  (`firebase apphosting:rollouts:create`); ya nos mordió una vez esta sesión (un fix
  quedó en el repo sin desplegar).
- [x] ~~Fase 6 (PWA hardening)~~ — completada 2026-08-23, ver 6.12.
- [ ] Fase 5 (Mensajería) y Fase 7 (QA + staging) siguen como se describen
  abajo — no se tocaron en esta auditoría por ser features nuevas, no bugs de
  algo ya construido.
- [ ] **`sedes`/`grupos`/`tarifas` exigen login para leerse** pese a que el wizard
  de planes dice estar "abierto a invitados" (ver 6.11) — decidir si se relaja la
  regla a lectura pública (son catálogo/precios, no datos sensibles) o si el
  wizard deja de prometer soporte a invitados.
- [ ] **`VELOCIDAD` hardcodeado en `dashboard/page.tsx`** (ver 6.13) — el gráfico de
  "Tendencia de velocidad" del alumno muestra datos inventados, no reales.
- [ ] **Limpiar código muerto**: `ROSTER`/`AtletaRoster`/`pctAsistencia` en
  `lib/planes.ts` (ver 6.13) — sin importadores en todo `src/`.
- [ ] **Desplegar `firestore.rules` y probar Mensajería contra Firestore real**
  (ver 6.14) — recordar `firebase deploy --only firestore:rules,storage` (no
  lo hace `apphosting:rollouts:create`, ver 6.10) y verificar si la query
  nueva de `/cancelar` necesita un índice compuesto que no está en
  `firestore.indexes.json` todavía.

---

## 8. Riesgos y decisiones abiertas

- **Storage vs. terceros:** ¿comprobantes en Firebase Storage o en un servicio como Cloudflare Images? Firebase es más simple y ya está en el stack.
- ~~**Códigos de invitación:** ¿one-shot o multi-uso con expiración?~~ Resuelto 2026-08-21 — se quitó el sistema completo (ver 6.4); el flujo real es registro como estudiante + promoción manual de rol.
- **Notificaciones push:** ¿FCM ahora o post-lanzamiento? Recomendado post-lanzamiento (Fase 6+).
- **Modo mock/demo:** ya está protegido por `NODE_ENV`, pero conviene añadir un test de humo en CI que verifique que un build de producción no expone `MOCK_USERS`.
- **Índices de Firestore:** al agregar nuevas queries en Fase 3 y 4 revisar `firestore.indexes.json`.
- **Deploy manual (`ABIU: Disabled`):** ¿activar auto-deploy en App Hosting, o mantener el rollout manual? Ver 7.

---

## 9. Estimación total

| Fase | Días |
|---|---|
| 1 — Cloud Functions | 2-3 |
| 2 — Compra de plan | 2-3 |
| 3 — Inscripción a clase | 2 |
| 4 — Admin CRUD | 2-3 |
| 5 — Mensajería | 2 |
| 6 — PWA hardening | 1 |
| 7 — QA + deploy | 2-3 |
| **Total** | **13-17 días de trabajo enfocado** |

Con 1 desarrollador full-time: **~3 semanas**. Con paralelización (frontend + backend): **~2 semanas**.
