*Note for the team: this translation was written by an AI. A Spanish speaker should read it before it is sent to the farm.*

*Nota para el equipo: esta traducción fue escrita por una IA. Una persona que hable español debe leerla antes de enviarla a la granja.*

# Qué hacer y cuándo

*Para la granja. Escrito el 3 de octubre de 2026 para los archivos de esta carpeta. Va del 3 de octubre de 2026 al 31 de diciembre de 2027 (y la primera mañana de 2028). Se queda en su computadora: está en `docs/`, que no se sube. Versión en inglés: [OWNER_YEAR_CALENDAR.md](OWNER_YEAR_CALENDAR.md).*

El sitio sigue el calendario por sí solo de muchas maneras: la temporada, las insignias "Open now", el año del pie de página y cada línea que tiene un último día. No puede saber el clima, un día festivo, un precio nuevo ni el menú del año que viene. Eso les toca a ustedes. Esta página enumera, fecha por fecha, **lo que el sitio hace por sí solo**, **lo que ustedes hacen antes de esa fecha**, **dónde** y **lo que ve un visitante si se olvidan**. (Lo que ve un visitante cada día está en [WHAT_VISITORS_SEE_WHEN.md](WHAT_VISITORS_SEE_WHEN.md), que está en inglés; esta página es la lista de tareas que lo acompaña.)

**Cómo leerla**

- Todas las fechas son del día de la granja (hora del Este). "A más tardar" es el último día seguro: hagan la tarea ese día o antes.
- "Dónde" es un archivo y unas palabras para buscar (Ctrl+F). `index.html` en `data-t="t58da3033"` significa: abran `index.html` y busquen esas palabras. Las filas y las secciones del README se nombran entre comillas. Las palabras del sitio entre comillas, como "Open now", están en inglés, tal como aparecen en los archivos.
- Después de cada cambio, publiquen y luego abran el sitio en vivo con `?check` al final de la dirección. Para publicar, ejecuten `python3 tools/make_deploy_folder.py` y suban lo que hay dentro de `deploy/` (`docs/LAUNCH_CHECKLIST.md`, sección "2. What to upload, and what to leave out"). En Windows escriban `python` en lugar de `python3`.
- Las palabras que siguen a "Dónde" describen los archivos como están hoy. Un ajuste que ya usaron se ve distinto después (`closures: [],` pasa a ser `closures: ['2026-10-04'],`). Entonces busquen su nombre y dos puntos (`closures:`, `notice:`, `noticeUntil:`, `week:`) y usen la línea que empieza con dos espacios, cerca del final de `js/content.js`. Las mismas palabras también están en las notas explicativas al principio de ese archivo. Son comentarios, no la línea que hay que cambiar. La oración que está debajo de la tabla de pizza recibe un código `data-t` nuevo la primera vez que publican un cambio, así que busquen sus palabras: `<strong>Open now:</strong> pizza reservations for`.
- Una oración en inglés nueva o cambiada necesita sus cuatro traducciones (español, hindi, chino, vietnamita) antes de que el comando de publicar funcione. Hasta entonces se detiene con "Translations missing", una línea por idioma, y no escribe nada en `deploy/`. Envíen las palabras nuevas a Claude el mismo día (README, sección "Change one sentence and its translations, step by step"; `python3 tools/i18n.py missing es --list` muestra lo que falta). Claude también puede publicar primero y agregar las traducciones después: hasta entonces los otros cuatro idiomas muestran esa línea en inglés. **Los fines de semana de pizza son la excepción.** Las fechas de una fila de pizza, y la oración "Open now" que está debajo de la tabla con la forma que muestra la fila "Open a new pizza weekend" del README, las traduce el propio comando de publicar. No hay nada que enviar. Las otras palabras de esa oración sí necesitan traducción.
- La barra delgada de arriba de la página ("In season: ...", "Next up: ...") se muestra solo en computadoras. Los teléfonos no la muestran.
- "Pregunta d23" es una pregunta de su panel que todavía espera su respuesta. El sitio no la decide, y esta página tampoco.
- Una prueba mantiene esta página al día: sus fechas, sus días de la semana y las líneas que se ocultan solas se comparan con los archivos (la última sección explica cómo).

Contenido: 1. Cada lunes · 2. El primer día de cada mes · 3. El calendario, de octubre a diciembre de 2026 · 4. El calendario de 2027 · 5. Cualquier día: cerrar por lluvia y otras sorpresas · 6. Líneas que nunca se apagan solas · 7. Una vez al año · 8. Preguntas que esperan una fecha · 9. Las fechas que usa el sitio (comprobadas por la prueba)

## 1. Cada lunes: 10 minutos

En temporada (de mediados de septiembre a principios de noviembre, las semanas de los árboles, de mediados de abril a principios de julio), todos los lunes. El resto del año basta con un lunes sí y uno no.

1. **Miren el sitio en vivo en su teléfono.** Las insignias "Open now" deben coincidir con la realidad, y la cuenta regresiva de la pizza debe nombrar el martes correcto.
2. **Agreguen `?check` a la dirección** (`https://www.wiseacresorganic.com/?check`). Si no aparece ningún cuadro al final, no hay nada mal. Un cuadro **amarillo** indica qué arreglar y dónde. Un cuadro **verde** enumera líneas viejas con fecha que ya se ocultaron solas: bórrenlas cuando quieran (README, sección "Check your changes").
3. **Actualicen "This week at the farm"** (`week` en `js/content.js`): cambien `updated` a la fecha de hoy y las palabras y los cupos que cambiaron. Todo lo que contiene dura 14 días después de `updated` y desaparece desde el día 15, y el cuadro amarillo lo avisa cuando está viejo (README, fila "Say what is ripe / spots left this week"). Fuera de temporada el cuadro se llena solo o se oculta: sáltense este paso.
4. **¿Lluvia o un día cerrado en los próximos siete días?** Agreguen la fecha a `closures`, escriban el aviso y su último día, y cierren los mismos horarios en Bookeo (README, filas "Close for rain or a holiday" y "Show a banner on every page"). El mismo día, `python3 tools/close_today.py rain` hace la parte del archivo (sección 5).
5. **En otoño, ¿se abre un fin de semana de pizza este martes?** Cambien la oración que está debajo de la tabla de pizza (README, fila "Open a new pizza weekend"). Aprovechen para agregar filas de los siguientes fines de semana. Las fechas se traducen solas al publicar (vean "Cómo leerla").
6. **Presionen Reserve.** Bookeo debe mostrar los días que ustedes esperan. Lean el buzón de correo de la granja (mensajes de la lista de espera y de contacto) y respondan.
7. **Si cambiaron un precio, un horario, un número de teléfono o un correo electrónico,** ejecuten `python3 tools/check_facts.py` antes de publicar. Debe decir que todos los datos coinciden.
8. **Publiquen** (vean "Cómo leerla"), actualicen a la fuerza (Ctrl+F5, o Cmd+Shift+R en una Mac) y miren `?check` una vez más.
9. **Abran esta página** y lean las entradas de los próximos 14 días.

