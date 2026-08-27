# User Stories — QA manual

**Propósito:** recorrer la app como usuarios reales (no solo leer código) para
encontrar bugs de UI/UX que el code review no atrapa. Cada historia se prueba
paso a paso en el navegador; las anotaciones y bugs encontrados quedan aquí.

**Cómo se usa:** al terminar de probar una historia, marcar su estado y anotar
lo encontrado. Si aparece un bug, anotarlo con suficiente detalle para poder
arreglarlo después (o el link al commit que lo arregló).

Estados: 🔲 Pendiente · 🔄 En progreso · ✅ Sin bugs · 🐛 Bugs encontrados (ver notas)

**Cobertura:** esta versión (2026-08-23) cubre TODO lo que hay en la app hoy —
los 5 tipos de plan, mensajería, plan virtual, racha, clases personalizadas,
PWA, y cada pantalla de los 3 roles. Si agregas una función nueva, agrégale
su historia acá antes de darla por terminada.

---

## Visitante (sin cuenta)

### V1 — Explora la landing
**Como** visitante, **quiero** navegar la página de inicio sin cuenta,
**para** entender qué ofrece el club antes de registrarme.

Pasos:
1. `/` → probar el nav de escritorio (Inicio/Info/Planes/Media) — el link
   activo debe resaltar según la sección visible al hacer scroll
2. En mobile, probar el dock flotante inferior (mismos 4 accesos)
3. Botones "Iniciar Sesión" y "Comenzar" (o "Mi Panel" si ya hay sesión) →
   deben llevar a `/login` o al home del rol correspondiente
4. Revisar la grilla de media (las imágenes son decorativas, sin acción) y
   la sección de testimonios

**Estado:** 🐛 Bugs encontrados (ver notas)

**Notas / bugs:**
-
Bug 1. = ✅ (CORREGIDO) En la parte de los planes en la pwa El logo de faors y la x de salida choca con la hora
Bug 2. = ✅ (CORREGIDO) Los botones de redes sociales, abajo del todo en la pwa, no llevan a ningun lado 

---


### V2 — Arma un plan como invitado y lo recupera al loguearse
**Como** visitante sin cuenta, **quiero** poder armar mi plan en el wizard
ANTES de registrarme, **para** no perder lo que ya elegí si tengo que crear
cuenta a mitad de camino.

Pasos:
1. Sin sesión iniciada, entrar directo a `/dashboard/planes`
2. Armar cualquier plan hasta el paso de resumen → "Solicitar"
3. Debe pedir crear cuenta o iniciar sesión (no debe perder la selección)
4. Registrarse/loguearse → verificar que el plan armado se restaura solo y
   salta directo al resumen (localStorage `faros-plan-pendiente` o similar)

**Estado:** Bugs encontrados (ver notas)

**Notas / bugs:**
-
Bug 1. = ✅ (CORREGIDO) La foto de perfil no deja centrarla, pone la foto tal cual, no deja tiene opción de edición basica, hacerle zoom, centrarla, rotarla.

Bug 2. = ✅ (CORREGIDO) Si es un plan personalizado, o de conjuntos, cuando me registro aparecen las sedes ya predeterminadas (todas), si es de conjunto la sede deberia ser los conjuntos que se tienen, o el de ellos donde se va adquirir el servicio. Lo mismo con el personalizado. Y el virtual. 

Bug 3. = ✅ (CORREGIDO) Me manda al dashbboard y me dice que no tengo plan, cuando lo solicito si se guarda. Pero seria bueno que arranque en la parte donde solicito el plan para luego pagar, no al dashboard.

Bug 4. = ✅ (CORREGIDO) En mi plan a la medida donde subo el comprobante no me dicen cuentas bancarias para hacer la tranferencia. crea un espacio para poner las cuentas y debajo del titulo (TU PLAN A LA MEDIDA) el valor para tener en cuental.
---

## Estudiante

### E1 — Alumno nuevo compra su primer plan
**Como** visitante sin cuenta, **quiero** registrarme, armar mi plan y subir mi
comprobante de pago, **para** quedar en revisión y que el club active mi plan.
 
Pasos:
1. Landing → "Comenzar" / "Inscríbete ahora" → `/registro`
2. Llenar formulario: nombres, apellidos, tipo/número de documento, teléfono,
   teléfono de emergencia, sede, EPS, dificultades médicas (opcional), correo,
   contraseña + confirmar — probar cada validación (campo vacío, email sin
   `@`, contraseña <6 caracteres, contraseñas que no coinciden)
3. Probar la foto de perfil opcional (subir, ver preview) — el registro no
   debe fallar si la foto falla al subir
4. Armar plan en el wizard (`/dashboard/planes`)
5. Confirmar solicitud → subir comprobante (imagen y PDF, y probar el límite
   de tamaño)
6. Verificar banner de "Pago en revisión" en `/dashboard`

**Estado:** 🐛 Bugs encontrados (probado por el usuario 2026-08-23)

