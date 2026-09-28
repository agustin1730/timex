# Estado actual del proyecto

Este documento resume la estructura y el estado de Time X para iniciar una tarea
nueva sin reconstruir el contexto desde el historial del chat. Para las reglas
de trabajo, prevalece `AGENTS.md`; este archivo no autoriza cambios de producto.

## Versión y entrega

- Base funcional confirmada por el usuario: candidata **0.23.0**.
- Candidata actual en preparación para Windows: **0.24.0**, rama `codex/json-timer-import-export-0.24.0`.
- Rama publicada: [`codex/time-x-settings-0.23.0`](https://github.com/agustin1730/timex/tree/codex/time-x-settings-0.23.0).
- Incluye los dos commits de control del widget en reproductores de 0.22.1,
  todavía no integrados en `main`, y el commit de identidad/Configuración/widget
  de 0.23.0.
- El usuario instaló la candidata y confirmó que funciona. Esa confirmación no
  reemplaza la lista de verificaciones manuales específicas de Windows en
  `DESKTOP-WINDOWS.md`.
- El instalador local se generó en
  `src-tauri/target/release/bundle/nsis/Time X_0.23.0_x64-setup.exe`.
- El usuario todavía no instaló la candidata 0.24.0. No dar por integrado el
  cambio en `main` ni por sincronizado con Lovable hasta revisar/combinar su PR.

## Producto y plataformas

Time X es una aplicación local primero. El producto visible se llama **Time X**;
`intervalos`, `com.agustin1730.intervalos` y las claves `interval-timers.*` son
identificadores históricos que se preservan para no perder datos ni romper
actualizaciones. La versión web y Windows existen. Android es una meta futura;
no hay una aplicación Android publicada o verificada.

Temporizadores individuales, bloques, etapas coloreadas, carpetas de hasta dos
niveles y secuencias guardadas están implementados. En 0.24.0, importar
temporizadores se ubica en la biblioteca y exportar en cada tarjeta. La selección
múltiple para exportar queda para después; el formato usa desde el inicio una
lista de temporizadores para permitir esa ampliación. No agregar secuencias ni
cambios de esquema por inferencia: leer el pedido de la actualización vigente.

Windows usa Tauri 2. El motor Rust conserva la sesión cuando se oculta la ventana;
la bandeja y el mini widget son exclusivos de Windows. El widget es opcional y
apagado por defecto. El jugador permite mostrarlo/ocultarlo durante una sesión;
muestra etapa, cuenta regresiva, color y repetición del bloque. Los ajustes
visuales de Configuración no reemplazan los ajustes por temporizador.

## Navegación y ajustes 0.23.0

- La navegación principal ofrece Temporizadores, Secuencias y Configuración.
- Cuenta se abre dentro de Configuración. Configuración muestra Acerca de la app,
  versión y plataforma. La sesión de cuenta/sincronización continúa siendo
  opcional y depende de la configuración externa documentada en `ACCOUNT-SYNC.md`.
- El nombre visible cambia a Time X. Se conserva el identificador Tauri y el
  almacenamiento local existente.
- El mini widget muestra `Repetición X de Y`, compartiendo el mismo estado nativo
  que controla la sesión.

## Datos y límites de sesión

- Temporizadores, carpetas y secuencias web se persisten localmente en
  `localStorage` por origen/perfil. Windows tiene el perfil de almacenamiento de
  WebView2 separado; no importa automáticamente los datos de Chrome.
- Acceder a los datos mediante `src/lib/timer-storage.ts`; no leer/escribir las
  claves directamente desde componentes. Ver `README.md` para las claves.
- `TimerSession` y `TimelineSession` capturan la configuración al iniciar. Las
  ediciones posteriores se aplican a la próxima ejecución, no a una sesión viva.
- Las secuencias guardan referencias a temporizadores por ID y resuelven la
  versión guardada actual al comenzar la próxima ejecución. Las etapas de
  transición guardan sus propios ajustes de voz/notificación.
- Google/Supabase tienen código preparatorio, pero faltan configuración externa
  y pruebas reales del flujo. Sin ella, la app debe seguir siendo utilizable en
  modo local y offline.

## Mapa rápido de código

- Biblioteca/carpetas: `src/routes/index.tsx`.
- Configuración: `src/routes/settings.tsx`; datos de versión/plataforma en
  `src/lib/app-info.ts`.
- Cuenta: `src/routes/account.tsx`.
- Edición y reproducción individual: `src/routes/editor.$timerId.tsx`,
  `src/routes/play.$timerId.tsx`, `src/lib/timer-session.ts`.
- Edición y reproducción de secuencias: `src/routes/sequence-editor.$sequenceId.tsx`,
  `src/routes/sequence-play.$sequenceId.tsx`, `src/lib/sequence-timeline.ts`.
- Widget/ventanas/eventos de Windows: `src-tauri/src/native_session.rs`,
  `src-tauri/src/main.rs`, `src/lib/desktop-session.ts`, `public/widget.html`.
- Mapa completo: `ARCHITECTURE.md`. Reglas de cambios: `AGENTS.md`.

## Verificación de 0.23.0

Resultados documentados para la candidata 0.23.0: `npm test` (40 pruebas),
`npm run typecheck`, `npm run lint` (sin errores; seis advertencias existentes),
`npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml --release`
(cuatro pruebas) y `npm run desktop:build` aprobados. La pantalla Configuración
se revisó visualmente en 1440×900 y 390×844 sin desbordamiento horizontal; el
usuario confirmó que la aplicación instalada funciona.

Una prueba de navegador no verifica voz audible, notificaciones nativas,
interacción real con la bandeja, continuidad oculta ni actualización del
instalador. Consultar `DESKTOP-WINDOWS.md`; no declarar esos puntos aprobados
sin la prueba instalada correspondiente.

## Importación/exportación JSON 0.24.0

El formato portátil `time-x-timers` incluye versión y un arreglo `timers`. Cada
temporizador exportado omite IDs y carpeta local, e incluye nombre, bloques,
etapas, segundos, color y ajustes de voz/notificaciones. El importador acepta un
archivo `.json` de hasta 5 MB, máximo 500 temporizadores y hasta 100 000 etapas
expandidas en total. Rechaza el lote entero ante cualquier registro o
versión inválidos. Al confirmar el resumen, asigna IDs nuevos y guarda todos los
registros en una sola operación en la carpeta abierta; los nombres en conflicto
reciben el siguiente sufijo numérico libre. Las secuencias no cambian.

Verificación de 0.24.0: `npm run typecheck`, `npm run lint` (sin errores; seis
advertencias preexistentes), `npm run build` y `npm run desktop:build` pasaron.
No se ejecutó la suite `npm test` ni se recorrió la importación/exportación en
la aplicación instalada; esos comportamientos necesitan comprobación antes de
considerar estable la candidata.
