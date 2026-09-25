# Verificación de secuencias guardadas

## Editor compacto — 24/09/2026

- Retirados el formulario grande y la creación de tramos. Nombre, duración reactiva,
  Guardar y Ejecutar en la cabecera; menú Agregar y tarjetas adaptables.
- Temporizadores muestran nombre, duración y bloques. El lápiz abre el editor del
  temporizador original en otra pestaña para conservar el borrador de secuencia.
- Transiciones se editan dentro de su tarjeta, con avisos propios. En móvil las
  tarjetas se despliegan al tocarlas. Flechas con límites y quitar por elemento.
- Migración automática de tramos antiguos a elementos explícitos, respaldo previo
  local y aviso en las secuencias convertidas. Mantiene orden, duración y avisos.
- 24 pruebas automatizadas aprobadas: incluye conversión fiel e idempotente,
  persistencia, independencia de transiciones y conservación ante datos inválidos
  o falta de espacio para respaldar.

### Comprobación manual del editor nuevo

- Escritorio 1280 × 800 y móvil 360 × 780: tarjetas compactas, expansión móvil,
  edición, botones accesibles, flechas desactivadas en extremos, sin desborde (360/360 px).
- Agregar HIIT y transición: total 8:00; cambiar transición a 45 s: 8:15.
  Subir/bajar conserva elementos y sus avisos. Guardar y recargar conserva el orden.
- Crear un temporizador de prueba en biblioteca, agregarlo a secuencia y abrir su
  editor con el lápiz. Guardar cambio de 3 a 5 s actualiza el borrador de secuencia
  de 5 a 7 s, manteniendo la transición de 2 s y sin perder elementos sin guardar.
- Quitar elementos recalcula total. Ejecutar guarda y abre reproductor; Siguiente
  pasa a temporizador de 5 s, Anterior vuelve a transición. Ejecución completa de
  7 s termina y ofrece volver al principio. Pruebas sin avisos activados.
- La secuencia previa «Entrenamiento lunes» conserva 20:00, Tren superior → HIIT;
  no contenía tramos. Migración de tramos verificada con fixtures aislados.
- Se eliminaron solamente el temporizador y la secuencia QA creados para esta prueba.
- Durante la incorporación del menú apareció un error de React por recarga de
  dependencias en desarrollo; se verificó nuevamente desde una carga limpia.
- Se retiró el rótulo obsoleto «Tramo» del contexto del reproductor, sin cambiar su motor.

Los apartados siguientes documentan la versión anterior con tramos; esa interfaz
ha sido reemplazada. Las pruebas de compatibilidad del motor se conservan.

## Cambios integrados

- Biblioteca con pestañas Temporizadores y Secuencias; carpetas originales conservadas.
- Secuencias sin carpetas, con creación, nombre editable, renombrado, duplicación,
  eliminación y reproducción. Referencias a temporizadores repetibles y transiciones
  con duración y avisos propios.
- Tramos consecutivos explícitos, sin anidación ni superposición. Reordenar elementos,
  reordenar tramos, quitar elementos y desagrupar. Se rechazan repeticiones inválidas
  y referencias inexistentes; no quedan tramos vacíos después de eliminar referencias.
- Motor común `TimelineSession`: misma navegación por etapa y mismo reloj para
  temporizadores individuales y secuencias. Cada ejecución de una secuencia captura
  las versiones actuales; las ediciones posteriores no alteran esa captura.
- Avisos por etapa y un único final de secuencia, siguiendo los ajustes de la última
  etapa. Ningún final intermedio detiene el motor.
- Eliminación de temporizador o carpeta con nombres de secuencias afectadas;
  limpieza de todas sus referencias y conservación del resto de sus elementos.
- Persistencia en claves nuevas de localStorage; no se modifican presets al crear
  secuencias. Los editores antiguos no pueden restaurar referencias a temporizadores
  que fueron eliminados mientras estaban abiertos.

## Pruebas automatizadas

`npm test`: **21 pruebas aprobadas**, incluidas las 13 pruebas anteriores.

Las ocho nuevas pruebas comprueban:

1. Ejemplo A → Preparación 30 s → A: **1290 segundos (21:30), 227 etapas**,
   claves de etapa distintas y siembra única sin alterar temporizadores existentes.
2. Tramo de temporizador + transición ×2: orden, repeticiones internas, cálculo,
   voz y notificaciones por origen, rechazo de rangos ambiguos.
3. Siguiente/Anterior en cada límite de bloques, temporizadores, transiciones y
   tramos; activos y pausados; cada destino empieza con su duración completa.
4. Ejecución automática con un evento por etapa, un solo final y reinicio posterior.
5. Referencias actualizadas frente a captura de sesión y duplicación independiente.
6. Eliminación de todas las apariciones de un temporizador, avisos por nombre,
   limpieza de tramos vacíos y prevención de referencias restauradas por un editor viejo.
