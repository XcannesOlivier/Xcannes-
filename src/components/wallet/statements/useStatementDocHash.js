import { useEffect, useState } from "react";
import { sha256Hex } from "@/utils/statementExport";

/**
 * useStatementDocHash
 * -------------------
 * Computes a SHA-256 document hash from a stable JSON string.
 * Shared by CurrencyStatement & GlobalStatement.
 *
 * @param {string} hashInput – JSON.stringify'd payload
 * @returns {string} hex hash (empty string while computing)
 */
export default function useStatementDocHash(hashInput) {
  const [docHash, setDocHash] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined") return () => {};
    (async () => {
      const hash = await sha256Hex(hashInput);
      if (!cancelled) setDocHash(hash);
    })();
    return () => {
      cancelled = true;
    };
  }, [hashInput]);

  return docHash;
}
