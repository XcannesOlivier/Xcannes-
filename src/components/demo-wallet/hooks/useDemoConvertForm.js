"use client";

import { useState } from "react";

export function useDemoConvertForm({
  defaultBaseCurrency = "",
  defaultQuoteCurrency = "",
  defaultAmount = "",
  defaultPreview = "",
} = {}) {
  const [convertBaseCurrency, setConvertBaseCurrency] =
    useState(defaultBaseCurrency);
  const [convertQuoteCurrency, setConvertQuoteCurrency] =
    useState(defaultQuoteCurrency);
  const [convertAmount, setConvertAmount] = useState(defaultAmount);
  const [convertPreview, setConvertPreview] = useState(defaultPreview);
  const [convertProcessing, setConvertProcessing] = useState(false);

  return {
    convertBaseCurrency,
    setConvertBaseCurrency,
    convertQuoteCurrency,
    setConvertQuoteCurrency,
    convertAmount,
    setConvertAmount,
    convertPreview,
    setConvertPreview,
    convertProcessing,
    setConvertProcessing,
  };
}