## 2. El primer día de cada mes: 10 minutos

1. `python3 tools/launch_check.py https://www.wiseacresorganic.com/` (cerca de un minuto). Un FAIL es algo roto: arréglenlo y vuelvan a ejecutarlo. Un WARN es un ajuste o una decisión que les toca a ustedes: léanlo. Un certificado del candado vencido aparece aquí como "The padlock (HTTPS) is not ready".
2. `python3 tools/check_facts.py --short`: debe decir `0 disagree` y terminar con `Nothing disagrees.` (cada dato está escrito igual en todos los lugares).
3. `python3 tools/make_deploy_folder.py --check`: no escribe nada y dice si las páginas y las traducciones están al día y listas para subir. Si la carpeta tools también tiene la herramienta "doctor" del sitio, ejecutarla con python3 hace los pasos 2 y 3 y más en un solo paso, y termina con READY TO UPLOAD o NOT READY.
4. Abran el sitio en vivo con `?check` una vez más, sin nada pendiente de publicar.
5. **Google.** Search Console: los informes Pages y Sitemaps no muestran errores. Perfil de Empresa de Google (Business Profile): los horarios y los horarios de feriados están bien, y las reseñas nuevas tienen respuesta. La página de uso de su host, si su plan tiene un límite (`docs/LAUNCH_CHECKLIST.md`, sección "Every week in season").
6. **Mailchimp.** Conectado: regístrense con su propio correo, esperen la confirmación y luego borren el contacto de prueba. No conectado: presionen "Join the email list" y comprueben que se abre la página de Mailchimp (README, fila "Make the email signup work"; preguntas d63 y la antigua Q26). **Analytics** está apagado hoy (`analytics` en `js/content.js`, en `analytics: { provider: 'none' }`). Si lo encienden, miren sus números y su factura o el fin de la prueba gratis una vez al mes (README, fila "Turn on analytics").
7. **Tiempo en auto y reseñas.** Presionen "Get drive time" una vez con su propia dirección (si falla dos veces seguidas, avisen al ayudante, `docs/LAUNCH_CHECKLIST.md`, sección "3.13"). Presionen "Leave a Google review" en su teléfono: debe abrir las estrellas (pregunta d06). Una reseña nueva que les guste: pregunten primero a quien la escribió y luego agréguenla (README, fila "Add a review"). Su `date` es texto normal ("May 2026") y nunca cambia solo.
8. **Pongan las fechas del mes en el calendario de su teléfono** a partir de esta página: las entradas de las próximas cinco semanas, con un recordatorio cinco días antes de cada fecha "a más tardar".

## 3. El calendario, de octubre a diciembre de 2026

Antes del día del lanzamiento (la fecha aún no está fijada): las decisiones de `docs/LAUNCH_CHECKLIST.md`, sección "4. Before you go live", y la lista de la primera hora en la sección "5. After launch". Las preguntas d05, d38, d30 y d15 son sobre el lanzamiento mismo. Nada de lo que sigue necesita que el lanzamiento ya haya ocurrido, pero un cambio solo llega a los visitantes cuando ustedes publican.

### sáb 3 oct 2026: hoy

- **Por sí solo:** hoy no cambia nada. La temporada de otoño está en curso (del 13 de septiembre al 8 de noviembre): aspecto de otoño, la insignia de la granja "Reserved visits today" de jueves a domingo, la cuenta regresiva de la pizza contando hasta el martes a las 5:00 PM.
- **Ustedes, a más tardar el sáb 3 oct 2026:** respondan **d60** ("¿Cierre por lluvia el 4 de octubre?"). Si la respuesta es sí: pongan el cierre y un aviso en el sitio, y cierren los horarios del domingo en Bookeo.
- **Dónde:** `js/content.js`, en `closures: [],`, `notice: '',` y `noticeUntil: '',` (README, filas "Close for rain or a holiday" y "Show a banner on every page").
- **Si se olvidan:** el domingo las insignias "Open now" dicen que están abiertos mientras la nota de pizza dice que probablemente estarán cerrados.

### mar 6 oct 2026: se abre el primer fin de semana de pizza (y cada martes hasta el mar 27 oct 2026)

- **Por sí solo:** la tabla ya tiene los cuatro fines de semana: filas con `data-release="2026-10-06"`, `data-release="2026-10-13"`, `data-release="2026-10-20"` y `data-release="2026-10-27"`, que abren a las 5:00 PM (`data-release-time="17:00"`). La cuenta regresiva, los botones "Remind me" y la etiqueta de la pantalla principal de otoño siguen las filas, y durante seis horas después de las 5:00 PM la cuenta regresiva dice "just opened" con un botón Reserve. La nota "Open now: pizza reservations for Oct 2 & 3" se oculta sola el lun 5 oct 2026. Cada fila se oculta el día después de su último día de visita (sección 9).
- **Ustedes, a más tardar a las 5:00 PM cada martes:** miren el pronóstico, abran en Bookeo los horarios de ese fin de semana y cambien la oración que está debajo de la tabla para que diga qué fin de semana está abierto ahora, con su último día. Mantengan la forma que muestra la fila del README, y el comando de publicar la traduce (vean "Cómo leerla").
- **Dónde:** `index.html`, en `<strong>Open now:</strong> pizza reservations for` (la oración y su `data-until`); `index.html`, en `data-release-time="17:00"` (la hora de apertura). README, fila "Open a new pizza weekend".
- **Si se olvidan:** la cuenta regresiva igual dice "just opened" por sí sola, pero la oración que está debajo de la tabla está vieja o falta, así que los visitantes no ven qué fin de semana está abierto.

