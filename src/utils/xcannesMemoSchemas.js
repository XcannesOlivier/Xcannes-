// ═══════════════════════════════════════════════════════════════════════════════
// Xcannes Memo Schemas — v2 compact format (v1 removed)
//
// On-chain format : { xc, v:2, ...short keys, tuples }
// Internal format : { xcannes, v:2, ...long keys, objects }
//
// Builders emit v2 compact. Parsers expand v2 → internal long keys.
// ═══════════════════════════════════════════════════════════════════════════════

const XCANNES_MEMO_TYPE = 'XCANNES';
const XCANNES_MEMO_FORMAT = 'application/json';
const XCANNES_MEMO_FORMAT_ZLIB = 'application/x-xcannes-zlib';
const MEMO_FORMAT_VERSION = 2;

// Valid memo types
const VALID_MEMO_TYPES = new Set(['wallet_label', 'conversion', 'payreq', 'moonpay', 'reconcile', 'address_book']);

// Short marker ↔ long type
const V2_TYPE_SHORT_TO_LONG = { wl: 'wallet_label', cv: 'conversion', pr: 'payreq', mp: 'moonpay', rc: 'reconcile', ab: 'address_book' };
const V2_TYPE_LONG_TO_SHORT = { wallet_label: 'wl', conversion: 'cv', payreq: 'pr', moonpay: 'mp', reconcile: 'rc', address_book: 'ab' };

// Short origin ↔ long origin (payreq)
const V2_ORIGIN_SHORT_TO_LONG = { p: 'payreq', m: 'manual', s: 'spread' };
const V2_ORIGIN_LONG_TO_SHORT = { payreq: 'p', manual: 'm', spread: 's' };

// Short side ↔ long side (moonpay)
const V2_SIDE_SHORT_TO_LONG = { b: 'buy', s: 'sell' };
const V2_SIDE_LONG_TO_SHORT = { buy: 'b', sell: 's' };

// "spread" origin = conversion fee transaction.
const VALID_ORIGINS = new Set(['payreq', 'manual', 'spread']);
const VALID_MOONPAY_SIDES = new Set(['sell', 'buy']);
const ADDRESS_LABEL_MAX_LENGTH = 40;
// Maximum JSON byte length for memo payload (XRPL practical limit ~1 KB).
const MEMO_MAX_JSON_BYTES = 900;
// ⚠️  SYNC : cette liste doit rester identique à XRPL_ASSET_CODES
//    définie dans utils/currency.js (source unique côté backend).
const XRPL_ASSET_CODES = new Set(['XRP', 'RLUSD']);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeUpper(value) {
  const text = normalizeString(value);
  return text ? text.toUpperCase() : null;
}

/**
 * Decode an XRPL hex-encoded currency code (40-char hex → human-readable).
 * Browser-compatible version (no Buffer dependency).
 */
function decodeXrplCurrencyHex(currency) {
  const raw = String(currency || '').trim();
  if (!raw) return '';
  if (!/^[0-9A-Fa-f]{40}$/.test(raw)) return raw.toUpperCase();
  try {
    let decoded = '';
    for (let i = 0; i < raw.length; i += 2) {
      const byte = parseInt(raw.substring(i, i + 2), 16);
      if (byte === 0) break;
      decoded += String.fromCharCode(byte);
    }
    if (!decoded) return raw.toUpperCase();
    if (!/^[\x20-\x7E]+$/.test(decoded)) return raw.toUpperCase();
    return decoded.trim().toUpperCase();
  } catch {
    return raw.toUpperCase();
  }
}

function normalizeCurrencyCode(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const code = /^[A-Fa-f0-9]{40}$/.test(trimmed)
    ? decodeXrplCurrencyHex(trimmed)
    : trimmed.toUpperCase();
  if (!code || code.length < 2 || code.length > 12) return null;
  return code;
}

function isValidWalletLabel(label) {
  if (!label) return false;
  const parts = String(label).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return false;
  return parts.every((part) => /^[A-Za-z]+$/.test(part) && part.length <= 7);
}

function isValidXrplAddress(address) {
  const trimmed = String(address || '').trim();
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(trimmed);
}

function parseOptionalNumber(value, { min = null, minExclusive = false } = {}) {
  if (value == null || value === '') return { ok: true, value: null, provided: false };
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return { ok: false, value: null, provided: true };
  if (min != null) {
    if (minExclusive && parsed <= min) return { ok: false, value: parsed, provided: true };
    if (!minExclusive && parsed < min) return { ok: false, value: parsed, provided: true };
  }
  return { ok: true, value: parsed, provided: true };
}

