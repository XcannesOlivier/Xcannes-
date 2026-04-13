"use client";

export default function WalletDashboardTokenList({
  tokens,
  renderTokenRow,
  className = "",
  style,
  headerTitle = "",
  headerActionLabel = "",
  onHeaderAction,
  disableInternalScroll = false,
}) {
  const hasHeader = Boolean(headerTitle || headerActionLabel);
  const listClassName = disableInternalScroll
    ? `flex-1 min-h-0 px-0 md:px-3 ${hasHeader ? "pt-[2px] md:pt-1.5" : "pt-1.5"} pb-[2px] md:pb-3 rounded-2xl bg-black`
    : `flex-1 min-h-0 px-0 md:px-3 ${hasHeader ? "pt-[2px] md:pt-1.5" : "pt-1.5"} pb-[2px] md:pb-3 overflow-y-auto overscroll-contain rounded-2xl bg-black`;
  const showHeaderAction = Boolean(headerActionLabel && onHeaderAction);
  return (
    <div
      className={`flex-1 min-h-0 flex flex-col max-h-none ${className}`}
      style={style}
    >
      {(headerTitle || headerActionLabel) && (
        <div
          className={`flex items-center gap-2 mb-1 md:mb-2 px-3 pt-4 ${
            showHeaderAction ? "justify-between" : "justify-center"
          }`}
        >
          {typeof headerTitle === "string" ? (
            <div
              className="text-xs text-white/40"
            >
              {headerTitle}
            </div>
          ) : headerTitle ? (
            <div>{headerTitle}</div>
          ) : null}
          {showHeaderAction ? (
            <button
              type="button"
              onClick={onHeaderAction}
              className="text-sm md:text-xs text-white/80 hover:text-white transition-colors"
            >
              {headerActionLabel} →
            </button>
          ) : null}
        </div>
      )}
      <div className={listClassName}>
        <div className="space-y-[2px] md:hidden">
          {tokens.map(renderTokenRow)}
        </div>
        <div className="hidden md:flex md:flex-col md:space-y-[4px]">
          {tokens.map(renderTokenRow)}
        </div>
      </div>
    </div>
  );
}
