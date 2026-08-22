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
| Mensajería | 🔴 Falta | Tipos y helpers listos (`lib/mensajes.ts`), UI (`Conversacion.tsx`) no consume Firestore — sigue siendo demo local a propósito dentro del calendario del profesor |
| Cloud Functions | 🔴 No existen | Sin directorio `functions/`; lógica sensible corre en API Routes (decisión ya tomada, ver Fase 1) |
| PWA / Service Worker | 🟡 Parcial | `sw.js` presente, sin precache completo ni background sync |
| Firestore Rules | ✅ Hardened | whitelist create, `activoOk()`, cross-check precio, validación instructor |
| Landing + Login | ⚪ Sin auditar | Nunca se revisó con el mismo nivel de detalle que el resto (ver 7) |
| Deploy config | 🟡 Funcional pero manual | `apphosting.yaml` OK, pero `ABIU: Disabled` — sin auto-deploy al hacer push, cada fix requiere rollout manual (ver 7) |
| Dependencias (GitHub Dependabot) | ⚪ Sin revisar | 14 vulnerabilidades reportadas en cada push (7 altas, 7 moderadas) — nunca auditadas (ver 7) |

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

### Fase 5 — Mensajería (2 días)

- [ ] `Conversacion.tsx`: consumir Firestore con `onSnapshot` sobre `mensajes/{canalId}/items`
- [ ] Function opcional para notificaciones push cuando hay mensaje nuevo
- [ ] Reglas de mensajería en `firestore.rules` (miembros del canal leen/escriben)
- [ ] UI de bandeja de conversaciones en `/dashboard` y `/portal`

### Fase 6 — PWA hardening (1 día)

- [ ] Service worker: precache de rutas críticas y assets estáticos
- [ ] Fallback offline para dashboard con última data cacheada
- [ ] Background sync para asistencia en modo offline (profesor sin cobertura)
- [ ] Verificar `InstallPrompt` en iOS Safari y Chrome Android

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

---

## 7. Pendientes actuales (post-auditoría 2026-08-21)

- [ ] **Verificar en producción** que el commit desplegado (`497e99f`) se comporta
  igual que en las pruebas locales — todo se probó en `localhost`, no en producción.
- [ ] **Revisar las 14 vulnerabilidades de Dependabot** que GitHub reporta en cada
  push (7 altas, 7 moderadas) — nunca se auditaron.
- [ ] **Decidir el alcance de `/portal/alumnos`**: hoy un profesor ve a TODOS los
  estudiantes del club, no solo los suyos. ¿Es intencional (club chico) o hay que
  acotarlo por grupo/instructor?
- [ ] **Auditar landing page + login** con el mismo nivel de detalle que el resto —
  nunca se revisaron en esta ronda.
- [ ] **Deploy manual**: `apphosting.yaml` está bien, pero `ABIU: Disabled` — no hay
  auto-deploy al hacer push a GitHub. Cada fix requiere correr el rollout a mano
  (`firebase apphosting:rollouts:create`); ya nos mordió una vez esta sesión (un fix
  quedó en el repo sin desplegar).
- [ ] Fase 5 (Mensajería), Fase 6 (PWA hardening) y Fase 7 (QA + staging) siguen
  como se describen abajo — no se tocaron en esta auditoría por ser features nuevas,
  no bugs de algo ya construido.

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
