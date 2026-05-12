import { useState, useRef, useCallback } from "react";

/**
 * useFlashNotice — gestion d'une notification flash temporaire (shareNotice).
 *
 * Retourne :
 *   notice      — texte affiché (string)
 *   noticeTone  — "success" | "error"
 *   flashNotice — (message, { tone?, autoClose?, onAutoClose? }) => void
 *   resetNotice — réinitialise l'état et annule le timer
 */
export function useFlashNotice() {
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("success");
  const timerRef = useRef(null);

  const resetNotice = useCallback(() => {
    setNotice("");
    setNoticeTone("success");
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flashNotice = useCallback(
    (message, { tone = "success", autoClose = true, onAutoClose } = {}) => {
      const text = String(message || "").trim();
      if (!text) return;
      setNotice(text);
      setNoticeTone(tone === "error" ? "error" : "success");
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!autoClose) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onAutoClose?.();
      }, 1100);
    },
    [],
  );

  return { notice, noticeTone, flashNotice, resetNotice };
}
