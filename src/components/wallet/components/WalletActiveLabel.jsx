"use client";

export default function WalletActiveLabel({
  prefix = "",
  label = "",
  className = "",
  prefixClassName = "",
  labelClassName = "",
  dotClassName = "",
}) {
  const resolvedLabel = String(label || "").trim() || "Wallet";
  const resolvedPrefix = String(prefix || "").trim();

  return (
    <div className={["flex items-center gap-2 min-w-0", className].filter(Boolean).join(" ")}>
      {resolvedPrefix ? (
        <span
          className={[
            "font-medium text-white/55 shrink-0",
            prefixClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {resolvedPrefix}
        </span>
      ) : null}
      <span
        className={[
          "h-2 w-2 rounded-full ring-4 ring-xcannes-green/25 bg-xcannes-green shrink-0 animate-pulse",
          dotClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      />
      <span
        className={["truncate min-w-0", labelClassName].filter(Boolean).join(" ")}
      >
        {resolvedLabel}
      </span>
    </div>
  );
}