### mié 7 oct 2026 al mié 4 nov 2026: las líneas se ocultan una por una

- **Por sí solo:** el mié 7 oct 2026: la línea "Exceptional Children Day". El lun 12 oct 2026, el lun 19 oct 2026 y el lun 26 oct 2026: las filas de pizza. El dom 1 nov 2026: la etiqueta "New: u-pick tomatoes & basil" y la insignia "New". El mié 4 nov 2026: la línea "Home School Day". Cuando todas las líneas del cuadro "Fall 2026 special days" han desaparecido, el cuadro se oculta solo.
- **Ustedes:** nada.
- **Dónde:** `index.html`, en `data-t="tcda0fa57"` y `data-t="t5efe64c3"` (los dos días especiales). La lista completa está en la sección 9.
- **Si se olvidan:** no se ve nada. `?check` las enumera en su cuadro verde ("remove them when you like").

### mar 27 oct 2026: se abre la última fila de pizza; esa noche desaparecen la cuenta regresiva y la etiqueta

- **Por sí solo:** la última fila es `data-release="2026-10-27"` (visitas del 30 de octubre al 8 de noviembre). Seis horas después de abrir, a las 11:00 PM del mar 27 oct 2026, el cuadro de la cuenta regresiva de la pizza y la etiqueta de la pantalla principal de otoño desaparecen, porque ya no queda ninguna apertura por delante.
- **Ustedes, a más tardar el mar 27 oct 2026:** si los fines de semana de pizza siguen después del 8 de noviembre, agreguen las filas ahora (pregunta **d23**). Las fechas se traducen solas. La etiqueta necesita al menos una fila cuyo día `data-release` todavía esté por delante.
- **Dónde:** `index.html`, en `data-release="2026-10-27"`: copien esa fila completa y cambien sus cuatro fechas (README, fila "Open a new pizza weekend").
- **Si se olvidan:** se vende pizza, pero no hay cuenta regresiva, ni "Remind me", ni etiqueta: los visitantes solo ven "New weekends open every Tuesday at 5:00 PM".

### lun 9 nov 2026: termina la temporada de otoño

- **Por sí solo:** no hay ninguna temporada en curso. La insignia de la granja desaparece, la barra superior dice "Next up: Christmas trees at The GreenHouse", la línea principal pasa a la de todo el año, las filas de pizza ya no están y el botón "Fall schedule" de la página de calabazas se oculta. La página conserva su aspecto de otoño hasta el mié 18 nov 2026, y los botones "Reserve" siguen apareciendo.
- **Ustedes, a más tardar el dom 1 nov 2026:** respondan **d23** (¿está abierta la granja después del 8 de noviembre?) y **d25** (botones Reserve cuando no se puede reservar nada). Si siguen abiertos, Claude mueve el fin del otoño; ustedes agregan filas de pizza y abren los horarios en Bookeo.
- **Dónde:** `js/season.js`, en `id: 'fall'` (la fecha de fin está en esa línea; pídanselo a Claude).
- **Si se olvidan:** del 9 al 17 de noviembre los visitantes ven "Reserve a fall visit" sin la insignia de la granja, y pueden reservar horarios que no existen.

### mié 18 nov 2026: el aspecto de invierno

- **Por sí solo:** la página se vuelve invernal. El botón de la primera pantalla "Visit The GreenHouse" reemplaza a "Reserve your visit", y los botones "Reserve" de la granja casi todos desaparecen.
- **Ustedes, a más tardar el mar 17 nov 2026:** respondan **d01** (qué ven los visitantes en invierno), **d09** (el horario de invierno de The GreenHouse) y **d69** ("Every tree is lit!" aparece demasiado pronto). Si el horario de invierno es distinto de viernes a domingo, de 10 a. m. a 8 p. m., cámbienlo en los dos lugares: los ajustes y las palabras.
- **Dónde:** `js/content.js`, en `greenhouse: { days: [5, 6, 0]` (las insignias verdes), luego las palabras (README, fila "Change opening hours"; README, sección "Change a fact everywhere"), y después `python3 tools/check_facts.py hours`.
- **Si se olvidan:** las insignias y el texto siguen diciendo de viernes a domingo, de 10 a 8, todo el invierno. Eso solo está mal si su horario realmente cambia.

### vie 27 nov 2026: empieza la temporada de árboles de Navidad (el viernes después de Acción de Gracias)

- **Por sí solo:** la temporada de invierno está en curso hasta el 8 de diciembre: la barra superior dice "In season: Christmas trees at The GreenHouse", el titular pasa a ser "Wise Acres Christmas trees", y el cuadro "This week" muestra los árboles "In season". El jue 26 nov 2026 (Día de Acción de Gracias) no es día de apertura, así que no necesita cierre.
- **Ustedes, a más tardar el mié 25 nov 2026:** confirmen las fechas y los precios de los árboles (**d50**, **d54**). Agreguen una nota breve a `week` ("Trees arrive Friday"; `updated` es hoy).
- **Dónde:** `js/content.js`, en `week: {},` (2 lugares: el ajuste y la nota que habla de él); `index.html`, en `data-t="t53cf41e8"` (las fechas de los árboles en la Shop). README, fila "Say what is ripe / spots left this week".
- **Si se olvidan:** el sitio dice que los árboles están en temporada desde el 27 de noviembre sin importar sus existencias, y la línea de la Shop dice "Prices coming soon".

### mar 1 dic 2026: se oculta el cuadro del calendario

