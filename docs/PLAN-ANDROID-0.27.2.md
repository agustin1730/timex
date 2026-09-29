# Recuperación Android 0.27.2 — plan y ejecución

Fecha: 29/09/2026. Rama existente: `codex/android-basic-apk`.

## Evidencia y límites

- El usuario confirma que instaló 0.27.1. El error actual es «No se pudo iniciar:
  No hay una sesión de Android activa». Prefiere probar mediante APK, sin USB.
- Los errores previos de ACL/nombre de comando cambiaron: el error actual se
  emite en `AndroidSessionPlugin.control`. No volver a atribuirlo a una APK vieja
  ni modificar permisos sin evidencia nueva.
- `AndroidSessionPlugin.start` solicita `startForegroundService` y responde
  inmediatamente con `snapshotJson`, antes de recibir confirmación del servicio.
  Los reproductores marcan la sesión como iniciada sin validar el ID o el estado
  recibido. Existe una carrera de inicio; no se obtuvo un registro del teléfono
  para confirmar que sea la única causa del fallo observado.
- `AndroidSessionService.onStartCommand` pasa acciones completas como
  `com.agustin1730.intervalos.PAUSE` a un controlador que espera `pause`.
  Los controles de la notificación tienen un defecto comprobable en el código.
- Al finalizar, `stopSelf` conduce a `onDestroy`, que borra `sharedState`;
  la pantalla puede perder el resultado y no mostrar el final correctamente.
- Las pruebas existentes cubren lógica web y Windows, pero no el plugin ni el
  servicio Kotlin. Una compilación correcta no prueba el arranque en Android.

## Alcance

Recuperar iniciar, pausar, reanudar, anterior, siguiente, reiniciar y finalizar
en temporizadores y secuencias Android, con una sesión nativa coherente y controles
de notificación funcionales. Mantener IDs, almacenamiento, datos y firma Android.
No ampliar funciones, añadir login o modificar la lógica Windows. La voz nativa
sigue perteneciendo a la segunda parte acordada de 0.27; esta corrección no la
declara implementada ni probada.

## Orden de implementación

1. **Reproducir antes de corregir.** Incorporar pruebas del código Kotlin real
   mediante pruebas Android de JVM (Robolectric o equivalente), conservadas en el
   repositorio e incorporadas por el script de generación. Cubrir inicio con
   servicio demorado y el recorrido plugin → servicio → respuesta. Comprobar
   también la serialización: `resolveObject(JSONObject)` debe sustituirse por
   el mecanismo de respuesta documentado de Tauri si no produce las claves
   esperadas. Hacer fallar la prueba con el código anterior.
2. **Confirmar el inicio.** Resolver la solicitud únicamente después de que el
   servicio haya validado la entrada, instalado su sesión y publicado la
   notificación de primer plano. Usar confirmación asíncrona con un límite de
   espera y error preciso; evitar una demora fija o bloquear el hilo principal.
   Validar el ID, índice, tiempo y estado de la respuesta antes de marcar el
   reproductor como iniciado. Una lectura sin sesión devuelve ausencia explícita,
   nunca un objeto de reproducción incompleto. Un fallo conserva la vista local
   válida y permite reintentar sin ejecutar dos relojes simultáneos.
3. **Corregir ciclo y controles.** Traducir los intents de notificación a las
   mismas acciones que usa la app. Mantener un único ciclo de reloj al iniciar,
   pausar y reanudar. Conservar el resultado final para que la interfaz lo lea y
   permitir iniciar desde cero después del final. Identificar lecturas y
   cancelaciones por ID para que una respuesta antigua no controle o detenga
   otra sesión. Resolver errores de creación del servicio sin éxito falso.
4. **Verificar y empaquetar una sola candidata.** Ejecutar las pruebas Kotlin,
   las pruebas pertinentes TypeScript/Rust, typecheck, lint y compilación Android.
   Conservar el empaquetado reproducible sin symlinks y verificar que la biblioteca
   y frontend incorporados son los recién construidos. Entregar 0.27.2 con
   versionCode superior, la misma firma e identificador; no pedir desinstalación.
   Actualizar `ANDROID.md`, `TESTING.md` y el mapa técnico con resultados reales.

## Casos de aceptación automatizados

- Primer inicio con servicio demorado; estado completo y mismo ID en la respuesta.
- Entrada inválida o arranque fallido: error preciso, reintento posible y estado
  existente conservado. Doble pulsación y cancelación durante el arranque.
- Pausa/reanudación sin duplicar el reloj; saltos desde la pantalla y notificación
  entre etapas, repeticiones, bloques, temporizadores y transiciones.
- Etapas de 1 y 2 segundos; sesión termina una vez y puede reiniciarse. El estado
  final permanece disponible después de detener el servicio.
- ID incorrecto, respuesta atrasada y parada antigua no alteran una sesión nueva.
- Ejemplos mantienen 10:30 y 21:30; formatos e IDs guardados permanecen intactos.

## Aceptación física pendiente

El Poco M6 Pro con Android 16/HyperOS es la aceptación final. Probar actualización
sobre 0.27.1 conservando la biblioteca; temporizador y secuencia; pausa, saltos y
reinicio desde pantalla y notificación; cambiar de app y bloquear; volver a la
app con etapa/tiempo correctos; final y nueva ejecución. Probar permisos denegados
y batería sin restricciones. Si falla, recoger el error y añadirlo a una prueba
antes de volver a entregar. Las pruebas JVM no certifican políticas de batería
Xiaomi, voz audible, notificación visible ni comportamiento físico bloqueado.

## Referencias verificadas

- Fuentes: `src-tauri/android/AndroidSessionPlugin.kt`,
  `src-tauri/android/AndroidSessionService.kt`, `src-tauri/src/android_session.rs`,
  `src/lib/desktop-session.ts` y ambos reproductores.
- Android: https://developer.android.com/develop/background-work/services/fgs/launch
- Tauri: https://v2.tauri.app/develop/plugins/develop-mobile/

Estado: implementación y candidata completadas. Pasaron siete pruebas Kotlin
Robolectric, 41 pruebas TypeScript, typecheck, lint sin errores y la compilación
Android. La APK 0.27.2 tiene el mismo identificador y certificado de la 0.27.1.
La aceptación en el Poco M6 Pro sigue pendiente; consultar `ANDROID.md`.
