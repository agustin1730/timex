# Time X para Windows

## Versión candidata 0.23.0: identidad, configuración y orientación del widget

La aplicación muestra el nombre **Time X** en la interfaz, la ventana, la bandeja y el instalador. Conserva el identificador `com.agustin1730.intervalos` y todas las claves locales existentes para que la actualización siga usando la biblioteca guardada. La nueva pantalla **Configuración** reúne el acceso a Cuenta y muestra la versión instalada y la plataforma.

El mini widget muestra la repetición actual del bloque debajo de la etapa, por ejemplo `Repetición 3 de 15`. Este dato forma parte de la misma copia de sesión que controla el reloj y se actualiza con Anterior, Siguiente y Reiniciar. La ventana crece 14 píxeles de alto para conservar legibilidad sin dejar de ser compacta.

Verificación de código: 40 pruebas web, comprobación de tipos, compilación web, lint sin errores y cuatro pruebas Rust en modo release. La pantalla Configuración se comprobó a 1440 × 900 y 390 × 844, sin desplazamiento horizontal. Pendiente para la versión candidata: instalar sobre 0.22.1 y confirmar visualmente el nombre, la biblioteca existente y la línea de repetición en el widget real.

## Versión candidata 0.22.1: control del widget en el reproductor

El botón **Mostrar/Ocultar mini widget** está junto a los controles de reproducción del temporizador y la secuencia, solo en Windows. Ya no ocupa el menú lateral. Funciona durante una sesión activa o pausada y refleja si la ventana del widget está visible, incluso después de cerrarla con la X. Se conserva la preferencia local de la versión anterior; no cambia el formato de temporizadores ni secuencias.

## Versión candidata 0.22.0: mini widget opcional

El mini widget de Windows se activa en el menú lateral (apagado por defecto) y aparece al iniciar una sesión. Muestra la etapa, el tiempo restante y Anterior/Pausar/Siguiente. Usa el color de la etapa; las transiciones de secuencia permanecen grises. La X lo oculta durante esa sesión; puede volver a mostrarse desde la bandeja o cambiando el interruptor. Al finalizar la sesión se oculta automáticamente. La voz sigue activa; las notificaciones de etapa se omiten mientras el widget está visible y vuelven en etapas futuras al ocultarlo.

El reloj y los controles de Windows viven en `src-tauri/src/native_session.rs`, independientemente de la ventana React. El reproductor principal y el widget muestran la misma sesión. Los temporizadores y secuencias guardados no cambian de formato. El ajuste local del widget usa `intervalos.widget.enabled.v1` y no se sincroniza.

Pruebas de código: ver el PR de esta versión para resultados de TypeScript, Rust, lint y compilación. El usuario confirmó en la versión instalada que el widget, sus controles y el comportamiento durante la sesión funcionan correctamente.

## Actualización 0.21.0: colores por etapa

Cada etapa de temporizador admite gris (predeterminado), rojo, amarillo, verde, violeta, azul o naranja. Los temporizadores anteriores sin campo de color se muestran en gris y se conservan sin reescribirlos. El editor muestra el color como fondo suave, borde lateral y selector circular. El paso expandido de reproducción transporta el nombre estable del color, por lo que las secuencias que ejecutan un temporizador y un futuro widget de Windows pueden usarlo; las transiciones todavía no tienen selector propio. El reproductor toma una copia del color al iniciar la sesión.

Verificación del código: 41 pruebas, comprobación de tipos, compilación web y lint sin errores. La prueba visual en navegador confirmó la paleta, el cambio de color y ausencia de desplazamiento horizontal a 390 px.

La compilación local de Tauri está bloqueada por Windows Code Integrity: `rustc.exe` no puede cargar `rustc_driver-573e106f78c6e3e0.dll` (eventos 3033 y 3077). GitHub Actions compiló correctamente el instalador NSIS en Windows (ejecución `36332165055`). Se instaló `Intervalos_0.21.0_x64-setup.exe` sobre 0.20.1, se comprobó que el ejecutable informa 0.21.0 y que abre sin servidor de desarrollo. El temporizador local existente conserva sus siete bloques y duración de 10:30; el editor muestra el selector gris en sus etapas sin reescribir el dato anterior. Se guardó una copia del perfil WebView2 antes de instalar. Falta probar manualmente la reproducción de etapas coloreadas y el comportamiento de voz y notificaciones en esta versión instalada.

## Versión anterior 0.20.1

La versión 0.20.1 usa Tauri 2 y se instala por usuario. El identificador estable es `com.agustin1730.intervalos`; conservarlo y aumentar la versión en `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json` permite instalar una actualización sobre la versión anterior sin cambiar el almacén local.

## Compilar e instalar

Requisitos instalados en la máquina de desarrollo:

1. Visual Studio Build Tools con **Desarrollo para el escritorio con C++**, MSVC y Windows SDK.
2. Rust estable para `x86_64-pc-windows-msvc` mediante rustup.
3. Node.js y las dependencias del proyecto (`npm ci`).

Comandos disponibles:

