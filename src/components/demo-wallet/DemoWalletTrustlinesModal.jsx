"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import DemoWalletModalShell from "./DemoWalletModalShell";
import DemoWalletDemoNotice from "./DemoWalletDemoNotice";

function safeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  return currency.replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export default function DemoWalletTrustlinesModal({
  open,
  onClose,
  walletLabel,
  allocations,
  allCurrencies,
  onEnableCurrency, // (currency) => { ok?: true, error?: string }
  onDisableCurrency, // (currency) => { ok?: true, error?: string }
}) {
  const { t } = useTranslation("common");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const existing = useMemo(() => {
    const entries = Object.entries(allocations || {}).map(([c, v]) => ({
      code: String(c).toUpperCase(),
      units: Number(v) || 0,
    }));
    return entries.sort((a, b) => a.code.localeCompare(b.code));
  }, [allocations]);

  const selectable = useMemo(() => {
    const existingSet = new Set(existing.map((e) => e.code));
    return (allCurrencies || []).filter((c) => !existingSet.has(String(c).toUpperCase()));
  }, [allCurrencies, existing]);

  return (
    <DemoWalletModalShell
      open={open}
      onClose={() => {
        onClose?.();
        setError("");
      }}
      title={t("demo_trustlines_title", "Currency lines (demo)")}
      subtitle={t(
        "demo_trustlines_subtitle",
        "Ajoutez/supprimez des lignes de devises fictives (aucun on‑chain)."
      )}
      maxWidthClassName="max-w-3xl"
    >
      <DemoWalletDemoNotice className="mb-1" />

      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="text-[11px] text-white/60">
          {t("demo_stmt_wallet", "Wallet")}:{" "}
          <span className="text-white/85 font-semibold">{walletLabel}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_160px] gap-3 items-end">
        <div className="space-y-1">
          <div className="text-[11px] text-white/55">
            {t("demo_trustlines_add", "Add a currency")}
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
            placeholder={t("demo_trustlines_placeholder", "e.g. JPY")}
          />
          <div className="text-[11px] text-white/40">
            {t("demo_trustlines_hint", "Ajoute une ligne à 0.00 pour la démo.")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            const currency = safeCurrency(code);
            if (!currency) {
              setError(t("demo_error_unsupported", "Devise non supportée (démo)."));
              return;
            }
            const res = onEnableCurrency?.(currency);
            if (res?.error) {
              setError(res.error);
              return;
            }
            setCode("");
          }}
          title={t("demo_tt_trustline_add", "Ajouter une devise locale.")}
          className="w-full px-4 py-2 rounded-lg bg-xcannes-green/20 hover:bg-xcannes-green/30 border border-xcannes-green/25 text-xcannes-green text-sm font-semibold transition-colors"
        >
          {t("demo_trustlines_add_cta", "Add")}
        </button>
      </div>

      {selectable?.length ? (
        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <div className="text-[11px] text-white/55 mb-2">
            {t("demo_trustlines_quick", "Quick add")}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectable.slice(0, 12).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setError("");
                  const res = onEnableCurrency?.(String(c).toUpperCase());
                  if (res?.error) setError(res.error);
                }}
                title={t("demo_tt_trustline_quick_add", "Ajouter cette devise.")}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs transition-colors"
              >
                {String(c).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <div className="text-xs text-red-300">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/15">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="text-sm font-semibold text-white/85">
            {t("demo_trustlines_list", "Currency lines")}
          </div>
          <div className="text-[11px] text-white/45">
            {existing.length} {t("demo_stmt_currencies", "Currencies")}
          </div>
        </div>
        <div className="max-h-[46vh] overflow-y-auto">
          {existing.map((row) => (
            <div
              key={row.code}
              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5"
            >
              <div className="min-w-0">
                <div className="text-sm text-white/90 font-semibold">
                  {row.code}
                </div>
                <div className="text-[11px] text-white/45">
                  {t("demo_trustlines_balance", "Balance")}:{" "}
                  <span className="font-mono">
                    {Number(row.units || 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={row.units !== 0}
                onClick={() => {
                  setError("");
                  const res = onDisableCurrency?.(row.code);
                  if (res?.error) setError(res.error);
                }}
                className={[
                  "px-3 py-2 rounded-lg text-xs border transition-colors",
                  row.units !== 0
                    ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
                    : "bg-red-500/10 border-red-500/25 text-red-300 hover:bg-red-500/15",
                ].join(" ")}
                title={
                  row.units !== 0
                    ? t("demo_trustlines_delete_disabled", "Convertissez vers 0 avant suppression.")
                    : t("demo_trustlines_delete", "Delete")
                }
              >
                {t("demo_trustlines_delete", "Delete")}
              </button>
            </div>
          ))}
          {existing.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/50">
              {t("demo_trustlines_empty", "No currency lines yet.")}
            </div>
          ) : null}
        </div>
      </div>
    </DemoWalletModalShell>
  );
}
