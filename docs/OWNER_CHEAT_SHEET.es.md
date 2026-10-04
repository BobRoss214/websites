*Note for the team: this translation was written by an AI. A Spanish speaker should read it before it is sent to the farm.*

*Nota para el equipo: esta traducción fue escrita por una IA. Una persona que hable español debe leerla antes de enviarla a la granja.*

# La hoja de ayuda: los 12 trabajos que más hacen

*Para la granja. Cada paso se hizo a mano en una copia de práctica del sitio el 4 de octubre de 2026. Las fechas de abajo son ejemplos: usen las suyas. Una página para imprimir (una hoja, por los dos lados): `print/owner-cheat-sheet.es.html`. Versión en inglés: [OWNER_CHEAT_SHEET.md](OWNER_CHEAT_SHEET.md).*

## Antes de empezar

- Abran la carpeta del sitio y luego abran una terminal en ella (README, "Commands: one-time setup"). En Windows escriban `python` donde esta hoja dice `python3`.
- Editen los archivos en un programa de texto simple: el Bloc de notas, o TextEdit con Formato, Convertir en texto simple. No en Word.
- Primero copien toda la carpeta del sitio y pongan la fecha de hoy en su nombre. Esa copia es su forma de deshacer (trabajo 9).
- Para buscar en un archivo, presionen Ctrl+F. En `index.html` la raya se escribe `&ndash;`, así que busquen `10 am&ndash;8 pm`.
- Editen `index.html`, `js/content.js` y los archivos de `pages/`. Nunca editen las cinco páginas armadas de la carpeta principal (`first-visit.html`, `pumpkin-patch.html`, `strawberry-picking.html`, `school-field-trips.html`, `wise-pie.html`).

## T. Traducciones (el trabajo 5 los manda aquí, y también un comando que dice NOT DONE yet)

Cada oración en inglés que cambien necesita cuatro traducciones: español, hindi, chino y vietnamita. Los comandos de los trabajos 1, 6 y 7 las escriben por ustedes. O mándenle a Claude lo que imprime el paso 1.

1. Ejecuten `python3 tools/pages.py`, luego `python3 tools/i18n.py extract`, luego `python3 tools/i18n.py missing es --list`. Deben ver una línea por cada texto cambiado, como `t87b79837 | Fri–Sun, 10 am–9 pm`. La primera palabra es el código nuevo.
2. Abran `lang/src/es.json`. Busquen las palabras viejas en español (por ejemplo `10 a. m.`). Copien la línea vieja, péguenla debajo de ella y cambien el código y el número o la dirección. No cambien nada más.
3. Hagan lo mismo en `lang/src/hi.json`, `lang/src/zh.json` y `lang/src/vi.json`. Usen comillas rectas. Dejen una coma al final de cada línea, menos la última antes de un `}`.
4. Ejecuten `python3 tools/i18n.py build`. Deben ver una línea por cada idioma, como `lang/zh.js  ui=1056 js=305`. Si dice `not valid JSON` y un número de línea, miren esa línea y la de arriba.
5. Ejecuten `python3 tools/i18n.py missing es`, y lo mismo con `hi`, `zh` y `vi`. Cada uno debe decir `0 missing`.

## 1. Cambiar el horario (ejemplo: The GreenHouse cierra a las 9 p. m.)

1. Ejecuten `python3 tools/change_fact.py hours "Fri-Sun, 10 am-8 pm" "Fri-Sun, 10 am-9 pm"`. Enumera todos los lugares que tienen el horario viejo, en `index.html` y `js/content.js`. Todavía no cambia nada.
2. Ejecuten el mismo comando con `--yes` al final. Cambia los lugares, escribe solo las cuatro traducciones y lo revisa todo. Tarda unos 10 segundos. Deben ver `Ready.` y `every fact agrees and no text is missing`.
3. También imprime las líneas nuevas del horario en español, hindi, chino y vietnamita. Pidan a una persona nativa que las lea una vez.
4. Ejecuten `python3 tools/serve.py`. Un viernes, sábado o domingo antes de las 9 p. m., la insignia verde dice `Open now, until 9 pm`. Después publiquen (trabajo 8).
5. Si dice `NOT DONE yet`, enumera lo que falta. Mándenle esas líneas a Claude. O pongan todo de vuelta: `python3 tools/change_fact.py undo`.

