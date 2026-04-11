"use client";

export default function WalletActiveLabel({
  prefix = "",
  label = "",
  className = "",
  prefixClassName = "",
  labelClassName = "",
  dotClassName = "",
  labelWrap = false,
}) {
  const resolvedLabel = String(label || "").trim() || "Wallet";
  const resolvedPrefix = String(prefix || "").trim();
  const wrapperAlignClass = labelWrap ? "items-start" : "items-center";
  const prefixAlignClass = labelWrap ? "mt-0.5" : "";
  // When wrapping, align the pulsing dot with the first line's visual center.
  // `mt-2` matches the typical (text-base) line-height minus dot size.
  const dotAlignClass = labelWrap ? "mt-2" : "";
  const labelBaseClass = labelWrap
    ? "min-w-0 whitespace-normal break-words"
    : "truncate min-w-0";

  return (
    <div
      className={[
        "flex gap-2 min-w-0",
        wrapperAlignClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {resolvedPrefix ? (
        <span
          className={[
            "font-medium text-white/55 shrink-0",
            prefixAlignClass,
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
          dotAlignClass,
          dotClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      />
      <span
        className={[labelBaseClass, labelClassName].filter(Boolean).join(" ")}
      >
        {resolvedLabel}
      </span>
    </div>
  );
}
