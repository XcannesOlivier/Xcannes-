import { useEffect, useRef } from "react";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export function useEodWsSubscription({
  connected,
  subscribe,
  unsubscribe,
}) {
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!connected || isSubscribedRef.current) {
      if (DEBUG_LOGS) {
        console.log("[EOD] ⏭️ Skip subscription:", {
          connected,
          alreadySubscribed: isSubscribedRef.current,
        });
      }
      return;
    }

    if (DEBUG_LOGS) {
      console.log('[EOD] 🔌 Abonnement unique au canal "eod-summary"');
    }
    isSubscribedRef.current = true;
    subscribe("eod-summary", "all");

    return () => {
      if (DEBUG_LOGS) {
        console.log('[EOD] 🔌 Désinscription du canal "eod-summary"');
      }
      isSubscribedRef.current = false;
      unsubscribe("eod-summary", "all");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);
}