## 2. Cerrar por un día (lluvia)

1. Abran `js/content.js`. Busquen `closures: [],`. Pongan el día entre los corchetes, entre comillas: `closures: ['2026-10-11'],`. Dos días: `['2026-10-11', '2026-10-18']`. Una semana entera: `['2026-11-09..2026-11-15']`.
2. Escriban cada fecha como año-mes-día con dos cifras cada uno. Si escriben `'2026-10-4'`, el recuadro amarillo Site check dice `closures "2026-10-4" was read as 2026-10-04.`
3. Ejecuten `python3 tools/serve.py`. Ese día las insignias de arriba dicen `Closed today. Opens Friday at 10 am` y `No visits today. Next reserved day: Thursday`. Los otros días no cambia nada: las insignias siguen la fecha.
4. Esto no cierra Bookeo. Cierren esos horarios en Bookeo ustedes mismos. Muestren también un aviso (trabajo 3).
5. Publiquen (trabajo 8). Las fechas pasadas pueden quedarse en la lista. La próxima vez busquen `closures:` y usen la línea que no tiene `*` al principio.

## 3. Mostrar una barra de aviso

1. Abran `js/content.js`. Busquen `notice: '',`. Escriban sus palabras entre las comillas: `notice: "Closed Sunday, Oct 11, for rain.",`. Usen comillas dobles cuando sus palabras tengan un apóstrofo.
2. En la línea de abajo busquen `noticeUntil: '',`. Escriban el último día que se muestra la barra: `noticeUntil: '2026-10-12',`. Después de ese día se quita sola. No hay día de inicio, así que escriban el día en las palabras.
3. Ejecuten `python3 tools/serve.py`. Deben ver una barra arriba de la página: `Heads up: Closed Sunday, Oct 11, for rain.` Se muestra en inglés en todos los idiomas.
4. Si el recuadro Site check dice `js/content.js stopped at line` y un número, miren esa línea y la de arriba. Las causas más comunes son una coma que falta, o un apóstrofo dentro de comillas simples.
5. Para quitar la barra, escriban otra vez `notice: '',` y `noticeUntil: '',`. Luego publiquen (trabajo 8).

## 4. Abrir un nuevo fin de semana de pizza

1. Abran `index.html`. Busquen `data-release=`. La última fila de la tabla de pizza se parece a `<tr data-release="2026-10-27" data-until="2026-11-08">`. Copien esa fila completa (de `<tr` a `</tr>`) y péguenla debajo de ella.
2. En la copia cambien cuatro cosas: `data-release="2026-11-03"` (el martes en que se abren las reservas), `data-until="2026-11-08"` (el último día de visita), `Nov 3` (ese martes) y `Nov 6&ndash;8` (los días de visita). Escriban la raya como `&ndash;`.
3. Busquen `<strong>Open now:</strong>`. Reemplacen el párrafo completo por `<p class="notice" data-until="2026-11-08"><strong>Open now:</strong> pizza reservations for Nov 6&ndash;8.</p>`. Se muestra en cuanto publican, así que háganlo el día en que se abren las reservas.
4. Ejecuten `python3 tools/make_deploy_folder.py`. Escribe por sí solo las líneas de fechas en español, hindi, chino y vietnamita (`tools/date_phrases.py`), así que no le mandan nada a nadie. Al final deben ver `Ready:`. Si se detiene, nombra la línea y dice por qué.
5. Ejecuten `python3 tools/serve.py`. La tabla "When pizza reservations open" muestra la fila nueva. Antes de las 5 p. m. de ese martes la cuenta regresiva dice `Next pizza reservations open in 4 hours 59 minutes`. Después de las 5 p. m. dice `Pizza reservations are open now`.
6. Cada semana: agreguen la fila siguiente, cambien la oración, hagan el paso 4 y luego publiquen (trabajo 8).

