"use client";

import { useState } from "react";

export function useDemoReceiveForm({ defaultReceiveTab = "receive" } = {}) {
  const [receiveTab, setReceiveTab] = useState(defaultReceiveTab); // 'receive' | 'request'

  return { receiveTab, setReceiveTab };
}
