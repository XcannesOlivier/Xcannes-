import { useEffect, useState } from "react";

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
        let { flashBidClass, flashAskClass, bidDelta, askDelta } = previous;

        const prevBid = previous.bid;
        const prevAsk = previous.ask;

        if (prevBid != null && bid !== prevBid) {
          const dir = bid > prevBid ? "up" : "down";
          bidDelta = bid - prevBid;
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
        }

        if (prevAsk != null && ask !== prevAsk) {
          const dir = ask > prevAsk ? "up" : "down";
          askDelta = ask - prevAsk;
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
        });
      });

      return next;
    });
  }, [eodData]);

  return flashStates;
}
