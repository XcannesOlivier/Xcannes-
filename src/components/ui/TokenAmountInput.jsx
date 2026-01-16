import { useTranslation } from "next-i18next";
export default function TokenAmountInput({
  value,
  onChange,
  max,
  placeholder = "0.00",
  token = "XCS",
  tokenClassName = ""
}) {
  const { t } = useTranslation("common");
  const handleInput = (e) => {
    const raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
    if (raw.split(".").length > 2) return; // une seule virgule
    if (raw.length > 0 && isNaN(Number(raw))) return;

    if (onChange) {
      onChange(raw);
    }
  };

  const handleMaxClick = () => {
    if (max == null || !onChange) return;
    const next = String(max);
    onChange(next);
  };

  return (
    <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3 hover:border-white/20 focus-within:border-xcannes-green/40 transition-all duration-300">
      <input
        className="bg-transparent text-white w-full outline-none text-xl font-medium placeholder:text-white/30"
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={handleInput}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()} />

      {typeof max === "number" && max > 0 &&
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleMaxClick();
        }}
        className="text-[11px] uppercase tracking-wide text-white/50 hover:text-xcannes-green transition-colors mr-1 active:scale-95">{t("ui_max_4a27fb9fbf", "Max")}


      </button>
      }
      <span className={`font-bold text-sm uppercase tracking-wider whitespace-nowrap ${tokenClassName || "text-xcannes-green"}`}>
        {token}
      </span>
    </div>);

}
