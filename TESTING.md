# Verificación y entrega

Elegí pruebas por el código afectado. Documentá resultados reales y pendientes; no confundas pruebas del navegador con pruebas de Windows o Android.

## Comprobaciones disponibles

| Cambio | Verificación |
| --- | --- |
| Modelo, datos, temporizadores o secuencias | `npm test`, `npm run typecheck` |
| Interfaz o rutas | `npm run lint`, `npm run build` y recorrido visual en escritorio y ventana estrecha |
| Voz, avisos, bandeja o ciclo de ventana | Pruebas anteriores, pruebas Rust pertinentes y recorrido en Tauri instalado |
| Cuenta o sincronización | `tests/sync*.test.ts`, pruebas de aislamiento/conflicto y prueba con servicio real cuando esté configurado |

Tests actuales: `tests/timer.test.ts`, `storage.test.ts`, `sequence.test.ts`, `sequence-timeline.test.ts`, `announcer.test.ts` y `sync*.test.ts`. Los dobles de prueba no certifican voz audible, notificaciones nativas ni retorno real de Google. El workflow `.github/workflows/windows-0.23.0.yml` construye el instalador solo para la rama 0.23.0; aún no es un control general de todos los PR. Los resultados de la candidata están en `DESKTOP-WINDOWS.md` y `docs/ESTADO-PROYECTO.md`.

## Recorridos que protegen el producto

1. Con datos existentes, abrir, editar y guardar un temporizador; cerrar y reabrir sin perder temporizadores, carpetas, secuencias ni ajustes. Si cambia el formato, probar también datos de una versión anterior y recuperación de respaldo.
2. Ejecutar temporizador y secuencia: iniciar, pausar, reanudar, anterior, siguiente y reiniciar; cruzar etapas, repeticiones, bloques y elementos. Confirmar fin una sola vez y que editar el preset no altera la sesión activa.
3. En Windows, comprobar que una sesión continúa al ocultar la ventana y que puede recuperarse y controlarse desde la bandeja o el mini widget. Probar inicio, pausa, saltos, voz y avisos con el widget visible y oculto en el instalador real.
4. Cuando exista Android, probar reproducción con la app abierta, en segundo plano y con pantalla bloqueada; voz y controles nativos se validan en un dispositivo real.

## Publicación

Trabajar en una rama y presentar un PR con cambio, pruebas y riesgos. Ejecutar las comprobaciones pertinentes antes del instalador o APK. Mantener los datos y el identificador de la app durante una actualización; probar el instalador sobre una versión anterior con biblioteca existente. Entregar al usuario una versión candidata y una lista breve de acciones manuales. Solo después de su prueba tratarla como estable. Las actualizaciones automáticas y el aviso al abrir la app son requisitos futuros, no verificación actual.
