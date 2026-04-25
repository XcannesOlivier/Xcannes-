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
    ? `flex-1 min-h-0 px-0 ${hasHeader ? "pt-[2px] md:pt-[4px]" : "pt-1.5"} pb-[2px] md:pb-[4px] rounded-2xl bg-black`
    : `flex-1 min-h-0 px-0 ${hasHeader ? "pt-[2px] md:pt-[4px]" : "pt-1.5"} pb-[2px] md:pb-[4px] overflow-y-auto overscroll-contain rounded-2xl bg-black`;
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
          className={`flex items-center gap-2 mb-0.5 md:mb-1 px-3 pt-4 bg-gradient-to-b from-transparent to-[#060809] md:to-[#0a0d0e] ${
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
