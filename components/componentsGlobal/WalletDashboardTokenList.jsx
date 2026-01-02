"use client";

export default function WalletDashboardTokenList({
  layout,
  tokens,
  renderTokenRow,
}) {
  return (
    <div
      className={`flex-1 p-3 overflow-y-auto overscroll-contain min-h-0 ${layout.tokenListClass}`}
    >
      <div className="space-y-1.5 md:hidden">{tokens.map(renderTokenRow)}</div>
      <div className="hidden md:flex md:flex-col md:space-y-1.5">
        {tokens.map(renderTokenRow)}
      </div>
    </div>
  );
}
