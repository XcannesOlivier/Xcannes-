import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import xcannesApi from "../../lib/xcannesApi";
import { getBookIdFromPair } from "../../utils/xrpl";

const FALLBACK_USD_RATES = {
  EUR: 1.08,
  GBP: 1.26,
  MXN: 0.058,
  ARS: 0.0012,
  BRL: 0.2,
  NGN: 0.001,
  INR: 0.012,
  PHP: 0.018,
  XAF: 0.0017,
};

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatMoney(locale, amount, currency) {
  const safeLocale = locale || "en";
  try {
    return new Intl.NumberFormat(safeLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "USD" ? 2 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function HomeLocalPaymentSection({ availablePairs = [] }) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const currencies = useMemo(
    () => [
      { code: "EUR", label: "Euro" },
      { code: "MXN", label: "Peso" },
      { code: "ARS", label: "Peso" },
      { code: "XAF", label: "Franc CFA" },
      { code: "NGN", label: "Naira" },
      { code: "PHP", label: "Peso" },
    ],
    []
  );

  const [currency, setCurrency] = useState("EUR");
  const [amount, setAmount] = useState("120");
  const [rateUsdPerLocal, setRateUsdPerLocal] = useState(null);
  const [rateSource, setRateSource] = useState("fallback"); // "live" | "fallback"
  const [loadingRate, setLoadingRate] = useState(false);

  const resolvedAmount = useMemo(() => {
    const parsed = safeNumber(String(amount).replace(",", "."));
    return parsed === null ? 0 : Math.max(0, parsed);
  }, [amount]);

  const usdEquivalent = useMemo(() => {
    if (!rateUsdPerLocal) return null;
    return resolvedAmount * rateUsdPerLocal;
  }, [resolvedAmount, rateUsdPerLocal]);

  useEffect(() => {
    let cancelled = false;

    const fallback = () => {
      const fallbackRate = FALLBACK_USD_RATES[currency] || null;
      if (!cancelled) {
        setRateUsdPerLocal(fallbackRate);
        setRateSource("fallback");
        setLoadingRate(false);
      }
    };

    const loadRate = async () => {
      setLoadingRate(true);

      const direct = `${currency}/USD`;
      const inverse = `USD/${currency}`;
      const pair = availablePairs.includes(direct)
        ? direct
        : availablePairs.includes(inverse)
        ? inverse
        : null;
      if (!pair) {
        fallback();
        return;
      }

      const book = getBookIdFromPair(pair);
      if (!book?.backendPair) {
        fallback();
        return;
      }

      try {
        const ticker = await xcannesApi.getTicker(book.backendPair);
        const lastPrice = safeNumber(ticker?.lastPrice);
        if (!lastPrice || lastPrice <= 0) {
          fallback();
          return;
        }

        const [base, quote] = pair.split("/");
        const usdPerLocal =
          quote === "USD"
            ? lastPrice // 1 LOCAL = X USD
            : 1 / lastPrice; // 1 USD = X LOCAL => 1 LOCAL = 1/X USD

        if (!cancelled) {
          setRateUsdPerLocal(usdPerLocal);
          setRateSource("live");
          setLoadingRate(false);
        }
      } catch {
        fallback();
      }
    };

    loadRate();
    return () => {
      cancelled = true;
    };
  }, [currency, availablePairs]);

  return (
    <section className="relative py-16 md:py-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">
              {t("home_localpay_badge", "Paiement local")}
            </p>
            <h2 className="text-2xl sm:text-3xl font-montserrat font-semibold text-white">
              {t("home_localpay_title", "Le client paie dans sa monnaie.")}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/65 max-w-xl">
              {t(
                "home_localpay_subtitle",
                "Sur XCANNES, les montants, reçus et relevés sont présentés dans la devise du pays — tout en restant adossés à la stabilité USD."
              )}
            </p>

            <div className="mt-6 space-y-2 text-sm text-white/65">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green" />
                <span>
                  {t(
                    "home_localpay_point1",
                    "Les prix et montants s’affichent en monnaie locale."
                  )}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green" />
                <span>
                  {t(
                    "home_localpay_point2",
                    "Validation via Xumm/Xaman, signature explicite."
                  )}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-xcannes-green" />
                <span>
                  {t(
                    "home_localpay_point3",
                    "Conversions au taux marché (selon disponibilité des paires)."
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/90">
                {t("home_localpay_demo_title", "Simulation de paiement")}
              </div>
              <div className="text-[11px] text-white/45">
                {loadingRate
                  ? t("home_localpay_demo_rate_loading", "Taux…")
                  : rateSource === "live"
                  ? t("home_localpay_demo_rate_live", "Taux en direct")
                  : t("home_localpay_demo_rate_fallback", "Taux estimatif")}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-2">
                <label className="text-xs text-white/55">
                  {t("home_localpay_amount_label", "Montant")}
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-4 py-3 text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
                  placeholder={t("home_localpay_amount_placeholder", "Ex: 120")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-white/55">
                  {t("home_localpay_currency_label", "Devise")}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-4 py-3 text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/40"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-xs text-white/55">
                  {t("home_localpay_you_pay", "Le client paie")}
                </div>
                <div className="text-lg font-semibold text-white">
                  {formatMoney(locale, resolvedAmount, currency)}
                </div>
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-3">
                <div className="text-xs text-white/55">
                  {t("home_localpay_backed_by", "Valeur adossée (USD)")}
                </div>
                <div className="text-sm font-semibold text-white/85">
                  {usdEquivalent !== null
                    ? formatMoney(locale, usdEquivalent, "USD")
                    : "—"}
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-black/25 border border-white/10 px-4 py-3">
                <div className="text-[11px] text-white/55 leading-relaxed">
                  {t(
                    "home_localpay_demo_note",
                    "L’utilisateur interagit en monnaie locale. La stabilité est assurée par une base USD."
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
