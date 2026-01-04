"use client";

import { useState } from "react";

export function usePaymentRequestForm({
  defaultAmount = "",
  defaultCurrency = "XRP",
  defaultMethod = "qr",
  defaultToAddress = "",
  defaultMemo = "",
} = {}) {
  const [requestAmount, setRequestAmount] = useState(defaultAmount);
  const [requestCurrency, setRequestCurrency] = useState(defaultCurrency);
  const [requestMethod, setRequestMethod] = useState(defaultMethod); // 'qr' | 'link' | 'xrpl' | 'notification'
  const [requestToAddress, setRequestToAddress] = useState(defaultToAddress);
  const [requestMemo, setRequestMemo] = useState(defaultMemo);

  return {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMethod,
    setRequestMethod,
    requestToAddress,
    setRequestToAddress,
    requestMemo,
    setRequestMemo,
  };
}

