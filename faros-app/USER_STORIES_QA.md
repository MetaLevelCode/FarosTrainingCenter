# User Stories — QA manual

**Propósito:** recorrer la app como usuarios reales (no solo leer código) para
encontrar bugs de UI/UX que el code review no atrapa. Cada historia se prueba
paso a paso en el navegador; las anotaciones y bugs encontrados quedan aquí.

**Cómo se usa:** al terminar de probar una historia, marcar su estado y anotar
lo encontrado. Si aparece un bug, anotarlo con suficiente detalle para poder
arreglarlo después (o el link al commit que lo arregló).

Estados: 🔲 Pendiente · 🔄 En progreso · ✅ Sin bugs · 🐛 Bugs encontrados (ver notas)

---

## Estudiante

### E1 — Alumno nuevo compra su primer plan
**Como** visitante sin cuenta, **quiero** registrarme, armar mi plan y subir mi
comprobante de pago, **para** quedar en revisión y que el club active mi plan.

Pasos:
1. Landing → "Comenzar" / "Inscríbete ahora" → `/registro`
2. Llenar formulario de registro (estudiante)
3. Armar plan en el wizard (`/dashboard/planes`)
4. Confirmar solicitud → subir comprobante
5. Verificar banner de "Pago en revisión" en `/dashboard`

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E2 — Alumno con plan activo se inscribe y cancela una clase
**Como** alumno con plan activo, **quiero** ver las clases disponibles,
inscribirme a una, y poder cancelarla, **para** organizar mi semana de
entrenamiento.

Pasos:
1. `/dashboard/asistencia` → ver "Clases disponibles"
2. Inscribirse a una clase → verificar que aparece en "Mis clases" y que el
   contador de sesiones restantes bajó
3. Cancelar la inscripción (fuera de la ventana de 2h) → verificar que el
   contador de sesiones se devolvió
4. Intentar cancelar una clase dentro de la ventana de 2h → debe bloquearse

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E3 — Alumno revisa su dashboard
**Como** alumno, **quiero** ver mi estado de suscripción, mi ranking y mi
historial, **para** hacer seguimiento a mi progreso.

Pasos:
1. `/dashboard` → revisar banner de estado, "Tu semana", ranking de compañeros
2. `/dashboard/perfil` → revisar datos personales
3. `/dashboard/planes` (con plan activo) → debe mostrar resumen, no el wizard

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

## Profesor

### P1 — Profesor usa su calendario del día a día
**Como** profesor, **quiero** ver mis clases en el calendario, subir el plan de
clase, marcar asistencia y finalizar la clase, **para** llevar el registro de
mis sesiones.

Pasos:
1. `/portal` → abrir una clase del día
2. Subir/editar plan de clase
3. Marcar asistencia de uno o más alumnos
4. Escribir observaciones y "Guardar y finalizar clase"
5. Verificar en `/portal/perfil` que "Clases dictadas" subió
6. Probar el muro de mensajes (demo local, no debería prometer persistencia)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### P2 — Profesor revisa Mis Clases y Estudiantes
**Como** profesor, **quiero** ver la vista alterna de mis clases y la lista de
mis alumnos, **para** tener otra forma de revisar mi carga.

Pasos:
1. `/portal/clases` → verificar que las clases y el estado coinciden con `/portal`
2. `/portal/alumnos` → verificar que solo aparecen alumnos inscritos en sus
   clases (no todos los del club)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

## Admin

### A1 — Admin aprueba/rechaza un pago
**Como** admin, **quiero** revisar una solicitud pendiente con su comprobante y
aprobarla o rechazarla, **para** activar (o no) el plan del alumno.

Pasos:
1. `/admin/finanzas` → abrir una transacción pendiente, ver comprobante
2. Aprobar → verificar que el alumno pasa a "Activo" y aparece el movimiento
3. (con otra tx) Rechazar con motivo → verificar que el alumno lo ve reflejado

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### A2 — Admin gestiona catálogo y usuarios
**Como** admin, **quiero** editar sedes/grupos/tarifas y gestionar roles de
usuarios, **para** mantener el catálogo y el equipo al día.

Pasos:
1. `/admin/planes` → crear/editar una sede, un grupo, ajustar una tarifa
2. `/admin/usuarios` → cambiar el rol de un usuario, suspender/reactivar una cuenta

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

## Resumen de bugs encontrados (se llena al final)

| # | Historia | Bug | Severidad | Estado |
|---|---|---|---|---|
| | | | | |
