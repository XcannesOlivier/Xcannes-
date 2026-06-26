"use client";

const BASE_PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: "Manrope", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  h2 { font-size: 14px; margin: 16px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; }
  .meta { margin-bottom: 12px; font-size: 12px; }
  .meta div { margin-bottom: 2px; }
  .muted { color: #666; }
  .right { text-align: right; }
  .small { font-size: 11px; }
  @media print { body { padding: 0; } }
`;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fallbackHash(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

export async function sha256Hex(input) {
  if (typeof window === "undefined") return "";
  if (window.crypto?.subtle?.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(input || ""));
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return fallbackHash(String(input || ""));
}

export function buildFullHtml({ title, bodyHtml, styles = "" }) {
  const safeTitle = escapeHtml(title || "XCANNES Statement");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>${BASE_PRINT_STYLES}${styles}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

export function openPrintWindow({ title, bodyHtml, styles = "" }) {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank", "height=720,width=960,noopener,noreferrer");
  if (!win) return false;

  const safeTitle = escapeHtml(title || "XCANNES Statement");
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>${BASE_PRINT_STYLES}${styles}</style>
  </head>
  <body>${bodyHtml}</body>
</html>`);
  doc.close();

  const triggerPrint = () => {
    win.focus();
    win.print();
    win.close();
  };

  win.onload = () => {
    window.setTimeout(triggerPrint, 200);
  };

  window.setTimeout(triggerPrint, 800);
  return true;
}