**Notas / bugs:**
- **(Abierto, no crítico)** Al entrar a `/dashboard` la página no arranca
  arriba del todo (donde está el saludo) — carga desplazada a la mitad del
  contenido.
- **(Corregido)** Durante la prueba se descubrió que en el paso de elegir
  grupo/horario del wizard los cupos disponibles estaban hardcodeados — ya
  se corrigió y quedó conectado a los cupos reales.

---

### E2 — Login
**Como** usuario con cuenta, **quiero** iniciar sesión y llegar a donde
corresponde, **para** entrar directo a mi rol sin pasos extra.

Pasos:
1. `/login` con credenciales incorrectas → debe mostrar el error, no crashear
2. Login correcto sin `?next=` → debe ir al home de su rol (alumno→`/dashboard`,
   profesor→`/portal`, admin→`/admin`)
3. Entrar a una URL protegida sin sesión (ej. `/dashboard/planes`) → debe
   redirigir a `/login?next=/dashboard/planes` y, tras loguearse, volver ahí
4. Probar manualmente `?next=` con una URL externa (ej.
   `/login?next=https://evil.com`) → debe IGNORARSE ese destino (guard
   anti open-redirect) y mandar al home del rol
5. Con la app ya iniciada como PWA instalada y sesión activa, confirmar que
   `/` redirige solo al home del rol

**Estado:** ✅ Sin bugs

**Notas / bugs:**
-
Todo funciona a la perfección
---

### E3 — Alumno con plan activo se inscribe y cancela una clase
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

**Estado:** 🐛 Bugs encontrados (corregidos, pendiente re-probar)

**Notas / bugs:**
- El contador de sesiones restantes no bajaba al inscribirse (bug de cliente:
  `AuthContext` nunca refrescaba el perfil tras la acción — el backend sí
  descontaba bien). Fix: nueva `refreshUser()`, llamada tras inscribir/cancelar.
- Se podía ver e inscribirse a clases de OTRA sede (la query no filtraba por
  sede). Fix: filtro en cliente + validación server-side + índice nuevo.
- "Mis clases" quedaba al final de la página, después de toda la lista de
  disponibles — costaba confirmar que la inscripción funcionó. Fix: se
  reordenó, "Mis clases" va primero.
- (Encontrado de paso) "Clase del Día" en `/dashboard` era 100% mock. Fix:
  ahora busca la clase real de hoy y muestra el plan real subido por el
  profesor.
- (Idem) "Tu semana" siempre mostraba los 6 días en gris. Fix: se derivan de
  sus clases inscritas reales.
- Un error nativo del navegador (Safari/iOS, probablemente IndexedDB al
  refrescar el token) se mostraba crudo y en inglés en el banner de error al
  inscribir/cancelar. Fix: `postConToken()` traduce cualquier falla que no
  venga de la API a un mensaje en español.

Pendiente: volver a probar los 4 pasos originales con los fixes ya
desplegados (especialmente cancelar dentro de la ventana de 2h).

Segundo Intento de esta User Story:

- ✅ (CORREGIDO) Funciona bien todo, pero se tiene configuarado que se muestre solo la clase mas proxima y las demas mas agrupadas, pero en ningun texto aparece eso. Tiene el titulo de mis clases y solo aparece esa y mas abajo las otras agrupadas por grupo. Quiero que tenga sus respectivos titulos para que sea claro, "Proxima clase", demas clases.

- ✅ (CORREGIDO) No me gusta que el boton sea "asistencia" ya que es mas que eso, desde ahi se maneja todo lo de clases, el boton deberia decir clases y asi 


---

### E4 — Wizard: Plan Grupal
**Como** alumno, **quiero** armar un plan Grupal, **para** entrenar en grupo
en una sede fija.

Pasos:
1. `/dashboard/planes` → elegir "Grupal UTP"
2. Elegir un grupo (verificar que muestra cupos disponibles REALES, no la
   capacidad total fija — y que bloquea si está lleno)
3. Elegir frecuencia (1x/2x/3x semana) → el precio debe recalcularse en vivo
4. Confirmar resumen y precio final antes de solicitar

**Estado:** ✅ Sin bugs 

**Notas / bugs:**
-
Todo funciona a la perfección.

---

### E5 — Wizard: Plan Personalizado (armar + agendar franja con profesor)
**Como** alumno, **quiero** armar un plan Personalizado — eligiendo modalidad,
combinación (disciplina) y frecuencia — y luego agendar mi horario con un
profesor específico, **para** entrenar 1-a-1 (o en pareja, familia, grupo
reducido) la disciplina que quiera, a mi medida.

Pasos, wizard:
1. Elegir "Personalizado" → elegir modalidad (Individual/Pareja/Familia/Grupo
   reducido)
2. Si la modalidad es Pareja/Familia/Grupo reducido, aparece el paso
   "¿Adquirir el plan o unirte a uno?" (ver E5.2) — "Adquirir plan" sigue el
   flujo normal; Individual no pasa por este paso
