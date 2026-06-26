import { createPortal } from "react-dom";

/**
 * StatementPreviewModal
 * Affiche un aperçu du relevé en iframe, centré au-dessus du modal parent
 * (plus petit que le modal principal, les côtés sont visibles).
 */
export default function StatementPreviewModal({ html, title, onClose, onPrint, printing }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10400] flex items-center justify-center p-3 md:p-10">
      {/* Backdrop semi-transparent — modal principal visible sur les côtés */}
      <div
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />

      {/* Panel : plus étroit que le modal parent */}
      <div
        className="relative z-10 w-full max-w-2xl flex flex-col rounded-[16px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
        style={{ maxHeight: "88dvh" }}
      >
        {/* Header blanc */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <span className="text-[13px] font-semibold text-gray-700 truncate min-w-0">
            {title || "Relevé"}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onPrint}
              disabled={printing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
                aria-hidden="true"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>{printing ? "…" : "Imprimer / PDF"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors text-sm font-bold leading-none"
              aria-label="Fermer l'aperçu"
            >
              ✕
            </button>
          </div>
        </div>

        {/* iframe avec le relevé */}
        <iframe
          srcDoc={html}
          title="Aperçu du relevé"
          className="w-full flex-1 bg-white"
          style={{ border: "none", minHeight: "300px" }}
        />
      </div>
    </div>,
    document.body,
  );
}
