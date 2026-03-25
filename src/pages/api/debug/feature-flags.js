import {
  MOONPAY_UI_ENABLED,
  MOONPAY_SELL_STATUS_ENABLED,
  MOONPAY_STATEMENT_TAG_FALLBACK,
  parseEnvBoolean,
} from "@/utils/featureFlags";

export default function handler(req, res) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  return res.status(200).json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      MOONPAY_UI_ENABLED: process.env.MOONPAY_UI_ENABLED ?? null,
      MOONPAY_STATEMENT_TAG_FALLBACK:
        process.env.MOONPAY_STATEMENT_TAG_FALLBACK ?? null,
      MOONPAY_SELL_STATUS_ENABLED: process.env.MOONPAY_SELL_STATUS_ENABLED ?? null,
    },
    parsed: {
      MOONPAY_UI_ENABLED,
      MOONPAY_STATEMENT_TAG_FALLBACK,
      MOONPAY_SELL_STATUS_ENABLED,
      sanity: {
        ui_enabled_from_raw: parseEnvBoolean(process.env.MOONPAY_UI_ENABLED, null),
      },
    },
  });
}

