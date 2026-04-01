import {
  MOONPAY_UI_ENABLED,
  MOONPAY_SELL_STATUS_ENABLED,
  MOONPAY_STATEMENT_TAG_FALLBACK,
  RAMP_DEFAULT_PROVIDER,
  TOPPER_UI_ENABLED,
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
      TOPPER_UI_ENABLED: process.env.TOPPER_UI_ENABLED ?? null,
      RAMP_DEFAULT_PROVIDER: process.env.RAMP_DEFAULT_PROVIDER ?? null,
    },
    parsed: {
      MOONPAY_UI_ENABLED,
      MOONPAY_STATEMENT_TAG_FALLBACK,
      MOONPAY_SELL_STATUS_ENABLED,
      TOPPER_UI_ENABLED,
      RAMP_DEFAULT_PROVIDER,
      sanity: {
        ui_enabled_from_raw: parseEnvBoolean(process.env.MOONPAY_UI_ENABLED, null),
        topper_ui_enabled_from_raw: parseEnvBoolean(
          process.env.TOPPER_UI_ENABLED,
          null,
        ),
      },
    },
  });
}
