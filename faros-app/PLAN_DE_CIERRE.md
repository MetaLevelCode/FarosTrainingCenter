# Plan de Cierre — Faros Training Center

**Fecha:** 2026-08-09
**Rama:** `frontend-nextjs`
**Stack:** Next.js 15 (App Router) · React 19 · Firebase 11 · Zustand · Motion · Tailwind v4

---

## 1. Estado actual (auditoría)

Snapshot de qué está terminado vs. qué falta para poder desplegar en producción.

| Área | Estado | Detalle |
|---|---|---|
| Auth + registro estudiante | ✅ Listo | Signup con schema definitivo; `AuthContext` conectado a Firebase |
| Auth registro profesor (código de invitación) | 🟡 Parcial | Códigos hardcodeados en dev (`src/lib/registro.ts`), sin verificación server-side |
| Dashboard estudiante — lectura | ✅ Listo | Suscripción, ranking, historial de asistencia leen Firestore real |
| Dashboard estudiante — **comprar plan** | 🔴 Roto | `Solicitar` solo hace `setSolicitado(true)`, no crea transacción |
| Dashboard estudiante — **subir comprobante** | 🔴 Falta | No hay UI ni Storage integrado |
| Dashboard estudiante — **inscripción a clase** | 🔴 Falta | No hay flujo que agregue a `estudiantes_inscritos` |
| Portal profesor — clases + asistencia | ✅ Listo | `registrarAsistencia()` completa: resta sesión, actualiza estadísticas |
| Portal profesor — plan de clase | ✅ Listo | Guarda `observaciones_profesor` y `plan[]` |
| Admin — dashboard KPIs | 🟡 Mock | `src/app/admin/page.tsx` con datos hardcodeados |
| Admin — finanzas (aprobar/rechazar) | ✅ Listo | `aprobarTransaccion()` crea suscripción + movimiento en tx atómica |
| Admin — planes CRUD | 🔴 UI-only | Edita estado local, no persiste a Firestore |
| Admin — usuarios CRUD | 🔴 Falta | Sin panel para crear/editar/suspender |
| Mensajería | 🔴 Falta | Tipos y helpers listos (`lib/mensajes.ts`), UI (`Conversacion.tsx`) no consume Firestore |
| Cloud Functions | 🔴 No existen | Sin directorio `functions/`; lógica sensible corre en cliente |
| PWA / Service Worker | 🟡 Parcial | `sw.js` presente, sin precache ni background sync |
| Firestore Rules | ✅ Hardened | Commit `cf78d8b` — whitelist create, `activoOk()`, cross-check precio, validación instructor |
| Landing | ✅ Listo | Pulida, con redirección por rol en modo standalone |
| Deploy config | ✅ Listo | `firebase.json` + `apphosting.yaml` configurados |

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
- [x] Crear `src/app/api/invitaciones/route.ts` — POST: verifica y consume código atómicamente
  - Transacción Firestore: check-and-mark-used en un solo paso
  - Cliente nunca lee la colección `codigos_invitacion`
- [x] Conectar `verificarCodigoEnServidor()` en `src/lib/registro.ts` a la API Route
- [x] Fix `src/app/dashboard/planes/page.tsx`:
  - `solicitar()` ahora llama `POST /api/transacciones` con ID token en header
  - Estado `solicitando` + error display en UI
- [x] Añadir `codigos_invitacion` a `firestore.rules` (admin read/write; consumo solo vía API)
- [x] Cambiar `transacciones` `allow create: if false` (creación solo vía Admin SDK)
- [x] Admin finanzas — selector de plan de Firestore antes de aprobar transacción
- [x] `src/lib/types.ts` — `Transaccion.seleccion`, `monto_disponible`, `CodigoInvitacion`

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

### Fase 4 — Admin CRUD ✅ COMPLETADA

- [x] `lib/firestore.ts`: `crearPlan`, `actualizarPlan`, `archivarPlan`, `setUsuarioRol`, `crearCodigoInvitacion`, `getCodigosInvitacion`
- [x] `admin/page.tsx`: KPIs reales desde Firestore (ingresos/egresos del mes, atletas activos, pagos pendientes); gráfico de ingresos últimos 6 meses; cola de pagos pendientes con enlace a finanzas
- [x] `admin/planes/page.tsx`: nuevo tab "Planes activos" con CRUD completo sobre colección `planes` (crear, editar inline, archivar)
- [x] `admin/usuarios/page.tsx`:
  - Selector de rol (estudiante ↔ profesor) por fila con actualización optimista
  - Sección de códigos de invitación: generar, listar, copiar al portapapeles, badge usado/disponible

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

## 4. Riesgos y decisiones abiertas

- **Storage vs. terceros:** ¿comprobantes en Firebase Storage o en un servicio como Cloudflare Images? Firebase es más simple y ya está en el stack.
- **Códigos de invitación:** ¿one-shot o multi-uso con expiración? Recomendado one-shot para trazabilidad.
- **Notificaciones push:** ¿FCM ahora o post-lanzamiento? Recomendado post-lanzamiento (Fase 6+).
- **Modo mock/demo:** ya está protegido por `NODE_ENV`, pero conviene añadir un test de humo en CI que verifique que un build de producción no expone `MOCK_USERS`.
- **Índices de Firestore:** al agregar nuevas queries en Fase 3 y 4 revisar `firestore.indexes.json`.

---

## 5. Estimación total

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
