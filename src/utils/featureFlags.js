const normalizeEnvString = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

export const readEnvBoolean = (name, defaultValue = false) => {
  const raw = normalizeEnvString(process.env[name]);
  if (!raw) return defaultValue;
  const normalized = raw.toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
};

const IS_PROD = process.env.NODE_ENV === "production";

// Phase 0 flags (feature gating / rollback safe)
export const MOONPAY_UI_ENABLED = readEnvBoolean(
  "MOONPAY_UI_ENABLED",
  // Safe-by-default in production, but don't break local/dev by default.
  !IS_PROD,
);

export const MOONPAY_STATEMENT_TAG_FALLBACK = readEnvBoolean(
  "MOONPAY_STATEMENT_TAG_FALLBACK",
  false,
);

export const MOONPAY_SELL_STATUS_ENABLED = readEnvBoolean(
  "MOONPAY_SELL_STATUS_ENABLED",
  false,
);

