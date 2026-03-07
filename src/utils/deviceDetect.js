/**
 * deviceDetect — Shared device-type detection utility
 *
 * Detects mobile devices via User-Agent string.
 * Covers Android, iPhone, iPad (including iPad Pro with desktop UA),
 * iPod, and generic "mobile" tokens.
 *
 * NOTE: This detects the *device type*, NOT viewport size.
 * An iPad Pro in landscape reports a desktop viewport but IS a mobile device.
 * For viewport-based responsive logic, use CSS media queries or matchMedia.
 */

/**
 * @returns {boolean} true if the current device is a mobile/tablet
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /android|iphone|ipad|ipod|mobile/i.test(ua) ||
    (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1)
  );
}
