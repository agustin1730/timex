# Intervalos (TimeX) — guía para agentes de código

Documento corto para **Claude Code, Codex, Cursor** y herramientas similares. Enfoque: **features de producto** (temporizadores, secuencias, UX). No sustituye el README ni los manuales especializados; solo enlaza.

| Documento | Contenido |
|-----------|-----------|
| [README.md](../README.md) | Producto, localStorage, secuencias, navegación, verificación |
| [DESKTOP-WINDOWS.md](../DESKTOP-WINDOWS.md) | Tauri, build de escritorio, pruebas Windows |
| [ACCOUNT-SYNC.md](../ACCOUNT-SYNC.md) | Supabase, cuenta, sync (fuera del alcance habitual de features) |
| [src/routes/README.md](../src/routes/README.md) | Convenciones TanStack Start (rutas file-based) |

---

## Qué es la app

**Intervalos** es una SPA de temporizadores por **bloques** y **etapas**, con **carpetas** (máx. 2 niveles), **secuencias** (timers + transiciones) y pantallas de **editor** y **reproducción** (voz/notificaciones según preset y entorno).

Stack: **React 19**, **TypeScript**, **TanStack Start + Router**, **Vite**, **Tailwind 4**, componentes **Radix/shadcn** en `src/components/ui/`. Escritorio opcional: **Tauri 2** (`src-tauri/`, producto “Intervalos”).

---

## Comandos (desde la raíz)

Requisito habitual: **Node.js 24**, `npm ci` para instalar.