7. Borrado de carpeta con subcarpeta: referencias eliminadas y otros presets preservados.
8. Rechazo de secuencias/tramos vacíos, referencias ausentes y transiciones inválidas.

El motor se prueba con reloj controlado. Los avisos se verifican como eventos y
llamadas de adaptadores, sin certificar entrega nativa de Windows o audio audible.

## Comprobaciones en navegador

- Ejemplo visible con 21 min 30 s; las carpetas y temporizadores previos permanecen.
- Temporizador de prueba de 1 s más transición de 2 s, tramo ×2: total 6 s.
- Interruptores de la transición activados inicialmente y editables individualmente.
- Siguiente y Anterior cruzan transición → segunda repetición y vuelven a la etapa
  anterior en pausa, con tiempos completos y contexto correcto.
- Ejecución real del tramo: final automático 00:06 / 00:06 y botón para volver al inicio.
- Cambio del temporizador a 60 s: próxima ejecución de 2:04. Guardarlo en otra
  pestaña con 2 s durante la reproducción no altera esa sesión de 2:04.
  Reiniciar e Iniciar toma los cambios y muestra 8 s; Pausar funciona.
- Duplicación y renombrado de secuencia; editar la transición y reordenar la copia
  produce 10 s mientras el original conserva su orden y sus 8 s.
- Advertencia al borrar temporizador de prueba lista las dos secuencias que lo usan;
  cancelar conserva el temporizador. Advertencia de carpeta lista la secuencia de
  ejemplo y los conteos del árbol; cancelar conserva el contenido.
- Cierre de una pestaña y apertura de una nueva en el mismo perfil y origen:
  persisten el ejemplo, ambas secuencias, nombres, tramos, orden y duraciones.
- Consola de la pestaña de comprobación: sin errores capturados. Revisión visual
  del editor y sus tramos en el navegador integrado.

Los datos con prefijo QA son datos locales de prueba creados durante la verificación;
no se incluyen en la siembra de la aplicación. Las eliminaciones confirmadas y la
limpieza de referencias se verificaron con almacenamiento aislado en las pruebas.

## Comprobaciones del proyecto

- `npm run typecheck`: aprobado.
- `npm run lint`: cero errores; seis advertencias preexistentes de Fast Refresh.
- `npm run build`: cliente, SSR y Nitro/Cloudflare compilados. Persisten las
  advertencias de configuración de Vite sobre tsconfig paths e inlineDynamicImports.

## Pendiente en Windows instalado

Notificaciones nativas, voz con la ventana oculta, cancelación nativa, bandeja,
precisión bajo suspensión, reapertura del proceso y persistencia tras reiniciar el
sistema, instalación y actualización. Probar especialmente pasos cortos al cruzar
tramos y temporizadores con ajustes de avisos diferentes. Ver `DESKTOP-WINDOWS.md`.
La reapertura comprobada aquí es de pestaña; no se certifica cierre del proceso
completo del navegador ni reinicio del sistema operativo.

## Reproductor con línea de tiempo — 24/09/2026

- Cabecera compacta: volver, nombre y duración total de la sesión.
- Una sola línea de segmentos por elemento ejecutado, sin dividir bloques.
  Segmentos iguales para mantener legibilidad; el relleno de cada uno es el tiempo
  transcurrido dentro del elemento dividido por su duración real completa.
- Borde naranja en el elemento actual, completados rellenos y pendientes vacíos.
  Saltar atrás recalcula los estados; Reiniciar vuelve todos a cero.
- La vista usa solo las etapas capturadas por TimelineSession. No consulta presets
  editables durante la reproducción ni modifica el motor, voz o notificaciones.
- Etapa y reloj como foco; bloque/repetición y siguiente etapa; controles y teclado
  conservados. Se retiraron contadores técnicos duplicados.
- 26 pruebas automatizadas aprobadas. Nuevas pruebas para seis temporizadores y
  dos transiciones, repeticiones internas, progreso fraccionario, pausa, navegación
  en ambos sentidos, reinicio y final con todos los segmentos al 100%.
- Prueba manual con ocho elementos (34 s): temporizadores de dos etapas (2+3 s)
  y transiciones de 2 s. Siguiente da 40% tras la primera etapa; al entrar en la
  transición cambia a 3 de 8 y empieza en cero. Anterior recupera el temporizador.
  Pausar mantiene el 45% observado; Reiniciar muestra ocho ceros.
- Escritorio y móvil 360 px revisados: ocho segmentos sin nombres comprimidos,
  contexto debajo, controles compactos y sin desbordamiento horizontal.
- Typecheck, lint y build aprobados. Lint conserva seis advertencias preexistentes.
- Sigue pendiente la validación de voz y notificaciones nativas, bandeja y ventana
  oculta en la aplicación instalada de Windows.
- Ejecución manual completa de 34 s finalizada correctamente, ocho segmentos completos y opción de volver al inicio. Consola sin errores. Se retiraron los dos registros QA creados para esta comprobación.
