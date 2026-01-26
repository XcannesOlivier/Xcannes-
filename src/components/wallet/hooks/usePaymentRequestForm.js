"use client";

import { useState } from "react";

export function usePaymentRequestForm({
  defaultAmount = "",
  defaultCurrency = "XRP",
  defaultMemo = "",
} = {}) {
  const [requestAmount, setRequestAmount] = useState(defaultAmount);
  const [requestCurrency, setRequestCurrency] = useState(defaultCurrency);
  const [requestMemo, setRequestMemo] = useState(defaultMemo);

  return {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMemo,
    setRequestMemo,
  };
}
