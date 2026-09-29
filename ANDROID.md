# Time X: APK interna

Objetivo de la candidata 0.27: temporizadores y secuencias locales con servicio
de primer plano. Dispositivo de aceptación: Poco M6 Pro, Android 16
BP2A.250605.031.A3, HyperOS 3.0.305.0. No requiere cuenta ni Supabase.

## Arquitectura

El mismo repositorio mantiene Windows y Android. `src-tauri/src/lib.rs` expone
la entrada móvil; `desktop.rs` conserva el código Windows, con dependencias de
bandeja y voz limitadas a ese sistema. `src/lib/platform.ts` evita enviar comandos
Windows desde Android. Android utiliza `TimerSession`/`TimelineSession` y el
almacenamiento local existente; los formatos e IDs no se modifican.

Desde 0.27, el reproductor solicita un servicio de primer plano nativo. En la
candidata 0.27.2, el plugin espera la confirmación del servicio antes de indicar
que la sesión comenzó. El servicio está diseñado para mantener el reloj al
bloquear la pantalla o cambiar de aplicación, pero falta validarlo en el teléfono.
La notificación persistente muestra etapa, tiempo restante,
repetición y barra de progreso, con Anterior, Pausar/Reanudar y Siguiente. El
canal no vibra y usa el sonido normal de Android cuando el volumen y el modo del
teléfono lo permiten. La voz nativa en segundo plano queda para la segunda parte.

En Xiaomi/HyperOS hay que abrir Ajustes → Apps → Time X → Batería y elegir
**Sin restricciones**; también conviene activar Inicio automático y permitir
notificaciones. La guía aparece en Configuración dentro de Android. El widget
sigue siendo exclusivo de Windows.

La web, Rust y la compilación no verifican el servicio real, la pantalla
bloqueada ni los controles de la notificación. Esos casos deben probarse con la
APK instalada en el Poco M6 Pro.

## Compilación en Windows

Requisitos: Node, Rust con `aarch64-linux-android`, Java 21, Android command-line
tools, SDK Platform 36, Build Tools 36.0.0 y NDK 27.2.12479018.
Configurar `JAVA_HOME`, `ANDROID_HOME` y `NDK_HOME`, o usar las herramientas
locales en `.android-tools/` (excluidas de Git).

Ejecutar `powershell -File scripts/android.ps1 build`. El script inicializa el
proyecto generado de Tauri si falta y construye una APK debug ARM64. La versión
Android 0.27.2 se define en `src-tauri/tauri.android.conf.json`, sin cambiar la
versión de Windows. El proyecto generado `src-tauri/gen/android` no se versiona.

Si Windows rechaza el enlace simbólico después de compilar Rust, el script copia
la biblioteca recién compilada a `jniLibs/arm64-v8a` y ejecuta Gradle excluyendo
solo la tarea Rust ya completada. Otros errores de compilación detienen el proceso.

La APK interna se firma con la clave debug local de Android. Mantener esa clave
fuera de Git para actualizar pruebas sin desinstalar y perder datos. No es una
entrega de Play Store: antes de distribuir públicamente se preparará una firma
release respaldada y un proceso de publicación.

## Candidata de recuperación 0.27.2 (29/09/2026)

La 0.27.1 instalada por el usuario mostraba «No hay una sesión de Android activa»
al intentar iniciar. La 0.27.2 espera el acuse del servicio, valida el estado y
su ID, descarta inicios tardíos y corrige las acciones de la notificación.
Conserva el estado final y permite iniciar nuevamente. Si el servicio desaparece,
la pantalla muestra el fallo y permite reintentar. La voz Android en segundo
plano todavía no está implementada.

APK de prueba: `Time-X-0.27.2-Android-prueba.apk`, versionCode 27002,
identificador `com.agustin1730.intervalos`, minSdk 26, ABI arm64-v8a.
SHA-256: `ED48BBF23805FFD5F3963893F5B99DE20A5B3CFB2FEE8E6256824ACD268E929A`.
`apksigner verify` pasó; el certificado SHA-256
`4AF176D85115D80E103C1BC2E22FD9BE93C3CE3CCF32E3EB53AEB363AE582406`
coincide con la APK 0.27.1 para actualizar encima sin desinstalar. La biblioteca
ARM64 embebida coincide byte a byte con la compilada. Pasaron siete pruebas
Robolectric del servicio/plugin, 41 pruebas TypeScript, typecheck, build web,
lint sin errores (seis advertencias previas) y compilación Android. Estas
comprobaciones no verifican el funcionamiento físico de la APK.

Instalar encima de 0.27.1 sin desinstalar y comprobar que la biblioteca siga
presente. Probar inicio de temporizador y secuencia, pausa/reanudación, saltos
desde la pantalla y la notificación, cambio de aplicación, pantalla bloqueada,
fin y nueva ejecución. Si aparece otro fallo, registrar el texto exacto.

## Candidata generada (28/09/2026)

APK debug ARM64 0.27.0, versionCode 27000, minSdk 26, targetSdk 36.
Archivo: `app/build/outputs/apk/universal/debug/app-universal-debug.apk` dentro
de `src-tauri/gen/android`. Tamaño 142008343 bytes (incluye símbolos debug).
SHA-256: `F0D076D5159E1D997A52D13EE1E2C42D84B6BE4FC6D32A6B9421FC781384A175`.
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
