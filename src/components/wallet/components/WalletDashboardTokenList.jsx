"use client";

export default function WalletDashboardTokenList({
  layout,
  tokens,
  renderTokenRow,
  className = "",
  style,
  headerTitle = "",
  headerActionLabel = "",
  onHeaderAction,
}) {
  return (
    <div
      className={`flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain ${layout.tokenListClass} ${className}`}
      style={style}
    >
      {(headerTitle || headerActionLabel) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[11px] text-white/45">{headerTitle}</div>
          {headerActionLabel ? (
            <button
              type="button"
              onClick={onHeaderAction}
              className="text-[11px] text-xcannes-green/80 hover:text-xcannes-green transition-colors"
            >
              {headerActionLabel} →
            </button>
          ) : null}
        </div>
      )}
      <div className="space-y-1.5 md:hidden">{tokens.map(renderTokenRow)}</div>
      <div className="hidden md:flex md:flex-col md:space-y-1.5">
        {tokens.map(renderTokenRow)}
      </div>
    </div>
  );
}
