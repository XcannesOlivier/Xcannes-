"use client";

/** Bannière d'erreur inline — fond rouge, texte 11px. */
export const ErrorBanner = ({ children }) => (
  <div className="rounded-lg ring-1 ring-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
    {children}
  </div>
);

/** Bannière d'avertissement inline — fond amber, texte 11px. */
export const WarnBanner = ({ children }) => (
  <div className="rounded-lg ring-1 ring-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
    {children}
  </div>
);

/** Bannière d'information inline — fond blanc atténué, texte 11px. */
export const InfoBanner = ({ children }) => (
  <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
    {children}
  </div>
);
