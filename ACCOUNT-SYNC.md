# Cuenta y sincronización — 25/09/2026

## Implementación

La aplicación existente es web (React/TanStack Start). Ahora hay una estructura Tauri para Windows (ver DESKTOP-WINDOWS.md), sin cliente Android ni Electron. Cuenta es opcional; biblioteca, editores y reproductores no tienen restricciones de sesión. Supabase Auth usa Google OAuth con PKCE y retorno web /auth/callback. No se solicita contraseña de Google.

Los datos anteriores del invitado mantienen sus claves originales de localStorage. Cada cuenta tiene un espacio independiente por el ID de Supabase. Los IDs existentes se conservan; los nuevos usan UUID. Se guardan carpetas, temporizadores, secuencias, ajustes y referencias, nunca el estado de una reproducción. Los reproductores mantienen su copia de sesión.

Cada cambio se escribe primero localmente. Una biblioteca versionada se envía en una transacción con revisión esperada (compare-and-swap); los conflictos se comparan contra la última base conocida. Las eliminaciones son registros nulos persistentes para evitar resurrecciones. No se purgan automáticamente. Se reintenta al recuperar conexión, volver a la ventana y periódicamente mientras está visible.

La primera conexión pide incorporar la biblioteca invitada o conservar únicamente la biblioteca de la cuenta. No modifica la biblioteca invitada. Los posibles duplicados por nombre con IDs distintos y los cambios incompatibles requieren una decisión explícita. La revisión pendiente persiste tras recargar. Se puede conservar ambas bibliotecas (se copian los registros locales con nuevos IDs y referencias remapeadas), conservar los registros distintos o elegir una biblioteca completa con confirmación. Se respaldan las versiones antes de resolver. Las claves de respaldo comienzan por intervalos.library.v1:<ID>:backup; no se borran automáticamente. Los editores abiertos bloquean el guardado si el registro cambió desde que se abrió, conservando el borrador en pantalla.

Cerrar sesión con cambios pendientes requiere sincronizarlos o elegir conservarlos en este dispositivo. Se oculta la biblioteca de la cuenta; al volver a esa cuenta se recuperan los pendientes. Otra cuenta y el invitado no los ven. El almacenamiento web del dispositivo no es una bóveda cifrada. No borrar los datos del sitio si hay cambios pendientes.

## Configuración externa necesaria

1. Crear un proyecto de Supabase. Ejecutar `supabase/migrations/202609250001_account_sync.sql` en su SQL Editor. La tabla tiene RLS por auth.uid(), incluso para INSERT/UPDATE; los anónimos no pueden leer ni ejecutar el RPC. La biblioteca se limita a 10 MB por escritura.
2. En Google Cloud configurar la pantalla de consentimiento y un cliente OAuth de tipo aplicación web. Si está en modo de prueba, agregar los usuarios de prueba. Usar los orígenes web reales de la app; para desarrollo, el origen usado aquí es `http://127.0.0.1:8080`.
3. Copiar de Supabase Auth > Providers > Google la URL de callback del proveedor. Registrar ESA URL como URI de redirección autorizada en Google (formato `https://<referencia-real-del-proyecto>.supabase.co/auth/v1/callback`). El texto entre ángulos es un marcador, no un valor utilizable.
4. Activar Google en Supabase y cargar allí el Client ID y Client Secret de Google. El secreto nunca va en este repositorio ni en variables VITE_.
5. En Supabase Auth > URL Configuration configurar Site URL con el origen de producción real y permitir sus retornos `/auth/callback`. Para desarrollo agregar `http://127.0.0.1:8080/auth/callback`; si se prueba preview, también `http://127.0.0.1:4173/auth/callback`. Mantener el mismo origen entre inicio y retorno de PKCE (localhost y 127.0.0.1 son distintos).
6. Copiar `.env.example` a `.env.local`; completar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY desde el dashboard. La clave publishable es pública; NO usar service_role ni claves secretas. Reiniciar el servidor y reconstruir producción después de configurarlas.
7. Ejecutar `npm run dev` para desarrollo; `npm run build` y `npm run preview` para probar producción. Preview sirve el shell SPA en 127.0.0.1:4173. El alojamiento de producción debe servir `.output/public`, con fallback a `_shell.html` para rutas sin archivo y HTTPS.

Documentación oficial: https://supabase.com/docs/guides/auth/social-login/auth-google y https://supabase.com/docs/guides/database/postgres/row-level-security.

## Sin conexión

Producción registra un service worker que precarga el shell y los recursos de todas las rutas. Después de una primera carga online completa puede reabrirse y navegar sin servidor. No guarda respuestas de autenticación ni API en la caché. La sesión y bibliotecas se conservan separadamente en almacenamiento local. No se promete una primera instalación sin internet. El servidor de desarrollo no instala el service worker. Las actualizaciones del shell se activan al cerrar las pestañas anteriores.

## Verificación ejecutada

- 37 pruebas automatizadas pasan: regresiones de temporizadores/secuencias, importación por ID, dos dispositivos simulados, modificaciones concurrentes, caída de red, reintento, propagación de eliminaciones, copias remapeadas, revisión persistente, aislamiento de cuentas, cuota de almacenamiento y guardado de editor obsoleto.
- La migración exacta se ejecutó en PostgreSQL local PGlite: roles autenticados A/B aislados, inserción ajena rechazada, anonimato sin acceso, borrado físico denegado y actualización con revisión atómica. Esto no equivale a verificar un proyecto Supabase desplegado.
- TypeScript y build correctos. ESLint sin errores; seis advertencias preexistentes de Fast Refresh en componentes UI.
- Prueba web de producción con el servidor apagado: reapertura del shell y navegación a la biblioteca y al editor; Cuenta disponible sin configuración externa.

## Pendiente de verificar con infraestructura real

No se crearon credenciales ni se probó un login real. Con la configuración anterior hay que validar Google -> callback, importación de datos existentes, edición offline con sesión real, recuperación de conexión, dos navegadores/dispositivos, cierre con pendientes y cambio de dos cuentas Google sin mezcla. Las pruebas automatizadas del motor no sustituyen este recorrido.

Windows instalado: existe la preparación de Tauri, aún sin compilación nativa verificada. Se necesita implementar y registrar retorno OAuth desde navegador del sistema (deep link/loopback y PKCE), almacenamiento de sesión apropiado, y probar instalador, notificaciones nativas, bandeja y voz oculta. El flujo web rechaza un entorno Tauri no configurado, no simula éxito.

Android: el esquema de biblioteca y protocolo de sincronización son compartibles; no existe cliente Android ni está probado su OAuth, almacenamiento o retorno de login.
