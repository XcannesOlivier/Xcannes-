"use client";

import { useState } from "react";

export function useSendForm({
  defaultSendTab = "scan-request",
  defaultSendAssetKey = "",
  defaultSendDestination = "",
  defaultSendAmount = "",
} = {}) {
  const [sendTab, setSendTab] = useState(defaultSendTab); // 'manual' | 'scan-request'
  const [sendAssetKey, setSendAssetKey] = useState(defaultSendAssetKey);
  const [sendDestination, setSendDestination] = useState(
    defaultSendDestination,
  );
  const [sendAmount, setSendAmount] = useState(defaultSendAmount);
  const [sendProcessing, setSendProcessing] = useState(false);
  const [sendPaymentRequest, setSendPaymentRequest] = useState(null);

  return {
    sendTab,
    setSendTab,
    sendAssetKey,
    setSendAssetKey,
    sendDestination,
    setSendDestination,
    sendAmount,
    setSendAmount,
    sendProcessing,
    setSendProcessing,
    sendPaymentRequest,
    setSendPaymentRequest,
  };
}