| Comando | Uso |
|---------|-----|
| `npm run dev -- --host 127.0.0.1` | Desarrollo web |
| `npm test` | Tests del motor (`tests/*.test.ts`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Build web + script offline |
| `npm run preview` | Preview producción local |
| `npm run desktop:frontend` | Vite fijo en `127.0.0.1:1420` (Tauri dev) |
| `npm run desktop:dev` | App de escritorio en desarrollo |
| `npm run desktop:build` | Instalador (NSIS, ver DESKTOP-WINDOWS) |

Tras cambios de dominio o storage, correr **`npm test`** y **`npm run typecheck`** como mínimo.

---

## Mapa de carpetas

```
src/
  routes/           # Una ruta por archivo .tsx (ver tabla abajo)
  routeTree.gen.ts  # GENERADO — no editar
  components/
    app-navigation.tsx, account-boundary.tsx
    ui/             # shadcn; preferir reutilizar antes de inventar UI
  lib/
    timer-model.ts      # Tipos y helpers (Stage, Block, TimerPreset, Folder)
    timer-storage.ts    # localStorage, CRUD, secuencias, carpetas, subscribe()
    timer-session.ts    # TimelineSession, TimerSession (reproducción)
    sequence-model.ts   # Secuencias, validación, expansión de formatos viejos
    sequence-timeline.ts# Reproducción de secuencias
    announcer.ts        # Voz/notificaciones; puente Tauri (nativeSchedule, etc.)
    sync/               # Cuenta/nube — no tocar salvo tarea explícita de sync
  hooks/use-account.ts, use-mobile.tsx
src-tauri/            # Rust: tray, notificaciones nativas, TTS, IPC con el front
tests/                # Regresiones de timer, storage, secuencias, sync, announcer
scripts/              # build-offline, build-desktop, preview
```

Alias de imports: `@/` → `src/` (tsconfig/vite).

---

## Rutas (TanStack Start)

No uses `src/pages/`, `_app/` ni layouts estilo Next.js. Shell global: **`src/routes/__root.tsx`** (`QueryClient`, `AppNavigation`, `AccountBoundary`, `<Outlet />`).

| Archivo | URL |
|---------|-----|
| `index.tsx` | `/` — biblioteca y carpetas (`?folder=`) |
| `editor.$timerId.tsx` | `/editor/:timerId` |
| `play.$timerId.tsx` | `/play/:timerId` |
| `sequences.tsx` | `/sequences` |
| `sequence-editor.$sequenceId.tsx` | `/sequence-editor/:sequenceId` |
| `sequence-play.$sequenceId.tsx` | `/sequence-play/:sequenceId` |
| `account.tsx` | `/account` |
| `auth.callback.tsx` | `/auth/callback` |

Parámetros dináicos: **`$timerId`**, no `{timerId}`. Tras añadir rutas nuevas, el plugin regenera **`routeTree.gen.ts`** al build/dev — **no editarlo a mano**.

Navegación principal (`app-navigation.tsx`): **Temporizadores** (`/`) y **Secuencias** (`/sequences` y rutas `sequence-*`). Cuenta existe pero el producto puede marcarla como limitada en UI.

---

## Modelo mental (features)

1. **Preset** (`TimerPreset`): bloques → etapas con duración; flags de voz/notificaciones; `folderId`.
2. **Biblioteca**: lectura/escritura vía **`timer-storage.ts`**; otras pestañas notifican con **`subscribe()`**.
3. **Sesión de reproducción**: al abrir play se clona el preset en **`TimerSession`** / **`TimelineSession`**. Editar el preset guardado **no** muta una sesión ya abierta; hace falta nueva sesión.
4. **Secuencia**: lista ordenada de refs a timers + **transiciones** (duración y avisos propios). Duración total depende de **versiones actuales** de los timers referenciados.
5. **Avisos**: lógica en **`announcer.ts`**; en desktop, **`main.rs`** programa notificaciones/TTS vía IPC. No colgar avisos dentro de setState de React (el motor usa reloj monotónico en sesión).

Para detalle de reglas de negocio (pausa, reinicio, borrado con secuencias afectadas, migración de tramos repetidos), ver **README.md**.

---

## localStorage — cuidado extremo

Toda persistencia local principal pasa por **`src/lib/timer-storage.ts`** (y capa sync en `src/lib/sync/local.ts` si aplica cuenta). **No renombrar claves** ni cambiar formato sin migración explícita y tests.

| Clave | Rol |
|-------|-----|
| `interval-timers.v1` | Presets de temporizadores |
| `interval-timers.folders.v1` | Carpetas |
| `interval-timers.example.v2` | Marca del timer de ejemplo (no recrear si el usuario lo borró) |
| `interval-timers.sequences.v1` | Secuencias |
| `interval-timers.sequence-example.v1` | Marca del ejemplo de secuencia |
| `interval-timers.sequences.before-expansion.v1` | Backup antes de expandir tramos repetidos (`SEQUENCE_BACKUP_KEY`) |

Tauri puede crear **`intervalos.desktop-backup.v0.20.0`** (copia one-shot al abrir desktop, ver `account-boundary.tsx`). Claves sync de biblioteca: prefijo **`intervalos.library.`** (solo si trabajás sync; ver ACCOUNT-SYNC).

Reglas para agentes:

- Preferir **APIs exportadas** (`loadTimers`, `upsertTimer`, `loadSequences`, …) en lugar de leer/escribir claves directamente.
- Cambios de esquema: migración idempotente, tests en `tests/storage.test.ts` / `tests/sequence.test.ts`, conservar datos viejos o respaldo como ya hace el código de secuencias.
- No borrar claves de ejemplo/migración “por limpieza”.

---

## UI y convenciones

- Estilos globales: `src/styles.css`; util **`cn()`** en `src/lib/utils.ts`.
- Componentes base: **`src/components/ui/*`** (Button, Dialog, Sheet, etc.). Patrones de la app en rutas grandes (`index.tsx`, editores, play).
- Textos de producto en **español** (Argentina: “Creá”, “Agregar”, etc.) — mantener tono existente.
- Responsive: sidebar ≥768px; móvil usa **Sheet** para menú (`app-navigation.tsx`).
- Rutas nuevas: `createFileRoute` + `head()` para título/meta cuando corresponda, como en `index.tsx`.

---

## Escritorio (Tauri) — resumen

- Config: `src-tauri/tauri.conf.json` (dev URL `http://127.0.0.1:1420`, `frontendDist`: `dist-desktop`).
- Front detecta Tauri con **`__TAURI_INTERNALS__`** en `window`; **`announcer.ts`** expone `hasDesktopLayer()`, `nativeSchedule`, `speak`, etc.
- Lógica nativa (bandeja, cerrar ventana con sesión activa, notificaciones): **`src-tauri/src/main.rs`**.

Cambios que afecten avisos o ciclo de vida de ventana deben probarse en **`npm run desktop:dev`**. Detalle e instalador: **DESKTOP-WINDOWS.md**.

---

## Checklist — implementar una feature de temporizador/secuencia/UX

1. **Alcance**: ¿solo UI, solo modelo, o storage + sesión? Tocar la capa mínima.
2. **Rutas**: ¿archivo nuevo en `src/routes/` o extender uno existente? No editar `routeTree.gen.ts`.
3. **Datos**: cambios persistentes solo vía **`timer-storage.ts`** / **`timer-model.ts`** / **`sequence-model.ts`**; respetar claves y migraciones.
4. **Reproducción**: si afecta play o secuencias, revisar **`timer-session.ts`** y **`sequence-timeline.ts`** + **`announcer.ts`** (y Tauri si aplica).
5. **Multi-pestaña**: si cambia biblioteca, ¿hace falta **`subscribe()`** o ya está cubierto?
6. **Borrados**: si eliminás timer/carpeta, reutilizar **`affectedSequences`**, **`sequenceDeletionWarning`**, etc.
7. **Verificación**: `npm test`, `npm run typecheck`; probar flujo manual biblioteca → editor → play (y secuencia si aplica).
8. **Sync/cuenta**: no mezclar salvo requisito explícito; ver ACCOUNT-SYNC.md.

---

## Anti-patrones

- Crear **`src/pages/`** o layouts ajenos a TanStack Start.
- Editar **`src/routeTree.gen.ts`** manualmente.
- Escribir **`localStorage`** con claves `interval-timers.*` fuera de la capa de storage/sync probada.
- Acoplar lógica de countdown a renders de React en lugar de la sesión existente.
- Duplicar presets al referenciarlos desde secuencias (las secuencias guardan **ids**, no copias completas del timer).
- Ampliar alcance a Supabase/sync o scripts de Lovable sin pedido del usuario.

---

## Tests útiles por área

| Área | Archivos |
|------|----------|
| Modelo timer | `tests/timer.test.ts` |
| Storage / carpetas | `tests/storage.test.ts` |
| Secuencias | `tests/sequence.test.ts`, `tests/sequence-timeline.test.ts` |
| Avisos (dobles, no audio real) | `tests/announcer.test.ts` |
| Sync | `tests/sync*.test.ts` (solo si tocás sync) |

---

*Última alineación con el repo: app web + Tauri “Intervalos” 0.20.0, TanStack Start, persistencia local first.*
