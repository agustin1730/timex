# Capa de escritorio para Windows (pendiente)

Esta app web contiene toda la interfaz y la lógica del temporizador. Para el
instalador de Windows falta agregar una capa de escritorio (Electron o Tauri)
que envuelva esta aplicación y provea:

1. Cerrar con la X oculta la ventana en la bandeja del sistema; el temporizador
   sigue corriendo.
2. Voz y notificaciones nativas de Windows aunque la ventana esté oculta.
3. Icono de bandeja para volver a mostrar la ventana.
4. Opción «Salir» que solo cierra si el temporizador está pausado o finalizado;
   si está en reproducción, avisa que hay que pausarlo primero.
5. Al salir, se detiene cualquier temporizador.

## Puente ya preparado en el código

`src/lib/announcer.ts` delega en `window.desktopTimer` si existe:

```ts
window.desktopTimer = {
  speak(text) {},        // voz nativa (SAPI / PowerShell / módulo TTS)
  notify(title, body) {},// notificación nativa de Windows
  setRunning(running) {},// informa al proceso principal si hay una cuenta activa
};
```

El reproductor llama a `setRunning(true/false)` en cada arranque y pausa, de modo
que el proceso principal puede bloquear la opción «Salir» mientras corre.

No verificable aquí: bandeja del sistema, notificaciones nativas, ejecución en
segundo plano con la ventana oculta y el instalador `.exe`.
