# Mapa técnico de Time X

Leé la sección de la función solicitada y después su código. Este mapa describe el estado actual; las decisiones de producto futuras se señalan al final.

## Entrada y pantallas

- React 19, TypeScript, TanStack Start/Router y Vite. `src/routes/__root.tsx` monta la navegación (`src/components/app-navigation.tsx`) y el contenido. Las rutas están en `src/routes/`; `src/routeTree.gen.ts` se genera y no se edita a mano. Configuración vive en `src/routes/settings.tsx` y la información de versión/plataforma en `src/lib/app-info.ts`. Componentes base: `src/components/ui/`; estilos: `src/styles.css`.
- Biblioteca y carpetas: `src/routes/index.tsx`. Editores: `editor.$timerId.tsx` y `sequence-editor.$sequenceId.tsx`. Reproductores: `play.$timerId.tsx` y `sequence-play.$sequenceId.tsx`. Secuencias: `sequences.tsx`. Configuración y Cuenta: `settings.tsx` y `account.tsx`.

## Datos y reproducción

| Necesidad | Fuente principal |
| --- | --- |
| Temporizador, bloques, etapas, duración y color | `src/lib/timer-model.ts`, `src/lib/stage-colors.ts` |
| Formato portátil JSON de temporizadores | `src/lib/timer-json.ts` |
| Secuencias, referencias por ID, transiciones y duración | `src/lib/sequence-model.ts` |
| Biblioteca local, carpetas, CRUD y migración de tramos antiguos | `src/lib/timer-storage.ts` |
| Cuenta y bibliotecas separadas por usuario | `src/lib/sync/`; detalles en `ACCOUNT-SYNC.md` |
| Reloj web, pausa, salto y copia de sesión | `src/lib/timer-session.ts` |
| Reloj nativo de Windows y mini widget | `src-tauri/src/native_session.rs`, `src-tauri/src/desktop.rs`, `public/widget.html`; puente en `src/lib/desktop-session.ts` |
| Sesión Android en segundo plano | `src-tauri/src/android_session.rs`, `src-tauri/android/AndroidSessionPlugin.kt`, `AndroidSessionService.kt`; inyección y pruebas en `scripts/android.ps1` |
| Posición y progreso de secuencias | `src/lib/sequence-timeline.ts` |
| Voz y avisos de navegador/Tauri | `src/lib/announcer.ts` |

El nombre visible es Time X. `src-tauri/tauri.conf.json` contiene el
nombre y versión de producto; el identificador Tauri `com.agustin1730.intervalos`,
el nombre de paquete Rust y las claves `interval-timers.*` permanecen históricos
por compatibilidad con instalaciones y bibliotecas ya existentes.

`TimerSession` y `TimelineSession` capturan los pasos al iniciar. Una edición guardada afecta la próxima ejecución. Las secuencias guardan referencias a temporizadores por ID y resuelven su versión actual al iniciar. La reproducción en curso no se sincroniza entre dispositivos.

El almacenamiento principal usa `localStorage` por origen/perfil: `interval-timers.v1`, `interval-timers.folders.v1` y `interval-timers.sequences.v1`, además de marcas de ejemplos y copias de migración. Accedé mediante `timer-storage.ts`; no escribas esas claves desde una pantalla. La capa `src/lib/sync/` separa invitado y cuentas, guarda cambios localmente y tiene código para sincronización; Google/Supabase aún requieren configuración externa y verificación real. El login obligatorio **no está decidido ni implementado**.

## Plataformas

- Web: voz y notificaciones dependen del navegador y sus permisos.
- Windows: Tauri 2 aporta instalador NSIS, bandeja, voz y notificaciones nativas. El motor Rust mantiene la sesión mientras la ventana principal está oculta; el reproductor React lee su estado mediante `desktop-session.ts`. El mini widget es una segunda ventana de la misma sesión. Consultá `DESKTOP-WINDOWS.md` antes de cambiar ciclo de ventana o avisos.
- La Configuración presenta Cuenta y Acerca de la app. `src/lib/app-info.ts` lee la versión nativa de Tauri cuando está disponible y distingue Web, Windows y Android.
- La importación/exportación JSON solo incluye temporizadores. El codec versionado está en `timer-json.ts`; las escrituras por lote pasan por `timer-storage.ts`. La biblioteca coloca importaciones en la ubicación abierta. La exportación de una tarjeta usa el mismo formato de arreglo que permitirá añadir exportación múltiple después.
- Android: candidata 0.27.2 pendiente de aceptación en el Poco M6 Pro (`ANDROID.md`). Entrada móvil en `src-tauri/src/lib.rs`; detección de plataforma en `src/lib/platform.ts`. Comparte modelos y almacenamiento con Windows. `desktop-session.ts` comunica los reproductores con el servicio nativo de primer plano; el servicio conserva el reloj y la notificación al ocultar la WebView. El plugin confirma el inicio solo después de crear el servicio y publicar su estado. `src-tauri/android/test/` cubre el contrato con pruebas JVM/Robolectric. Voz nativa en segundo plano y comportamiento físico con pantalla bloqueada siguen pendientes de prueba/implementación.

## Decisiones futuras, no funciones actuales

El proyecto mantiene un repositorio y lógica compartida, con versiones de Windows y Android publicadas en fechas distintas. El usuario prioriza uso local y prueba personalmente cada versión candidata. Quiere exportar/importar toda la biblioteca. Para una futura primera sincronización, conservar registros exclusivos de ambos dispositivos; Windows tiene prioridad ante cambios incompatibles del mismo registro, conservando la alternativa recuperable. Definir el flujo exacto antes de implementarlo. La app puede publicarse para otros usuarios más adelante; Supabase, tiendas y monetización no son requisitos de esta etapa.
