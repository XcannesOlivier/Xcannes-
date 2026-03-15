"use client";

import { Buffer } from "buffer";
import pako from "pako";
import {
  XCANNES_MEMO_TYPE,
  XCANNES_MEMO_FORMAT_ZLIB,
  MEMO_MAX_JSON_BYTES,
  validateXcannesMemoPayload,
  buildWalletLabelMemo,
  buildAddressBookMemo,
  buildConversionMemo,
  buildPayreqMemo,
  buildMoonpayMemo,
  buildReconcileMemo,
} from "./xcannesMemoSchemas";

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

function encodeBytesToHex(uint8arr) {
  return Buffer.from(uint8arr).toString("hex").toUpperCase();
}

export function buildXrplJsonMemo(
  payload,
  { memoType = XCANNES_MEMO_TYPE, validate = true } = {}
) {
  // Validate the payload but keep the original (compact v2) for on-chain encoding.
  // The builders already validate in mode "create" and return compact v2;
  // this second validation acts as a safety net for raw/external payloads.
  if (validate && payload && typeof payload === "object") {
    const validation = validateXcannesMemoPayload(payload, { mode: "create" });
    if (!validation.ok) {
      recordMemoMetric("memo_encode_schema_invalid");
      console.error("[xrplMemo] Invalid memo payload:", validation.errors);
      return null;
    }
  }

  let json = "";
  try {
    json = JSON.stringify(payload ?? {});
  } catch (error) {
    recordMemoMetric("memo_encode_json_error");
    console.error("[xrplMemo] Memo JSON stringify failed:", error?.message || error);
    return null;
  }

  // Size guard on raw JSON (before compression)
  if (json.length > MEMO_MAX_JSON_BYTES) {
    recordMemoMetric("memo_encode_too_large");
    console.error(`[xrplMemo] Memo payload too large: ${json.length} bytes (max ${MEMO_MAX_JSON_BYTES})`);
    return null;
  }

  // Compress JSON with deflate (zlib) → binary on-chain, not human-readable
  let memoData = "";
  let memoFormat = XCANNES_MEMO_FORMAT_ZLIB;
  try {
    const compressed = pako.deflate(json);
    memoData = encodeBytesToHex(compressed);
  } catch (error) {
    recordMemoMetric("memo_encode_deflate_error");
    console.error("[xrplMemo] Memo deflate failed:", error?.message || error);
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
    formatHex = encodeUtf8ToHex(memoFormat);
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

export {
  buildWalletLabelMemo,
  buildAddressBookMemo,
  buildConversionMemo,
  buildPayreqMemo,
  buildMoonpayMemo,
  buildReconcileMemo,
};
