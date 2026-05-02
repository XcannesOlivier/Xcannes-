"use client";

import { useEffect, useState } from "react";

/**
 * useIsDesktop — Media query hook for responsive layouts
 *
 * Returns true when viewport width >= breakpoint (default: 768px).
 * Handles SSR gracefully (returns false initially).
 * Supports both modern and legacy matchMedia APIs.
 *
 * @param {number} breakpoint - Minimum width in pixels (default: 768)
 * @returns {boolean} - True if viewport >= breakpoint
 *
 * @example
 * const isDesktop = useIsDesktop();           // >= 768px
 * const isLargeDesktop = useIsDesktop(1024);  // >= 1024px
 */
function useIsDesktop(breakpoint = 768) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handleChange = () => setIsDesktop(media.matches);

    // Set initial value
    handleChange();

    // Modern API (Chrome 103+, Firefox 106+, Safari 14+)
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    // Legacy API fallback
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [breakpoint]);

  return isDesktop;
}

export default useIsDesktop;
