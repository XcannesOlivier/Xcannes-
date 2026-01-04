"use client";

import { useTranslation } from "next-i18next";

/**
 * Panneau pédagogique Info & Fees / Info & rates.
 * Utilisé pour les paires externes et pour les cas XRPL sans carnet actif.
 */
export default function InfoFeesPanel({ pair, variant = "external" }) {
  const { t } = useTranslation("common");

  const isExternal = variant === "external";
  const isXrplNoOrders = variant === "xrpl_no_orders";
  const isMaintenance = variant === "maintenance";
  const isXrplDefault = variant === "xrpl_default";

  const displayPair =
    pair || t("trading_unknown_pair", "Selected pair");

  let badge, title, subtitle;

  if (isMaintenance) {
    badge = "Orderbook maintenance";
    title = "Service temporarily unavailable";
    subtitle =
      "The orderbook data for this pair is undergoing maintenance. Prices and liquidity may not be reliable.";
  } else if (isXrplNoOrders) {
    badge = "No active orders";
    title = "No active orders for this pair";
    subtitle =
      "There are currently no buy or sell orders. You can place a new order to open liquidity.";
  } else if (isXrplDefault) {
    badge = "XRPL pair";
    title = "How this XRPL market works";
    subtitle =
      "This pair is tradable on XCANNES with a live orderbook. Fees and risks depend on spreads, depth and your execution strategy.";
  } else {
    // Cas externe (par défaut)
    badge = "No orderbook for this pair";
    title = "This market uses indicative rates";
    subtitle =
      "This market uses indicative rates instead of a live orderbook. You can monitor prices but not place direct orderbook trades.";
  }

  return (
    <div className="panel-body space-y-4 text-secondary text-sm">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          {badge}
        </p>
        <h2 className="text-base font-semibold text-primary">
          {displayPair} · {title}
        </h2>
        <p className="text-[12px] text-muted">
          {subtitle}
        </p>
      </header>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-primary tracking-[0.14em] uppercase">
          How this pair works
        </h3>
        <p className="text-[13px] leading-relaxed text-secondary">
          {isExternal
            ? "Prices are provided by external liquidity sources and reference feeds. You can use this pair to monitor the market, value your positions, or prepare transfers in RLUSD / XCS."
            : "This XRPL pair is tradable on XCANNES. Liquidity and execution quality depend on orderbook depth, spreads and your order size."}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-primary tracking-[0.14em] uppercase">
          Fees overview
        </h3>
        <ul className="text-[13px] leading-relaxed text-secondary space-y-1.5">
          <li>• Network fees: paid on the underlying network (XRPL or external) when you move assets.</li>
          <li>• Service fees: may apply on conversions RLUSD / XCS or off-ramp operations.</li>
          <li>• Minimum amounts: small trades can be rounded or aggregated to protect users from fee friction.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-primary tracking-[0.14em] uppercase">
          Risks &amp; tips
        </h3>
        <ul className="text-[13px] leading-relaxed text-secondary space-y-1.5">
          <li>• Liquidity can vary significantly between pairs and sessions.</li>
          <li>• Always double-check the pair direction (BASE/QUOTE) before sending or converting.</li>
          <li>• For large amounts, consider splitting operations and monitoring spreads.</li>
        </ul>
      </section>

      <div className="pt-2">
        <button
          type="button"
          className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-subtle text-[12px] text-secondary hover:text-primary hover:border-accent-secondary focus-ring-token transition-colors"
        >
          Learn more about this pair
        </button>
      </div>
    </div>
  );
}