- **Por sí solo:** el bloque "No pizza" (`data-until="2026-11-30"`) era la última línea con fecha, así que todo el cuadro "Fall 2026 reservation schedule" se oculta. La oración "See the current fall schedule" de las preguntas frecuentes de la página principal se oculta con él (`data-needs="schedule"`), así que ningún enlace lleva a ninguna parte.
- **Ustedes:** nada. Si planean fechas de pizza para el invierno, agreguen filas y el cuadro vuelve.
- **Dónde:** `index.html`, en `data-t="t6fab8a7b"` (la oración con el enlace); `pages/pumpkin-patch.html`, en `data-until="2026-11-30"` (2 lugares).
- **Si se olvidan:** nada. La oración vuelve sola cuando vuelve un cuadro del calendario.

### mié 9 dic 2026: la temporada de árboles termina en el calendario del sitio

- **Por sí solo:** el último día de árboles en el código es el 8 de diciembre. Desde el mié 9 dic 2026 no hay ninguna temporada en curso: la barra superior dice "Next up: Strawberries, usually mid-April", el titular es el de todo el año, y los árboles salen del cuadro "This week".
- **Ustedes, a más tardar el vie 4 dic 2026:** si venden árboles después del 8 de diciembre, o se les acaban antes, díganlo (pregunta **d50**). Mientras Claude mueve la fecha de fin, usen la barra de aviso y `week` (`crops: { trees: 'peak' }`, o `'off'` cuando ya no haya).
- **Dónde:** `js/season.js`, en `id: 'winter'`; `js/content.js`, en `notice: '',`.
- **Si se olvidan:** el sitio deja de decir que los árboles están en temporada el 9 de diciembre mientras ustedes todavía los venden, o sigue diciéndolo cuando ya se acabaron.

### vie 25 dic 2026: el día de Navidad es día de apertura (también el sáb 26 dic 2026 y el dom 27 dic 2026)

- **Por sí solo:** The GreenHouse y Wise Pie abren de viernes a domingo, así que sus insignias dicen "Open now" (de 10 a. m. a 8 p. m. y de 4 p. m. a 8 p. m.).
- **Ustedes, a más tardar el mié 23 dic 2026, si van a estar cerrados:** agreguen los días a `closures` (sirve un solo rango: `'2026-12-25..2026-12-27'`). Escriban un aviso en los cinco idiomas con `noticeUntil: '2026-12-27'`. Cierren los horarios en Bookeo y pongan el horario de feriado en su Perfil de Empresa de Google. El Año Nuevo también cae en viernes (más abajo).
- **Dónde:** `js/content.js`, en `closures: [],` y `noticeUntil: '',` (README, filas "Close for rain or a holiday" y "Show a banner on every page").
- **Si se olvidan:** la insignia dice "Open now" un día en que están cerrados.

### vie 1 ene 2027: el año nuevo

- **Por sí solo:** el año del pie de página cambia de 2026 a 2027 (`data-year`), y la cinta "New this year" se oculta (`data-until="2026-12-31"`). Nada en los datos para buscadores ni en el mapa del sitio tiene una fecha que se venza.
- **Ustedes, a más tardar el vie 18 dic 2026:** respondan **d66** (¿dejar de decir "new this year" desde enero?) y **d24** (precios, calendario y menú de otoño 2027). Ocho lugares todavía dicen que los tomates son nuevos, y siete lugares escriben "2026" en una etiqueta (otras dos etiquetas se ocultan solas en otoño). Si van a estar cerrados el 1 de enero, agréguenlo a `closures`.
- **Dónde:** "new": `index.html`, en `data-t="td6ecd1d8"`, `data-t="t1c989256"`, `data-t="tedce5b9f"`, `data-t="tbc119a85"`, `data-t="t4eb3e326"`, `data-t="t247dcbc5"` y `data-t="t398007b0"`, y `pages/pumpkin-patch.html`, en `New this year. Certified organic cherry tomatoes`. El año: `python3 tools/check_facts.py year` enumera todos los lugares (README, sección "A new year, a new season").
- **Si se olvidan:** en 2027 las preguntas frecuentes todavía dicen "Yes, and it's new this year!", y las páginas dicen "Fall 2026 prices" todo el invierno, la primavera y el verano. Es cierto, pero se ve viejo.

## 4. El calendario de 2027

### mié 10 feb 2027: el aspecto de primavera

- **Por sí solo:** la página cambia a primavera. "Reserve your visit" y "Reserve a strawberry visit" vuelven, y la nota "No reservation? Visit The GreenHouse next door" aparece otra vez. La barra superior dice "Next up: Strawberries, usually mid-April".
- **Ustedes, a más tardar el mar 9 feb 2027:** respondan **d25** (botones Reserve cuando no se puede reservar nada). Abran los horarios de primavera en Bookeo, o los botones llevarán a un calendario vacío durante nueve semanas.
- **Dónde:** Bookeo; los botones Reserve están en `index.html` (README, fila "Change the booking link" si la dirección cambia).
- **Si se olvidan:** del 10 de febrero al 14 de abril los botones "Reserve" aparecen mientras no se puede reservar nada.

### jue 25 mar 2027: las fresas aparecen en el cuadro "This week"

- **Por sí solo:** el cuadro empieza a decir "Strawberries: usually starts Apr 15", con tres semanas de anticipación. Son fechas típicas, no promesas.
- **Ustedes:** nada por ahora. De aquí en adelante actualicen `week` cuando sepan algo mejor.
- **Dónde:** `js/content.js`, en `week: {},` (2 lugares). README, fila "Say what is ripe / spots left this week".
- **Si se olvidan:** el cuadro mantiene las fechas típicas, lo cual está bien.

### dom 28 mar 2027: Domingo de Pascua (día de apertura)

- **Por sí solo:** es domingo, así que las insignias dicen "Open now".
- **Ustedes, a más tardar el jue 25 mar 2027, si van a estar cerrados:** agréguenlo a `closures` y escriban un aviso. La galería muestra la foto "Happy Easter" todo el año (preguntas **d13** y **d32**).
- **Dónde:** `js/content.js`, en `closures: [],`.
- **Si se olvidan:** "Open now" en un día cerrado.

