# Verificación y entrega

Elegí pruebas por el código afectado. Documentá resultados reales y pendientes; no confundas pruebas del navegador con pruebas de Windows o Android.

## Comprobaciones disponibles

| Cambio | Verificación |
| --- | --- |
| Modelo, datos, temporizadores o secuencias | `npm test`, `npm run typecheck` |
| Interfaz o rutas | `npm run lint`, `npm run build` y recorrido visual en escritorio y ventana estrecha |
| Voz, avisos, bandeja o ciclo de ventana | Pruebas anteriores, pruebas Rust pertinentes y recorrido en Tauri instalado |
| Servicio y notificación Android | `testUniversalDebugUnitTest` en el proyecto generado, `npm test`, `npm run typecheck`, `npm run lint`, APK firmada y prueba en teléfono |
| Cuenta o sincronización | `tests/sync*.test.ts`, pruebas de aislamiento/conflicto y prueba con servicio real cuando esté configurado |

Tests actuales: `tests/timer.test.ts`, `storage.test.ts`, `sequence.test.ts`, `sequence-timeline.test.ts`, `announcer.test.ts` y `sync*.test.ts`. Los dobles de prueba no certifican voz audible, notificaciones nativas ni retorno real de Google. El workflow `.github/workflows/windows-0.24.0.yml` comprueba tipos, lint y compilaciones, y construye el instalador solo para la rama 0.24.0; aún no es un control general de todos los PR. Los resultados de la candidata están en `DESKTOP-WINDOWS.md` y `docs/ESTADO-PROYECTO.md`.

## Recorridos que protegen el producto

1. Con datos existentes, abrir, editar y guardar un temporizador; cerrar y reabrir sin perder temporizadores, carpetas, secuencias ni ajustes. Si cambia el formato, probar también datos de una versión anterior y recuperación de respaldo.
2. Ejecutar temporizador y secuencia: iniciar, pausar, reanudar, anterior, siguiente y reiniciar; cruzar etapas, repeticiones, bloques y elementos. Confirmar fin una sola vez y que editar el preset no altera la sesión activa.
3. En Windows, comprobar que una sesión continúa al ocultar la ventana y que puede recuperarse y controlarse desde la bandeja o el mini widget. Probar inicio, pausa, saltos, voz y avisos con el widget visible y oculto en el instalador real.
4. En Android, probar temporizador y secuencia con la app abierta, en segundo plano y con pantalla bloqueada. Los controles nativos, los avisos y la voz audible requieren un dispositivo real; Robolectric no los certifica.

## Publicación

Android básico: ver `ANDROID.md` para la compilación y aceptación en el Poco M6 Pro.
Para las pruebas Kotlin, primero ejecutar `scripts/android.ps1 init` para copiar
el servicio y los tests al proyecto generado, y después
`gradlew.bat -p src-tauri/gen/android testUniversalDebugUnitTest -x rustBuildUniversalDebug`.
La prueba `tests/platform.test.ts` protege la separación entre comandos Windows y
Android. Los recorridos con user-agent Android en Chrome solo verifican interfaz
y lógica compartida: no equivalen a instalar y ejecutar la APK.

Trabajar en una rama y presentar un PR con cambio, pruebas y riesgos. Ejecutar las comprobaciones pertinentes antes del instalador o APK. Mantener los datos y el identificador de la app durante una actualización; probar el instalador sobre una versión anterior con biblioteca existente. Entregar al usuario una versión candidata y una lista breve de acciones manuales. Solo después de su prueba tratarla como estable. Las actualizaciones automáticas y el aviso al abrir la app son requisitos futuros, no verificación actual.
