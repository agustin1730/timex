import { useEffect, useState } from "react";
import { PictureInPicture2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauriDesktop, setWidgetPreference, widgetPreference } from "@/lib/desktop-session";

export function PlayerWidgetButton({
  active,
  visible,
  onError,
}: {
  active: boolean;
  visible: boolean;
  onError: (message: string) => void;
}) {
  const [desktop, setDesktop] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isTauriDesktop()) return;
    setDesktop(true);
    void setWidgetPreference(widgetPreference()).catch((error) => onError(String(error)));
    // La preferencia se sincroniza una vez al abrir el reproductor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!desktop) return null;
  return (
    <Button
      size="lg"
      variant="ghost"
      disabled={!active || busy}
      aria-pressed={visible}
      onClick={() => {
        setBusy(true);
        void setWidgetPreference(!visible)
          .catch((error) => onError(String(error)))
          .finally(() => setBusy(false));
      }}
    >
      <PictureInPicture2 className="mr-1 h-5 w-5" aria-hidden="true" />
      {visible ? "Ocultar mini widget" : "Mostrar mini widget"}
    </Button>
  );
}
