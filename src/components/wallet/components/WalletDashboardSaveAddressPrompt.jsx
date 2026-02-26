"use client";

import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/utils/useModalTransition";

export default function WalletDashboardSaveAddressPrompt({
  open,
  addressToSave,
  addressLabel,
  setAddressLabel,
  onClose,
  onSave,
}) {
  const { t } = useTranslation("common");
  const { shouldRender, isClosing } = useModalTransition(open);

  if (!shouldRender) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
          isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
        }`}
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className={`relative w-full max-w-md bg-gray-900 border-0 md:border md:border-white/10 rounded-2xl overflow-hidden pointer-events-auto ${
            isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-2">
              {t("ui_save_this_address_7ef65aa11c", "Save this address?")}
            </h3>
            <p className="text-sm text-white/60 mb-4">
              {t(
                "ui_would_you_like_to_save_this__117bb9f717",
                "Would you like to save this address for future use?",
              )}
            </p>
            <div className="mb-4">
              <label className="block text-xs text-white/60 mb-2">
                {t("ui_address_2ef763fa89", "Address")}
              </label>
              <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-mono break-all">
                {addressToSave}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xs text-white/60 mb-2">
                {t("ui_label_optional_3b6a3c454c", "Label (optional)")}
              </label>
              <input
                type="text"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
                placeholder={t(
                  "ui_e_g_exchange_friend_11008b5e9e",
                  "e.g., Exchange, Friend, ...",
                )}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                {t("ui_skip_95d6fefee9", "Skip")}
              </button>
              <button
                onClick={onSave}
                className="flex-1 px-4 py-2.5 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
              >
                {t("ui_save_47661c12f6", "Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
