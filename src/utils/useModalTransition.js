import { useCallback, useEffect, useRef, useState } from "react";

export function useModalTransition(
  open,
  {
    enabled = true,
    duration = 400,
    durationMobile = 500,
    mobileQuery = "(max-width: 767px)",
  } = {}
) {
  const [shouldRender, setShouldRender] = useState(Boolean(open));
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const getDuration = useCallback(() => {
    if (typeof window === "undefined") return duration;
    if (!durationMobile) return duration;
    return window.matchMedia(mobileQuery).matches ? durationMobile : duration;
  }, [duration, durationMobile, mobileQuery]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setShouldRender(Boolean(open));
      setIsClosing(false);
      return undefined;
    }

    if (open) {
      clearTimer();
      setShouldRender(true);
      setIsClosing(false);
      return undefined;
    }

    if (!shouldRender) return undefined;

    setIsClosing(true);
    const delay = getDuration();
    timerRef.current = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      timerRef.current = null;
    }, delay);

    return clearTimer;
  }, [open, enabled, getDuration, shouldRender]);

  useEffect(() => clearTimer, []);

  return {
    shouldRender: enabled ? shouldRender : Boolean(open),
    isClosing: enabled ? isClosing : false,
  };
}
