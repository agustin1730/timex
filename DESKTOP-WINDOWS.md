# Windows: integración y verificación pendientes

Esta entrega es una aplicación web. No incluye Electron/Tauri, instalador ni
implementación nativa del puente. Ejecutar el sitio desde un navegador en Windows
no verifica las funciones de escritorio.

## Contrato del puente

`src/lib/announcer.ts` admite `window.desktopTimer`:

```ts
window.desktopTimer = {
  speak(text) {},
  stopSpeaking() {}, // cancelar la locución nativa anterior, sin encolarla
  notify(title, body) {},
  setRunning(running) {},
};
```

El reproductor cancela voz al cambiar de etapa, reiniciar, pausar y abandonar la
sesión. Informa actividad al iniciar, pausar, finalizar o desmontarse. El permiso
del navegador no se solicita cuando el puente implementa notificaciones.
Se verificó el contrato con dobles de prueba, no con una implementación nativa.

## Matriz pendiente en la aplicación de escritorio real

- Notificaciones nativas habilitadas/deshabilitadas por temporizador; permisos de
  Windows, No molestar, avisos de etapas de 1 y 2 segundos y final único.
- Voz nativa y cancelación inmediata al cambiar de etapa, con ventana visible y
  oculta. No acumular locuciones atrasadas.
- Cerrar con X oculta la ventana en la bandeja y mantiene el motor ejecutándose.
- Icono de bandeja vuelve a mostrar la ventana y refleja el estado correcto.
- Salir solicita pausar una sesión activa; salir realmente detiene voz y motor.
- Precisión con ventana minimizada/oculta, suspensión y reanudación del equipo.
  Definir política de suspensión antes de prometer avisos en esos escenarios.
- Persistencia después de cerrar el proceso, reiniciar Windows y actualizar la app.
- Instalador, primera instalación, actualización y desinstalación; conservación
  de datos según la política elegida.

Las secuencias ya forman parte de la versión web. En Windows instalado también
se deben probar los cruces automáticos entre temporizadores y transiciones,
los ajustes por etapa, la cancelación de voz en etapas cortas y un solo aviso
al finalizar toda la secuencia. La copia de sesión debe mantenerse al ocultar
la ventana, incluso si se editan los presets guardados.
