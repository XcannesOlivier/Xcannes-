"use client";

import { useEffect, useMemo, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import QRScanner from "../components/QRScanner";
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
  handlePaymentRequestScan,
  handleSendSubmit,
  sendProcessing,
  enableSaveAddress = false
}) {const { t } = useTranslation("common");
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [saveNewAddressLabel, setSaveNewAddressLabel] = useState("");
  const [requestText, setRequestText] = useState("");
  const payreqFileInputId = "payreq-qr-file";

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination]
  );
  const isSavedDestination = useMemo(() => {
    return (savedAddresses || []).some(
      (addr) => addr.address === normalizedDestination
    );
  }, [savedAddresses, normalizedDestination]);
  const canSaveDestination =
    enableSaveAddress && normalizedDestination && !isSavedDestination;

  useEffect(() => {
    if (!open) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
      setRequestText("");
    }
  }, [open]);

  useEffect(() => {
    if (!canSaveDestination) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
    }
  }, [canSaveDestination]);

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
          "relative w-full max-w-md bg-elevated border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto",
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
              {sendTab === "manual" ? "Send assets" : "Pay Request"}
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
            onClick={() => setSendTab("scan-request")}
            title={t("ui_send_tab_payreq_tip", "Payer via un code de demande.")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
            sendTab === "scan-request" ?
            "bg-xcannes-green text-black font-semibold" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_scan_request_44801f50d1", "Scan Request")}


          </button>
            <button
            type="button"
            onClick={() => setSendTab("manual")}
            title={t("ui_send_tab_manual_tip", "Envoyer manuellement à une adresse.")}
            className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
            sendTab === "manual" ?
            "bg-xcannes-green text-black font-semibold" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_manual_send_d5de1bf948", "Manual Send")}


          </button>
          </div>


          {/* Tab Content: Manual Send */}
          {sendTab === "manual" &&
        <div className="space-y-3">
              <div>
                <label
                  className="block text-[11px] md:text-xs text-white/60 mb-1"
                  title={t("ui_send_asset_tip", "Sélectionnez la devise à envoyer.")}
                >
                  {t("ui_asset_e5170a7a06", "Asset")}

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
                <label
                  className="block text-[11px] md:text-xs text-white/60 mb-1"
                  title={t("ui_send_amount_tip", "Saisissez le montant à envoyer.")}
                >
                  {t("ui_amount_52cea2dd3d", "Amount")}

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
                <label
                  className="block text-[11px] md:text-xs text-white/60 mb-1"
                  title={t("ui_send_destination_tip", "Adresse XRPL du destinataire.")}
                >
                  {t("ui_destination_xrpl_address_9c2b94554c", "Destination (XRPL address)")}

            </label>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                    type="text"
                    list="saved-addresses"
                    value={sendDestination}
                    onChange={(e) => setSendDestination(e.target.value)}
                    placeholder={(savedAddresses || []).length > 0 ?
                    t("ui_select_saved_address_60c28f89c1", "Select saved address...") :
                    t("ui_rxxxxxxxxxxxxxxxxxxxxxxxxxxx_26c99db80a", "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80" />
                      <datalist id="saved-addresses">
                        {(savedAddresses || []).map((addr, idx) =>
                  <option
                    key={idx}
                    value={addr.address}
                    label={`${addr.label} (${addr.address.slice(0, 8)}...${addr.address.slice(-6)})`} />
                  )}
                      </datalist>
                    </div>

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

                  {canSaveDestination ?
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 space-y-2">
                      <label className="flex items-center gap-2 text-[11px] text-white/60">
                        <input
                      type="checkbox"
                      checked={saveNewAddress}
                      onChange={(e) => setSaveNewAddress(e.target.checked)}
                      className="accent-xcannes-green" />
                        {t("ui_save_this_address_7ef65aa11c", "Save this address?")}
                      </label>
                      {saveNewAddress ?
                <div className="space-y-1">
                          <div className="text-[11px] text-white/60">
                            {t("ui_label_optional_3b6a3c454c", "Label (optional)")}
                          </div>
                          <input
                      type="text"
                      value={saveNewAddressLabel}
                      onChange={(e) => setSaveNewAddressLabel(e.target.value)}
                      placeholder={t("ui_e_g_exchange_friend_11008b5e9e", "e.g., Exchange, Friend, ...")}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-xcannes-green/80" />
                        </div> :
                null}
                    </div> :
              null}
                </div>
              </div>
              <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const result = await handleSendSubmit?.({
                saveDestination:
                  saveNewAddress && canSaveDestination ? normalizedDestination : "",
                saveLabel: saveNewAddressLabel
              });
              if (result?.ok) {
                setSaveNewAddress(false);
                setSaveNewAddressLabel("");
              }
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
              <QRScanner
              isOpen={sendTab === "scan-request"}
              onScan={handlePaymentRequestScan}
              embedded={true}
              showClose={false}
              fileInputId={payreqFileInputId}
              className="bg-black/30 border-white/10" />

              <div className="flex items-center gap-3 text-[11px] text-white/35">
                <span className="h-px flex-1 bg-white/10" />
                <span>{t("ui_or_8a4c1f83bd", "ou")}</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <div className="rounded-lg border border-white/5 bg-white/5 p-3 space-y-2">
                <div className="text-[11px] text-white/45">
                  {t("demo_payreq_token", "Request token")}
                </div>
                <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const input = document.getElementById(payreqFileInputId);
                  input?.click();
                }}
                className="inline-flex items-center gap-2 text-[11px] text-white/55 hover:text-white/70 transition-colors">

                  <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/10 text-white/50">
                    +
                  </span>
                  {t("ui_or_upload_a_qr_image_works_e_df6baa8039", "Upload a QR image")}
                </button>
                <textarea
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                className="w-full min-h-[110px] rounded-md bg-black/40 border border-white/10 px-3 py-2 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-xcannes-green/30 font-mono"
                placeholder="xcannes-payreq:... / JSON" />
                <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePaymentRequestScan?.(requestText);
                }}
                disabled={!requestText.trim()}
                className="w-full px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

                  {t("demo_scan_parse", "Load request")}
                </button>
              </div>

            </div>
        }
        </div>
      </div>
    </>;


  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
