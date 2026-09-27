# Mapa técnico de Intervalos

Leé la sección de la función solicitada y después su código. Este mapa describe el estado actual; las decisiones de producto futuras se señalan al final.

## Entrada y pantallas

- React 19, TypeScript, TanStack Start/Router y Vite. `src/routes/__root.tsx` monta la navegación (`src/components/app-navigation.tsx`) y el contenido. Las rutas están en `src/routes/`; `src/routeTree.gen.ts` se genera y no se edita a mano. Componentes base: `src/components/ui/`; estilos: `src/styles.css`.
- Biblioteca y carpetas: `src/routes/index.tsx`. Editores: `editor.$timerId.tsx` y `sequence-editor.$sequenceId.tsx`. Reproductores: `play.$timerId.tsx` y `sequence-play.$sequenceId.tsx`. Secuencias: `sequences.tsx`.

## Datos y reproducción

| Necesidad | Fuente principal |
| --- | --- |
| Temporizador, bloques, etapas, duración y color | `src/lib/timer-model.ts`, `src/lib/stage-colors.ts` |
| Secuencias, referencias por ID, transiciones y duración | `src/lib/sequence-model.ts` |
| Biblioteca local, carpetas, CRUD y migración de tramos antiguos | `src/lib/timer-storage.ts` |
| Cuenta y bibliotecas separadas por usuario | `src/lib/sync/`; detalles en `ACCOUNT-SYNC.md` |
| Reloj, pausa, salto y copia de sesión | `src/lib/timer-session.ts` |
| Posición y progreso de secuencias | `src/lib/sequence-timeline.ts` |
| Voz y avisos de navegador/Tauri | `src/lib/announcer.ts` |

`TimerSession` y `TimelineSession` capturan los pasos al iniciar. Una edición guardada afecta la próxima ejecución. Las secuencias guardan referencias a temporizadores por ID y resuelven su versión actual al iniciar. La reproducción en curso no se sincroniza entre dispositivos.

El almacenamiento principal usa `localStorage` por origen/perfil: `interval-timers.v1`, `interval-timers.folders.v1` y `interval-timers.sequences.v1`, además de marcas de ejemplos y copias de migración. Accedé mediante `timer-storage.ts`; no escribas esas claves desde una pantalla. La capa `src/lib/sync/` separa invitado y cuentas, guarda cambios localmente y tiene código para sincronización; Google/Supabase aún requieren configuración externa y verificación real. El login obligatorio **no está decidido ni implementado**.

## Plataformas

- Web: voz y notificaciones dependen del navegador y sus permisos.
- Windows: Tauri 2 (`src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`) aporta instalador NSIS, bandeja, voz y notificaciones nativas. `announcer.ts` es el puente con el reproductor. Consultá `DESKTOP-WINDOWS.md` antes de cambiar ciclo de ventana o avisos.
- Android: aún no existe cliente instalado. Compartir modelos y reglas de negocio; implementar y comprobar por separado los servicios de segundo plano, controles en pantalla bloqueada y voz cuando se desarrolle la app.

## Decisiones futuras, no funciones actuales

El proyecto mantiene un repositorio y lógica compartida, con versiones de Windows y Android publicadas en fechas distintas. El usuario prioriza uso local y prueba personalmente cada versión candidata. Quiere exportar/importar toda la biblioteca. Para una futura primera sincronización, conservar registros exclusivos de ambos dispositivos; Windows tiene prioridad ante cambios incompatibles del mismo registro, conservando la alternativa recuperable. Definir el flujo exacto antes de implementarlo. La app puede publicarse para otros usuarios más adelante; Supabase, tiendas y monetización no son requisitos de esta etapa.
