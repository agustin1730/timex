# Time X

Aplicación creada con Lovable, con React 19, TypeScript, TanStack Start y Vite.
Esta entrega cubre temporizadores individuales, bloques, ajustes, carpetas y
secuencias guardadas de temporizadores y transiciones.

La versión actual del código es **0.24.0**. La interfaz se llama Time X; se
conservan el identificador interno de Tauri (`com.agustin1730.intervalos`) y
las claves locales `interval-timers.*` para mantener la biblioteca al actualizar.
El estado operativo está resumido en [ESTADO-PROYECTO.md](docs/ESTADO-PROYECTO.md).

## Ejecución local

Usar Node.js 24 y npm. Desde la raíz:

```sh
npm ci
npm run dev -- --host 127.0.0.1
npm test
npm run typecheck
npm run build
```

`npm install` se usa cuando se cambian dependencias; `package-lock.json` fija la
instalación de npm. El archivo `bun.lock` proviene de la exportación de Lovable.

## Datos y sesiones

Los datos se guardan en `localStorage` del navegador, por perfil y origen
(protocolo, host y puerto). No hay servidor de datos ni sincronización remota.
Cerrar y volver a abrir la misma dirección conserva los presets y carpetas;
borrar datos del navegador los elimina. Una sesión en curso no se restaura al
cerrar la página. La biblioteca se actualiza ante cambios en otra pestaña.

Claves existentes, preservadas por esta versión:

- `interval-timers.v1`: temporizadores con bloques, etapas, voz, notificaciones y carpeta.
- `interval-timers.folders.v1`: carpetas y subcarpetas, máximo dos niveles.
- `interval-timers.example.v2`: marca de creación del ejemplo. No se vuelve a crear si fue eliminado expresamente.

El ejemplo nuevo tiene siete bloques y 113 etapas, con duración de 630 segundos
(10:30). Si ya existe un ejemplo, se conserva íntegro, incluso si corresponde a
una versión anterior: no hay una huella fiable para distinguir todas las ediciones
personales y migrarlo sin perder cambios.

`TimerSession` captura una copia profunda al abrir el reproductor. Guardar cambios
en otra pestaña no altera la sesión abierta. Para cargar esos cambios se abre una
nueva sesión. El motor usa un reloj monotónico y no ejecuta avisos dentro de
actualizaciones de estado de React. Pausar conserva el tiempo exacto; cambiar de
etapa la reinicia y conserva el estado activo/pausado. Reiniciar vuelve al comienzo
pausado. Al reanudar no se repite el anuncio de la misma etapa.

En web, voz y notificaciones dependen de las API y permisos del navegador.
Un permiso denegado no impide usar el temporizador. La suspensión de pestañas
puede demorar los avisos; no se promete ejecución nativa en segundo plano.

## Secuencias guardadas

La pestaña Secuencias permite crear, editar, renombrar, duplicar, ejecutar y borrar
secuencias. Los elementos de temporizador guardan solo su identificador. Las
transiciones guardan nombre, segundos y ajustes de voz/notificaciones propios,
activados por defecto. No hay interruptores generales que reemplacen los ajustes.

El editor usa tarjetas ordenadas y un menú «Agregar» para temporizadores de la
biblioteca y transiciones. Los temporizadores se editan en su editor existente,
en una nueva pestaña, sin perder el borrador de la secuencia. Los cambios guardados
actualizan la duración de la secuencia. En móvil, tocar una tarjeta despliega sus controles.

Ya no se pueden crear tramos repetidos. Al cargar datos antiguos, se convierten
en elementos explícitos siguiendo el mismo orden y número de ejecuciones, con
identificadores individuales y conservando los ajustes de cada transición.
Antes de escribir la conversión se guarda un respaldo completo en
`interval-timers.sequences.before-expansion.v1`. La conversión es idempotente.
Los datos inválidos o demasiado grandes (más de 100000 elementos resultantes)
detienen la conversión con un error y conservan el original; si el respaldo no
puede guardarse tampoco se reemplaza el original. El editor informa cuando una
secuencia tiene tramos convertidos. Las referencias siguen apuntando a los mismos
temporizadores; no se duplican los presets de la biblioteca.

Claves adicionales: `interval-timers.sequences.v1` y
`interval-timers.sequence-example.v1`. No se migran ni sobrescriben temporizadores.
El ejemplo se crea una sola vez si el temporizador de ejemplo aún existe.

La duración usa las versiones actuales de los temporizadores referenciados. Al
pulsar Iniciar se captura una nueva línea de tiempo; Pausar y reanudar conservan
la captura. Reiniciar deja pausado al comienzo y la próxima pulsación de Iniciar
captura la versión actualizada. Volver a iniciar una secuencia finalizada también
captura los cambios. Editar o borrar presets no altera una sesión ya iniciada.

