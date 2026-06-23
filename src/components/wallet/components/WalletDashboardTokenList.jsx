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
  onScroll,
}) {
  const hasHeader = Boolean(headerTitle || headerActionLabel);
  const listClassName = [
    "flex-1 min-h-0 px-3",
    hasHeader ? "pt-0" : "pt-1.5",
    "pb-[50px] md:pb-[60px] rounded-2xl bg-transparent",
    !disableInternalScroll && "overflow-y-auto overscroll-contain",
  ]
    .filter(Boolean)
    .join(" ");
  const showHeaderAction = Boolean(headerActionLabel && onHeaderAction);
  const headerJustifyClass =
    showHeaderAction || (headerTitle && typeof headerTitle !== "string")
      ? "justify-between"
      : "justify-center";
  return (
    <div
      className={`flex-1 min-h-0 flex flex-col max-h-none ${className}`}
      style={style}
    >
      <div className={listClassName} onScroll={onScroll}>
        {(headerTitle || headerActionLabel) && (
          <div
            className={`flex items-center gap-2 mb-0 md:mb-1 pt-0 bg-transparent ${
              headerJustifyClass
            }`}
          >
            {typeof headerTitle === "string" ? (
              <div
                className="text-xs text-white/40"
              >
                {headerTitle}
              </div>
            ) : headerTitle ? (
              <div className="w-full">{headerTitle}</div>
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
        <div className="space-y-2 md:hidden">
          {tokens.map(renderTokenRow)}
        </div>
        <div className="hidden md:flex md:flex-col md:space-y-2">
          {tokens.map(renderTokenRow)}
        </div>
      </div>
    </div>
  );
}