## 5. Agregar o cambiar una foto

1. Ejecuten `python3 tools/add_photo.py "C:\Pictures\goat.jpg" --name goat-on-grass --alt "A white goat on green grass" --caption "Goat on the grass" --tags animals`. En `--alt` digan solo lo que se ve: sin precios, nombres ni fechas. Deben ver `Done.` y una línea que empieza con `picture:`.
2. Ejecuten `python3 tools/i18n.py jsstrings`. Deben ver una línea como `306 JavaScript strings -> lang/js-strings.json`.
3. Abran `lang/src/es.json`. Debajo de `"js": {`, arriba, agreguen dos líneas, con las palabras en inglés primero: `"A white goat on green grass": "Una cabra blanca sobre hierba verde",` y `"Goat on the grass": "Cabra en la hierba",`. Hagan lo mismo en `lang/src/hi.json`, `lang/src/zh.json` y `lang/src/vi.json`. El recuadro T muestra cómo escribir una línea de traducción.
4. Ejecuten `python3 tools/i18n.py build`. Luego ejecuten `python3 tools/i18n.py missing es`, y lo mismo con `hi`, `zh` y `vi`. Cada uno debe decir `text written by JavaScript: 0 missing`.
5. Ejecuten `python3 tools/serve.py` y bajen hasta la galería de fotos. Cuenta una foto más (`All: 31 photos`) y muestra su foto. Después publiquen (trabajo 8).
6. Para cambiar una foto, agreguen la nueva con un nombre NUEVO: los navegadores guardan una imagen vieja hasta por un año. Pídanle a Claude que quite la vieja.

## 6. Cambiar un precio (ejemplo: el paquete de $31 pasa a $32)

1. Ejecuten `python3 tools/change_fact.py price "$31" "$32"`. Deben ver `3 places in 2 files`, en `index.html` y `pages/pumpkin-patch.html`. Todavía no cambia nada.
2. Ejecuten el mismo comando con `--yes` al final. Cambia los 3 lugares, copia las 3 traducciones de cada idioma y lo revisa todo. Deben ver `Ready.`
3. Un precio puede significar dos cosas. Si dice `means more than one thing` (`$3` también es el trencito del barril), agreguen palabras que estén junto a su precio: `python3 tools/change_fact.py price "$3" "$4" --only "per person"`.
4. Ejecuten `python3 tools/serve.py` y miren el paquete y la tienda. Después publiquen (trabajo 8).
5. ¿Algo salió mal? `python3 tools/change_fact.py undo` pone todo de vuelta.

## 7. Cambiar el teléfono o el correo electrónico

1. Ejecuten `python3 tools/change_fact.py email cathy@wiseacresorganic.com office@wiseacresorganic.com`. Enumera todos los lugares, también el botón de la lista de espera en `js/features.js`. Todavía no cambia nada. Para el teléfono del mismo día: `python3 tools/change_fact.py phone 704-207-6347 704-555-1234`.
2. Ejecuten el mismo comando con `--yes` al final. Cambia los lugares, escribe las traducciones (6 textos para el correo, 1 para el teléfono) y lo revisa todo. Deben ver `Ready.`
3. Ejecuten `python3 tools/check_facts.py e-mail`, o `python3 tools/check_facts.py phone`. La dirección o el número viejo ya no debe estar en la lista, y las últimas líneas deben decir `agree everywhere; 0 disagree.`
4. Publiquen (trabajo 8). Luego abran el sitio en vivo con `?check` (trabajo 10).
5. ¿Algo salió mal? `python3 tools/change_fact.py undo` pone todo de vuelta.