### jue 15 abr 2027: empieza la temporada de fresas (según el calendario, no según el clima)

- **Por sí solo:** la barra superior dice "In season: Strawberries", la primera pantalla dice "It's strawberry season!" y el cuadro "This week" dice "In season". Nada en el sitio sigue el clima.
- **Ustedes, a más tardar el jue 8 abr 2027:** respondan **d41** (cargo por cancelación en la página de fresas), **d54** (precios) y **d26** (¿cuándo hay flores para cortar?). Si el campo está atrasado o adelantado, avísenlo con la barra de aviso y `week` (`crops: { strawberries: 'soon' }`). Abran los horarios de Bookeo. Si reciben visitas con reserva en primavera, agreguen los días a `hours` (`farm`) para que aparezca la insignia de la granja: `farm:       { fall: [4, 5, 6, 0], spring: [4, 5, 6, 0] }`.
- **Dónde:** `js/content.js`, en `farm:       { fall: [4, 5, 6, 0] }` (hoy solo el otoño tiene días de la granja), `notice: '',` y `week: {},` (2 lugares).
- **Si se olvidan:** la primera pantalla dice que es temporada de fresas un día en que el campo no está listo; sin días de la granja en primavera no hay insignia de la granja (es un hueco, no un error).

### mar 8 jun 2027 al mar 15 jun 2027: termina la primavera, empieza el verano

- **Por sí solo:** el último día de la temporada de fresas es el 7 de junio. El mar 8 jun 2027 no hay ninguna temporada en curso; el aspecto cambia a verano el sáb 12 jun 2027; el mar 15 jun 2027 empieza la temporada de arándanos y girasoles ("It's blueberry season!").
- **Ustedes, a más tardar el lun 7 jun 2027:** respondan **d59** (programas de verano), **d58** (¿botanas y bebidas en primavera y verano?) y **d68** (la insignia de girasoles solo funciona en pantallas grandes). Abran los horarios de verano en Bookeo; agreguen días de la granja de verano a `hours` si quieren la insignia (`summer: [4, 5, 6, 0]`, en el mismo lugar); actualicen `week`.
- **Dónde:** `js/season.js`, en `id: 'summer'` (las fechas están en esa línea; pídanselo a Claude); `js/content.js`, en `week: {},` (2 lugares).
- **Si se olvidan:** lo mismo que con las fresas: palabras del calendario en un día en que quizá los arándanos no estén listos.

### dom 20 jun 2027 y dom 4 jul 2027: Día del Padre y Cuatro de Julio

- **Por sí solo:** los dos son domingos: "Open now". La galería muestra la foto "Happy Father's Day" todo el año (**d13**, **d32**).
- **Ustedes, a más tardar el jue 1 jul 2027, si van a estar cerrados el 4 de julio:** `closures` y un aviso.
- **Dónde:** `js/content.js`, en `closures: [],`.
- **Si se olvidan:** "Open now" en un día cerrado.

### dom 11 jul 2027: termina la temporada de verano

- **Por sí solo:** la barra superior dice "Next up: Pumpkins & tomatoes, usually mid-September" y el cuadro "This week" se vacía.
- **Ustedes:** nada todavía. Empiecen a reunir los datos del otoño de 2027 (vean la entrada del jue 12 ago 2027).
- **Dónde:** nada todavía.
- **Si se olvidan:** nada todavía.

### jue 12 ago 2027: empieza el aspecto de otoño, un mes antes de la temporada

- **Por sí solo:** la página cambia a otoño: "Reserve a fall visit" y las líneas de otoño aparecen, aunque la temporada empieza el lun 13 sep 2027.
- **Ustedes, a más tardar el mié 11 ago 2027:** tengan listos los datos del otoño de 2027.
  1. Los precios y las etiquetas que dicen 2026 (pregunta **d24**, con **d54** y **d16**).
  2. Los días especiales (Home School Day y los demás), con un `data-until` en cada línea, y el título del cuadro.
  3. El calendario: las palabras y el último día del bloque "No pizza", el último día del botón de la página de calabazas (deben coincidir) y las primeras filas de pizza.
  4. La imagen nueva del menú, con un nombre de archivo nuevo.
  5. Los horarios de Bookeo; los tomates y el sendero embrujado (**d48**); el horario de otoño (**d51**); la cena tailandesa (**d08**).
- **Dónde:** `python3 tools/check_facts.py year` enumera los lugares con 2026. `index.html`, en `data-t="t7f10df40"` (título de los días especiales), `data-t="t65d35823"` (título del calendario), `data-t="tb848cce7"` (las palabras de "No pizza") y `data-t="t4f7c68ac"` (título Fall Menu); `pages/pumpkin-patch.html`, en `data-until="2026-11-30"` (2 lugares). README, sección "A new year, a new season"; README, fila "Open a new pizza weekend". Cada oración en inglés que cambien necesita sus cuatro traducciones (README, sección "Change one sentence and its translations, step by step").
- **Si se olvidan:** desde el 12 de agosto los visitantes ven una página de otoño con precios de 2026 y sin cuadro del calendario.

### lun 23 ago 2027 al sáb 25 sep 2027: el cuadro "This week" cuenta hacia atrás solo

- **Por sí solo:** las calabazas "usually start Sep 13", los tomates y la albahaca "usually start Sep 25", las flores para cortar desde el 1 de septiembre.
- **Ustedes:** opcional: `week` cuando sepan algo mejor.
- **Dónde:** `js/content.js`, en `week: {},` (2 lugares).
- **Si se olvidan:** el cuadro mantiene las fechas típicas.

### lun 13 sep 2027: empieza la temporada de otoño

