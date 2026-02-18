"use client";

import { useState } from "react";

export function useDemoPaymentRequestForm({
  defaultAmount = "",
  defaultCurrency = "RLUSD",
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
