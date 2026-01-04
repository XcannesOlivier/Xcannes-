"use client";

import { QRCodeCanvas } from "qrcode.react";

export default function WalletDashboardReceiveModal({
  open,
  onClose,
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
}) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modale */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
          >
            ✕
          </button>
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
            {receiveTab === "receive" ? "Receive assets" : "Request payment"}
          </h3>
          {renderWalletMeta?.("mb-2")}

          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setReceiveTab("receive")}
              className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
                receiveTab === "receive"
                  ? "bg-xcannes-green text-black font-semibold"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Receive
            </button>
            <button
              type="button"
              onClick={() => setReceiveTab("request")}
              className={`flex-1 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors ${
                receiveTab === "request"
                  ? "bg-xcannes-green text-black font-semibold"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Request Payment
            </button>
          </div>

          <p className="text-xs md:text-sm text-white/50 mb-3">
            {receiveTab === "receive"
              ? "Partagez cette adresse XRPL pour recevoir des fonds."
              : "Créez une demande de paiement à envoyer à un autre wallet."}
          </p>

          {/* Tab Content: Receive */}
          {receiveTab === "receive" && effectiveWallet && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                <QRCodeCanvas
                  value={effectiveWallet}
                  size={180}
                  bgColor="#000000"
                  fgColor="#ffffff"
                />
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
                className="px-4 py-2 rounded-md bg-white/10 text-xs text-white/80 hover:bg-white/20 transition-colors active:scale-95"
              >
                Copy address
              </button>
            </div>
          )}

          {/* Tab Content: Request Payment */}
          {receiveTab === "request" && effectiveWallet && (
            <div className="space-y-4">
              {/* Amount & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                  />
                </div>
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                    Currency
                  </label>
                  <select
                    value={requestCurrency}
                    onChange={(e) => setRequestCurrency(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                  >
                    {(augmentedTokens || []).map((t) => (
                      <option key={t.key} value={t.currency}>
                        {t.currency}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Memo (optional) */}
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                  Memo (optional)
                </label>
                <input
                  type="text"
                  value={requestMemo}
                  onChange={(e) => setRequestMemo(e.target.value)}
                  placeholder="Payment for..."
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                />
              </div>

              {/* Request Method Selection */}
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-2">
                  Send request via:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestMethod("qr")}
                    className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                      requestMethod === "qr"
                        ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                        : "bg-white/5 border-white/10 text-white/60"
                    } border`}
                  >
                    📱 QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestMethod("link")}
                    className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                      requestMethod === "link"
                        ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                        : "bg-white/5 border-white/10 text-white/60"
                    } border`}
                  >
                    🔗 Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestMethod("xrpl")}
                    className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                      requestMethod === "xrpl"
                        ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                        : "bg-white/5 border-white/10 text-white/60"
                    } border`}
                  >
                    💎 XRPL Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestMethod("notification")}
                    className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                      requestMethod === "notification"
                        ? "bg-xcannes-green/20 border-xcannes-green/40 text-xcannes-green"
                        : "bg-white/5 border-white/10 text-white/60"
                    } border`}
                  >
                    🔔 Notification
                  </button>
                </div>
              </div>

              {/* Conditional: Address for notification */}
              {requestMethod === "notification" && (
                <div>
                  <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                    Recipient Wallet Address
                  </label>
                  <input
                    type="text"
                    value={requestToAddress}
                    onChange={(e) => setRequestToAddress(e.target.value)}
                    placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                  />
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement payment request generation
                  alert(
                    `Payment request feature coming soon!\nMethod: ${requestMethod}\nAmount: ${requestAmount} ${requestCurrency}`
                  );
                }}
                className="w-full mt-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10"
              >
                Generate Request
              </button>

              {/* Info */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  {requestMethod === "qr" &&
                    "Generate a QR code that can be scanned to pay you."}
                  {requestMethod === "link" &&
                    "Create a shareable link for this payment request."}
                  {requestMethod === "xrpl" &&
                    "Use XRPL native payment request (Payment Channel)."}
                  {requestMethod === "notification" &&
                    "Send a notification to the specified wallet address."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

