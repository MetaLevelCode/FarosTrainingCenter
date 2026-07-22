# User Stories — Panel de Administración · Faros Training Center

> **Contexto:** El panel de administración es usado por los dueños y entrenadores de Faros Training Center para monitorear el negocio. Los usuarios (estudiantes) se registran solos; el admin solo observa y gestiona finanzas.

---

## Módulo: Usuarios

### US-01 · Ver listado de usuarios
**Como** administrador de Faros Training Center,  
**quiero** ver todos los usuarios registrados en el sistema,  
**para** tener visibilidad del total de estudiantes y profesores activos.

**Criterios de aceptación:**
- [ ] Se muestra el total de usuarios, cantidad de estudiantes y cantidad de profesores en tarjetas de resumen.
- [ ] La lista muestra nombre, rol, documento, teléfono y clases (disponibles para estudiantes / dadas para profesores).
- [ ] En escritorio se muestra como tabla; en móvil como tarjetas.
- [ ] Si no hay usuarios se muestra un estado vacío claro.

---

### US-02 · Buscar y filtrar usuarios
**Como** administrador,  
**quiero** buscar un usuario por nombre o número de documento y filtrar por rol (Todos / Estudiante / Profesor),  
**para** encontrar rápidamente a una persona específica sin recorrer toda la lista.

**Criterios de aceptación:**
- [ ] El campo de búsqueda filtra en tiempo real por nombre completo o documento.
- [ ] Los botones de filtro (Todos / Estudiantes / Profesores) funcionan como selector exclusivo con animación deslizante.
- [ ] Al combinar búsqueda + filtro de rol, ambos aplican simultáneamente.
- [ ] Si el resultado está vacío se muestra mensaje de "No se encontraron usuarios".

---

### US-03 · Ver detalle de un usuario
**Como** administrador,  
**quiero** ver el perfil completo de un usuario al hacer clic sobre él,  
**para** consultar sus datos de contacto, información médica y estado de clases sin salir de la pantalla.

**Criterios de aceptación:**
- [ ] Al hacer clic en cualquier fila/tarjeta se abre un modal con el detalle.
- [ ] Para **estudiantes** muestra: documento, teléfono, EPS, contacto de emergencia, clases disponibles, clases recibidas, plan actual.
- [ ] Para **profesores** muestra: documento, teléfono, clases dadas.
- [ ] El modal se cierra al presionar la X o al hacer clic fuera de él.

---

## Módulo: Finanzas

### US-04 · Ver resumen financiero del mes
**Como** administrador,  
**quiero** ver el total de ingresos, egresos y balance del mes seleccionado,  
**para** saber de un vistazo si el negocio está en positivo o negativo ese mes.

**Criterios de aceptación:**
- [ ] Se muestran tres tarjetas: Ingresos (verde), Egresos (rojo) y Balance (verde si positivo, rojo si negativo).
- [ ] Los valores están formateados en pesos colombianos (COP).
- [ ] El mes activo se puede cambiar con flechas anterior / siguiente.
- [ ] El balance se recalcula automáticamente al cambiar de mes.

---

### US-05 · Ver tendencia de los últimos 6 meses
**Como** administrador,  
**quiero** ver una gráfica de barras comparando ingresos y egresos de los últimos 6 meses,  
**para** identificar tendencias y meses atípicos de un solo vistazo.

**Criterios de aceptación:**
- [ ] La gráfica muestra barras agrupadas (ingresos en amarillo / egresos en gris) por mes.
- [ ] La escala se ajusta automáticamente al valor máximo del periodo.
- [ ] Las etiquetas de mes son legibles (ej. "Ene", "Feb"…).

---

### US-06 · Ver movimientos del mes agrupados por fecha
**Como** administrador,  
**quiero** ver el listado de movimientos del mes organizados por día,  
**para** revisar el detalle cronológico de los ingresos y egresos.