- `npm run desktop:dev`: abre el frontend y la ventana Tauri de desarrollo.
- `npm run desktop:build-web`: compila el frontend para Tauri.
- `npm run desktop:build`: genera el ejecutable y el instalador NSIS.
- `npm run desktop:info`: muestra el diagnóstico del entorno.

El instalador 0.22.0 se genera en `src-tauri/target/release/bundle/nsis/Intervalos_0.22.0_x64-setup.exe`. No incluye actualizador automático ni firma de código. Para actualizar manualmente, cerrar o detener la sesión activa si corresponde y ejecutar el instalador de la versión nueva sobre la instalada.

## Comportamiento de escritorio implementado

- Voz mediante el motor de texto a voz de Windows, con preferencia por una voz en español disponible.
- Notificaciones nativas al comenzar cada etapa y una notificación al terminar toda la sesión.
- Una sesión nativa controla reloj, avisos y widget independientemente del temporizador JavaScript de la interfaz. Al pausar, reiniciar o saltar de etapa se cancela el aviso anterior para evitar duplicados o locuciones atrasadas.
- Bandeja del sistema con **Mostrar Intervalos**, estado de la sesión y **Salir**.
- El clic normal, el doble clic y **Mostrar Intervalos** recuperan la ventana desde la bandeja.
- Pulsar el cuerpo de una notificación o su acción **Abrir Intervalos** recupera el reproductor activo; descartar la notificación no abre la ventana.
- La aplicación admite una sola instancia: volver a abrir el acceso directo recupera la ventana existente en lugar de iniciar otra copia.
- La X oculta la ventana cuando hay un temporizador o una secuencia en ejecución o pausada. Sin una sesión activa, la X cierra la aplicación.
- **Salir** desde la bandeja pide confirmación si hay una sesión activa.
- Si Windows suspende el equipo, al reanudar se descartan los avisos vencidos y solo se conserva el último que corresponda; no se reproduce una ráfaga de etapas antiguas.
- Temporizadores, carpetas y secuencias se guardan primero en el almacenamiento local de WebView2. La reproducción activa no se sincroniza.
- Antes de usar la versión de escritorio se conserva la copia local creada bajo `intervalos.desktop-backup.v0.20.0` cuando el almacenamiento lo permite.

La aplicación instalada usa un almacenamiento WebView2 propio. No importa automáticamente el `localStorage` de Chrome ni de la ventana web de desarrollo. Google y la sincronización de cuenta siguen fuera de esta entrega de Windows.

## Verificación realizada

- `npm run typecheck`: correcto.
- `npm test`: 38 pruebas correctas.
- `npm run lint`: sin errores; quedan seis advertencias preexistentes de Fast Refresh.
- `cargo test --release`: tres pruebas Rust correctas, incluidas la selección del aviso posterior a una suspensión, el estado de ventana y la activación de notificaciones.
- `npm run desktop:build`: correcto con Rust/Cargo 1.98.1 y MSVC.
- Instalación de `Intervalos_0.20.1_x64-setup.exe` sobre 0.20.0: correcta; el ejecutable instalado informa versión 0.20.1.
- Apertura de la aplicación instalada: correcta y sin servidor de desarrollo.
- Persistencia durante la actualización: comprobada; la aplicación volvió a abrir el temporizador local que estaba guardado antes de instalar 0.20.0.
- Reproducción instalada: comprobada con un temporizador activo.
- Notificación nativa: comprobada visualmente al cambiar de etapa, con el nombre de etapa, bloque y repetición.
- Instancia única: comprobada; abrir el ejecutable nuevamente mantuvo un solo proceso y reutilizó la ventana existente.
- Activación de notificación: comprobada mediante prueba Rust para clic en el cuerpo, acción **Abrir Intervalos**, descarte y acciones ajenas. El clic físico queda en la lista manual.

La compilación de pruebas Rust en modo debug fue bloqueada por Windows Application Control (error 4551); las mismas pruebas compilaron y pasaron en modo release.

## Pruebas manuales pendientes en Windows

Estas verificaciones necesitan interacción o percepción humana y no deben darse por aprobadas mediante pruebas automatizadas:

- Confirmar que la voz elegida se oye en español, que se corta inmediatamente al usar **Siguiente**, **Anterior**, **Pausar** y **Reiniciar**, y que etapas de uno o dos segundos no dejan locuciones atrasadas.
- Pulsar físicamente el cuerpo de una notificación y **Abrir Intervalos** para confirmar que Windows entrega ambos eventos y recupera el reproductor instalado.
- Cerrar con la X durante una sesión, recuperar la ventana desde el ícono de bandeja y confirmar que la reproducción continúa con la ventana oculta.
- Usar **Salir** en la bandeja durante una sesión y comprobar el diálogo de confirmación, tanto al cancelar como al aceptar.
- Probar suspensión y reanudación reales del equipo y la interacción con Asistente de concentración/No molestar.
- Probar instalación limpia, desinstalación y una segunda actualización futura. La actualización de una instalación existente ya fue comprobada.

Android, Google OAuth, sincronización remota, importación automática de datos del navegador, firma de código y actualizaciones automáticas no forman parte de la versión 0.20.1.
