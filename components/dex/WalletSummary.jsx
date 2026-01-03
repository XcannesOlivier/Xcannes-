"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { useXumm } from "../../context/XummContext";
import XummConnectButton from "../xumm/XummConnectButton";

// Version compacte du wallet pour la page DEX
export default function WalletSummary() {
  const { t } = useTranslation("common");
  const { wallet, balance, refreshBalance } = useXumm();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const normalizedTokens = useMemo(
    () => balance?.tokens || [],
    [balance?.tokens]
  );

  const xrpAmount = useMemo(
    () => (Number.parseFloat(balance?.xrp ?? 0) || 0),
    [balance]
  );

  const isStablecoin = (currency) =>
    ["RLUSD", "USD", "USDC", "USDT", "EUR", "EURS", "EURT"].includes(currency);

  const stableUsd = useMemo(
    () =>
      normalizedTokens
        .filter((t) => isStablecoin(t.currency))
        .reduce((sum, t) => {
          const v = Number.parseFloat(t.value);
          return sum + (Number.isFinite(v) ? v : 0);
        }, 0),
    [normalizedTokens]
  );

  const totalLabel =
    stableUsd > 0
      ? `$${stableUsd.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `${xrpAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} XRP`;

  const displayTokens = useMemo(() => {
    const baseTokens = [...normalizedTokens];

    // Toujours mettre en avant les actifs XCANNES / principaux,
    // même si le solde est à 0 pour l'instant.
    const ensureToken = (currency) => {
      if (!baseTokens.some((t) => t.currency === currency)) {
        baseTokens.push({ currency, issuer: "", value: 0 });
      }
    };

    // Au minimum 4 tokens "visibles" + XRP => 5 lignes
    ensureToken("XCS");
    ensureToken("RLUSD");
    ensureToken("USD");
    ensureToken("EUR");

    const enriched = [
      {
        key: "XRP",
        currency: "XRP",
        value: xrpAmount,
      },
      ...baseTokens.map((t) => ({
        key: `${t.currency}:${t.issuer}`,
        currency: t.currency,
        value: Number.parseFloat(t.value) || 0,
      })),
    ];

    const weight = (currency) => {
      if (currency === "XCS") return 0;
      if (currency === "RLUSD") return 1;
      if (currency === "XRP") return 2;
      return 3;
    };

    enriched.sort((a, b) => {
      const wa = weight(a.currency);
      const wb = weight(b.currency);
      if (wa !== wb) return wa - wb;
      return b.value - a.value;
    });

    return enriched.slice(0, 5);
  }, [normalizedTokens, xrpAmount]);

  const handleRefresh = async () => {
    if (!refreshBalance) return;
    setIsRefreshing(true);
    await refreshBalance();
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const handleCopy = async () => {
    if (!wallet || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(wallet);
    } catch (e) {
      console.error("Copy wallet error:", e);
    }
  };

  return (
    <div className="panel-surface bg-elevated md:backdrop-blur-sm h-full flex flex-col justify-between border-t border-white/10">
      <div className="p-4 pb-3 border-b border-subtle/60">
        {/* Brand line (mobile) */}
        <div className="md:hidden flex items-center gap-3 mb-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase">
              XCANNES
            </span>
            <span className="text-[10px] font-light text-white/30">|</span>
            <span className="text-[10px] font-light text-white/40 truncate max-w-[160px]">
              Digital Asset Exchange
            </span>
          </div>
        </div>

        {/* Header mobile : bouton Xumm + bouton Trade centré */}
        <div className="md:hidden flex items-center gap-3">
          <XummConnectButton
            mode="single"
            className="inline-flex items-center justify-center gap-2 rounded-lg shadow-md active:scale-95 transition-transform px-4 py-2.5 bg-[#3052ff] text-white text-sm font-semibold"
            connectedClassName="inline-flex items-center justify-center gap-2 rounded-lg shadow-md active:scale-95 transition-transform px-3 py-1.5 bg-xcannes-green/10 border border-xcannes-green/50 text-[11px] font-medium text-xcannes-green"
            connectLabel={t("wallet_connect", "Connect wallet")}
            connectedLabel={t("wallet_connected", "Wallet connected")}
          />

          <div className="flex-1 flex justify-center">
            <button
              type="button"
              className="text-[26px] font-semibold text-xcannes-green"
            >
              Trade
            </button>
          </div>
        </div>

        {/* Header desktop : bouton Xumm à gauche + bouton Trade plus grand */}
        <div className="hidden md:flex items-center justify-start gap-10">
          <XummConnectButton
            mode="single"
            className="inline-flex items-center justify-center gap-2 rounded-lg shadow-md active:scale-95 transition-transform px-5 py-2 bg-[#3052ff] text-white text-sm font-semibold"
            connectedClassName="inline-flex items-center justify-center gap-2 rounded-lg shadow-md active:scale-95 transition-transform px-3 py-1.5 bg-xcannes-green/10 border border-xcannes-green/50 text-xs font-medium text-xcannes-green"
            connectLabel={t("wallet_connect", "Connect wallet")}
            connectedLabel={t("wallet_connected", "Wallet connected")}
          />

          <button
            type="button"
            className="text-2xl lg:text-3xl font-semibold text-xcannes-green"
          >
            Trade
          </button>
        </div>
      </div>

      <div className="px-4 py-3 flex-1 min-h-0 flex flex-col gap-3">
        <div className="space-y-1.5 overflow-y-auto pr-1">
          {displayTokens.map((token) => (
            <div
              key={token.key}
              className="flex items-center justify-between rounded-md bg-subtle hover:bg-elevated border border-subtle px-3 py-2 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-subtle flex items-center justify-center text-[12px] font-semibold text-primary">
                  {token.currency.slice(0, 3)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-primary truncate">
                    {token.currency}
                  </span>
                  <span className="text-[11px] text-muted truncate">
                    {token.currency === "XRP"
                      ? "XRP · Native"
                      : isStablecoin(token.currency)
                      ? "XRPL Stablecoin"
                      : "XRPL Token"}
                  </span>
                </div>
              </div>
              <div className="text-right text-[12px] font-mono text-primary">
                {token.value.toLocaleString("en-US", {
                  maximumFractionDigits: 4,
                })}
              </div>
            </div>
          ))}

          {displayTokens.length === 0 && (
            <p className="text-[11px] text-muted">
              {t(
                "wallet_no_assets_short",
                "Your balances will appear here once connected."
              )}
            </p>
          )}
        </div>

        <div className="mt-auto pt-2 border-t border-subtle/60 flex items-center justify-between text-[12px] md:text-[11px] text-muted">
          <span>{t("wallet_more_details", "More details")}</span>
          <Link
            href="/wallet"
            className="text-[14px] md:text-[11px] text-accent-rlusd hover:underline font-medium"
          >
            {t("wallet_open_full", "Open full wallet")}
          </Link>
        </div>
      </div>
    </div>
  );
}
