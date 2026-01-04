"use client";

import { useState } from "react";

export function useSwapDemoLines({ demoRlusdTotal }) {
  const [demoLines, setDemoLines] = useState(() => ({
    RLUSD: {
      currency: "RLUSD",
      rlusd: demoRlusdTotal,
      units: demoRlusdTotal,
      rate: 1,
    },
    EUR: { currency: "EUR", rlusd: 0, units: 0, rate: 0 },
    USD: { currency: "USD", rlusd: 0, units: 0, rate: 0 },
    GBP: { currency: "GBP", rlusd: 0, units: 0, rate: 0 },
    CHF: { currency: "CHF", rlusd: 0, units: 0, rate: 0 },
    JPY: { currency: "JPY", rlusd: 0, units: 0, rate: 0 },
    CAD: { currency: "CAD", rlusd: 0, units: 0, rate: 0 },
    AUD: { currency: "AUD", rlusd: 0, units: 0, rate: 0 },
    SGD: { currency: "SGD", rlusd: 0, units: 0, rate: 0 },
    HKD: { currency: "HKD", rlusd: 0, units: 0, rate: 0 },
    SEK: { currency: "SEK", rlusd: 0, units: 0, rate: 0 },
    NOK: { currency: "NOK", rlusd: 0, units: 0, rate: 0 },
    DKK: { currency: "DKK", rlusd: 0, units: 0, rate: 0 },
    PLN: { currency: "PLN", rlusd: 0, units: 0, rate: 0 },
    CZK: { currency: "CZK", rlusd: 0, units: 0, rate: 0 },
    HUF: { currency: "HUF", rlusd: 0, units: 0, rate: 0 },
    MXN: { currency: "MXN", rlusd: 0, units: 0, rate: 0 },
    INR: { currency: "INR", rlusd: 0, units: 0, rate: 0 },
    ZAR: { currency: "ZAR", rlusd: 0, units: 0, rate: 0 },
    TRY: { currency: "TRY", rlusd: 0, units: 0, rate: 0 },
    IDR: { currency: "IDR", rlusd: 0, units: 0, rate: 0 },
    PHP: { currency: "PHP", rlusd: 0, units: 0, rate: 0 },
    KRW: { currency: "KRW", rlusd: 0, units: 0, rate: 0 },
    TWD: { currency: "TWD", rlusd: 0, units: 0, rate: 0 },
    AED: { currency: "AED", rlusd: 0, units: 0, rate: 0 },
    BRL: { currency: "BRL", rlusd: 0, units: 0, rate: 0 },
    XOF: { currency: "XOF", rlusd: 0, units: 0, rate: 0 },
    XAF: { currency: "XAF", rlusd: 0, units: 0, rate: 0 },
  }));

  return { demoLines, setDemoLines };
}

