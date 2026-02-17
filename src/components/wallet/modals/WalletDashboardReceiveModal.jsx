"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import { XCANNES_MEMO_SCHEMAS } from "@/utils/xrplMemo";
import { useModalTransition } from "@/utils/useModalTransition";

export default function WalletDashboardReceiveModal({
  open,
  onClose,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  dashboardVariant = "default",
  receiveTab,
  setReceiveTab,
  renderWalletMeta,
  effectiveWallet,
  handleCopyAddress,
  requestAmount,
  setRequestAmount,
  requestCurrency,
  setRequestCurrency,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  augmentedTokens,
  requestMemo,
  setRequestMemo,
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  walletLabel,
  onRequestGenerated,
  inline = false
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
  const greenActionBtnBase =
    "rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const greenActionBtnMuted =
    "rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 text-white/85 font-semibold transition-all duration-200 hover:bg-[#22C55E]/20 hover:text-white/95 hover:scale-105 active:scale-95";
  const greenTabInactive =
    "rounded-lg border border-white/20 bg-transparent text-white/60 font-semibold transition-all duration-200 hover:border-white/35 hover:text-white/80";
  const [generatedRequest, setGeneratedRequest] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const showPersistentRequestPreview = false;
  const showWalletPageRequestDecor = false;

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

  useEffect(() => {
    if (!open) {
      setGeneratedRequest(null);
      setGenerateError(null);
    }
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    setGeneratedRequest(null);
    setGenerateError(null);
  }, [effectiveWallet, requestAmount, requestCurrency, requestMemo]);

  const isFxRequest = useMemo(() => {
    if (!selectedRequestToken?.isTrustlineOnly) return false;
    if (!requestCurrencyCode) return false;
    return requestCurrencyCode !== "XRP" && requestCurrencyCode !== "RLUSD" && requestCurrencyCode !== "RLUSD";
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
    } else {
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
        : targetCurrencyUpper === "RLUSD"
          ? XRPL_KNOWN_ISSUERS.RLUSD
          : null;
    const issuer = isFxRequest ? null : knownIssuer || (issuerLooksValid ? issuerCandidate : null);

    const beneficiaryLabel = String(walletLabel || "").trim() || null;
    const req = {
      schema: XCANNES_MEMO_SCHEMAS.payreq.schema,
      to: effectiveWallet,
      targetCurrency: targetCurrencyUpper,
      displayAmount: amount,
      displayCurrency: targetCurrencyUpper,
      amountRlusd: Number.isFinite(amountRlusd) ? amountRlusd : null,
      fxRate,
      fxSource,
      issuer,
      memo: requestMemo || "",
      beneficiaryLabel,
      createdAt: new Date().toISOString()
    };

    setGeneratedRequest(req);
    onRequestGenerated?.(req);
  };

  const requestValue = useMemo(() => {
    if (!generatedRequest) return "";
    try {
      return JSON.stringify(generatedRequest);
    } catch {
      return "";
    }
  }, [generatedRequest]);
  const requestDecorValue = useMemo(() => {
    if (effectiveWallet) return `xcannes-request:${effectiveWallet}`;
    return "xcannes-request";
  }, [effectiveWallet]);
  const shouldShowRequestPreview =
    showPersistentRequestPreview || (Boolean(generatedRequest) && Boolean(requestValue));
  const showRequestPlaceholder = !generatedRequest || !requestValue;
  const qrSize = inline ? 240 : 180;

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-receive-modal border border-white/10 p-4 md:p-5 space-y-3 overflow-y-auto flex flex-col min-h-0 overscroll-contain pointer-events-auto",
    inline ? "h-full max-h-none rounded-xl" : "max-w-md md:max-w-lg max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline ? (isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in") : "",
  ].join(" ");

  const content =
  <>
      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
        />
      ) : null}

      {/* Modale */}
      <div className={wrapperClass}>
        <div
        className={panelClass}
        style={{ WebkitOverflowScrolling: "touch" }}
        onClick={(e) => {
          if (!inline) e.stopPropagation();
        }}>

          <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="wallet-modal-close absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10">

            ✕
          </button>
          <div className="flex flex-wrap items-center gap-2 mb-1 pr-6">
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
              {receiveTab === "receive"
                ? t(
                    "ui_receive_assets_title_b3c7f4d2a1",
                    "Receive assets"
                  )
                : t("ui_request_payment_c62b99fb16", "Request Payment")}
            </h3>
            {noticeVariant === "demo" ? (
              <span className="inline-flex items-center text-white/70 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                {t("demo_notice_title", "Mode démo")}
              </span>
            ) : null}
            {showNotConnectedNotice ? (
              <span className="inline-flex items-center text-xcannes-yellow text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                {t("wallet_not_connected_title", "Wallet not connected")}
              </span>
            ) : null}
            {showNotActivatedNotice ? (
              <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                {t(
                  "wallet_not_activated_title",
                  "Wallet not activated: a minimum reserve of 1 XRP is required."
                )}
              </span>
            ) : null}
            {showRlusdNotActivatedNotice ? (
              <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                {t(
                  "wallet_rlusd_not_activated_title",
                  "RLUSD not activated. Authorize RLUSD on your wallet."
                )}
              </span>
            ) : null}
          </div>
          {renderWalletMeta?.("mb-2")}


          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button
            type="button"
            onClick={() => setReceiveTab("receive")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm ${
            receiveTab === "receive" ? greenActionBtnMuted : greenTabInactive
            }`}>{t("ui_receive_b7d6ae4037", "Receive")}


          </button>
            <button
            type="button"
            onClick={() => setReceiveTab("request")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm ${
            receiveTab === "request" ? greenActionBtnMuted : greenTabInactive
            }`}>{t("ui_request_payment_c62b99fb16", "Request Payment")}


          </button>
          </div>

          <div className={inline ? "flex-1 min-h-0 flex flex-col" : ""}>
            <div key={receiveTab} className="wallet-tab-unfold-in">
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
        <div className={`flex flex-col items-center gap-3 ${inline ? "flex-1 min-h-0 justify-center" : ""}`}>
              <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                <QRCodeCanvas
              value={effectiveWallet}
              size={qrSize}
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
	            className="px-4 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-white/90 font-semibold transition-colors">{t("ui_copy_address_779691d570", "Copy address")}

	
	          </button>
            </div>
        }

              {/* Tab Content: Request Payment */}
              {receiveTab === "request" && effectiveWallet &&
        <div className={`space-y-4 ${inline ? "flex-1 min-h-0 flex flex-col" : ""}`}>
              <div className={inline ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-between gap-[clamp(12px,2.2vh,26px)]" : "space-y-4"}>
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
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-base md:text-sm text-white outline-none focus:border-xcannes-green/80" />

                </div>
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_currency_1ed55673be", "Currency")}

              </label>
                  <ModalSelect
                value={requestCurrency}
                onChange={setRequestCurrency}
                options={(augmentedTokens || []).map((token) => {
                  const currencyUpper = String(token.currency || "").toUpperCase();
                  const labelLeft =
                    selectLabelByCurrency?.[token.currency] ||
                    selectLabelByCurrency?.[currencyUpper] ||
                    token.currency;
                  const labelRight =
                    selectLabelRightByCurrency?.[token.currency] ||
                    selectLabelRightByCurrency?.[currencyUpper] ||
                    null;
                  return {
                    value: token.currency,
                    icon:
                      selectIconByCurrency?.[token.currency] ||
                      selectIconByCurrency?.[currencyUpper] ||
                      null,
                    label: labelLeft,
                    labelLeft,
                    labelRight,
                    labelMobile:
                      selectLabelMobileByCurrency?.[token.currency] ||
                      selectLabelMobileByCurrency?.[currencyUpper] ||
                      labelLeft,
                  };
                })}
                useNativeSelect={false}
                buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 cursor-pointer"
                menuClassName={noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"}
                selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                hideMobileSelectedRight={receiveTab === "request"}
              />
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

              {/* Generate Button */}
              <SwipeConfirmButton
              label={t("ui_generate_request_58584f23a2", "Generate Request")}
              onConfirm={handleGenerateRequest}
              variant="green"
              className="mt-2 md:hidden" />
              <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateRequest();
            }}
            className={`hidden md:block w-full mt-2 text-sm py-2.5 ${greenActionBtnMuted}`}>{t("ui_generate_request_58584f23a2", "Generate Request")}


          </button>

              {generateError &&
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {generateError}
                </div>
          }

              </div>

              {shouldShowRequestPreview &&
          <div className="space-y-3">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative bg-black/60 border border-white/10 rounded-xl p-3 overflow-hidden">
                      {showWalletPageRequestDecor ? (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="opacity-30" style={{ filter: "brightness(0.2)" }}>
                            <QRCodeCanvas
                              value={requestDecorValue}
                              size={qrSize}
                              bgColor="#000000"
                              fgColor="#ffffff"
                            />
                          </div>
                        </div>
                      ) : null}
                      <div className="relative z-10">
                        {showRequestPlaceholder ? (
                          <div
                            className="flex items-center justify-center text-center text-xs text-white/50"
                            style={{ width: qrSize, height: qrSize }}
                          >
                            {t(
                              "ui_request_qr_placeholder_2c4f7a1d9b",
                              "Votre QR code sera créé ici"
                            )}
                          </div>
                        ) : (
                          <QRCodeCanvas
                            value={requestValue}
                            size={qrSize}
                            bgColor="#000000"
                            fgColor="#ffffff"
                          />
                        )}
                      </div>
                    </div>
                    <div className={`w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/70 break-all ${showRequestPlaceholder ? "text-center" : ""}`}>
                      {showRequestPlaceholder
                        ? t(
                            "ui_request_code_placeholder_8c1e7b4d2a",
                            "Votre code de demande de paiement apparaîtra ici"
                          )
                        : requestValue}
                    </div>
                    {!showRequestPlaceholder ? (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await navigator.clipboard.writeText(requestValue);
                          } catch {
                            // ignore
                          }
                        }}
                        className={`px-4 py-2 text-xs ${greenActionBtnBase}`}
                      >
                        {t("ui_copy_request_32a3f4409b", "Copy request")}
                      </button>
                    ) : null}
                  </div>
                  {!showRequestPlaceholder ? (
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
                  ) : null}
                </div>
          }
              </div>
            </div>
          }
            </div>
          </div>
        </div>
      </div>
    </>;


  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
