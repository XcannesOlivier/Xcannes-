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
  disableInternalScroll = false,
}) {
  const listClassName = disableInternalScroll
    ? "flex-1 min-h-0 px-3 pb-3"
    : "flex-1 min-h-0 px-3 pb-3 overflow-y-auto overscroll-contain";
  return (
    <div
      className={`flex-1 min-h-0 flex flex-col ${layout.tokenListClass} ${className}`}
      style={style}
    >
      {(headerTitle || headerActionLabel) && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 pt-3">
          <div className="text-xs text-white/45">{headerTitle}</div>
          {headerActionLabel ? (
            <button
              type="button"
              onClick={onHeaderAction}
              className="text-sm md:text-xs text-xcannes-green/80 hover:text-xcannes-green transition-colors"
            >
              {headerActionLabel} →
            </button>
          ) : null}
        </div>
      )}
      <div className={listClassName}>
        <div className="space-y-1.5 md:hidden">{tokens.map(renderTokenRow)}</div>
        <div className="hidden md:flex md:flex-col md:space-y-1.5">
          {tokens.map(renderTokenRow)}
        </div>
      </div>
    </div>
  );
}