## 8. Publicar

1. Primero revisen su cambio (trabajo 10).
2. Ejecuten `python3 tools/make_deploy_folder.py`. Tarda unos 15 segundos.
3. Deben ver `Ready:` y `Upload what is INSIDE that folder`. Ready quiere decir que las páginas están al día, los datos coinciden, las cuatro traducciones están y todos los archivos que las páginas necesitan están en `deploy/`. Las líneas que empiezan con `WARNING:` son ajustes que faltan. No los detienen.
4. Si en cambio ven `NOT READY: 4 checks are red.`, lean cada línea roja. Nombra el archivo y dice qué hacer. No se escribe nada en `deploy/`. Arréglenlo y ejecuten el comando otra vez. No usen `--force` a menos que Claude lo diga.
5. Suban los archivos que están dentro de `deploy/`: en Cloudflare abran Workers & Pages, su proyecto, "Create a new deployment", y arrastren los archivos (`docs/LAUNCH_CHECKLIST.md`, paso 3.2). Guarden una copia de la carpeta con la fecha en su nombre, como `wise-acres-upload-2026-10-09`.
6. Abran `https://www.wiseacresorganic.com/?check`. Si no hay un recuadro amarillo, todo está bien. Presionen Ctrl+F5 (en Mac: Cmd+Shift+R) para ver la versión nueva de inmediato. Otras personas pueden ver la vieja hasta por una hora.

## 9. Deshacer mi último cambio

1. Cierren su editor. Pongan de vuelta su copia de la carpeta con la fecha. Si solo cambiaron uno o dos archivos, pongan de vuelta solo esos archivos (`js/content.js`, `index.html`, `pages/`, `lang/src/`).
2. Si pusieron de vuelta solo algunos archivos, ejecuten estos cuatro comandos, uno tras otro: `python3 tools/pages.py`, `python3 tools/i18n.py extract`, `python3 tools/i18n.py jsstrings`, `python3 tools/i18n.py build`. No cambian nada que ya esté bien.
3. Ejecuten `python3 tools/make_deploy_folder.py --check`. Deben ver `Facts agree everywhere. Translations complete: es, hi, vi, zh.` y `Ready to make deploy/ (nothing was written: --check).`
4. ¿Ya lo subieron? En Cloudflare abran su proyecto, luego "Deployments", y vuelvan a la versión anterior (`docs/LAUNCH_CHECKLIST.md`, sección "5. After launch"). Después abran el sitio en vivo con `?check`.

## 10. Revisar mi cambio

1. Guarden sus archivos. Ejecuten `python3 tools/serve.py`. Imprime `Address:` y una dirección web como `http://localhost:54755/`, y abre su navegador. Después de cada guardado presionen F5. Presionen Ctrl+C para detenerlo.
2. Miren la parte de abajo de la página. Un recuadro amarillo, `Site check: 1 thing to fix`, dice qué arreglar y dónde. Un recuadro verde, `Site check: nothing is broken`, está bien: solo lista líneas viejas que se ocultaron solas. Si no hay recuadro, no se encontró nada.
3. Ejecuten `python3 tools/check_facts.py`. Las últimas líneas deben decir `agree everywhere; 0 disagree.` Un dato escrito de dos maneras se marca `DIFFERENT`, con el archivo y la línea.
4. Ejecuten `python3 tools/make_deploy_folder.py --check`. No escribe nada. Deben ver `Facts agree everywhere. Translations complete: es, hi, vi, zh.`
5. En el sitio en vivo agreguen `?check` a la dirección: `https://www.wiseacresorganic.com/?check`. Los visitantes nunca ven un mensaje, así que revisen después de cada subida.

## 11. Algo se ve mal

