import { useState } from "react";

export default function TokenAmountInput({
  value,
  onChange,
  max,
  placeholder = "0.00",
  token = "XCS",
}) {
  const [localValue, setLocalValue] = useState(value || "");

  const handleInput = (e) => {
    const raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
    if (raw.split(".").length > 2) return; // une seule virgule
    if (raw.length > 0 && isNaN(Number(raw))) return;

    setLocalValue(raw);
    if (onChange) onChange(raw);
  };

  return (
    <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3 hover:border-white/20 focus-within:border-xcannes-green/40 transition-all duration-300">
      <input
        className="bg-transparent text-white w-full outline-none text-xl font-medium placeholder:text-white/30"
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={localValue}
        onChange={handleInput}
      />
      <span className="text-xcannes-green font-bold text-sm uppercase tracking-wider whitespace-nowrap">
        {token}
      </span>
    </div>
  );
}
