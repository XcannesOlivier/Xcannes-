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
    ? `flex-1 min-h-0 px-3 ${hasHeader ? "pt-[2px] md:pt-[4px]" : "pt-1.5"} pb-[60px] md:pb-[4px] rounded-2xl bg-transparent`
    : `flex-1 min-h-0 px-3 ${hasHeader ? "pt-[2px] md:pt-[4px]" : "pt-1.5"} pb-[60px] md:pb-[4px] overflow-y-auto overscroll-contain rounded-2xl bg-transparent`;
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
      {(headerTitle || headerActionLabel) && (
        <div
          className={`flex items-center gap-2 mb-2 md:mb-1 px-3 pt-4 bg-[linear-gradient(to_bottom,transparent_0%,#060809_calc(100%-8px),#060809_100%)] md:bg-[linear-gradient(to_bottom,transparent_0%,#0a0d0e_calc(100%-8px),#0a0d0e_100%)] ${
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
      <div className={listClassName}>
        <div className="space-y-[4px] md:hidden">
          {tokens.map(renderTokenRow)}
        </div>
        <div className="hidden md:flex md:flex-col md:space-y-[4px]">
          {tokens.map(renderTokenRow)}
        </div>
      </div>
    </div>
  );
}