1. Tranquilos. Nadie ve sus cambios hasta que los suben. Después de una subida, la versión anterior sigue guardada en Cloudflare.
2. Abran el sitio con `?check` (en su computadora: `python3 tools/serve.py`). Lean el recuadro. Nombra el ajuste y qué escribir. `js/content.js stopped at line` y un número quiere decir que hay un error de escritura en ese archivo: miren esa línea y la de arriba.
3. Ejecuten `python3 tools/check_facts.py` y `python3 tools/make_deploy_folder.py --check`. Cada línea roja nombra el archivo y la solución.
4. ¿Sigue mal? Deshagan su último cambio (trabajo 9). ¿Mal en el sitio en vivo? En Cloudflare abran "Deployments" y vuelvan a la versión anterior.
5. Para probar el sitio en vivo ejecuten `python3 tools/launch_check.py https://www.wiseacresorganic.com/ --quick`. Tarda unos 10 segundos. Cada línea `FAIL` dice qué hacer. Las últimas líneas empiezan con `== Summary ==`.
6. Pregúntenle a Claude, la persona que cuida el sitio. Mándenle lo que cambiaron, cuándo, y las palabras del recuadro amarillo o de las líneas rojas (copiar y pegar).

## 12. Año nuevo: los cuatro trabajos del año

1. Renovaciones. Pongan cada fecha en el calendario de su teléfono dos veces, 60 días y 14 días antes. El dominio `wiseacresorganic.com` (también mantiene funcionando el correo de la granja). Sus cuentas de pago: el host, Mailchimp, Bookeo, Square.
2. Miren el sitio en vivo: el candado, Google Search Console (debe decir "Success" para el sitemap) y el horario de su Perfil de Empresa de Google.
3. Palabras con año. Busquen `2026` en `index.html` y en los archivos de `pages/`. Algunas palabras no cambian solas. Son los títulos "Fall 2026", la imagen del menú de otoño (trabajo 5), los días especiales y las filas de pizza (trabajo 4). El año del pie de página sí cambia solo.
4. Una vez al año pidan a una persona nativa que lea las traducciones (agosto, antes de que empiece el aspecto de otoño). En enero borren las fechas pasadas de `closures:` si quieren.
5. Todas las fechas, una por una: `docs/OWNER_YEAR_CALENDAR.md`, sección "7. Once a year".

## Notas para el equipo

No es para la dueña ni para el dueño, y no se imprime.

- Cómo se revisó. El 4 de octubre de 2026, en una copia del sitio con los parches opcionales, cada paso de arriba se hizo a mano y los resultados se leyeron en el navegador (con un reloj de mentira para las insignias, la barra de aviso y la cuenta regresiva de pizza). Los comandos y las palabras que deben ver son los reales.
- La página para imprimir. `print/owner-cheat-sheet.html` y `print/owner-cheat-sheet.es.html` se hacen con estos dos archivos con `python3 tools/make_cheat_sheet.py`. No se suben (`tools/make_deploy_folder.py` las deja fuera). Una prueba falla cuando están desactualizadas.
- La copia en español. `docs/OWNER_CHEAT_SHEET.es.md` tiene las mismas líneas en el mismo orden. Una prueba compara el tipo de cada línea, las palabras entre comillas invertidas y los números. Cambien los dos archivos juntos.
- Todavía no está en el árbol, así que no está en la hoja: una herramienta de un solo comando para cerrar por un día (tools/close_today.py), una herramienta para ensayar respuestas (tools/rehearse_answers.py) y una herramienta de diagnóstico. Cuando llegue una, agreguen una línea al trabajo 2 o al trabajo 11.
- Límites conocidos. `tools/change_fact.py` cambia un número, un precio, una dirección o una hora en las traducciones viejas; un cambio de palabras (trabajo 5, recuadro T) todavía necesita a una persona. Solo se muestra como ejemplo el horario de The GreenHouse: el mismo comando sirve para el horario de Wise Pie, por ejemplo "4 to 8 pm".