function parseRequiredNumber(value, { min = null, minExclusive = false } = {}) {
  const result = parseOptionalNumber(value, { min, minExclusive });
  if (!result.provided) return { ok: false, value: null, provided: false };
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE INFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

function inferXcannesMemoType(payload) {
  if (!isPlainObject(payload)) return null;

  if (payload.xc && V2_TYPE_SHORT_TO_LONG[payload.xc]) {
    return V2_TYPE_SHORT_TO_LONG[payload.xc];
  }

  const marker = normalizeString(payload?.xcannes);
  if (marker && VALID_MEMO_TYPES.has(marker)) return marker;

  if (payload?.tc) return 'payreq';

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 PAYLOAD EXPANSION
// ═══════════════════════════════════════════════════════════════════════════════

function expandV2WalletLabel(p) {
  return {
    label: p.l ?? p.label,
    defaultCurrency: p.dc ?? p.defaultCurrency,
  };
}

function expandV2Conversion(p) {
  let lineStates = p.lineStates ?? null;
  const ls = p.ls;
  if (Array.isArray(ls) && ls.length > 0 && !lineStates) {
    lineStates = ls.map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        return { currencyCode: entry[0], allocatedRlusdAfter: entry[1] };
      }
      return entry;
    });
  }

  return {
    base: p.b ?? p.base,
    quote: p.q ?? p.quote,
    amountRlusd: p.r ?? p.amountRlusd,
    amountRlusdGross: p.rg ?? p.amountRlusdGross,
    amountBase: p.ab ?? p.amountBase,
    amountQuote: p.aq ?? p.amountQuote,
    fxRate: p.fx ?? p.fxRate,
    fxSource: p.fs ?? p.fxSource,
    spreadRlusd: p.sp ?? p.spreadRlusd,
    spreadTier: p.st ?? p.spreadTier,
    lineStates,
  };
}

function expandV2Payreq(p) {
  let origin = p.o ?? p.origin ?? null;
  if (origin && V2_ORIGIN_SHORT_TO_LONG[origin]) origin = V2_ORIGIN_SHORT_TO_LONG[origin];

  return {
    origin,
    targetCurrencyCode: p.tc ?? p.targetCurrencyCode,
    amountRlusd: p.r ?? p.amountRlusd,
    displayAmount: p.da ?? p.displayAmount,
    displayCurrencyCode: p.dc ?? p.displayCurrencyCode,
    fxRate: p.fx ?? p.fxRate,
    fxSource: p.fs ?? p.fxSource,
    allocatedRlusdAfter: p.aa ?? p.allocatedRlusdAfter,
    note: p.n ?? p.note,
  };
}

function expandV2Moonpay(p) {
  let side = p.sd ?? p.side ?? null;
  if (side && V2_SIDE_SHORT_TO_LONG[side]) side = V2_SIDE_SHORT_TO_LONG[side];

  return {
    side,
    provider: p.provider ?? 'moonpay',
    currencyCode: p.c ?? p.currencyCode,
    amount: p.a ?? p.amount,
    amountRlusd: p.r ?? p.amountRlusd,
  };
}

function expandV2Reconcile(p) {
  let operations = p.operations ?? null;
  const ops = p.ops;
  if (Array.isArray(ops) && ops.length > 0 && !operations) {
    operations = ops.map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        return { currencyCode: entry[0], deductedRlusd: entry[1] };
      }
      return entry;
    });
  }

  let lineStates = p.lineStates ?? null;
  const ls = p.ls;
  if (Array.isArray(ls) && ls.length > 0 && !lineStates) {
    lineStates = ls.map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        return { currencyCode: entry[0], allocatedRlusdAfter: entry[1] };
      }
      return entry;
    });
  }

  return {
    deficit: p.d ?? p.deficit,
    operations,
    lineStates,
  };
}

function expandV2AddressBook(p) {
  return {
    address: p.a ?? p.address,
    label: p.l ?? p.label,
  };
}

