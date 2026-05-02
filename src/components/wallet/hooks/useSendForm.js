"use client";

import { useState } from "react";

export function useSendForm({
  defaultSendAssetKey = "",
  defaultSendDestination = "",
  defaultSendAmount = "",
} = {}) {
  const [sendAssetKey, setSendAssetKey] = useState(defaultSendAssetKey);
  const [sendDestination, setSendDestination] = useState(
    defaultSendDestination,
  );
  const [sendDestinationLabel, setSendDestinationLabel] = useState("");
  const [sendAmount, setSendAmount] = useState(defaultSendAmount);
  const [sendProcessing, setSendProcessing] = useState(false);
  const [sendPaymentRequest, setSendPaymentRequest] = useState(null);

  const resetSendForm = () => {
    setSendAssetKey(defaultSendAssetKey);
    setSendDestination(defaultSendDestination);
    setSendDestinationLabel("");
    setSendAmount(defaultSendAmount);
    setSendProcessing(false);
    setSendPaymentRequest(null);
  };

  return {
    sendAssetKey,
    setSendAssetKey,
    sendDestination,
    setSendDestination,
    sendDestinationLabel,
    setSendDestinationLabel,
    sendAmount,
    setSendAmount,
    sendProcessing,
    setSendProcessing,
    sendPaymentRequest,
    setSendPaymentRequest,
    resetSendForm,
  };
}
