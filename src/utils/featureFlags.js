const normalizeEnvString = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

// Important: client bundles cannot reliably read `process.env[name]` dynamically
// (Next inlines only explicit `process.env.MY_VAR` references).
export const parseEnvBoolean = (rawValue, defaultValue = false) => {
  const raw = normalizeEnvString(rawValue);
  if (!raw) return defaultValue;
  const normalized = raw.toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
};

const IS_PROD = process.env.NODE_ENV === "production";

// Phase 0 flags (feature gating / rollback safe)
export const MOONPAY_UI_ENABLED = parseEnvBoolean(
  process.env.MOONPAY_UI_ENABLED,
  // Safe-by-default in production, but don't break local/dev by default.
  !IS_PROD,
);

export const MOONPAY_STATEMENT_TAG_FALLBACK = parseEnvBoolean(
  process.env.MOONPAY_STATEMENT_TAG_FALLBACK,
  false,
);

export const MOONPAY_SELL_STATUS_ENABLED = parseEnvBoolean(
  process.env.MOONPAY_SELL_STATUS_ENABLED,
  false,
);
