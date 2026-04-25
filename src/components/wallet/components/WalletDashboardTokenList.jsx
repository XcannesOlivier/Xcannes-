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
          className={`flex items-center gap-2 mb-0.5 md:mb-1 px-3 pt-4 bg-[linear-gradient(to_bottom,transparent_0%,#060809_calc(100%-8px),#060809_100%)] md:bg-[linear-gradient(to_bottom,transparent_0%,#0a0d0e_calc(100%-8px),#0a0d0e_100%)] ${
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
      <div className={`${listClassName} relative`}>
        {/* Ambient green glow – left center */}
        <div className="pointer-events-none absolute inset-0 z-0 md:hidden bg-[radial-gradient(600px_circle_at_0%_50%,rgba(0,255,150,0.07),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 hidden md:block bg-[radial-gradient(900px_circle_at_0%_50%,rgba(0,255,150,0.07),transparent_60%)]" />
        <div className="relative z-[1] space-y-[2px] md:hidden">
          {tokens.map(renderTokenRow)}
        </div>
        <div className="relative z-[1] hidden md:flex md:flex-col md:space-y-[4px]">
          {tokens.map(renderTokenRow)}
        </div>
      </div>
    </div>
  );
}
