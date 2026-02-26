"use client";

import { useState } from "react";

export function useDemoCurrencyLinesForm({
  defaultCurrencyLineCode = "",
  defaultAllocatedRlusd = "",
} = {}) {
  const [currencyLineCode, setCurrencyLineCode] = useState(
    defaultCurrencyLineCode,
  );
  const [currencyLineAllocatedRlusd, setCurrencyLineAllocatedRlusd] = useState(
    defaultAllocatedRlusd,
  );

  return {
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd,
  };
}