function expandV2Payload(payload, type) {
  const expanders = {
    wallet_label: expandV2WalletLabel,
    conversion: expandV2Conversion,
    payreq: expandV2Payreq,
    moonpay: expandV2Moonpay,
    reconcile: expandV2Reconcile,
    address_book: expandV2AddressBook,
  };

  const expander = expanders[type];
  if (!expander) return payload;

  const expanded = expander(payload);
  expanded.xcannes = type;
  expanded.v = payload.v ?? MEMO_FORMAT_VERSION;
  return expanded;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD NORMALIZERS (per type)
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeWalletLabelPayload(payload, errors) {
  const label = normalizeString(payload?.label);
  if (!label || !isValidWalletLabel(label)) errors.push('wallet_label.label');
  const defaultCurrency = normalizeCurrencyCode(payload?.defaultCurrency);
  const normalized = { label };
  if (defaultCurrency) normalized.defaultCurrency = defaultCurrency;
  return normalized;
}

function normalizeAddressBookPayload(payload, errors) {
  const address = normalizeString(payload?.address);
  if (!address || !isValidXrplAddress(address)) {
    errors.push('address_book.address');
  }
  let label = normalizeString(payload?.label);
  if (label && label.length > ADDRESS_LABEL_MAX_LENGTH) {
    errors.push('address_book.label');
  }
  const normalized = { address };
  if (label) normalized.label = label;
  return normalized;
}

function normalizeConversionPayload(payload, errors) {
  const base = normalizeCurrencyCode(payload?.base);
  const quote = normalizeCurrencyCode(payload?.quote);
  if (!base) errors.push('conversion.base');
  if (!quote) errors.push('conversion.quote');

  const amountRlusdRes = parseRequiredNumber(payload?.amountRlusd, { min: 0, minExclusive: true });
  if (!amountRlusdRes.ok) errors.push('conversion.amountRlusd');

  const amountRlusdGrossRes = parseOptionalNumber(payload?.amountRlusdGross, { min: 0 });
  if (!amountRlusdGrossRes.ok) errors.push('conversion.amountRlusdGross');

  const amountBaseRes = parseOptionalNumber(payload?.amountBase, { min: 0 });
  if (!amountBaseRes.ok) errors.push('conversion.amountBase');

  const amountQuoteRes = parseOptionalNumber(payload?.amountQuote, { min: 0 });
  if (!amountQuoteRes.ok) errors.push('conversion.amountQuote');

  const fxRateRes = parseOptionalNumber(payload?.fxRate, { min: 0, minExclusive: true });
  if (!fxRateRes.ok) errors.push('conversion.fxRate');

  const spreadRlusdRes = parseOptionalNumber(payload?.spreadRlusd, { min: 0 });
  if (!spreadRlusdRes.ok) errors.push('conversion.spreadRlusd');

  const spreadTier = normalizeString(payload?.spreadTier);
  const fxSource = normalizeUpper(payload?.fxSource);

  const hasGross = amountRlusdGrossRes.value != null;
  const hasBaseFx = amountBaseRes.value != null && fxRateRes.value != null;
  const isXrplPair = XRPL_ASSET_CODES.has(base) && XRPL_ASSET_CODES.has(quote);
  if (!hasGross && !hasBaseFx && !isXrplPair) {
    errors.push('conversion.amountRlusdGross');
  }

  const lineStatesRaw = Array.isArray(payload?.lineStates) ? payload.lineStates : null;
  let lineStates = null;
  if (lineStatesRaw && lineStatesRaw.length > 0) {
    const normalizedStates = [];
    lineStatesRaw.forEach((entry) => {
      const currencyCode = normalizeCurrencyCode(entry?.currencyCode ?? entry?.currency);
      if (!currencyCode) { errors.push('conversion.lineStates.currencyCode'); return; }
      const amountRes = parseRequiredNumber(entry?.allocatedRlusdAfter ?? entry?.allocated_after, { min: 0 });
      if (!amountRes.ok) { errors.push('conversion.lineStates.allocatedRlusdAfter'); return; }
      normalizedStates.push({ currencyCode, allocatedRlusdAfter: amountRes.value });
    });
    if (normalizedStates.length === 0) {
      errors.push('conversion.lineStates');
    } else {
      lineStates = normalizedStates;
    }
  }

  const normalized = { base, quote, amountRlusd: amountRlusdRes.value };
  if (amountRlusdGrossRes.value != null) normalized.amountRlusdGross = amountRlusdGrossRes.value;
  if (amountBaseRes.value != null) normalized.amountBase = amountBaseRes.value;
  if (amountQuoteRes.value != null) normalized.amountQuote = amountQuoteRes.value;
  if (fxRateRes.value != null) normalized.fxRate = fxRateRes.value;
  if (fxSource) normalized.fxSource = fxSource;
  if (spreadRlusdRes.value != null) normalized.spreadRlusd = spreadRlusdRes.value;
  if (spreadTier) normalized.spreadTier = spreadTier;
  if (lineStates) normalized.lineStates = lineStates;
  return normalized;
}

function normalizePayreqPayload(payload, errors, { requireOrigin = false } = {}) {
  const targetCurrencyCode = normalizeCurrencyCode(payload?.targetCurrencyCode);
  if (!targetCurrencyCode) errors.push('payreq.targetCurrencyCode');

  const amountRlusdRes = parseRequiredNumber(payload?.amountRlusd, { min: 0, minExclusive: true });
  if (!amountRlusdRes.ok) errors.push('payreq.amountRlusd');

  const displayAmountRes = parseOptionalNumber(payload?.displayAmount, { min: 0 });
  if (!displayAmountRes.ok) errors.push('payreq.displayAmount');

  const displayCurrencyCode = normalizeCurrencyCode(payload?.displayCurrencyCode) || targetCurrencyCode;

  const fxRateRes = parseOptionalNumber(payload?.fxRate, { min: 0, minExclusive: true });
  if (!fxRateRes.ok) errors.push('payreq.fxRate');

  const allocatedAfterRes = parseOptionalNumber(payload?.allocatedRlusdAfter, { min: 0 });
  if (!allocatedAfterRes.ok) errors.push('payreq.allocatedRlusdAfter');

  const fxSource = normalizeUpper(payload?.fxSource);
  const note = normalizeString(payload?.note);

  const originRaw = normalizeString(payload?.origin);
  const origin = originRaw ? originRaw.toLowerCase() : null;
  if (origin && !VALID_ORIGINS.has(origin)) errors.push('payreq.origin');
  if (!origin && requireOrigin) errors.push('payreq.origin');

  const normalized = { targetCurrencyCode, amountRlusd: amountRlusdRes.value };
  if (origin) normalized.origin = origin;
  if (displayAmountRes.value != null) normalized.displayAmount = displayAmountRes.value;
  if (displayCurrencyCode) normalized.displayCurrencyCode = displayCurrencyCode;
  if (fxRateRes.value != null) normalized.fxRate = fxRateRes.value;
  if (allocatedAfterRes.value != null) normalized.allocatedRlusdAfter = allocatedAfterRes.value;
  if (fxSource) normalized.fxSource = fxSource;
  if (note) normalized.note = note;
  return normalized;
}

function normalizeMoonpayPayload(payload, errors) {
  const sideRaw = normalizeString(payload?.side);
  const side = sideRaw ? sideRaw.toLowerCase() : null;
  if (!side || !VALID_MOONPAY_SIDES.has(side)) errors.push('moonpay.side');

  const providerRaw = normalizeString(payload?.provider ?? 'moonpay');
  const provider = providerRaw ? providerRaw.toLowerCase() : null;
  if (!provider) errors.push('moonpay.provider');

  const currencyCode = normalizeCurrencyCode(payload?.currencyCode);
  if (payload?.currencyCode != null && !currencyCode) errors.push('moonpay.currencyCode');

  const amountRes = parseOptionalNumber(payload?.amount, { min: 0, minExclusive: true });
  if (!amountRes.ok) errors.push('moonpay.amount');

  const amountRlusdRes = parseOptionalNumber(payload?.amountRlusd, { min: 0, minExclusive: true });
  if (!amountRlusdRes.ok) errors.push('moonpay.amountRlusd');

  const normalized = { side, provider };
  if (currencyCode) normalized.currencyCode = currencyCode;
  if (amountRes.provided) normalized.amount = amountRes.value;
  if (amountRlusdRes.provided) normalized.amountRlusd = amountRlusdRes.value;
  return normalized;
}

function normalizeReconcilePayload(payload, errors) {
  const deficitRes = parseRequiredNumber(payload?.deficit, { min: 0, minExclusive: true });
  if (!deficitRes.ok) errors.push('reconcile.deficit');

  const operationsRaw = Array.isArray(payload?.operations) ? payload.operations : null;
  let operations = null;
  if (operationsRaw && operationsRaw.length > 0) {
    const normalizedOps = [];
    operationsRaw.forEach((entry) => {
      const currencyCode = normalizeCurrencyCode(entry?.currencyCode ?? entry?.currency);
      if (!currencyCode) { errors.push('reconcile.operations.currencyCode'); return; }
      const amountRes = parseRequiredNumber(entry?.deductedRlusd ?? entry?.amount, { min: 0, minExclusive: true });
      if (!amountRes.ok) { errors.push('reconcile.operations.deductedRlusd'); return; }
      normalizedOps.push({ currencyCode, deductedRlusd: amountRes.value });
    });
    if (normalizedOps.length === 0) {
      errors.push('reconcile.operations');
    } else {
      operations = normalizedOps;
    }
  } else {
    errors.push('reconcile.operations');
  }

  const lineStatesRaw = Array.isArray(payload?.lineStates) ? payload.lineStates : null;
  let lineStates = null;
  if (lineStatesRaw && lineStatesRaw.length > 0) {
    const normalizedStates = [];
    lineStatesRaw.forEach((entry) => {
      const currencyCode = normalizeCurrencyCode(entry?.currencyCode ?? entry?.currency);
      if (!currencyCode) { errors.push('reconcile.lineStates.currencyCode'); return; }
      const amountRes = parseRequiredNumber(entry?.allocatedRlusdAfter ?? entry?.allocated_after, { min: 0 });
      if (!amountRes.ok) { errors.push('reconcile.lineStates.allocatedRlusdAfter'); return; }
      normalizedStates.push({ currencyCode, allocatedRlusdAfter: amountRes.value });
    });
    if (normalizedStates.length > 0) {
      lineStates = normalizedStates;
    }
  }

  const normalized = { deficit: deficitRes.value };
  if (operations) normalized.operations = operations;
  if (lineStates) normalized.lineStates = lineStates;
  return normalized;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATE — parse v2 compact → normalized long-key payload
// ═══════════════════════════════════════════════════════════════════════════════

function validateXcannesMemoPayload(payload, options = {}) {
  const mode = options.mode || 'parse';
  const errors = [];

  if (!isPlainObject(payload)) {
    return { ok: false, errors: ['payload'], type: null };
  }

  const inferredType = options.type || inferXcannesMemoType(payload);
  if (!inferredType || !VALID_MEMO_TYPES.has(inferredType)) {
    return { ok: false, errors: ['type'], type: null };
  }

  const expanded = expandV2Payload(payload, inferredType);

  const markerType = normalizeString(expanded?.xcannes);
  if (markerType && markerType !== inferredType) {
    errors.push('xcannes');
  } else if (!markerType && mode === 'create') {
    errors.push('xcannes');
  }

  let normalizedBody = null;
  if (inferredType === 'wallet_label') {
    normalizedBody = normalizeWalletLabelPayload(expanded, errors);
  } else if (inferredType === 'address_book') {
    normalizedBody = normalizeAddressBookPayload(expanded, errors);
  } else if (inferredType === 'conversion') {
    normalizedBody = normalizeConversionPayload(expanded, errors);
  } else if (inferredType === 'payreq') {
    normalizedBody = normalizePayreqPayload(expanded, errors, { requireOrigin: mode === 'create' });
  } else if (inferredType === 'moonpay') {
    normalizedBody = normalizeMoonpayPayload(expanded, errors);
  } else if (inferredType === 'reconcile') {
    normalizedBody = normalizeReconcilePayload(expanded, errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors, type: inferredType };
  }

  const normalizedPayload = {
    xcannes: inferredType,
    v: MEMO_FORMAT_VERSION,
    ...normalizedBody,
  };

  return {
    ok: true,
    type: inferredType,
    payload: normalizedPayload,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 COMPACT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

function toV2Compact(type, body) {
  const short = V2_TYPE_LONG_TO_SHORT[type];
  if (!short) return null;

  const compact = { xc: short, v: MEMO_FORMAT_VERSION };

  if (type === 'wallet_label') {
    compact.l = body.label;
    if (body.defaultCurrency) compact.dc = body.defaultCurrency;
  } else if (type === 'address_book') {
    compact.a = body.address;
    if (body.label) compact.l = body.label;
  } else if (type === 'conversion') {
    compact.b = body.base;
    compact.q = body.quote;
    compact.r = body.amountRlusd;
    if (body.amountRlusdGross != null) compact.rg = body.amountRlusdGross;
    if (body.amountBase != null) compact.ab = body.amountBase;
    if (body.amountQuote != null) compact.aq = body.amountQuote;
    if (body.fxRate != null) compact.fx = body.fxRate;
    if (body.fxSource && body.fxSource !== 'FAWAZ') compact.fs = body.fxSource;
    if (body.spreadRlusd != null) compact.sp = body.spreadRlusd;
    if (body.spreadTier) compact.st = body.spreadTier;
    if (body.lineStates && body.lineStates.length > 0) {
      compact.ls = body.lineStates.map((s) => [s.currencyCode, s.allocatedRlusdAfter]);
    }
  } else if (type === 'payreq') {
    compact.tc = body.targetCurrencyCode;
    compact.r = body.amountRlusd;
    if (body.origin) compact.o = V2_ORIGIN_LONG_TO_SHORT[body.origin] || body.origin;
    if (body.displayAmount != null) compact.da = body.displayAmount;
    if (body.displayCurrencyCode && body.displayCurrencyCode !== body.targetCurrencyCode) {
      compact.dc = body.displayCurrencyCode;
    }
    if (body.fxRate != null) compact.fx = body.fxRate;
    if (body.fxSource && body.fxSource !== 'FAWAZ') compact.fs = body.fxSource;
    if (body.allocatedRlusdAfter != null) compact.aa = body.allocatedRlusdAfter;
    if (body.note) compact.n = body.note;
  } else if (type === 'moonpay') {
    compact.sd = V2_SIDE_LONG_TO_SHORT[body.side] || body.side;
    if (body.currencyCode) compact.c = body.currencyCode;
    if (body.amount != null) compact.a = body.amount;
    if (body.amountRlusd != null) compact.r = body.amountRlusd;
  } else if (type === 'reconcile') {
    compact.d = body.deficit;
    if (body.operations && body.operations.length > 0) {
      compact.ops = body.operations.map((op) => [op.currencyCode, op.deductedRlusd]);
    }
    if (body.lineStates && body.lineStates.length > 0) {
      compact.ls = body.lineStates.map((s) => [s.currencyCode, s.allocatedRlusdAfter]);
    }
  }

  return compact;
}

function buildXcannesMemoPayload(type, data = {}, options = {}) {
  if (!VALID_MEMO_TYPES.has(type)) {
    return { ok: false, errors: ['type'], type: null };
  }

  const payload = { xcannes: type, v: MEMO_FORMAT_VERSION, ...(data || {}) };

  const result = validateXcannesMemoPayload(payload, {
    mode: options.mode || 'create',
    type,
  });

  if (!result.ok) return result;

  result.compactPayload = toV2Compact(type, result.payload);

  // Size guard — reject memo payloads that exceed XRPL practical limit
  try {
    const json = JSON.stringify(result.compactPayload ?? result.payload);
    if (json.length > MEMO_MAX_JSON_BYTES) {
      return { ok: false, errors: ['memo_too_large'], type };
    }
  } catch {
    return { ok: false, errors: ['memo_serialize_error'], type };
  }

  return result;
}

function createXcannesMemoPayload(type, data = {}, options = {}) {
  const result = buildXcannesMemoPayload(type, data, options);
  if (result.ok) return result.compactPayload || result.payload;
  return null;
}

function buildWalletLabelMemo(data) {
  return createXcannesMemoPayload('wallet_label', data);
}

function buildAddressBookMemo(data) {
  return createXcannesMemoPayload('address_book', data);
}

function buildConversionMemo(data) {
  return createXcannesMemoPayload('conversion', data);
}

function buildPayreqMemo(data) {
  return createXcannesMemoPayload('payreq', data);
}

function buildMoonpayMemo(data) {
  return createXcannesMemoPayload('moonpay', data);
}

function buildReconcileMemo(data) {
  return createXcannesMemoPayload('reconcile', data);
}

export {
  XCANNES_MEMO_TYPE,
  XCANNES_MEMO_FORMAT,
  XCANNES_MEMO_FORMAT_ZLIB,
  MEMO_MAX_JSON_BYTES,
  validateXcannesMemoPayload,
  buildWalletLabelMemo,
  buildAddressBookMemo,
  buildConversionMemo,
  buildPayreqMemo,
  buildMoonpayMemo,
  buildReconcileMemo,
};
