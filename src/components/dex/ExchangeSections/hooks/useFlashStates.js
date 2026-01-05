import { useEffect, useState } from "react";

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

function stableHash(str) {
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function pickAlternateSide(pairKey, previous) {
  if (previous?.lastFlashSide === "bid") return "ask";
  if (previous?.lastFlashSide === "ask") return "bid";
  return stableHash(pairKey) % 2 === 0 ? "bid" : "ask";
}

function durationSecondsFromIntensity(intensity) {
  const minDuration = 1.4;
  const maxDuration = 3.0;
  const eased = Math.pow(clamp(intensity, 0, 1), 0.7);
  return minDuration + eased * (maxDuration - minDuration);
}

function minIntervalMsFromIntensity(intensity) {
  const base = 650;
  const extra = 650;
  return Math.round(base + (1 - clamp(intensity, 0, 1)) * extra);
}

export function useFlashStates(eodData) {
  const [flashStates, setFlashStates] = useState(new Map());

  useEffect(() => {
    if (!eodData) return;

    setFlashStates((prev) => {
      const next = new Map(prev);

      Object.entries(eodData).forEach(([pairKey, data]) => {
        const price = Number(data.price ?? data.close ?? 0) || 0;
        const rawBid = Number(data.bid);
        const rawAsk = Number(data.ask);
        const bid = Number.isFinite(rawBid) ? rawBid : price;
        const ask = Number.isFinite(rawAsk) ? rawAsk : price;

        const previous = next.get(pairKey) || {};
        let {
          flashBidClass,
          flashAskClass,
          bidDelta,
          askDelta,
          flashBidDurationS,
          flashAskDurationS,
        } = previous;

        const prevBid = previous.bid;
        const prevAsk = previous.ask;

        const bidChanged = prevBid != null && bid !== prevBid;
        const askChanged = prevAsk != null && ask !== prevAsk;

        if (bidChanged) bidDelta = bid - prevBid;
        if (askChanged) askDelta = ask - prevAsk;

        const mid = price > 0 ? price : (bid + ask) / 2;
        const denom = Math.max(Math.abs(mid || 0), 1e-12);
        const bidMoveBps =
          bidChanged && bidDelta != null ? (Math.abs(bidDelta) / denom) * 10000 : 0;
        const askMoveBps =
          askChanged && askDelta != null ? (Math.abs(askDelta) / denom) * 10000 : 0;

        const minMoveBps = 0.05;
        const bidEligible = bidMoveBps >= minMoveBps;
        const askEligible = askMoveBps >= minMoveBps;

        // Rule: never flash BID and ASK at the same time.
        // Prefer the dominant move; if it's close, alternate for visual balance.
        let flashTarget = null; // "bid" | "ask" | null
        const tieThreshold = 0.25; // 25% = treat as "similar magnitude"
        if (bidEligible && askEligible) {
          const maxMove = Math.max(bidMoveBps, askMoveBps);
          const relDiff = maxMove > 0 ? Math.abs(bidMoveBps - askMoveBps) / maxMove : 0;
          if (relDiff <= tieThreshold) {
            flashTarget = pickAlternateSide(pairKey, previous);
          } else {
            flashTarget = bidMoveBps > askMoveBps ? "bid" : "ask";
          }
        } else if (bidEligible) {
          flashTarget = "bid";
        } else if (askEligible) {
          flashTarget = "ask";
        }

        const now = Date.now();
        const fullIntensityBps = 3.0;
        const intensity =
          flashTarget === "bid"
            ? clamp(bidMoveBps / fullIntensityBps, 0, 1)
            : flashTarget === "ask"
              ? clamp(askMoveBps / fullIntensityBps, 0, 1)
              : 0;

        if (flashTarget) {
          const minIntervalMs = minIntervalMsFromIntensity(intensity);
          if (previous.lastFlashAt && now - previous.lastFlashAt < minIntervalMs) {
            flashTarget = null;
          }
        }

        if (flashTarget === "bid") {
          const dir = bid > prevBid ? "up" : "down";
          flashAskClass = ""; // ensure ASK does not flash simultaneously
          flashBidDurationS = durationSecondsFromIntensity(intensity);
          flashAskDurationS = previous.flashAskDurationS;
          if (dir === "up") {
            flashBidClass =
              previous.flashBidClass === "eod-flash-up-a"
                ? "eod-flash-up-b"
                : "eod-flash-up-a";
          } else {
            flashBidClass =
              previous.flashBidClass === "eod-flash-down-a"
                ? "eod-flash-down-b"
                : "eod-flash-down-a";
          }
        } else if (flashTarget === "ask") {
          const dir = ask > prevAsk ? "up" : "down";
          flashBidClass = ""; // ensure BID does not flash simultaneously
          flashAskDurationS = durationSecondsFromIntensity(intensity);
          flashBidDurationS = previous.flashBidDurationS;
          if (dir === "up") {
            flashAskClass =
              previous.flashAskClass === "eod-flash-up-a"
                ? "eod-flash-up-b"
                : "eod-flash-up-a";
          } else {
            flashAskClass =
              previous.flashAskClass === "eod-flash-down-a"
                ? "eod-flash-down-b"
                : "eod-flash-down-a";
          }
        }

        next.set(pairKey, {
          bid,
          ask,
          bidDelta,
          askDelta,
          flashBidClass,
          flashAskClass,
          flashBidDurationS,
          flashAskDurationS,
          lastFlashAt: flashTarget ? now : previous.lastFlashAt,
          lastFlashSide: flashTarget ? flashTarget : previous.lastFlashSide,
        });
      });

      return next;
    });
  }, [eodData]);

  return flashStates;
}
