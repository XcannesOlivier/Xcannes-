"use client";

import { Buffer } from "buffer";
import {
  XCANNES_MEMO_TYPE,
  XCANNES_MEMO_FORMAT,
  XCANNES_MEMO_SCHEMAS,
  validateXcannesMemoPayload,
  buildWalletLabelMemo,
  buildCurrencyLineMemo,
  buildConversionMemo,
  buildPayreqMemo,
  buildAllocationAdjustMemo,
  buildMoonpayMemo,
} from "./demoXcannesMemoSchemas";

const MEMO_METRICS_LOG_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_MEMO_METRICS_LOG_INTERVAL_MS || 60000
);
const MEMO_METRICS_LOG_ENABLED =
  process.env.NEXT_PUBLIC_MEMO_METRICS_LOG_ENABLED !== "false";

const memoMetrics = {
  counters: {},
  lastLogAt: 0,
  dirty: false,
};

function maybeLogMemoMetrics(force = false) {
  if (!MEMO_METRICS_LOG_ENABLED) return;
  if (!memoMetrics.dirty) return;
  const now = Date.now();
  if (!force && now - memoMetrics.lastLogAt < MEMO_METRICS_LOG_INTERVAL_MS) return;
  memoMetrics.lastLogAt = now;
  memoMetrics.dirty = false;
  console.info(
    JSON.stringify({
      type: "MEMO_METRICS",
      counters: { ...memoMetrics.counters },
      timestamp: new Date().toISOString(),
    })
  );
}

function recordMemoMetric(name) {
  if (!name) return;
  memoMetrics.counters[name] = (memoMetrics.counters[name] || 0) + 1;
  memoMetrics.dirty = true;
  if (typeof window !== "undefined") {
    window.__xcannesMemoMetrics = memoMetrics.counters;
  }
  maybeLogMemoMetrics();
}

function encodeUtf8ToHex(value) {
  const raw = String(value ?? "");
  if (!raw) return "";
  return Buffer.from(raw, "utf8").toString("hex").toUpperCase();
}

export function buildXrplJsonMemo(
  payload,
  { memoType = XCANNES_MEMO_TYPE, validate = true } = {}
) {
  let memoPayload = payload;
  if (validate && payload && typeof payload === "object") {
    const validation = validateXcannesMemoPayload(payload, { mode: "create" });
    if (!validation.ok) {
      recordMemoMetric("memo_encode_schema_invalid");
      console.error("[xrplMemo] Invalid memo payload:", validation.errors);
      return null;
    }
    memoPayload = validation.payload;
  }

  let json = "";
  try {
    json = JSON.stringify(memoPayload ?? {});
  } catch (error) {
    recordMemoMetric("memo_encode_json_error");
    console.error("[xrplMemo] Memo JSON stringify failed:", error?.message || error);
    return null;
  }

  let memoData = "";
  try {
    memoData = encodeUtf8ToHex(json);
  } catch (error) {
    recordMemoMetric("memo_encode_hex_error");
    console.error("[xrplMemo] Memo hex encode failed:", error?.message || error);
    return null;
  }
  if (!memoData) {
    recordMemoMetric("memo_encode_hex_empty");
    return null;
  }

  let typeHex = "";
  let formatHex = "";
  try {
    typeHex = memoType ? encodeUtf8ToHex(memoType) : "";
    formatHex = encodeUtf8ToHex(XCANNES_MEMO_FORMAT);
  } catch (error) {
    recordMemoMetric("memo_encode_hex_error");
    console.error("[xrplMemo] Memo type/format hex encode failed:", error?.message || error);
    return null;
  }

  const memo = {
    MemoData: memoData,
  };
  if (typeHex) memo.MemoType = typeHex;
  if (formatHex) memo.MemoFormat = formatHex;

  return [{ Memo: memo }];
}

function decodeHexToUtf8(hex) {
  const raw = String(hex || "").trim();
  if (!raw) return "";
  if (!/^[0-9A-Fa-f]+$/.test(raw) || raw.length % 2 !== 0) return "";
  try {
    return Buffer.from(raw, "hex").toString("utf8");
  } catch {
    return "";
  }
}

function decodeHexToUtf8Detailed(hex) {
  const raw = String(hex || "").trim();
  if (!raw) return { ok: false, value: "", reason: "empty" };
  if (!/^[0-9A-Fa-f]+$/.test(raw) || raw.length % 2 !== 0) {
    return { ok: false, value: "", reason: "invalid_hex" };
  }
  try {
    return { ok: true, value: Buffer.from(raw, "hex").toString("utf8"), reason: null };
  } catch {
    return { ok: false, value: "", reason: "decode_error" };
  }
}

function decodeMemoFieldHex(value) {
  const decoded = decodeHexToUtf8(value);
  return decoded ? decoded.trim() : "";
}

function isXcannesMemo(memo, { allowMissingType = true } = {}) {
  if (!memo?.MemoData) return false;
  const memoType = decodeMemoFieldHex(memo.MemoType);
  if (memoType) {
    if (memoType.toUpperCase() !== XCANNES_MEMO_TYPE) return false;
  } else if (!allowMissingType) {
    return false;
  }

  const memoFormat = decodeMemoFieldHex(memo.MemoFormat);
  if (memoFormat) {
    if (memoFormat.toLowerCase() !== XCANNES_MEMO_FORMAT) return false;
  }

  return true;
}

export function extractXcannesPayReqFromMemos(memos) {
  const list = Array.isArray(memos) ? memos : [];
  for (const entry of list) {
    const memo = entry?.Memo || entry?.memo || null;
    if (!isXcannesMemo(memo)) continue;
    const decoded = decodeHexToUtf8Detailed(memo.MemoData);
    if (!decoded.ok || !decoded.value) {
      if (decoded.reason === "invalid_hex") {
        recordMemoMetric("memo_decode_invalid_hex");
      } else if (decoded.reason === "decode_error") {
        recordMemoMetric("memo_decode_error");
      } else {
        recordMemoMetric("memo_decode_empty");
      }
      continue;
    }
    const text = decoded.value;
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) {
      recordMemoMetric("memo_json_invalid");
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed) {
        recordMemoMetric("memo_json_invalid");
        continue;
      }
      const validation = validateXcannesMemoPayload(parsed, { mode: "parse" });
      if (!validation.ok || validation.type !== "payreq") {
        recordMemoMetric("memo_schema_invalid");
        continue;
      }
      recordMemoMetric("memo_payreq_extracted");
      return validation.payload;
    } catch {
      recordMemoMetric("memo_json_invalid");
    }
  }
  return null;
}

export {
  XCANNES_MEMO_SCHEMAS,
  buildWalletLabelMemo,
  buildCurrencyLineMemo,
  buildConversionMemo,
  buildPayreqMemo,
  buildAllocationAdjustMemo,
  buildMoonpayMemo,
};