**Criterios de aceptación:**
- [ ] Los movimientos se agrupan bajo la fecha en formato "lunes 2 de junio".
- [ ] Cada movimiento muestra: tipo (↑/↓), categoría con su color, descripción y monto.
- [ ] Si no hay movimientos en el mes se muestra un estado vacío con acceso rápido a registrar uno.

---

### US-07 · Registrar un movimiento financiero manual
**Como** administrador,  
**quiero** registrar un ingreso o egreso manualmente indicando monto, categoría, descripción y fecha,  
**para** llevar un control contable de gastos y cobros que no se generan automáticamente.

**Criterios de aceptación:**
- [ ] El formulario permite seleccionar tipo: Ingreso o Egreso.
- [ ] El selector de categoría muestra solo las categorías del tipo elegido.
- [ ] Los campos obligatorios son: monto, categoría y fecha.
- [ ] Al guardar, el movimiento aparece inmediatamente en el listado sin recargar la página.
- [ ] El monto acepta solo valores numéricos positivos.

---

### US-08 · Gestionar categorías de movimientos
**Como** administrador,  
**quiero** crear, editar o eliminar las categorías de ingresos y egresos,  
**para** adaptar la clasificación contable a la realidad del negocio durante la configuración inicial del sistema.

**Criterios de aceptación:**
- [ ] Se pueden ver todas las categorías separadas por tipo (ingreso / egreso).
- [ ] Se puede crear una nueva categoría indicando nombre, tipo y color identificador.
- [ ] Se puede editar el nombre o color de una categoría existente.
- [ ] Se puede eliminar una categoría (con confirmación).
- [ ] Si no hay categorías al iniciar, el sistema carga un conjunto por defecto (Planes, Matrículas, Eventos, Nómina, Servicios, Mantenimiento, Otros).

---

## Módulo: Aprobación de planes _(pendiente)_

### US-09 · Revisar y aprobar solicitudes de plan
**Como** administrador,  
**quiero** ver las solicitudes de plan enviadas por los estudiantes y aprobarlas o rechazarlas,  
**para** confirmar que el pago fue recibido antes de activar el plan.

**Criterios de aceptación:**
- [ ] Se lista cada solicitud con: nombre del estudiante, plan solicitado, fecha y estado (pendiente / aprobada / rechazada).
- [ ] Al aprobar una solicitud se activa el plan en el perfil del estudiante.
- [ ] Al aprobar una solicitud **se registra automáticamente un ingreso** en el módulo de Finanzas con el monto del plan y categoría "Planes".
- [ ] Se puede rechazar con motivo opcional.

---

## Módulo: Observatorio _(pendiente)_

### US-10 · Consultar métricas generales del negocio
**Como** administrador,  
**quiero** ver un panel de métricas clave del negocio (asistencia, retención, ingresos acumulados, etc.),  
**para** tomar decisiones informadas sobre el centro de entrenamiento.

**Criterios de aceptación:**
- [ ] _(Por definir junto al equipo — pendiente de especificación detallada del observatorio)_

---

## Transversales

### US-11 · Cambiar entre tema claro y oscuro
**Como** administrador,  
**quiero** alternar entre modo claro y oscuro en el panel,  
**para** trabajar cómodamente según las condiciones de luz del entorno.

**Criterios de aceptación:**
- [ ] El toggle está disponible en el sidebar (escritorio) y en el header (móvil).
- [ ] La preferencia se mantiene entre sesiones.
- [ ] La transición entre temas es animada y no produce parpadeos.

---

### US-12 · Cerrar sesión
**Como** administrador,  
**quiero** poder cerrar sesión desde el panel,  
**para** proteger el acceso al sistema cuando termine de trabajar.

**Criterios de aceptación:**
- [ ] El botón "Cerrar sesión" está visible en la parte inferior del sidebar.
- [ ] Al cerrar sesión se redirige a la pantalla de login.
- [ ] No es posible volver al panel sin autenticarse de nuevo.

---

_Documento generado: 2026-06-16_
