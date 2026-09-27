<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Guía breve para trabajar en Intervalos

Un solo agente puede realizar una tarea completa. Estos archivos son instrucciones y mapas, no agentes adicionales.

1. Leé el pedido y después [ARCHITECTURE.md](ARCHITECTURE.md) solo en la sección afectada. Abrí los archivos de código vinculados y ampliá la búsqueda si aparece una dependencia. Usá `rg` para localizar símbolos; evitá releer todo el repositorio en cada tarea.
2. Conservá temporizadores, carpetas, secuencias y sus IDs. No cambies claves ni formatos guardados sin una migración idempotente, una copia recuperable y pruebas con datos anteriores. La sesión activa debe conservar su propia copia de la configuración.
3. Reutilizá el modelo, el motor de reproducción y los componentes existentes. Mantené la lógica común apta para Windows y un futuro Android; aislá los controles nativos de cada plataforma. El widget es exclusivo de Windows.
4. Corregí los fallos relacionados con el pedido y los problemas de estructura que impidan resolverlo bien. Si hace falta una reorganización grande, documentá motivo, alcance y costo estimado; avanzá dentro del trabajo autorizado. No refactorices áreas ajenas por rutina.
5. Seguí [TESTING.md](TESTING.md) según el riesgo del cambio. Un resultado web no verifica notificaciones, voz, bandeja ni instalación de Windows. Prepará un PR con las comprobaciones; el usuario prueba la versión candidata antes de considerarla estable.
6. Informá avances breves solo cuando haya un hallazgo, una decisión o una demora. Al cerrar, resumí cambios, pruebas reales y límites. Ahorrá tokens en lecturas y explicaciones repetidas, nunca omitiendo verificaciones que protegen datos o reproducción.

Estado del producto: uso local prioritario. Cuenta y sincronización tienen código preparatorio, pero requieren configuración externa y verificación real. Exportación/importación completa, Android y tiendas son trabajo futuro. No fuerces login en una función actual. Consultá [ACCOUNT-SYNC.md](ACCOUNT-SYNC.md) solo si la tarea toca cuenta o sincronización y [DESKTOP-WINDOWS.md](DESKTOP-WINDOWS.md) si toca Tauri.
