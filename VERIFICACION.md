# Verificación inicial de temporizadores individuales

Este informe corresponde a la primera entrega. La ampliación de secuencias y
sus resultados actuales se documentan en `VERIFICACION-SECUENCIAS.md`.

Fecha: 24 de septiembre de 2026.
Entorno: Windows, Node.js 24.16.0, npm 11.13.0, navegador integrado Chromium.
Servidor local: `http://127.0.0.1:8080/`.

## Resultados automatizados

- Instalación: 420 paquetes, auditoría de npm sin vulnerabilidades informadas.
- `npm test`: 13 pruebas aprobadas, ninguna fallida.
- `npm run typecheck`: aprobado. Se corrigió el acceso al parámetro de carpeta
  que incumplía `noPropertyAccessFromIndexSignature`.
- `npm run lint`: cero errores; seis advertencias preexistentes de Fast Refresh
  en componentes genéricos de UI. No impiden compilar ni ejecutar.
- `npm run build`: compilación de cliente, SSR y salida Nitro/Cloudflare aprobada.
  Advertencias del empaquetador sobre `vite-tsconfig-paths` y
  `inlineDynamicImports`; no son fallos de compilación.

Las pruebas en `tests/` cubren:

| Comportamiento      | Evidencia                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Ejemplo             | Orden exacto de los siete bloques, nombres, duraciones y repeticiones; 113 etapas y 630 segundos (10:30)                              |
| Siembra y migración | Cargas repetidas no duplican; nombre, repeticiones, ajustes y ubicación editados se preservan; una eliminación explícita no resiembra |
| Duplicación         | Nuevos identificadores y copia profunda; las modificaciones de etapas no afectan originales; ajustes y carpeta conservados            |
| Controles           | Siguiente y Anterior atraviesan todos los índices en ambos sentidos, activos y pausados, reiniciando cada etapa                       |
| Tiempo              | Pausa exacta, reanudación sin aviso repetido, reinicio, retraso de ticks y finalización única                                         |
| Avisos              | 113 eventos durante recorrido completo, incluidas etapas de 1 y 2 segundos; un solo evento final                                      |
| Sesión              | Copia profunda independiente de cambios al preset                                                                                     |
| Carpetas            | Máximo dos niveles, renombrado, movimientos y borrado del árbol; destinos inexistentes rechazados                                     |
| Adaptadores         | Cancelación de voz, permiso denegado o fallido, API no disponible y contrato del puente de escritorio con dobles de prueba            |

El recorrido completo de 630 segundos se verificó con reloj controlado, sin
esperar diez minutos reales. Los avisos se cuentan como llamadas; esto no demuestra
que el sistema operativo entregue una notificación o reproduzca audio.

## Pruebas realizadas en la interfaz real

- Apertura de la biblioteca: un ejemplo, 10 min 30 s, siete bloques y 113 etapas.
- Creación de carpeta y subcarpeta; dentro de la subcarpeta no se ofrece un tercer
  nivel. Renombrado de ambos niveles y navegación por las migas de ubicación.
- Temporizador nuevo con ambos interruptores activados. Desactivarlos, guardar y
  duplicar conserva los valores en la copia.
- Duplicar bloque lo coloca inmediatamente debajo. Editar su nombre, etapa y
  duración conserva los valores originales (Trabajo 1 s / copia Descanso 2 s).
- Duplicar temporizador lo deja en la misma subcarpeta. Editar la copia a seis
  segundos mantiene el original en tres segundos. Mover la copia a la biblioteca
  principal conserva el original en la subcarpeta.
- Reproductor: Siguiente/Anterior en pausa, Iniciar/Pausar, finalización real de
  tres segundos, indicador 00:03 / 00:03, botón «Volver a iniciar desde el
  principio» y Reiniciar devolviendo el estado pausado inicial.
- Sesión activa de 62 segundos: guardar en otra pestaña una versión de seis
  segundos con voz activada no cambia su duración ni sus avisos desactivados.
  Abrir una nueva sesión carga los seis segundos y la voz activada.
- Borrado de carpeta con una subcarpeta y un temporizador: el diálogo informa
  ambos conteos y que no se puede deshacer. Cancelar conserva todos los datos.
  La eliminación efectiva del árbol se verificó en las pruebas de almacenamiento.
- Cierre y reapertura de la pestaña: se mantienen carpeta y subcarpeta renombradas,
  temporizador, ubicación y copia movida. El ejemplo sigue siendo único.
- Inspección visual a 1280 × 720: biblioteca y navegación legibles.
- Consola tras corregir los diálogos y reabrir: sin errores capturados.

Se detectó realmente `prompt() is not supported` al intentar crear una carpeta;
se reemplazaron los prompts y confirmaciones por diálogos propios de la app.
Los datos de demostración quedan en el perfil local de prueba, no en el código
ni como temporizadores adicionales sembrados para otros usuarios.

## Límites de esta verificación

No se cerró el proceso del navegador ni se reinició Windows: la persistencia se
comprobó al cerrar y reabrir la pestaña en el mismo perfil y origen. El reinicio
de la aplicación nativa y del equipo pertenece a la matriz de escritorio.
No se certifican notificaciones nativas, voz con la ventana oculta, bandeja ni
instalador. Ver `DESKTOP-WINDOWS.md` para pruebas pendientes.
Las secuencias de varios temporizadores siguen expresamente fuera de alcance.
