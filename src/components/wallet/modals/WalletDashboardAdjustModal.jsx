"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { buildAllocationAdjustMemo, buildXrplJsonMemo } from "@/utils/xrplMemo";
import {
  buildRlusdPaymentTxjson,
  XCANNES_ACTIVATION_WALLET_ADDRESS,
} from "@/utils/walletSpread";

const DEFAULT_ADJUSTMENT_FEE_RLUSD = 1;

export default function WalletDashboardAdjustModal({
  open,
  onClose,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview",
  walletId = "",
  renderWalletMeta,
  walletAddress,
  signTransaction,
  deficitRlusd,
  currencyLines,
  rlusdPerUnitRates,
  refreshBalance,
  refreshCurrencyLines,
  adjustmentFeeRlusd = DEFAULT_ADJUSTMENT_FEE_RLUSD,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const showNotConnectedNotice = isPreviewMode && noticeVariant !== "demo";
  const showNotActivatedNotice =
    !isPreviewMode && noticeVariant !== "demo" && isWalletActivated === false;
  const showRlusdNotActivatedNotice =
    !isPreviewMode &&
    noticeVariant !== "demo" &&
    isWalletActivated === true &&
    hasRlusdTrustline === false;
  const [adjustments, setAdjustments] = useState({});
  const [processing, setProcessing] = useState(false);

  const effectiveDeficit = Number(deficitRlusd || 0);
  const feeRlusd =
    Number.isFinite(Number(adjustmentFeeRlusd)) && Number(adjustmentFeeRlusd) > 0
      ? Number(adjustmentFeeRlusd)
      : DEFAULT_ADJUSTMENT_FEE_RLUSD;
  const requiredTotalRlusd =
    Number.isFinite(effectiveDeficit) && effectiveDeficit > 0
      ? effectiveDeficit + feeRlusd
      : 0;

  useEffect(() => {
    if (!open) return;
    setAdjustments({});
    setProcessing(false);
  }, [open]);

  const lineRows = useMemo(() => {
    const activeLines = Array.isArray(currencyLines)
      ? currencyLines.filter((line) => line?.active !== false)
      : [];

    return activeLines.map((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      const allocatedRlusd = Number.parseFloat(line?.allocatedRlusd ?? 0) || 0;
      const rateRaw = rlusdPerUnitRates?.[code];
      const rlusdPerUnit = Number.isFinite(Number(rateRaw))
        ? Number(rateRaw)
        : Number.NaN;
      const units =
        Number.isFinite(rlusdPerUnit) && rlusdPerUnit > 0
          ? allocatedRlusd / rlusdPerUnit
          : null;
      const rawDelta = adjustments?.[code];
      const deltaUnits = Number.parseFloat(rawDelta);
      const safeDeltaUnits = Number.isFinite(deltaUnits) ? deltaUnits : 0;
      const deltaRlusd =
        Number.isFinite(rlusdPerUnit) && rlusdPerUnit > 0
          ? safeDeltaUnits * rlusdPerUnit
          : 0;
      const minUnits = units != null ? -units : null;

      return {
        code,
        allocatedRlusd,
        rlusdPerUnit,
        units,
        rawDelta,
        deltaUnits: safeDeltaUnits,
        deltaRlusd,
        minUnits,
      };
    });
  }, [currencyLines, rlusdPerUnitRates, adjustments]);

  const totals = useMemo(() => {
    const totalDeltaRlusd = lineRows.reduce(
      (sum, row) => sum + (Number.isFinite(row.deltaRlusd) ? row.deltaRlusd : 0),
      0
    );
    const remaining = requiredTotalRlusd + totalDeltaRlusd;
    return {
      totalDeltaRlusd,
      remaining,
    };
  }, [lineRows, requiredTotalRlusd]);

  const epsilon = 1e-6;
  const hasValidAdjustments = lineRows.some(
    (row) => Math.abs(row.deltaRlusd) > epsilon
  );
  const hasInvalidAdjustments = lineRows.some((row) => {
    if (!Number.isFinite(row.deltaRlusd)) return true;
    const allocatedAfter = row.allocatedRlusd + row.deltaRlusd;
    return allocatedAfter < -epsilon;
  });
  const canSubmit =
    !isPreviewMode &&
    !processing &&
    Boolean(walletAddress) &&
    Boolean(signTransaction) &&
    requiredTotalRlusd > 0 &&
    Math.abs(totals.remaining) <= epsilon &&
    hasValidAdjustments &&
    !hasInvalidAdjustments;

  const handleAdjustChange = (code, value) => {
    setAdjustments((prev) => ({ ...(prev || {}), [code]: value }));
  };

  const handleAdjustBlur = (code, minUnits) => {
    setAdjustments((prev) => {
      const raw = prev?.[code];
      if (raw == null || raw === "") return prev;
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed)) return prev;
      let next = parsed;
      if (Number.isFinite(minUnits) && parsed < minUnits) next = minUnits;
      if (Object.is(next, parsed)) return prev;
      return { ...(prev || {}), [code]: String(next) };
    });
  };

  const handleReset = () => {
    setAdjustments({});
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!walletAddress) {
      alert("Please connect your Xumm wallet first.");
      return;
    }
    const destination = String(XCANNES_ACTIVATION_WALLET_ADDRESS || "").trim();
    if (!destination) {
      alert("Activation wallet not configured.");
      return;
    }

    const adjustmentsPayload = lineRows
      .filter((row) => Math.abs(row.deltaRlusd) > epsilon)
      .map((row) => {
        const action = row.deltaRlusd > 0 ? "allocate" : "deallocate";
        const amountRlusd = Math.abs(row.deltaRlusd);
        const allocatedAfter = Math.max(0, row.allocatedRlusd + row.deltaRlusd);
        return {
          action,
          currencyCode: row.code,
          amountRlusd,
          allocatedRlusdAfter: allocatedAfter,
        };
      });

    const memoPayload = buildAllocationAdjustMemo({
      adjustments: adjustmentsPayload,
      reason: "ajustement rlusd pour operation exterieure a xcannes",
      method: "manual",
    });
    if (!memoPayload) {
      alert("Invalid adjustment memo payload.");
      return;
    }

    const memos = buildXrplJsonMemo(memoPayload);
    if (!memos) {
      alert("Invalid adjustment memo.");
      return;
    }

    const txjson = buildRlusdPaymentTxjson({
      account: walletAddress,
      destination,
      amountRlusd: feeRlusd,
    });
    if (!txjson) {
      alert("Unable to build RLUSD adjustment transaction.");
      return;
    }
    txjson.Memos = memos;

    try {
      setProcessing(true);
      const result = await signTransaction(txjson, {
        action: "wallet:allocation-adjust",
      });
      if (!result?.signed) {
        alert("Adjustment cancelled or expired.");
        return;
      }

      setAdjustments({});
      if (refreshBalance) setTimeout(() => refreshBalance(), 2500);
      if (refreshCurrencyLines) setTimeout(() => refreshCurrencyLines(), 2500);
      onClose?.();
    } catch (error) {
      const message = error?.message || String(error);
      console.error("Adjustment error:", error);
      alert("Adjustment error: " + message);
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  const remainingLabel = Number.isFinite(totals.remaining)
    ? totals.remaining.toLocaleString("en-US", { maximumFractionDigits: 6 })
    : "-";
  const requiredLabel = Number.isFinite(requiredTotalRlusd)
    ? requiredTotalRlusd.toLocaleString("en-US", { maximumFractionDigits: 6 })
    : "-";

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    "relative w-full border border-white/10 overflow-hidden flex flex-col pointer-events-auto",
    inline ? "h-full max-h-none rounded-xl" : "max-w-2xl max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" && walletId === "A"
      ? "bg-[#0b1017]"
      : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
  ].join(" ");

  const content = (
    <>
      {!inline ? (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
          onClick={onClose}
        />
      ) : null}

      <div className={wrapperClass}>
        <div
          className={panelClass}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
          className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
          >
            X
          </button>

          <div
            className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-1 pr-6">
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                {t(
                  "ui_adjustment_modal_title_7b1c2d3e4f",
                  "RLUSD adjustment required"
                )}
              </h3>
              {noticeVariant === "demo" ? (
                <span className="inline-flex items-center text-xcannes-green text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                  {t("demo_notice_title", "Mode demo")}
                </span>
              ) : null}
              {showNotConnectedNotice ? (
                <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none">
                  {t("wallet_not_connected_title", "Wallet not connected")}
                </span>
              ) : null}
              {showNotActivatedNotice ? (
                <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none">
                  {t(
                    "wallet_not_activated_title",
                    "Wallet not activated: a minimum reserve of 1 XRP is required."
                  )}
                </span>
              ) : null}
              {showRlusdNotActivatedNotice ? (
                <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none">
                  {t(
                    "wallet_rlusd_not_activated_title",
                    "RLUSD not activated. Authorize RLUSD on your wallet."
                  )}
                </span>
              ) : null}
            </div>

            {renderWalletMeta?.("mb-2")}

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 md:p-4 space-y-2">
              <div className="text-sm text-amber-200">
                <strong>
                  {t(
                    "ui_adjustment_required_94b2c1d5aa",
                    "Ajustement requis:"
                  )}
                </strong>{" "}
                {t(
                  "ui_adjustment_required_desc_4f7a2c1b9e",
                  "Le pool RLUSD ne couvre plus toutes les allocations."
                )}
              </div>
              <div className="text-xs text-amber-200/80">
                {t(
                  "ui_adjustment_required_amount_2c7b1a9d5e",
                  "Montant total a ajuster"
                )}
                :{" "}
                <span className="font-semibold text-amber-100">
                  {requiredLabel} RLUSD
                </span>{" "}
                <span className="text-amber-200/60">
                  ({t("ui_includes_fee_2d1c9b7a5e", "inclut frais")} {feeRlusd}{" "}
                  RLUSD)
                </span>
              </div>
              <div className="text-xs text-amber-100/90">
                {t(
                  "ui_adjustment_remaining_3a9c1b7d5e",
                  "Reste a ajuster"
                )}
                :{" "}
                <span
                  className={
                    Math.abs(totals.remaining) <= epsilon
                      ? "text-xcannes-green font-semibold"
                      : "text-amber-100 font-semibold"
                  }
                >
                  {remainingLabel} RLUSD
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {lineRows.length === 0 ? (
                <div className="text-sm text-white/50">
                  {t(
                    "ui_adjustment_no_lines_41b2c9d5e",
                    "No active currency lines available."
                  )}
                </div>
              ) : (
                lineRows.map((row) => {
                  const unitsLabel =
                    row.units == null || !Number.isFinite(row.units)
                      ? "-"
                      : row.units.toLocaleString("en-US", {
                          maximumFractionDigits: 6,
                        });
                  const rlusdLabel = row.allocatedRlusd.toLocaleString("en-US", {
                    maximumFractionDigits: 6,
                  });
                  const deltaRlusdLabel = row.deltaRlusd.toLocaleString("en-US", {
                    maximumFractionDigits: 6,
                  });
                  const rateLabel =
                    Number.isFinite(row.rlusdPerUnit) && row.rlusdPerUnit > 0
                      ? row.rlusdPerUnit.toLocaleString("en-US", {
                          maximumFractionDigits: 6,
                        })
                      : null;
                  const inputDisabled =
                    !Number.isFinite(row.rlusdPerUnit) || row.rlusdPerUnit <= 0;

                  return (
                    <div
                      key={row.code}
                      className="rounded-xl border border-white/10 bg-black/40 p-3 md:p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white">
                            {row.code}
                          </div>
                          <div className="text-[11px] text-white/50">
                            {t(
                              "ui_line_balance_label_7d2c1b9e5a",
                              "Solde ligne"
                            )}
                            :{" "}
                            <span className="text-white/80">
                              {unitsLabel} {row.code}
                            </span>{" "}
                            <span className="text-white/40">
                              (≈ {rlusdLabel} RLUSD)
                            </span>
                          </div>
                          {rateLabel ? (
                            <div className="text-[10px] text-white/35">
                              1 {row.code} ≈ {rateLabel} RLUSD
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-200/70">
                              {t(
                                "ui_rate_unavailable_9c1b2d4e5f",
                                "Rate unavailable"
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <label className="text-[10px] text-white/50">
                            {t(
                              "ui_adjustment_input_label_8c1b2d5e4f",
                              "Ajustement (devise)"
                            )}
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={Number.isFinite(row.minUnits) ? row.minUnits : undefined}
                            value={row.rawDelta ?? ""}
                            onChange={(e) =>
                              handleAdjustChange(row.code, e.target.value)
                            }
                            onBlur={() => handleAdjustBlur(row.code, row.minUnits)}
                            disabled={inputDisabled || isPreviewMode}
                            className="w-32 md:w-40 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-xcannes-green/60 disabled:opacity-60"
                          />
                          <div className="text-[10px] text-white/45">
                            {t(
                              "ui_adjustment_delta_rlusd_1b2c3d4e5f",
                              "Delta RLUSD"
                            )}
                            :{" "}
                            <span className="text-white/70">
                              {deltaRlusdLabel} RLUSD
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="md:flex-1 rounded-lg border border-white/20 bg-transparent text-white/70 font-semibold px-4 py-2 text-sm hover:bg-white/10 transition-colors"
                disabled={processing}
              >
                {t("ui_reset_1d2c3b4e5f", "Reset")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="md:flex-1 rounded-lg border border-xcannes-green/40 bg-xcannes-green/80 text-black font-semibold px-4 py-2 text-sm transition-all duration-200 hover:bg-xcannes-green hover:scale-[1.01] disabled:border-xcannes-green/30 disabled:bg-xcannes-green/20 disabled:text-black/50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {processing
                  ? t("ui_adjusting_6b2c1a9d5e", "Adjusting...")
                  : t(
                      "ui_adjustment_confirm_4c1b2d5e6f",
                      "Valider l ajustement"
                    )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
