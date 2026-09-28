# Time X: primera APK interna

Objetivo: temporizadores y secuencias locales con la aplicación abierta y pantalla
encendida. Dispositivo de aceptación: Poco M6 Pro, Android 16 BP2A.250605.031.A3,
HyperOS 3.0.305.0. No requiere cable USB, cuenta ni Supabase. El usuario puede
descargar la APK en el teléfono mediante su Drive.

## Arquitectura

El mismo repositorio mantiene Windows y Android. `src-tauri/src/lib.rs` expone
la entrada móvil; `desktop.rs` conserva el código Windows, con dependencias de
bandeja y voz limitadas a ese sistema. `src/lib/platform.ts` evita enviar comandos
Windows desde Android. Android utiliza `TimerSession`/`TimelineSession` y el
almacenamiento local existente; los formatos e IDs no se modifican.

Esta candidata se pausa al recibir el evento de ocultación del documento; no
reanuda automáticamente al volver. Debe comprobarse ese evento en el teléfono.
No ofrece todavía servicio de segundo plano, voz nativa ni controles de bloqueo.
El widget sigue siendo exclusivo de Windows. La interfaz muestra estas limitaciones.

## Compilación en Windows

Requisitos: Node, Rust con `aarch64-linux-android`, Java 21, Android command-line
tools, SDK Platform 36, Build Tools 36.0.0 y NDK 27.2.12479018.
Configurar `JAVA_HOME`, `ANDROID_HOME` y `NDK_HOME`, o usar las herramientas
locales en `.android-tools/` (excluidas de Git).

Ejecutar `powershell -File scripts/android.ps1 build`. El script inicializa el
proyecto generado de Tauri si falta y construye una APK debug ARM64. La versión
Android 0.25.0 se define en `src-tauri/tauri.android.conf.json`, sin cambiar la
versión de Windows. El proyecto generado `src-tauri/gen/android` no se versiona.

Si Windows rechaza el enlace simbólico después de compilar Rust, el script copia
la biblioteca recién compilada a `jniLibs/arm64-v8a` y ejecuta Gradle excluyendo
solo la tarea Rust ya completada. Otros errores de compilación detienen el proceso.

La APK interna se firma con la clave debug local de Android. Mantener esa clave
fuera de Git para actualizar pruebas sin desinstalar y perder datos. No es una
entrega de Play Store: antes de distribuir públicamente se preparará una firma
release respaldada y un proceso de publicación.

## Candidata generada (28/09/2026)

APK debug ARM64 0.25.0, versionCode 25000, minSdk 26, targetSdk 36.
Archivo: `app/build/outputs/apk/universal/debug/app-universal-debug.apk` dentro
de `src-tauri/gen/android`. Tamaño 141850167 bytes (incluye símbolos debug).
SHA-256: `CA09293BB1ECF7A0BFB779E975AC4952EDECD7B6BB713E01F163E899EE23946D`.
`apksigner verify --verbose`: firma v2 válida; `aapt dump badging`: nombre,
versión y ABI correctos. Gradle terminó con BUILD SUCCESSFUL.

Verificación: 41 pruebas TypeScript, cuatro pruebas Rust Windows, typecheck,
compilación frontend y lint sin errores (seis advertencias existentes).
Recorrido Chrome a 390 px con plataforma Android simulada: biblioteca, reproducción,
pausa y saltos; secuencia cruzando los límites de transición; crear y guardar un
temporizador y recargar; sin errores JS ni desbordamiento en reproductores.
No se instaló en emulador ni teléfono. La biblioteca nativa de esta build tiene
alineación ELF de 4 KB; compatibilidad con dispositivos de páginas de 16 KB queda
pendiente antes de una distribución Android general.

## Aceptación pendiente en teléfono

Instalar; abrir sin internet; crear/editar y ejecutar temporizadores y secuencias;
probar pausa, saltos, reinicio y final; cerrar y reabrir conservando la biblioteca;
revisar teclado, menú móvil, colores y ausencia de desbordamiento. Confirmar pausa
al cambiar de app o bloquear. Importación/exportación con el selector Android
requiere prueba propia. Las comprobaciones web no certifican estos puntos.
