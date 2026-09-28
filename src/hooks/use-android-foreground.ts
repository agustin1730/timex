import { useEffect } from "react";
import { isAndroidApp } from "@/lib/platform";

/** The first Android candidate only plays in the foreground. */
export function useAndroidForeground(onHide: () => void) {
  useEffect(() => {
    if (!isAndroidApp()) return;
    const changed = () => {
      if (document.hidden) onHide();
    };
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, [onHide]);
}
