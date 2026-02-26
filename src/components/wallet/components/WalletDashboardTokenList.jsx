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
  const showHeaderAction = Boolean(headerActionLabel && onHeaderAction);
  return (
    <div
      className={`flex-1 min-h-0 flex flex-col ${layout.tokenListClass} ${className}`}
      style={style}
    >
      {(headerTitle || headerActionLabel) && (
        <div
          className={`flex items-center gap-2 mb-2 px-3 pt-3 ${
            showHeaderAction ? "justify-between" : "justify-end"
          }`}
        >
          {typeof headerTitle === "string" ? (
            <div
              className={`text-xs text-white/45 ${showHeaderAction ? "" : "ml-auto"}`}
            >
              {headerTitle}
            </div>
          ) : headerTitle ? (
            <div className={showHeaderAction ? "" : "ml-auto"}>
              {headerTitle}
            </div>
          ) : null}
          {showHeaderAction ? (
            <button
              type="button"
              onClick={onHeaderAction}
              className="text-sm md:text-xs text-white/70 hover:text-white transition-colors"
            >
              {headerActionLabel} →
            </button>
          ) : null}
        </div>
      )}
      <div className={listClassName}>
        <div className="space-y-1.5 md:hidden">
          {tokens.map(renderTokenRow)}
        </div>
        <div className="hidden md:flex md:flex-col md:space-y-1.5">
          {tokens.map(renderTokenRow)}
        </div>
      </div>
    </div>
  );
}
