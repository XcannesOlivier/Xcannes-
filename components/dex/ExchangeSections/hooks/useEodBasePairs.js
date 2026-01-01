import { useEffect, useState } from "react";
import xcannesApi from "../../../../lib/xcannesApi";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export function useEodBasePairs() {
  const [basePairs, setBasePairs] = useState([]);

  useEffect(() => {
    const loadBasePairs = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets();
        if (!markets) return;

        const raw = [
          ...(markets.trading || [])
            .filter((m) => !(m.base === "XCS" && m.quote === "XRP"))
            .map((m) => ({
              base: m.base,
              quote: m.quote,
              source: "xrpl",
              symbol: m.symbol,
              active: m.active !== false,
            })),
          ...(markets.pyth || []).map((m) => ({
            base: m.base,
            quote: m.quote,
            source: "pyth",
            symbol: m.symbol,
            active: m.active !== false,
          })),
        ];

        const seen = new Set();
        const unique = [];
        raw.forEach((p) => {
          if (!p.active) return;
          const key = `${p.base}/${p.quote}`;
          if (seen.has(key)) return;
          seen.add(key);
          unique.push({
            base: p.base,
            quote: p.quote,
            source: p.source,
            symbol: p.symbol,
          });
        });

        setBasePairs(unique);
      } catch (error) {
        console.error("[EOD] ❌ Erreur chargement marchés:", error);
        if (DEBUG_LOGS) {
          console.error(error);
        }
      }
    };

    loadBasePairs();
  }, []);

  return basePairs;
}

