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
} from "../../../utils/xcannesMemoSchemas";

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
      console.error("[xrplMemo] Invalid memo payload:", validation.errors);
      return null;
    }
    memoPayload = validation.payload;
  }

  const json = JSON.stringify(memoPayload ?? {});
  const memoData = encodeUtf8ToHex(json);
  if (!memoData) return null;

  const typeHex = memoType ? encodeUtf8ToHex(memoType) : "";
  const formatHex = encodeUtf8ToHex(XCANNES_MEMO_FORMAT);

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
    const text = decodeHexToUtf8(memo.MemoData);
    if (!text) continue;
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed) continue;
      const validation = validateXcannesMemoPayload(parsed, { mode: "parse" });
      if (!validation.ok || validation.type !== "payreq") continue;
      return validation.payload;
    } catch {
      // ignore
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
