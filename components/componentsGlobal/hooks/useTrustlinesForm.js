"use client";

import { useState } from "react";

export function useTrustlinesForm({
  defaultTrustlineCode = "",
  defaultTrustlineLocked = "",
  defaultEditingTrustlineCurrency = null,
  defaultEditingTrustlineLocked = "",
} = {}) {
  const [trustlineCode, setTrustlineCode] = useState(defaultTrustlineCode);
  const [trustlineLocked, setTrustlineLocked] = useState(defaultTrustlineLocked);
  const [editingTrustlineCurrency, setEditingTrustlineCurrency] = useState(
    defaultEditingTrustlineCurrency
  );
  const [editingTrustlineLocked, setEditingTrustlineLocked] = useState(
    defaultEditingTrustlineLocked
  );

  return {
    trustlineCode,
    setTrustlineCode,
    trustlineLocked,
    setTrustlineLocked,
    editingTrustlineCurrency,
    setEditingTrustlineCurrency,
    editingTrustlineLocked,
    setEditingTrustlineLocked,
  };
}

