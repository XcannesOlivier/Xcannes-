"use client";import { useTranslation } from "next-i18next";

export default function DemoWalletModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClassName = "max-w-md"
}) {const { t } = useTranslation("common");
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose} />

      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className={[
          "relative w-full bg-elevated border border-white/10 rounded-2xl p-4 md:p-5 space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto",
          maxWidthClassName].
          join(" ")}
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
            aria-label={t("ui_close_ed73c869c7", "Close")}>

            ✕
          </button>

          <div className="pr-6">
            {title ?
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                {title}
              </h3> :
            null}
            {subtitle ?
            <p className="mt-1 text-xs text-white/60">{subtitle}</p> :
            null}
          </div>

          {children}
        </div>
      </div>
    </>);

}