- **Por sí solo:** "In season: Pumpkins & tomatoes", la insignia de la granja "Reserved visits today" de jueves a domingo, la línea principal de otoño. La etiqueta "New: u-pick tomatoes" y la insignia "New" ya no vuelven.
- **Ustedes, a más tardar el lun 6 sep 2027:** la tabla de pizza debe tener filas para los primeros fines de semana, con la primera apertura todavía por delante (la cuenta regresiva lo necesita). Escriban la oración que está debajo de la tabla cada día de apertura (se traduce sola, vean "Cómo leerla").
- **Dónde:** `index.html`, en `data-release-time="17:00"`; README, fila "Open a new pizza weekend".
- **Si se olvidan:** sin filas que queden de 2026, no hay cuenta regresiva ni etiqueta todo el otoño. El cuadro del calendario muestra solo sus líneas "No pizza", o permanece oculto si no renovaron su último día en agosto.

### lun 8 nov 2027 al mar 9 nov 2027: termina la temporada de otoño (como el lun 9 nov 2026)

- **Por sí solo:** la insignia de la granja desaparece el lun 8 nov 2027; ninguna temporada en curso el mar 9 nov 2027; las filas ya no están.
- **Ustedes, a más tardar el lun 1 nov 2027:** otra vez las preguntas **d23** y **d25**, si la respuesta fue solo para 2026.
- **Dónde:** `js/season.js`, en `id: 'fall'`.
- **Si se olvidan:** lo mismo que el 9 de noviembre de 2026.

### jue 18 nov 2027 al vie 26 nov 2027: aspecto de invierno, Acción de Gracias (jue 25 nov 2027), árboles desde el viernes siguiente

- **Por sí solo:** aspecto de invierno el jue 18 nov 2027; la temporada de árboles empieza el vie 26 nov 2027.
- **Ustedes, a más tardar el mié 24 nov 2027:** las fechas y los precios de los árboles, el horario de invierno, la nota de `week`, como el 25 de noviembre de 2026.
- **Dónde:** `js/content.js`, en `greenhouse: { days: [5, 6, 0]` y `week: {},` (2 lugares).
- **Si se olvidan:** lo mismo que en 2026.

### jue 9 dic 2027 y vie 24 dic 2027 al vie 31 dic 2027: terminan los árboles, Navidad, fin de año

- **Por sí solo:** la temporada de árboles termina el jue 9 dic 2027. El vie 24 dic 2027, el sáb 25 dic 2027 y el dom 26 dic 2027 son días de apertura (The GreenHouse y Wise Pie abren de viernes a domingo).
- **Ustedes, a más tardar el mié 22 dic 2027:** cierres y un aviso para los días en que estén cerrados; las etiquetas "new" y "Fall 2027" para el próximo enero (vean el vie 1 ene 2027).
- **Dónde:** `js/content.js`, en `closures: [],` y `noticeUntil: '',`.
- **Si se olvidan:** "Open now" en un día cerrado.

### sáb 1 ene 2028: el año vuelve a cambiar

- **Por sí solo:** el año del pie de página pasa a 2028. Las etiquetas "Fall 2027" empiezan a verse viejas, como pasó con las de 2026.
- **Ustedes:** repitan la entrada del 1 de enero de 2027.
- **Dónde:** `python3 tools/check_facts.py year`.
- **Si se olvidan:** etiquetas viejas, nada grave.

## 5. Cualquier día: cerrar por lluvia y otras sorpresas

- **La forma rápida, el mismo día.** Ejecuten `python3 tools/close_today.py rain` (o `wind`, `holiday`, `late-open 10:30`, `sold-out`). Agrega el día a `closures`, escribe el aviso en cinco idiomas con su último día y guarda una copia del archivo viejo fuera de la carpeta del sitio. Después imprime lo que no puede hacer: los horarios en Bookeo, el Perfil de Empresa y Instagram, con palabras listas para pegar (`docs/NOTICE_KIT.md`). Agreguen `--dry-run` antes para ver el cambio. `python3 tools/close_today.py --undo` lo deja todo como estaba.
- **Cierren el día.** Agreguen la fecha a `closures` en `js/content.js` (`'2026-10-11'` para un día, `'2026-11-09..2026-11-15'` para un tramo). La granja, The GreenHouse y Wise Pie aparecen entonces como cerrados ese día, los tres juntos. No detiene a Bookeo: cierren los mismos horarios allí (README, fila "Close for rain or a holiday"). Las fechas pasadas pueden quedarse en la lista.
- **Avísenlo en todas las páginas.** Escriban `notice` (la barra amarilla) y `noticeUntil` (el último día en que se muestra). La barra se muestra desde el momento en que publican, sin fecha de inicio, así que pongan la fecha en las palabras ("Closed Oct 10 for rain.") y, si el cierre es dentro de varias semanas, agreguen la barra más tarde. Una barra a la vez; para cada idioma escriban `{ en, es, hi, zh, vi }` (README, fila "Show a banner on every page").
- **Cuánto dura.** Un cierre vale solo por su día. La barra se oculta sola el día después de `noticeUntil`; `?check` lo avisa entonces en su cuadro verde ("nothing is broken": solo les recuerda borrar las palabras viejas). Una barra sin `noticeUntil` se queda hasta que escriban `notice: ''`.
- **Un cierre el mismo día.** Los navegadores de los visitantes pueden guardar el archivo viejo hasta una hora después de que publican, así que avísenlo también donde la gente mira primero: Facebook, Instagram y su Perfil de Empresa de Google.
- **Si se olvidan:** las insignias dicen "Open now", y una barra sin último día sigue puesta después del día del que hablaba.
- **Dónde:** `tools/close_today.py` hace la edición por ustedes. A mano es `js/content.js`, en `closures: [],`, `notice: '',` y `noticeUntil: '',`.

## 6. Líneas que nunca se apagan solas

Estas líneas siguen en la página todos los días hasta que ustedes las editen. Nada las une a una fecha.