3. Elegir combinación (Natación / Ejercicio funcional / Rumbaterapia /
   Natación + Acuagym) — antes "Conjuntos" era un tipo de plan aparte, ahora
   es este paso dentro de Personalizado, cruzado con la modalidad. Probar
   una combinación sin precio cargado para esa modalidad (ej. recién
   fusionado, "Rumbaterapia + Pareja") → debe mostrar "Por confirmar", no
   romper el wizard ni dejar solicitar con un precio inventado
4. Elegir frecuencia (1x/2x/3x — ya no hay tope de 2x para las combinaciones
   que antes eran Conjuntos) → precio recalculado (por persona si aplica),
   si la modalidad es por persona probar el contador de personas (mín/máx)

Pasos, agendar franja (una vez el plan está activo, en
`SolicitudPersonalizada` dentro de `/dashboard/asistencia`):
5. Elegir un profesor (solo deben aparecer los que tienen al menos N días
   distintos declarados, N = la frecuencia semanal elegida en el paso 4 — ej.
   con plan 3x/semana, un profesor con disponibilidad en solo 2 días no debe
   aparecer)
6. Con plan 2x o 3x/semana, la pantalla debe pedir esa cantidad de filas
   "Día + Hora", una por sesión, sin dejar repetir el mismo día en dos filas
7. Elegir día y horario dentro de la disponibilidad de ese profesor, en
   cada fila
8. "Solicitar estos horarios" (o "este horario" si el plan es 1x/semana) →
   debe quedar en estado "Esperando respuesta del profesor" listando TODAS
   las franjas pedidas, con botón "Cancelar solicitud"
9. Probar pedir horarios a un segundo profesor mientras el primero sigue
   pendiente → debe rechazarlo (409)
10. Cancelar la solicitud pendiente → debe volver a poder pedir otra
11. Cuando el profesor acepta, verificar que se generen automáticamente las
    clases recurrentes del mes para CADA una de las N franjas (ej. plan
   3x/semana → 3 clases/semana, no 1) y aparezca el mensaje de horario fijo
   asignado con las N franjas listadas.

**Estado:** 🔲 Pendiente

**Notas / bugs:**
- **(Corregido)** Reportado por el usuario 2026-08-26: sin importar la
  frecuencia semanal elegida al comprar (1x/2x/3x), el flujo de agendar solo
  dejaba pedir UNA franja y por lo tanto solo se generaba 1 clase/semana.
  Fix: `SolicitudPersonalizada` ahora guarda un array `franjas` (antes un
  único `dow/horaInicio/horaFin`) y la UI pide tantas filas día+hora como
  indique `suscripcionActiva.week`.

