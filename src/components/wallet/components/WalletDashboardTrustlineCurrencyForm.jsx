"use client";import { useTranslation } from "next-i18next";

export default function WalletDashboardTrustlineCurrencyForm({
  currentEditingLine,
  editingTrustlineLocked,
  setEditingTrustlineLocked,
  onSave,
  onRemove,
  minLockedXcs = 0.2
}) {const { t } = useTranslation("common");
  return (
    <>
      {currentEditingLine &&
      <p className="text-[11px] text-white/70">{t("ui_currently_locked_6e8b9f74e1", "Actuellement verrouillé :")}
        {" "}
          <span className="font-semibold">
            {Number(currentEditingLine.lockedXcs || 0).toLocaleString("en-US", {
            maximumFractionDigits: 4
          })}{" "}{t("ui_xcs_03b4acfd2b", "XCS")}

        </span>
        </p>
      }

      <div className="space-y-2">
        <label className="block text-[11px] text-white/60 mb-1">{t("ui_locked_xcs_68d65407f8", "Locked XCS")}</label>
        <input
          type="number"
          min={minLockedXcs}
          step="0.0001"
          value={editingTrustlineLocked}
          onChange={(e) => setEditingTrustlineLocked(e.target.value)}
          placeholder="0.0000"
          className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80" />

      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSave?.();
          }}
          className="flex-1 px-3 py-2 rounded-lg bg-xcannes-green text-black text-sm font-semibold hover:bg-xcannes-green/90 transition-colors active:scale-95">{t("ui_save_9c004489ad", "Enregistrer")}


        </button>
        {currentEditingLine &&
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="flex-1 px-3 py-2 rounded-lg bg-red-500/80 text-white text-sm font-semibold hover:bg-red-500 transition-colors active:scale-95">{t("ui_delete_trustline_298bb3739d", "Supprimer la trustline")}


        </button>
        }
      </div>
    </>);

}