- **"Prices coming soon"** en la Shop y en las listas de precios. Rellenen cada una cuando tengan el precio (**d54**). Busquen esas palabras en `index.html`.
- **Visitas escolares "Now booking"** (`index.html`, en `data-t="td727517c"` y `data-t="t61e401ae"`): aparecen todo el año (**d27**). Cámbienlas cuando las visitas no estén recibiendo reservas.
- **Las etiquetas "2026"** ("Fall 2026 reservations", "Fall Menu 2026", "Prices are for fall 2026", la página de calabazas). `python3 tools/check_facts.py year` las enumera. El nombre de la imagen del menú lleva 2026: agreguen la nueva con un nombre nuevo (README, sección "A new year, a new season").
- **"Usually mid-April to early June" y las demás fechas habituales en las palabras.** Se repiten cada año (busquen `mid-April`, `mid- to late June`, `Mid-September` y `Friday after Thanksgiving`: la tabla Season by season, las tarjetas de temporada, las preguntas frecuentes, las páginas de fresas y de calabazas). Cámbienlas solo cuando cambien las fechas habituales, en las palabras y en `js/season.js` a la vez (pídanselo a Claude: una prueba las compara).
- **Fotos con palabras que se fechan** (Pascua, Día del Padre, "waiting all summer", "berries & sunflowers"): están en la galería todo el año (**d13**, **d32**).
- **Las reseñas** que agregaron, con su `date` en texto libre.
- **Precios e impuestos.** El sitio muestra solo los precios que ustedes escribieron, y ningún impuesto sobre las ventas. Cuando cambie un precio, sigan el README, sección "Change a fact everywhere", y luego `python3 tools/check_facts.py price`. Bookeo y Square muestran lo que se cobra al pagar.

Una revisión de problemas de fechas (3 de octubre de 2026) no encontró nada en el código atado a un año. Las temporadas, los horarios, el año del pie de página y las cuentas regresivas funcionan con el reloj. Los visitantes de otras zonas horarias ven el día de la granja, no el suyo. Los datos para buscadores no tienen ninguna fecha que se venza, y el mapa del sitio no tiene una fecha de "última modificación" que mantener al día. Una página que se deja abierta pasada la medianoche o el Año Nuevo se pone al día sola en las insignias, la barra superior, la barra de aviso, el año del pie de página y las líneas que se ocultan solas. El aspecto de la temporada y las palabras de la primera pantalla cambian cuando la página se abre de nuevo. Las únicas fechas que se vuelven viejas son las que ustedes escriben en las palabras, y están enumeradas arriba.

## 7. Una vez al año

Pongan cada fecha en el calendario de su teléfono dos veces: 60 días antes y 14 días antes.

- **El dominio.** Busquen la fecha de renovación en su registrador (`docs/LAUNCH_CHECKLIST.md`, sección "4. Before you go live", filas D1 y D2). Si se vence, el sitio web **y los correos electrónicos** de `wiseacresorganic.com` dejan de funcionar.
- **El candado.** Cloudflare Pages y Netlify lo renuevan solos. La revisión mensual dice "The padlock (HTTPS) is not ready" si alguna vez no lo hacen.
- **Search Console.** El sitio sigue verificado mientras su etiqueta siga en `index.html` (busquen las palabras "GOOGLE SEARCH CONSOLE"); el informe Sitemaps debe decir "Success" (`docs/LAUNCH_CHECKLIST.md`, sección "3.10").
- **Perfil de Empresa de Google.** Los horarios, los horarios de feriados, la dirección del sitio web y el enlace de reservas coinciden con el sitio (sección "3.12").
- **Cuentas de pago.** Su plan de host, Mailchimp, Bookeo, Square y cualquier servicio de analítica: la fecha de renovación, y que una dirección de reservas o de pedidos anticipados que cambie también se cambie en el sitio (README, fila "Change the booking link").
- **Las traducciones.** Una vez al año, en agosto antes de que empiece el aspecto de otoño, pidan a una persona nativa que lea lo que cambió (preguntas **d37** y **d71**).
- **Fechas de cierre viejas.** En enero borren de `closures` las fechas pasadas, si quieren (las fechas pasadas pueden quedarse).

## 8. Preguntas que esperan una fecha

Ninguna de estas se decide aquí. Cada una es una tarjeta de su panel; esta lista dice cuándo empieza a importar.

| Pregunta | A más tardar | Por qué entonces |
|---|---|---|
| d60 ¿Cierre por lluvia el 4 de octubre? | sáb 3 oct 2026 | las insignias del domingo |
| d23 ¿Está abierta la granja después del 8 de noviembre? | dom 1 nov 2026 | la temporada de otoño termina el 8 de noviembre |
| d25 Botones Reserve cuando no se puede reservar nada | dom 1 nov 2026 (otra vez mar 9 feb 2027) | los botones aparecen entre temporadas |
| d01 Qué ven los visitantes en invierno, d09 El horario de invierno de The GreenHouse, d69 "Every tree is lit!" aparece demasiado pronto | mar 17 nov 2026 | el aspecto de invierno empieza el 18 de noviembre |
| d50 Fechas de los árboles de Navidad, d54 Precios de calabazas, bayas, flores y árboles | mié 25 nov 2026 | la temporada de árboles empieza el 27 de noviembre |
| d66 ¿Dejar de decir "new this year" desde enero? | vie 18 dic 2026 | el año nuevo |
| d26 ¿Cuándo hay flores para cortar?, d41 Cargo por cancelación en la página de fresas | jue 8 abr 2027 | la temporada de fresas empieza el 15 de abril |
| d58 ¿Botanas y bebidas en primavera y verano?, d59 ¿Todavía tienen programas de verano?, d68 La insignia de girasoles solo funciona en pantallas grandes | lun 7 jun 2027 | la temporada de verano empieza el 15 de junio |
| d24 Precios, calendario y menú de otoño 2027 | mié 11 ago 2027 | el aspecto de otoño empieza el 12 de agosto |
| d48 Sendero embrujado y tomates para cosechar este otoño, d51 ¿Son correctos los horarios de otoño?, d08 Cena tailandesa | lun 6 sep 2027 | la temporada de otoño empieza el 13 de septiembre |
| d27 Letrero de visitas escolares, d13 Fotos con palabras o con personas, d32 Fotos con palabras que se fechan | cualquier momento | aparecen todo el año |
| d37 Hablantes nativos para las traducciones, d71 ¿Tono cercano o formal en las traducciones? | cualquier momento | antes de la próxima revisión de agosto |