---`

### E5.1 — Alumno cancela una sesión puntual de clase personalizada
**Como** alumno con plan personalizado y horario semanal fijo acordado,
**quiero** poder cancelar una clase específica (ej. un viernes puntual) con
más de 2 horas de anticipación, **para** liberar al profesor ese día y
recuperar mi sesión sin perder las clases de las siguientes semanas.

Pasos:
1. Con un horario personalizado activo y clases generadas (ej. 4 viernes del mes),
   entrar a `/dashboard/asistencia` (sección Mis clases)
2. Cancelar la inscripci ón de UNA sola sesión (con > 2h de anticipación)
3. Verificar que el contador de sesiones restantes del alumno aumenta en +1
4. Verificar que SOLO esa sesión se retira de "Mis clases", y que las sesiones
   de los viernes de las semanas siguientes permanecen intactas y programadas
5. Verificar que el banner de horario fijo acordado se mantiene visible (la franja
   semanal no se altera por cancelar una fecha puntual)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E5.2 — Plan Personalizado grupal: código para invitar y ver a tu grupo
**Como** alumno que compra un plan Pareja/Familia/Grupo reducido, **quiero**
recibir un código para invitar al resto de mi grupo y ver quién ya se unió,
**para** que no sea yo el único inscrito aunque pagué por varias personas.

Pasos:
1. Comprar un plan Pareja (2 personas) o Familia/Grupo reducido (elegir de 3
   a 5 en el contador) con "Adquirir plan" → esperar aprobación del admin
2. Con el plan ya activo, entrar a `/dashboard/planes` → debe aparecer la
   tarjeta "Tu grupo" con un código de 6 caracteres y botón de copiar
3. Con otra cuenta de alumno SIN plan activo, ir al wizard → elegir la misma
   modalidad → "Ya tengo un código — unirme a un plan" → pegar el código →
   debe quedar con plan activo de inmediato, sin pasar por admin ni subir
   comprobante (es gratis, ya está pagado por el jefe)
4. Verificar en ambas cuentas que la tarjeta "Tu grupo" lista a los dos (el
   jefe con badge "Jefe")
5. Probar unirse con un código ya lleno (ej. Pareja con 2/2) → debe
   rechazarlo (409 "Este grupo ya está lleno")
6. Probar unirse con un código inventado → debe rechazarlo (404 "Código
   inválido")
7. Probar unirse con una cuenta que ya tiene un plan activo propio → debe
   rechazarlo (409 "Ya tienes un plan activo")
8. El jefe agenda su horario (ver E5) → una vez el profesor acepta, verificar
   que TODOS los miembros del grupo (no solo el jefe) queden con "Tus clases
   ya aparecen en Mis clases arriba"

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E6 — Wizard: Plan Conjunto (grupo con horario fijo por sede)
**Como** alumno, **quiero** armar un plan Conjunto eligiendo un grupo con
horario fijo en una sede, **para** combinar natación con otra disciplina en
un ambiente grupal — igual que Grupal, pero con una combinación adicional.

Nota (2026-08-26): además de este flujo, las mismas 3 combinaciones
(Natación+Acuagym, Ejercicio funcional, Rumbaterapia) también están
disponibles dentro de Personalizado como el paso "combinación" (ver E5,
pasos 3-4) para quien las quiera 1-a-1 o en grupo cerrado con horario
libre, en vez de en un grupo fijo por sede. Ambos flujos coexisten.

Pasos:
1. Elegir "Conjuntos" → debe listar SOLO grupos de categoría Conjunto (ej.
   "Tulcán II · Natación + Acuagym") — los grupos de natación Grupal
   (Knowill, Estrellas) NO deben aparecer acá, y viceversa (probar
   "Grupal" y confirmar que Tulcán II tampoco aparece ahí)
2. Cada grupo debe mostrar sede, horarios fijos, combinación, nivel,
   coach y cupos disponibles — igual que el paso de Grupal
3. Elegir frecuencia (1x/2x/3x, sin tope — a diferencia del viejo Conjuntos
   que topaba en 2x) → precio por sesión en vivo según `conjuntoPorSesion`
4. Un grupo lleno debe aparecer deshabilitado ("Grupo lleno"), igual que
   en Grupal

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E7 — Wizard: Vacaciones deportivas (Adquirir o Unirse, como los planes grupales)
**Como** padre/alumno, **quiero** inscribir niños al programa de vacaciones
— comprando yo o uniéndome gratis con el código de otro padre —, **para**
que varias familias puedan compartir un mismo cupo grupal, igual que
Pareja/Familia/Grupo reducido en Personalizado.

Pasos, Adquirir:
1. Elegir "Vacaciones deportivas" → aparece el paso "¿Adquirir el plan o
   unirte a uno?" (siempre, no solo si hay más de 1 niño) → "Adquirir plan"
2. Probar el contador de niños (1 a 10) → precio = tarifa × niños, en vivo
3. Confirmar que el resumen dice "Programa de 2 semanas", no una frecuencia
   semanal (no aplica acá)
4. Al aprobar el pago (admin), el comprador debe ver la tarjeta "Tu grupo"
   con un código de 6 caracteres — el badge de cupos debe decir
   "N / total niños", no personas

Pasos, Unirse (otra cuenta, sin plan activo):
5. Wizard → "Vacaciones deportivas" → "Unirme a Plan" → pegar el código →
   debe pedir un contador aparte "¿Cuántos de tus niños vas a inscribir?"
   (1 a 10) ANTES del botón "Entrar con código" — a diferencia de
   Personalizado, acá sí hace falta este dato porque un miembro puede
   aportar más de un niño
6. Unirse con más niños de los que quedan de cupo (ej. grupo con 1 cupo
   libre, pedir 2) → debe rechazarlo con el mensaje de cupos restantes,
   no un genérico "grupo lleno"
7. Verificar que la tarjeta "Tu grupo" lista a cada miembro con su cantidad
   de niños (ej. "María González · 2 niños"), y que el total del badge
   suma los niños de todos, no la cantidad de miembros
8. Unirse con una cuenta que ya tiene un plan activo propio → debe
   rechazarlo (409 "Ya tienes un plan activo"), igual que en Personalizado

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E8 — Wizard: Plan Virtual (nuevo)
**Como** alumno, **quiero** armar un plan Virtual eligiendo mi entrenador,
**para** tener una rutina remota sin ir a una sede.

Pasos:
1. Elegir "Virtual" → NO debe pedir sede, grupo ni frecuencia
2. Elegir un entrenador de la lista (debe listar profesores reales)
3. Confirmar que el precio es fijo mensual y dice "Acceso ilimitado mientras
   esté activo" (no una cantidad de sesiones)
4. Solicitar → admin aprueba en `/admin/finanzas` (ver A1)
5. Verificar que apenas se aprueba, el alumno ya tiene su rutina creada (aún
   sin sesiones) — chequear como el profesor asignado en `/portal/virtual`

**Estado:** 🔲 Pendiente

**Notas / bugs:**
- Feature construida esta sesión, nunca probada con cuentas reales — ver
  PLAN_DE_CIERRE.md 6.18.

---

### E9 — Plan Virtual: ver rutina y completar sesiones
**Como** alumno con Plan Virtual activo, **quiero** ver mi rutina y marcar
las sesiones que ya hice, **para** llevar mi propio progreso.

Pasos (requiere que un profesor ya haya agregado sesiones — ver P6):
1. `/dashboard/virtual` → si no hay rutina asignada, debe mostrar el estado
   vacío correspondiente, no un error
2. Con sesiones cargadas: cada una debe mostrar el video (si el link es de
   YouTube/Vimeo, embebido directo en la página; si no lo reconoce, un link
   "Ver video" en vez de romper)
3. Marcar una sesión como completada → la barra de progreso y el contador
   ("X de Y completadas") deben actualizarse al toque
4. Desmarcarla → debe volver atrás sin problema
5. Confirmar que el alumno NO puede editar título/descripción/video de una
   sesión (solo el check de completada existe en su vista)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E10 — Dashboard general del alumno
**Como** alumno, **quiero** ver mi estado de suscripción, mi racha, mi
asistencia y mi ranking, **para** hacer seguimiento a mi progreso.

Pasos:
1. `/dashboard` → revisar banner de estado del plan (activo/vencido/pendiente)
2. Revisar la Racha (el faro animado junto a "Hola, {nombre}") — debe verse
   apagado (gris, sin glow) en 0, y encendido con glow + haz girando cuando
   hay racha activa
3. Revisar el gráfico "Asistencia semanal" — debe mostrar datos reales de las
   últimas 6 semanas, no un patrón fijo
4. Revisar "Tu semana" (Semanario) — debe marcar los días reales en los que
   el alumno tiene clase
5. Revisar la tarjeta "Mensajes" (vista previa) → botón "Ver mensajes" lleva
   a `/dashboard/mensajes`
6. `/dashboard/planes` con plan activo → debe mostrar resumen, no el wizard

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E11 — Mensajería del alumno (muro grupal + privado)
**Como** alumno, **quiero** comentar en el muro de mi grupo y escribirle en
privado a mi profesor, **para** comunicarme sin depender de otro canal.

Pasos:
1. `/dashboard/mensajes` → confirmar que aparece una tab de "Muro" por cada
   grupo en el que está inscrito, y una tab de DM por cada profesor distinto
   con el que tiene clases
2. Enviar un mensaje al muro grupal → debe verse en tiempo real desde otra
   sesión (ej. el profesor en `/portal`)
3. Enviar un DM al profesor → debe verse solo entre esos dos
4. Cambiar de una conversación a otra → NO debe seguir mostrando los
   mensajes de la conversación anterior mientras carga la nueva
5. En mobile, confirmar que la lista y el chat se turnan la pantalla completa
   (con botón de volver), no un bloque chico
6. Abrir el teclado para escribir → no debe hacer zoom raro ni cortar el chat
   (probar específicamente en iPhone/Safari)
7. Confirmar que las burbujas de mensaje muestran la foto de perfil real (si
   el usuario tiene una), no solo iniciales

**Estado:** 🔲 Pendiente

**Notas / bugs:**
- Ya probado y corregido en sesión de desarrollo (permisos de grupo, chat
  cortado por teclado, fotos, conversación vieja al cambiar de chat) — esta
  pasada es para confirmar que sigue sin regresiones.

---

### E12 — Ranking
**Como** alumno, **quiero** ver mi posición frente a mis compañeros de sede,
**para** motivarme.

Pasos:
1. `/dashboard/ranking` → revisar podio (top 3), tarjeta "Tu posición", tabla
   completa
2. Probar el toggle "General" / "Mensual"

**Estado:** 🔲 Pendiente

**Notas / bugs:**
- ⚠️ Revisar en código: el toggle "Mensual" no parece cambiar realmente la
  consulta de datos (queda igual que "General") — confirmar en pantalla si
  es un bug real o si ya se resolvió.

---

### E13 — Perfil del alumno
**Como** alumno, **quiero** ver mis datos, cambiar mi foto y mandar una
sugerencia, **para** mantener mi cuenta al día y dar feedback.

Pasos:
1. `/dashboard/perfil` → cambiar la foto de perfil (debe comprimirse y
   reflejarse en el header/avatar en todos lados)
2. Revisar que los datos (cédula, celular, correo, sede, nivel, emergencia)
   se ven correctos y son de solo lectura
3. Escribir y enviar una sugerencia → botón debe deshabilitarse y mostrar
   "Enviada ✓" un momento
4. "Cerrar sesión" → debe volver a `/login`

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### E14 — Instalar la PWA
**Como** alumno, **quiero** instalar la app en mi teléfono, **para** usarla
como una app nativa.

Pasos:
1. En Android/Chrome: esperar el banner de instalación (~4s), probar
   "Instalar" y también la "X" de descartar (no debe volver a aparecer por
   14 días)
2. En iPhone/Safari: debe mostrar instrucciones manuales ("Toca compartir →
   Agregar a inicio"), no el prompt nativo (no existe en iOS)
3. Con la app ya instalada, abrirla — no debe mostrar el banner de nuevo
4. Desconectar internet y navegar → debe mostrar la pantalla "Sin conexión"
   en vez de un error genérico del navegador, con botón "Reintentar"

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
6. Probar el muro de mensajes y el chat privado con un alumno DENTRO de la
   tarjeta de la clase — ya es real (Firestore, tiempo real), no demo local

**Estado:** 🔲 Pendiente

**Notas / bugs:**
- (Corrección al texto original de esta historia) La mensajería dejó de ser
  "demo local" — ahora es real con `onSnapshot`. Revisar paso 6 con eso en
  mente.

---

### P2 — Profesor revisa Mis Clases y Estudiantes
**Como** profesor, **quiero** ver la vista alterna de mis clases y la lista de
mis alumnos, **para** tener otra forma de revisar mi carga.

Pasos:
1. `/portal/clases` → verificar que las clases y el estado coinciden con `/portal`
2. Abrir la tab de Asistencia de una clase → los nombres y fotos de los
   alumnos deben verse reales (no un uid crudo sin foto)
3. `/portal/alumnos` → verificar que solo aparecen alumnos inscritos en sus
   clases (no todos los del club); probar el buscador y los filtros
   (Todos/Activos/Vencidos/Sin plan)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### P3 — Mensajería dedicada del profesor
**Como** profesor, **quiero** un lugar centralizado para ver todos mis chats,
**para** no tener que entrar clase por clase a buscar un mensaje.

Pasos:
1. `/portal/mensajes` → confirmar que lista TODOS los grupos que dicta (no
   solo el de la clase seleccionada en el calendario) + un DM por cada
   alumno distinto entre todas sus clases
2. Enviar un mensaje al muro de un grupo y un DM → deben coincidir con lo que
   ve el alumno del otro lado (ver E11)
3. Confirmar que la lista muestra el último mensaje real + hora de cada
   conversación, no un subtítulo genérico

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### P4 — Profesor gestiona disponibilidad y solicitudes de clase personalizada
**Como** profesor, **quiero** declarar mis horarios disponibles y aceptar o
rechazar solicitudes de alumnos, **para** organizar mis clases 1-a-1.

Pasos:
1. `/portal/perfil` → agregar una franja de disponibilidad (día + desde/hasta)
2. Probar validaciones: hora de inicio después de la de fin (debe
   rechazarlo), franja que se solapa con una ya agregada (debe rechazarlo)
3. Quitar una franja → "Guardar disponibilidad"
4. Con una solicitud pendiente de un alumno con plan 2x o 3x/semana (ver E5):
   la bandeja debe listar TODAS las franjas pedidas, no solo una
5. Aceptarla → debe generar las clases recurrentes reales de CADA franja
   hasta el vencimiento del plan del alumno, y chocar si ya hay una clase en
   cualquiera de esos horarios
6. Rechazar otra solicitud sin escribir motivo → debe bloquearlo (400); con
   motivo, debe guardarlo y notificar el rechazo

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### P4.1 — Profesor visualiza cancelación puntual de clase personalizada
**Como** profesor, **quiero** ver en mi calendario diario de `/portal` cuándo
una sesión personalizada quedó sin alumnos (0 alumnos) porque el estudiante
canceló puntualmente esa fecha, **para** saber con anticipación que no debo
desplazarme ese día sin que se afecte el resto del mes.

Pasos:
1. Con una clase personalizada recurrente activa (ej. generada en P4/E5), hacer
   que el alumno cancele solo la sesión de hoy o de esta semana (ver E5.1)
2. Entrar a `/portal` con la cuenta de profesor y seleccionar la fecha cancelada
3. Verificar que la tarjeta de la clase en ese día indica claramente "0 alumnos"
   (o estado sin inscritos)
4. Navegar en el calendario a la semana siguiente y confirmar que la clase
   personalizada de ese día sigue programada y con el alumno inscrito normalmente

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### P4.2 — Profesor pasa lista a todo el grupo de un plan personalizado compartido
**Como** profesor, **quiero** ver a TODOS los integrantes de un grupo
Pareja/Familia/Grupo reducido en la clase generada, **para** llamar a lista
completa y no solo a quien compró el plan.

Pasos:
1. Con un grupo de al menos 2 personas ya unidas (ver E5.2) y el jefe con
   horario ya aceptado (ver P4)
2. Entrar a `/portal/clases`, abrir esa clase personalizada → pestaña
   "Asistencia"
3. Verificar que aparecen TODOS los miembros del grupo, no solo el jefe que
   agendó el horario
4. Marcar asistencia de cada uno por separado → debe guardarse
   individualmente
5. Que se una una persona nueva al grupo DESPUÉS de que el horario ya estaba
   aceptado (con clases futuras ya generadas) → verificar que aparece en las
   próximas clases (no en las que ya pasaron)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### P5 — Profesor gestiona el Plan Virtual de sus alumnos
**Como** profesor, **quiero** armar y editar la rutina virtual de cada uno de
mis alumnos, **para** que tengan contenido para entrenar remoto.

Pasos:
1. `/portal/virtual` → confirmar que solo aparecen SUS alumnos asignados
   (no los de otros profesores)
2. Abrir un alumno → agregar una sesión (título, descripción, link de
   YouTube o Vimeo) → confirmar que se guarda y aparece en la lista
3. Editar una sesión existente (cambiar título/descripción/link)
4. Borrar una sesión → debe pedir confirmación
5. Pegar un link que NO sea de YouTube/Vimeo → debe avisar que no lo
   reconoce (pero igual guardarlo como link plano, sin romper nada)
6. Confirmar que el profesor NO puede marcar una sesión como completada por
   el alumno (ese control no debe existir de este lado)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
- Feature construida esta sesión, nunca probada con cuentas reales — ver
  PLAN_DE_CIERRE.md 6.18.

---

### P6 — Perfil del profesor
**Como** profesor, **quiero** ver mis datos y cambiar mi foto, **para**
mantener mi cuenta al día.

Pasos:
1. `/portal/perfil` → cambiar foto de perfil
2. Revisar "Acumulado del mes" (clases dictadas)
3. "Cerrar sesión"

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
4. Aprobar específicamente una solicitud de Plan Virtual → confirmar que se
   crea la rutina automáticamente y el profesor elegido ya la ve en
   `/portal/virtual` (ver E8/P5)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### A2 — Dashboard admin
**Como** admin, **quiero** ver el estado general del negocio y accesos
rápidos, **para** tener una vista de control.

Pasos:
1. `/admin` → revisar las 4 KPIs (ingresos/egresos del mes, atletas activos,
   pagos pendientes) y el gráfico de ingresos de los últimos 6 meses
2. Revisar la cola de "Pagos pendientes" → "Ver todas en Finanzas"
3. Probar los 4 accesos rápidos (Usuarios/Finanzas/Planes/Clases)
4. Probar los 3 botones de siembra (con confirmación cada uno):
   - "Sembrar catálogo" → repuebla sedes/grupos/tarifas
   - "Crear clases" → pide un correo de profesor, genera 4 semanas de clases
   - "Reparar canales de mensajes" → agrega miembros faltantes a los muros
     de grupo (solo agrega, nunca quita)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### A3 — Vista detallada del usuario en el directorio
**Como** admin, **quiero** poder ver la información detallada de los estudiantes y profesores directamente desde el directorio de usuarios, **para** no tener que navegar entre diferentes vistas y gestionar rápidamente sus accesos y conocer su estado.

Pasos:
1. `/admin/usuarios` → revisar la tabla y constatar que aparece la columna de "Plan Activo".
2. Tocar sobre una fila de usuario → debe abrirse un modal centrado con la ficha completa del usuario.
3. Verificar que el modal muestra la información correcta de identidad, plan actual, estadísticas de asistencia y nivel/dificultades.
4. Interactuar con el botón del modal para suspender o reactivar al usuario y ver que el cambio se aplica correctamente y se cierra el modal.

**Estado:** ✅ Implementado y probado

**Notas / bugs:**
- 

---

### A3 — Admin gestiona catálogo: Sedes y Grupos
**Como** admin, **quiero** crear/editar sedes y grupos, **para** mantener la
oferta física al día.

Pasos:
1. `/admin/planes` → tab Sedes: crear una sede, editarla, marcarla
   inactiva/activa
2. Tab Grupos: crear un grupo asociado a una sede, con horarios; editarlo
3. Elegir categoría "Conjunto" al crear/editar un grupo → debe aparecer el
   select de Combinación (obligatorio, sin él no deja guardar) — probar
   categoría "Grupal" y confirmar que el select de Combinación desaparece
4. Confirmar que la fila del grupo en la lista muestra el badge de
   categoría (Grupal/Conjunto) y, si es Conjunto, el nombre de la
   combinación
5. Probar "Diagnóstico Firestore" (botón arriba a la derecha) → debe hacer un
   ciclo de escritura+lectura+borrado y mostrar éxito o el error real

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### A4 — Admin gestiona Tarifas (los 5 tipos de plan)
**Como** admin, **quiero** ajustar los precios de cada tipo de plan,
**para** mantener el catálogo de precios al día.

Pasos:
1. Tab Tarifas → editar el precio de Grupal (por sesión, las 3 frecuencias)
2. Editar el precio de Conjuntos (por sesión, las 3 frecuencias) — mismo
   layout que Grupal, campo `conjuntoPorSesion` independiente. Confirmar
   que un doc de Tarifas de antes de este cambio (sin este campo) no rompe
   la pantalla — debe rellenarse solo con un valor por defecto
3. Sección Personales: agrupada por combinación (Natación / Ejercicio
   funcional / Rumbaterapia / Natación+Acuagym), con una fila por modalidad
   (individual/pareja/familia/reducido) dentro de cada una — 16 filas en
   total. Confirmar que al abrir el tab por primera vez tras el cambio que
   fusionó Conjuntos en Personalizado aparecen las 12 filas nuevas sin que
   se haya perdido ningún precio ya cargado
4. Dejar alguna combinación×modalidad nueva en blanco = "por confirmar" y
   verificar que el wizard lo respeta (ver E5, paso 3)
5. Editar precio de Vacaciones (por niño)
6. Editar precio de Virtual (mensual fijo)
7. "Guardar cambios" → volver al wizard del alumno y confirmar que el precio
   nuevo se refleja ahí, tanto en Personalizado/Grupal/Vacaciones/Virtual
   como en Conjuntos (ver E6)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

### A5 — Admin gestiona el Plan Virtual de cualquier alumno
**Como** admin, **quiero** poder gestionar la rutina virtual de cualquier
alumno (no solo las de mis propios alumnos, porque el admin no tiene
alumnos propios), **para** cubrir a un profesor si hace falta.

Pasos:
1. `/admin/planes` → tab Virtual → confirmar que aparecen las rutinas de
   TODOS los alumnos, de cualquier profesor asignado
2. Agregar/editar/borrar una sesión de un alumno que NO es del profesor con
   el que estás logueado (o sea, probando como admin) → debe funcionar igual
   que en `/portal/virtual` (mismo componente)

**Estado:** 🔲 Pendiente

**Notas / bugs:**
- Feature construida esta sesión, nunca probada con cuentas reales — ver
  PLAN_DE_CIERRE.md 6.18.

---

### A6 — Admin gestiona Plantillas
**Como** admin, **quiero** crear planes ad-hoc con nombre propio, **para**
casos especiales (promos, descuentos) que no encajan en los 5 tipos
estándar.

Pasos:
1. Tab Plantillas → crear una plantilla (nombre, sesiones, precio, duración,
   sede)
2. Editarla, archivarla

**Estado:** ✅ Implementado y probado

**Notas / bugs:**
- (Resuelto) El usuario solicitó explícitamente habilitar las plantillas en el wizard para los alumnos (opción "Especiales"). La funcionalidad se integró con éxito.

---

### A7 — Admin gestiona usuarios
**Como** admin, **quiero** cambiar el rol de un usuario y suspender cuentas,
**para** mantener el equipo y la membresía al día.

Pasos:
1. `/admin/usuarios` → buscar por nombre/cédula/email, probar los filtros
   (Todos/Estudiantes/Profesores)
2. Cambiar el rol de un estudiante a profesor (con el diálogo de
   confirmación) → verificar que afecta a la cuenta CORRECTA (bug crítico ya
   corregido, ver PLAN_DE_CIERRE 6.6 — re-probar igual)
3. Suspender una cuenta → esa persona no debe poder usar la app (ver
   `CuentaSuspendida`); reactivarla
4. Confirmar que NO hay ningún control de rol/suspensión sobre una cuenta de
   admin (ni la propia ni otra) — no deben aparecer botones ahí

**Estado:** 🔲 Pendiente

**Notas / bugs:**
-

---

## Resumen de bugs encontrados (se llena al final)

| # | Historia | Bug | Severidad | Estado |
|---|---|---|---|---|
| 1 | E3 | Contador de sesiones no baja al inscribirse (cliente no refresca perfil) | Alta | ✅ Corregido (`ce9c8a8`) |
| 2 | E3 | Se puede inscribir a clases de otra sede | Media | ✅ Corregido (`ce9c8a8`) |
| 3 | E3 | "Mis clases" al final de la página, difícil confirmar inscripción | Baja | ✅ Corregido (`ce9c8a8`) |
| 4 | E3 | "Clase del Día" en dashboard 100% hardcodeada | Alta | ✅ Corregido (`ce9c8a8`) |
| 5 | E3 | "Tu semana" siempre en gris, sin días reales | Media | ✅ Corregido (`ce9c8a8`) |
| 6 | E3 | Error nativo del navegador (en inglés) se mostraba crudo al inscribir/cancelar | Media | ✅ Corregido |
| 7 | E11 | Mensajería grupal no dejaba enviar (alumnos pre-existentes sin backfill) | Alta | ✅ Corregido |
| 8 | E11 | Cancelar clase fallaba si el canal de mensajes del grupo no existía aún | Media | ✅ Corregido |
| 9 | E11 | Conversación anterior seguía visible al cambiar de chat | Media | ✅ Corregido |
| 10 | E11/E14 | Zoom raro de iOS al enfocar inputs del chat | Media | ✅ Corregido |
| 11 | E11/E14 | Chat cortado por el teclado en iOS (modo PWA) | Alta | ✅ Corregido |
| 12 | E11 | Fotos de perfil no se veían en las burbujas de mensaje | Baja | ✅ Corregido |
| 13 | P2 | `/portal/clases` mostraba uid crudo sin nombre/foto en asistencia | Media | ✅ Corregido |
| 14 | E12 | Toggle "Mensual" del ranking no cambia la consulta de datos | Baja | 🔲 Por confirmar en pantalla |