El aviso final de la secuencia sigue los ajustes de su última etapa. No se emiten
avisos de finalización de temporizadores intermedios. Si la última etapa tiene
ambos avisos desactivados, el final se muestra visualmente sin voz ni notificación.

Borrar un temporizador o una carpeta muestra las secuencias afectadas. Confirmar
quita todas las referencias; una secuencia vacía se conserva
como borrador editable y no se puede ejecutar. Cancelar no cambia los datos.

## Verificación

Ver `VERIFICACION.md` para resultados y `DESKTOP-WINDOWS.md` para las pruebas de
escritorio pendientes. Las pruebas del motor usan reloj controlado; los adaptadores
de avisos usan dobles de prueba y no certifican voz audible ni notificaciones nativas.

Ver `VERIFICACION-SECUENCIAS.md` para los resultados de esta ampliación.
`TimelineSession` es el motor común; `TimerSession` conserva la interfaz de los
temporizadores individuales. `sequence-model.ts` contiene referencias, compatibilidad con tramos antiguos,
validación y expansión. Los datos nuevos se integran en `timer-storage.ts` para
resolver dependencias al eliminar.

## Importar y exportar temporizadores

La biblioteca importa un archivo JSON de Time X desde la raíz o desde la carpeta
abierta; cada archivo puede contener varios temporizadores. Se valida el archivo
completo y se muestra un resumen antes de guardar. Si cualquier registro es
inválido, no se importa ninguno. Los nuevos temporizadores se guardan en la
ubicación abierta; si un nombre ya existe allí, se añade `(1)`, `(2)`, etc. Se
generan IDs nuevos para el temporizador, los bloques y las etapas. No se modifican
las secuencias existentes.

Cada tarjeta permite exportar su temporizador. El formato es versionado e incluye
un arreglo `timers`, también cuando se exporta un único elemento; así puede
extenderse para exportar varios sin cambiar el formato. Se conservan bloques,
etapas, color, repeticiones y ajustes de voz/notificaciones. IDs y ubicación de
carpeta son locales y no se exportan. El codec está en `src/lib/timer-json.ts` y
el guardado agrupado en `src/lib/timer-storage.ts`.

## Lovable

[Proyecto en Lovable](https://lovable.dev/projects/4229b463-a795-47b6-9440-aa1660bf3ddf).
No reescribir historial publicado. Los cambios de una rama local no se publican
automáticamente en GitHub ni en Lovable.

La candidata 0.23.0 está publicada en la rama
[`codex/time-x-settings-0.23.0`](https://github.com/agustin1730/timex/tree/codex/time-x-settings-0.23.0).
La candidata 0.24.0, con importación/exportación JSON, está en la rama
`codex/json-timer-import-export-0.24.0`.
Un push no integra cambios en `main` ni los publica en Lovable.

## Navegación adaptable

La barra lateral de escritorio (desde 768 px) abre expandida y permite plegar a
íconos. Temporizadores, Secuencias y Configuración muestran su sección activa
también en editores y reproductores. Cuenta se abre desde Configuración; no hay carpetas
en la barra lateral. En móvil, el botón de menú abre un panel con fondo superpuesto,
control de foco y cierre con X, Escape, toque exterior o selección de sección.

Las carpetas conservan su navegación dentro de Temporizadores. La ruta pequeña solo
aparece dentro de carpetas; las tarjetas muestran el conteo numérico de temporizadores
directos. Las tarjetas de temporizadores muestran duración y bloques. La ubicación
raíz del selector Mover a se llama Sin carpeta.

Verificación del rediseño: barra abierta/plegada, sección activa y cambios de sección;
tres modos de cierre móvil; navegación de carpeta, traslado de un temporizador y
retorno a su ubicación original, diálogo de crear carpeta cancelado, acceso al
editor y reproductor. Medición del documento sin desbordamiento horizontal a 320,
360 y 800 px, e inspección de escritorio a 1280 px. Se conservan los controladores
de crear, editar, duplicar, eliminar y mover y las claves de datos existentes.
TypeScript, compilación y las 21 pruebas de regresión pasan; ESLint tiene cero
errores y seis advertencias preexistentes de Fast Refresh.

Proyecto conectado a [Lovable](https://lovable.dev/projects/4229b463-a795-47b6-9440-aa1660bf3ddf). Los cambios integrados en main se sincronizan con Lovable; conservar el historial publicado.

## Cuenta opcional y uso offline

La pantalla Configuración (`/settings`) agrupa Cuenta y Acerca de la app; indica
la versión y plataforma, y enlaza con la cuenta opcional (`/account`). La
configuración de Google/Supabase, el almacenamiento por cuenta y los resultados
de pruebas están en [ACCOUNT-SYNC.md](ACCOUNT-SYNC.md). Sin variables externas,
la aplicación mantiene el modo local. Para probar producción: `npm run build` y
`npm run preview` (http://127.0.0.1:4173). La preparación de Tauri para Windows
está en `DESKTOP-WINDOWS.md`; Android sigue pendiente.
