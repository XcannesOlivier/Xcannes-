import { useCallback, useRef, useState, useEffect } from "react";
import { loadXrplData } from "../useXrplData";
import { loadPythData } from "../usePythData";
import { loadFawazData } from "../useFawazData";

export function useEodData(basePairs, tickers) {
  const [eodData, setEodData] = useState({});
  const [loadingPairs, setLoadingPairs] = useState(new Set());
  const tickersRef = useRef(new Map());

  useEffect(() => {
    tickersRef.current = tickers instanceof Map ? tickers : new Map();
  }, [tickers]);

  const loadEODData = useCallback(
    async (base, quote, source = "eod", symbol = null) => {
      const pairKey = `${base}/${quote}`;
      setLoadingPairs((prev) => new Set(prev).add(pairKey));

      try {
        let payload = null;
        const backendPair = symbol || `${base}_${quote}`;
        const wsTicker = tickersRef.current.get(backendPair);

        if (source === "xrpl") {
          payload = await loadXrplData(base, quote, symbol, wsTicker, tickersRef);
        } else if (source === "pyth") {
          payload = await loadPythData(base, quote, symbol, wsTicker);
        } else {
          payload = await loadFawazData(base, quote);
        }

        setEodData((prev) => ({
          ...prev,
          [pairKey]: payload,
        }));
      } catch (error) {
        console.error(`Erreur chargement EOD ${pairKey}:`, error);
      } finally {
        setLoadingPairs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(pairKey);
          return newSet;
        });
      }
    },
    []
  );

  useEffect(() => {
    if (!basePairs || basePairs.length === 0) return;
    basePairs.forEach((pair) => {
      loadEODData(pair.base, pair.quote, pair.source || "eod", pair.symbol);
    });
  }, [basePairs, loadEODData]);

  return { eodData, loadingPairs, loadEODData, setEodData };
}

