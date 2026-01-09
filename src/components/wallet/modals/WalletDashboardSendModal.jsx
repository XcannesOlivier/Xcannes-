"use client";

import TokenAmountInput from "@/components/ui/TokenAmountInput";
import WalletNotConnectedNotice from "../components/WalletNotConnectedNotice";
import { createPortal } from "react-dom";import { useTranslation } from "next-i18next";

export default function WalletDashboardSendModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  sendTab,
  setSendTab,
  renderWalletMeta,
  augmentedTokens,
  selectedSendToken,
  sendFxInfo,
  setSendAssetKey,
  sendAmount,
  setSendAmount,
  savedAddresses,
  sendDestination,
  setSendDestination,
  setQrScannerOpen,
  setPaymentRequestScannerOpen,
  handleSendSubmit,
  sendProcessing
}) {const { t } = useTranslation("common");
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
        className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
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
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
            {sendTab === "manual" ? "Send assets" : "Pay Request"}
          </h3>
          {renderWalletMeta?.("mb-2")}
          <WalletNotConnectedNotice
          show={isPreviewMode}
          variant={noticeVariant}
          contextLabel={noticeContextLabel} />


          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button
            type="button"
            onClick={() => setSendTab("manual")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
            sendTab === "manual" ?
            "bg-xcannes-green text-black font-semibold" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_manual_send_d5de1bf948", "Manual Send")}


          </button>
            <button
            type="button"
            onClick={() => setSendTab("scan-request")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
            sendTab === "scan-request" ?
            "bg-xcannes-green text-black font-semibold" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_scan_request_44801f50d1", "Scan Request")}


          </button>
          </div>

          <p className="text-xs md:text-sm text-white/50 mb-2 md:mb-4">
            {sendTab === "manual" ?
          "Choisissez l'actif, le montant et l'adresse XRPL de destination." :
          "Scannez un QR code de demande de paiement."}
          </p>

          {/* Tab Content: Manual Send */}
          {sendTab === "manual" &&
        <div className="space-y-3">
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_asset_e5170a7a06", "Asset")}

            </label>
                <select
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
              value={selectedSendToken ? selectedSendToken.key : ""}
              onChange={(e) => setSendAssetKey(e.target.value)}
              onClick={(e) => e.stopPropagation()}>

                  {(augmentedTokens || []).map((t) =>
              <option key={t.key} value={t.key}>
                      {t.currency}
                    </option>
              )}
                </select>
                {selectedSendToken &&
            <p className="mt-1 text-[11px] text-white/40">{t("ui_balance_340cdcff7a", "Balance:")}

              <span className="text-white/70">
                      {selectedSendToken.value.toLocaleString("en-US", {
                  maximumFractionDigits: 6
                })}{" "}
                      {selectedSendToken.currency}
                    </span>
                  </p>
            }
              </div>
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_amount_52cea2dd3d", "Amount")}

            </label>
                <TokenAmountInput
              value={sendAmount}
              onChange={setSendAmount}
              max={sendFxInfo ? undefined : selectedSendToken ? selectedSendToken.value : undefined}
              placeholder="0.0000"
              token={selectedSendToken?.currency || "XRP"} />

              </div>

              {sendFxInfo &&
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-[11px] font-semibold text-white/80">{t("ui_payment_fx_base_usd_r_gleme_4818b8a6c3", "Paiement FX (base USD · règlement XRPL via RLUSD)")}

            </div>
                  <p className="mt-1 text-[11px] text-white/60">
                    ≈{" "}
                    <span className="font-mono">
                      {Number(sendFxInfo.paymentRlusd || 0).toLocaleString("en-US", {
                  maximumFractionDigits: 6
                })}{" "}{t("ui_rlusd_ff5048a674", "RLUSD")}

              </span>{" "}{t("ui_au_recipient_67dcc85cec", "au destinataire")}

            </p>
                  {Number(sendFxInfo.spreadFeeRlusd || 0) > 0 &&
            <p className="mt-1 text-[11px] text-white/60">{t("ui_spread_xcannes_tier_7ad17576d3", "Spread XCANNES (tier")}
              {" "}
                      <span className="font-mono">{sendFxInfo.spreadTier || "A"}</span>,{" "}
                      {sendFxInfo.fxSource ?
              <>{t("ui_source_507c065942", "source")}
                {" "}
                          <span className="font-mono">{String(sendFxInfo.fxSource).toUpperCase()}</span>
                        </> :

              "source inconnue"
              }
                      ):{" "}
                      <span className="font-mono">
                        {Number(sendFxInfo.spreadFeeRlusd || 0).toLocaleString("en-US", {
                  maximumFractionDigits: 6
                })}{" "}{t("ui_rlusd_ff5048a674", "RLUSD")}

              </span>
                    </p>
            }
                  <p className="mt-2 text-[10px] text-white/45">
                    {Number(sendFxInfo.spreadFeeRlusd || 0) > 0 ?
              "2 signatures Xumm: spread → XCANNES, puis paiement → destinataire." :
              "1 signature Xumm: paiement → destinataire."}
                  </p>
                </div>
          }
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_destination_xrpl_address_9c2b94554c", "Destination (XRPL address)")}

            </label>

                {/* Dropdown pour adresses sauvegardées */}
                {(savedAddresses || []).length > 0 &&
            <div className="mb-2">
                    <select
                onChange={(e) => {
                  if (e.target.value) {
                    setSendDestination(e.target.value);
                  }
                }}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-xcannes-green/80">

                      <option value="">{t("ui_select_saved_address_60c28f89c1", "Select saved address...")}</option>
                      {savedAddresses.map((addr, idx) =>
                <option key={idx} value={addr.address}>
                          {addr.label} ({addr.address.slice(0, 8)}...
                          {addr.address.slice(-6)})
                        </option>
                )}
                    </select>
                  </div>
            }

                <div className="flex gap-2">
                  <input
                type="text"
                value={sendDestination}
                onChange={(e) => setSendDestination(e.target.value)}
                placeholder={t("ui_rxxxxxxxxxxxxxxxxxxxxxxxxxxx_26c99db80a", "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")}
                className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80" />

                  <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQrScannerOpen(true);
                }}
                className="md:hidden px-3 py-2.5 bg-xcannes-green/20 hover:bg-xcannes-green/30 border border-xcannes-green/40 rounded-lg transition-colors"
                title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}>

                    <svg
                  className="w-5 h-5 text-xcannes-green"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">

                      <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />

                    </svg>
                  </button>
                </div>
              </div>
              <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSendSubmit();
            }}
            disabled={sendProcessing}
            className="w-full mt-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-white/10">

                {sendProcessing ? "Sending..." : "Send"}
              </button>
            </div>
        }

          {/* Tab Content: Scan Request */}
          {sendTab === "scan-request" &&
        <div className="space-y-6">
              {/* Header explicatif */}
              <div className="bg-gradient-to-br from-xcannes-green/10 to-emerald-600/10 border border-xcannes-green/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-xcannes-green/20 rounded-full flex items-center justify-center">
                    <svg
                  className="w-6 h-6 text-xcannes-green"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">

                      <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-sm mb-1">{t("ui_pay_a_payment_request_0a5c61fa4c", "Pay a Payment Request")}

                </h3>
                    <p className="text-white/70 text-xs leading-relaxed">{t("ui_scan_a_qr_code_to_pay_a_merc_a5eaca7464", "Scan a QR code to pay a merchant, friend, or service instantly. The payment details will be filled automatically.")}



                </p>
                  </div>
                </div>
              </div>

              {/* Bouton principal de scan */}
              <div className="text-center py-6">
                <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPaymentRequestScannerOpen(true);
              }}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-xcannes-green to-emerald-600 hover:from-xcannes-green/90 hover:to-emerald-600/90 rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-xcannes-green/30">

                  <svg
                className="w-7 h-7 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">

                    <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />

                  </svg>
                  <span className="text-black font-bold text-base">{t("ui_scan_qr_code_44b98df9b6", "Scan QR Code")}

              </span>
                </button>
              </div>

              {/* Info supplémentaire */}
              <div className="bg-black/20 border border-white/5 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg
                className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">

                    <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

                  </svg>
                  <p className="text-white/60 text-xs leading-relaxed">{t("ui_compatible_with_xrpl_payment_be47f01f33", "Compatible with XRPL payment requests, Xaman (XUMM) QR codes, and standard crypto addresses.")}


              </p>
                </div>
              </div>
            </div>
        }
        </div>
      </div>
    </>;


  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}