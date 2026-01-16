"use client";

import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Buffer } from "buffer";
import { createPortal } from "react-dom";import { useTranslation } from "next-i18next";
import { XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";

export default function WalletDashboardReceiveModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  receiveTab,
  setReceiveTab,
  renderWalletMeta,
  effectiveWallet,
  handleCopyAddress,
  requestAmount,
  setRequestAmount,
  requestCurrency,
  setRequestCurrency,
  augmentedTokens,
  requestMemo,
  setRequestMemo,
  requestMethod,
  setRequestMethod,
  requestToAddress,
  setRequestToAddress,
  rlusdPerUnitRates,
  rlusdPerUnitSources
}) {const { t } = useTranslation("common");
  const [generatedRequest, setGeneratedRequest] = useState(null);
  const [generateError, setGenerateError] = useState(null);

  const requestCurrencyCode = useMemo(
    () => String(requestCurrency || "").trim().toUpperCase(),
    [requestCurrency]
  );

  const selectedRequestToken = useMemo(() => {
    return (
      (augmentedTokens || []).find(
        (t) => String(t?.currency || "").toUpperCase() === requestCurrencyCode
      ) || null);

  }, [augmentedTokens, requestCurrencyCode]);

  const isFxRequest = useMemo(() => {
    if (!selectedRequestToken?.isTrustlineOnly) return false;
    if (!requestCurrencyCode) return false;
    return requestCurrencyCode !== "XRP" && requestCurrencyCode !== "RLUSD" && requestCurrencyCode !== "XCS";
  }, [requestCurrencyCode, selectedRequestToken?.isTrustlineOnly]);

  const handleGenerateRequest = () => {
    setGenerateError(null);

    const amount = Number.parseFloat(requestAmount || "0");
    if (!Number.isFinite(amount) || amount <= 0) {
      setGenerateError(
        t(
          "ui_request_error_invalid_amount_5bd214c9a7",
          "Please enter a valid amount."
        )
      );
      return;
    }

    if (!effectiveWallet) {
      setGenerateError(
        t(
          "ui_request_error_missing_wallet_4f7a2c9b1e",
          "Wallet address is missing."
        )
      );
      return;
    }

    const targetCurrencyCode = requestCurrencyCode || "RLUSD";
    const targetCurrencyUpper = String(targetCurrencyCode || "").toUpperCase();
    let amountRlusd = null;
    let fxRate = null;
    let fxSource = null;

    if (targetCurrencyUpper === "RLUSD") {
      amountRlusd = amount;
      fxRate = 1;
      fxSource = "PYTH";
    } else if (isFxRequest) {
      const rate = Number(rlusdPerUnitRates?.[targetCurrencyUpper]);
      if (!Number.isFinite(rate) || rate <= 0) {
        setGenerateError(
          t("ui_request_error_rate_unavailable_8c2e1a7b5d", {
            defaultValue: "Rate unavailable for {{currency}}.",
            currency: targetCurrencyUpper,
          })
        );
        return;
      }
      fxRate = rate;
      fxSource = rlusdPerUnitSources?.[targetCurrencyUpper] || null;
      amountRlusd = amount * rate;
    }

    const issuerCandidate = String(selectedRequestToken?.issuer || "").trim();
    const issuerLooksValid = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(issuerCandidate);
    const knownIssuer =
      targetCurrencyUpper === "RLUSD"
        ? XRPL_KNOWN_ISSUERS.RLUSD
        : targetCurrencyUpper === "XCS"
          ? XRPL_KNOWN_ISSUERS.XCS
          : null;
    const issuer = isFxRequest ? null : knownIssuer || (issuerLooksValid ? issuerCandidate : null);

    const req = {
      schema: "xcannes-payreq-v1",
      to: effectiveWallet,
      targetCurrency: targetCurrencyUpper,
      displayAmount: amount,
      displayCurrency: targetCurrencyUpper,
      amountRlusd: Number.isFinite(amountRlusd) ? amountRlusd : null,
      fxRate,
      fxSource,
      issuer,
      memo: requestMemo || "",
      createdAt: new Date().toISOString()
    };

    setGeneratedRequest(req);
  };

  const requestValue = useMemo(() => {
    if (!generatedRequest) return "";
    try {
      return JSON.stringify(generatedRequest);
    } catch {
      return "";
    }
  }, [generatedRequest]);

  const requestLink = useMemo(() => {
    if (!generatedRequest) return "";
    if (typeof window === "undefined") return "";
    try {
      const json = JSON.stringify(generatedRequest);
      const base64url = Buffer.from(json, "utf8").
      toString("base64").
      replace(/\+/g, "-").
      replace(/\//g, "_").
      replace(/=+$/g, "");
      const url = new URL("/pay", window.location.origin);
      url.searchParams.set("req", base64url);
      return url.toString();
    } catch {
      return "";
    }
  }, [generatedRequest]);

  if (!open) return null;

  const content =
  <>
      {/* Backdrop */}
      <div
      className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
      onClick={onClose} />

      {/* Modale */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
        className={[
          "relative w-full max-w-md md:max-w-lg border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto",
          noticeVariant === "demo" && walletId === "A" ? "bg-[#0b1017]" : "bg-elevated",
          noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
        ].join(" ")}
        style={{ WebkitOverflowScrolling: "touch" }}
        onClick={(e) => e.stopPropagation()}>

          <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10">

            ✕
          </button>
          <div className="flex items-center gap-2 mb-1 pr-6">
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
              {receiveTab === "receive"
                ? t(
                    "ui_receive_assets_title_b3c7f4d2a1",
                    "Receive assets"
                  )
                : t("ui_request_payment_c62b99fb16", "Request Payment")}
            </h3>
            {noticeVariant === "demo" ? (
              <span className="inline-flex items-center text-emerald-400 text-sm md:text-base font-semibold border border-emerald-400/40 rounded-full px-2 py-0.5 leading-none">
                {t("demo_notice_title", "Mode démo")}
              </span>
            ) : null}
            {isPreviewMode && noticeVariant !== "demo" ? (
              <span className="inline-flex items-center text-amber-200 text-xs md:text-sm font-semibold border border-amber-400/40 rounded-full px-2 py-0.5 leading-none">
                {t("wallet_not_connected_title", "Wallet not connected")}
              </span>
            ) : null}
          </div>
          {renderWalletMeta?.("mb-2")}


          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button
            type="button"
            onClick={() => setReceiveTab("receive")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
            receiveTab === "receive" ?
            "bg-xcannes-green text-black font-semibold" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_receive_b7d6ae4037", "Receive")}


          </button>
            <button
            type="button"
            onClick={() => setReceiveTab("request")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
            receiveTab === "request" ?
            "bg-xcannes-green text-black font-semibold" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_request_payment_c62b99fb16", "Request Payment")}


          </button>
          </div>

          <p className="text-xs md:text-sm text-white/50 mb-3">
            {receiveTab === "receive"
              ? t(
                  "ui_receive_assets_desc_1b7f2c9d4e",
                  "Share this XRPL address to receive funds."
                )
              : t(
                  "ui_request_payment_desc_9c2b1a7d4f",
                  "Create a payment request to send to another wallet."
                )}
          </p>

          {/* Tab Content: Receive */}
          {receiveTab === "receive" && effectiveWallet &&
        <div className="flex flex-col items-center gap-3">
              <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                <QRCodeCanvas
              value={effectiveWallet}
              size={180}
              bgColor="#000000"
              fgColor="#ffffff" />

              </div>
              <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 break-all">
                {effectiveWallet}
              </div>
              <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyAddress();
            }}
            className="px-4 py-2 rounded-md bg-white/10 text-xs text-white/80 hover:bg-white/20 transition-colors active:scale-95">{t("ui_copy_address_779691d570", "Copy address")}


          </button>
            </div>
        }

          {/* Tab Content: Request Payment */}
          {receiveTab === "request" && effectiveWallet &&
        <div className="space-y-4">
              {/* Amount & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_amount_7668986206", "Amount")}

              </label>
                  <input
                type="number"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80" />

                </div>
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_currency_1ed55673be", "Currency")}

              </label>
                  <select
                value={requestCurrency}
                onChange={(e) => setRequestCurrency(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80">

                    {(augmentedTokens || []).map((t) =>
                <option key={t.key} value={t.currency}>
                        {t.currency}
                      </option>
                )}
                  </select>
                </div>
              </div>

              {/* Memo (optional) */}
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_memo_optional_d9594474c7", "Memo (optional)")}

            </label>
                <input
              type="text"
              value={requestMemo}
              onChange={(e) => setRequestMemo(e.target.value)}
              placeholder={t("ui_payment_for_82ec86ac25", "Payment for...")}
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80" />

              </div>

              {/* Request Method Selection */}
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-2">{t("ui_send_request_via_19ac1c6506", "Send request via:")}

            </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                type="button"
                onClick={() => setRequestMethod("qr")}
                className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                requestMethod === "qr" ?
                "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green" :
                "bg-white/5 border-white/10 text-white/60"} border`
                }>{t("ui_qr_code_7614ee32a0", "📱 QR Code")}


              </button>
                  <button
                type="button"
                onClick={() => setRequestMethod("link")}
                className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                requestMethod === "link" ?
                "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green" :
                "bg-white/5 border-white/10 text-white/60"} border`
                }>{t("ui_link_c2c8a504d7", "🔗 Link")}


              </button>
                </div>
              </div>

              {/* Conditional: Address for notification */}
              {requestMethod === "notification" &&
          <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_recipient_wallet_address_1724bca6de", "Recipient Wallet Address")}

            </label>
                  <input
              type="text"
              value={requestToAddress}
              onChange={(e) => setRequestToAddress(e.target.value)}
              placeholder={t("ui_rxxxxxxxxxxxxxxxxxxxxxxxxxxx_ae36b8d4d2", "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")}
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80" />

                </div>
          }

              {/* Generate Button */}
              <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateRequest();
            }}
            className="w-full mt-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10">{t("ui_generate_request_58584f23a2", "Generate Request")}


          </button>

              {generateError &&
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {generateError}
                </div>
          }

              {!!generatedRequest && !!requestValue &&
          <div className="space-y-3">
                  {requestMethod === "qr" ?
            <div className="flex flex-col items-center gap-3">
                      <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                        <QRCodeCanvas
                  value={requestMethod === "qr" && requestLink ? requestLink : requestValue}
                  size={180}
                  bgColor="#000000"
                  fgColor="#ffffff" />

                      </div>
                      {requestLink ?
              <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70 break-all">
                          {requestLink}
                        </div> :

              <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70 break-all">
                          {requestValue}
                        </div>
              }
                      <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(requestLink || requestValue);
                  } catch {

                    // ignore
                  }}}
                className="px-4 py-2 rounded-md bg-white/10 text-xs text-white/80 hover:bg-white/20 transition-colors active:scale-95">{t("ui_copy_request_32a3f4409b", "Copy request")}


              </button>
                    </div> :

            <div className="space-y-2">
                      <div className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70 break-all">
                        {requestMethod === "link" && requestLink ? requestLink : requestValue}
                      </div>
                      <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(
                      requestMethod === "link" && requestLink ? requestLink : requestValue
                    );
                  } catch {

                    // ignore
                  }}}
                className="w-full px-4 py-2 rounded-md bg-white/10 text-xs text-white/80 hover:bg-white/20 transition-colors active:scale-95">{t("ui_copy_request_32a3f4409b", "Copy request")}


              </button>
                    </div>
            }
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-[11px] text-white/60">
                    {isFxRequest
                      ? t("ui_request_settlement_note_6a1c9d2f3b", {
                          defaultValue:
                            "Payment will settle on-chain in RLUSD, and be credited to the {{currency}} line for the receiver.",
                          currency: requestCurrencyCode,
                        })
                      : t("ui_request_prepared_for_5d2a8b1c3f", {
                          defaultValue:
                            "Payment request prepared for {{currency}}.",
                          currency: requestCurrencyCode || "RLUSD",
                        })}
                  </div>
                </div>
          }

              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  {requestMethod === "qr" &&
                    t(
                      "ui_request_info_qr_4b1c8d2a6f",
                      "Generate a QR code that can be scanned to pay you."
                    )}
                  {requestMethod === "link" &&
                    t(
                      "ui_request_info_link_9a2b6c1d4f",
                      "Create a shareable link for this payment request."
                    )}
                  {requestMethod === "xrpl" &&
                    t(
                      "ui_request_info_xrpl_2c7b1a9d5e",
                      "Use XRPL native payment request (Payment Channel)."
                    )}
                  {requestMethod === "notification" &&
                    t(
                      "ui_request_info_notification_7d1a4c9b2e",
                      "Send a notification to the specified wallet address."
                    )}
                </p>
              </div>
            </div>
        }
        </div>
      </div>
    </>;


  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