Tarjetas sin fecha: d61, d62, d63, d64, d65, d67, d70, d72, d73.

## 9. Las fechas que usa el sitio (comprobadas por la prueba)

La prueba `node tests/owner-calendar.test.mjs` compara cada fila de abajo con los archivos. No necesita navegador y tarda cerca de un segundo. Si cambian una fecha de temporada o una línea con fecha, pídanle a Claude que la ejecute y que actualice esta página.

### Los días en que el sitio cambia solo su aspecto de temporada o su temporada

| Fecha | Día | Qué cambia |
|---|---|---|
| `2026-11-09` | lun 9 nov 2026 | termina la temporada de otoño (último día: 8 nov); ninguna temporada en curso |
| `2026-11-18` | mié 18 nov 2026 | aspecto de invierno |
| `2026-11-27` | vie 27 nov 2026 | empieza la temporada de árboles (el viernes después de Acción de Gracias) |
| `2026-12-09` | mié 9 dic 2026 | termina la temporada de árboles (último día: 8 dic) |
| `2027-02-10` | mié 10 feb 2027 | aspecto de primavera |
| `2027-04-15` | jue 15 abr 2027 | empieza la temporada de fresas |
| `2027-06-08` | mar 8 jun 2027 | termina la temporada de fresas (último día: 7 jun) |
| `2027-06-12` | sáb 12 jun 2027 | aspecto de verano |
| `2027-06-15` | mar 15 jun 2027 | empieza la temporada de arándanos y girasoles |
| `2027-07-11` | dom 11 jul 2027 | termina la temporada de verano (último día: 10 jul) |
| `2027-08-12` | jue 12 ago 2027 | aspecto de otoño |
| `2027-09-13` | lun 13 sep 2027 | empieza la temporada de otoño |
| `2027-11-09` | mar 9 nov 2027 | termina la temporada de otoño (último día: 8 nov) |
| `2027-11-18` | jue 18 nov 2027 | aspecto de invierno |
| `2027-11-26` | vie 26 nov 2027 | empieza la temporada de árboles (el viernes después de Acción de Gracias) |
| `2027-12-09` | jue 9 dic 2027 | termina la temporada de árboles (último día: 8 dic) |

### Las líneas que tienen un último día (un `data-until`) o un día de apertura (un `data-release`)

Una línea con `data-until="D"` se oculta el día después de D. Una fila de pizza tiene las dos cosas: abre en su martes `data-release` y se oculta después de su `data-until`.

| En los archivos | Qué es | Se oculta el |
|---|---|---|
| `data-until="2026-10-04"` | la nota "Open now: pizza reservations for Oct 2 & 3" | lun 5 oct 2026 |
| `data-until="2026-10-06"` | la línea "Exceptional Children Day" | mié 7 oct 2026 |
| `data-release="2026-10-06"` `data-until="2026-10-11"` | fila de pizza: abre el 6 de oct, visitas del 9 al 11 de oct | lun 12 oct 2026 |
| `data-release="2026-10-13"` `data-until="2026-10-18"` | fila de pizza: abre el 13 de oct, visitas del 16 al 18 de oct | lun 19 oct 2026 |
| `data-release="2026-10-20"` `data-until="2026-10-25"` | fila de pizza: abre el 20 de oct, visitas del 23 al 25 de oct | lun 26 oct 2026 |
| `data-release="2026-10-27"` `data-until="2026-11-08"` | fila de pizza: abre el 27 de oct, visitas del 30 de oct al 8 de nov | lun 9 nov 2026 |
| `data-until="2026-10-31"` | la etiqueta "New: u-pick tomatoes & basil" y la insignia "New" (2 lugares) | dom 1 nov 2026 |
| `data-until="2026-11-03"` | la línea "Home School Day" | mié 4 nov 2026 |
| `data-until="2026-11-30"` | el bloque "No pizza" (el botón "Fall schedule" de la página de calabazas lleva la misma fecha, pero ya se oculta el 9 de nov con la temporada de otoño) | mar 1 dic 2026 |
| `data-until="2026-12-31"` | la cinta "New this year" | vie 1 ene 2027 |

### Datos en los que se apoya esta página

- Las filas de pizza abren los martes a las 5:00 PM (`data-release-time="17:00"` en `index.html`).
- The GreenHouse abre de viernes a domingo, de 10 a. m. a 8 p. m., y Wise Pie de 4 p. m. a 8 p. m.; la granja tiene insignia solo en otoño, de jueves a domingo (`hours` en `js/content.js`).
- "This week at the farm" dura 14 días después de `updated` y desaparece desde el día 15 (`expireDays: 14` en `js/features.js`).
- El Domingo de Pascua de 2027 es el dom 28 mar 2027; Acción de Gracias es el jue 26 nov 2026 y el jue 25 nov 2027.
- Año del pie de página: `data-year` en `index.html`; cambia a medianoche del 1 de enero (hora del Este).

*Cómo se mantiene al día esta página.* `node tests/owner-calendar.test.mjs` comprueba estas cosas:

- Que cada día de la semana escrito con una fecha sea el día correcto.
- Que las entradas estén en orden de fecha.
- Que los días de temporada de arriba sean exactamente los días de la lista de [WHAT_VISITORS_SEE_WHEN.md](WHAT_VISITORS_SEE_WHEN.md). `node tests/calendar-doc.test.mjs` mantiene ese archivo igual al código real de las temporadas.
- Que cada `data-until` y cada `data-release` de los archivos de las páginas esté en la segunda tabla, y cada uno de la segunda tabla esté en los archivos.
- Que cada día "Se oculta el" sea el día después de su último día.
- Que `docs/OWNER_YEAR_CALENDAR.md` tenga un enlace desde el README y desde la lista de lanzamiento.
- Que esta copia en español, `docs/OWNER_YEAR_CALENDAR.es.md`, tenga las mismas fechas, entradas, tablas, rutas y palabras.

Los archivos y las palabras que nombra cada entrada los comprueba `node tests/docs.test.mjs`.
