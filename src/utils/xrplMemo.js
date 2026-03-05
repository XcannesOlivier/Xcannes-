"use client";

import { Buffer } from "buffer";
import {
  XCANNES_MEMO_TYPE,
  XCANNES_MEMO_FORMAT,
  XCANNES_MEMO_SCHEMAS,
  validateXcannesMemoPayload,
  buildWalletLabelMemo,
  buildConversionMemo,
  buildPayreqMemo,
  buildAllocationAdjustMemo,
  buildMoonpayMemo,
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

export {
  XCANNES_MEMO_SCHEMAS,
  buildWalletLabelMemo,
  buildConversionMemo,
  buildPayreqMemo,
  buildAllocationAdjustMemo,
  buildMoonpayMemo,
};
