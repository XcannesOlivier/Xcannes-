"use client";

import { Buffer } from "buffer";

function encodeUtf8ToHex(value) {
  const raw = String(value ?? "");
  if (!raw) return "";
  return Buffer.from(raw, "utf8").toString("hex").toUpperCase();
}

export function buildXrplJsonMemo(payload, { memoType = "XCANNES" } = {}) {
  const json = JSON.stringify(payload ?? {});
  const memoData = encodeUtf8ToHex(json);
  if (!memoData) return null;

  const typeHex = memoType ? encodeUtf8ToHex(memoType) : "";
  const formatHex = encodeUtf8ToHex("application/json");

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

export function extractXcannesPayReqFromMemos(memos) {
  const list = Array.isArray(memos) ? memos : [];
  for (const entry of list) {
    const memo = entry?.Memo || entry?.memo || null;
    if (!memo?.MemoData) continue;
    const text = decodeHexToUtf8(memo.MemoData);
    if (!text) continue;
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed) continue;
      const marker = String(parsed?.xcannes || parsed?.xc || "").toLowerCase();
      if (!marker.includes("payreq")) continue;
      return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}
