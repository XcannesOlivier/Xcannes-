"use client";

import { useState } from "react";

export function useReceiveForm({ defaultReceiveTab = "receive" } = {}) {
  const [receiveTab, setReceiveTab] = useState(defaultReceiveTab); // 'receive' | 'request'

  return { receiveTab, setReceiveTab };
}
