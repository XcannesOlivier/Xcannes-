"use client";

import { useState } from "react";

export function useSwapDemoLines({ demoRlusdTotal }) {
  const [demoLines, setDemoLines] = useState(() => {
    const seedFromCode = (code) =>
      String(code || "")
        .toUpperCase()
        .split("")
        .reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 997, 7);

    // RLUSD per 1 unit (approx values, demo only)
    const rlusdPerUnit = {
      EUR: 1.08,
      GBP: 1.27,
      CHF: 1.12,
      CAD: 0.74,
      AUD: 0.66,
      NZD: 0.61,
      JPY: 0.0068,
      SGD: 0.74,
      HKD: 0.128,
      SEK: 0.097,
      NOK: 0.093,
      DKK: 0.145,
      PLN: 0.25,
      CZK: 0.044,
      HUF: 0.0029,
      MXN: 0.059,
      INR: 0.012,
      ZAR: 0.055,
      TRY: 0.034,
      IDR: 0.000064,
      PHP: 0.018,
      KRW: 0.00075,
      TWD: 0.032,
      AED: 0.272,
      SAR: 0.266,
      BRL: 0.20,
      XOF: 0.0016,
      XAF: 0.0016,
      USD: 1,
    };

    const base = {
      RLUSD: { currency: "RLUSD", rlusd: 0, units: 0, rate: 1 },
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
    };

    const currencyCodes = Object.keys(base).filter((c) => c !== "RLUSD");
    const total = Number.isFinite(Number(demoRlusdTotal))
      ? Number(demoRlusdTotal)
      : 1000;

    // Pour le "preview wallet" (non connecté), on veut une UI à 0 partout.
    // Donc si le total démo est 0 (ou négatif), on ne seed aucun montant.
    if (total <= 0) {
      return base;
    }
    let allocatedSum = 0;

    currencyCodes.forEach((code) => {
      const seed = seedFromCode(code);
      const allocatedRlusd = 8 + (seed % 18); // 8..25 RLUSD
      const perUnit = rlusdPerUnit[code] ?? 1;
      const units = perUnit > 0 ? allocatedRlusd / perUnit : allocatedRlusd;
      base[code] = {
        currency: code,
        rlusd: allocatedRlusd,
        units,
        rate: allocatedRlusd > 0 ? units / allocatedRlusd : 0,
      };
      allocatedSum += allocatedRlusd;
    });

    const unallocated = Math.max(0, total - allocatedSum);
    base.RLUSD = {
      currency: "RLUSD",
      rlusd: unallocated,
      units: unallocated,
      rate: 1,
    };

    return base;
  });

  return { demoLines, setDemoLines };
}
