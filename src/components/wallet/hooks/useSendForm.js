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
  const [sendDestinationLabel, setSendDestinationLabel] = useState("");

  const resetSendForm = () => {
    setSendTab(defaultSendTab);
    setSendAssetKey(defaultSendAssetKey);
    setSendDestination(defaultSendDestination);
    setSendAmount(defaultSendAmount);
    setSendProcessing(false);
    setSendPaymentRequest(null);
    setSendDestinationLabel("");
  };

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
    sendDestinationLabel,
    setSendDestinationLabel,
    resetSendForm,
  };
}
