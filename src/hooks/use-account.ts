import { useSyncExternalStore } from "react";
import { accountSnapshot, watchAccount } from "@/lib/sync/account";
export function useAccount() {
  return useSyncExternalStore(watchAccount, accountSnapshot, accountSnapshot);
}
