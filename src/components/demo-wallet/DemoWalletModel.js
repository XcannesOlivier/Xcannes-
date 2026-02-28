import { isFxConversion } from "./utils/demoWalletSpread";

const DEFAULT_RATES_USD_PER_UNIT = {
  RLUSD: 1,
  XRP: 0.55,
  EUR: 1.08,
  CAD: 0.74,
  CHF: 1.1,
  JPY: 0.0067,
  GBP: 1.26,
  MXN: 0.058,
  ARS: 0.0012,
  BRL: 0.2,
  AED: 0.272,
  NGN: 0.001,
  INR: 0.012,
  PHP: 0.018,
  XAF: 0.0017,
};

const DEMO_ALLOCATIONS_MODE = "usd_v2";
const DEMO_UNALLOCATED_USD = 250;
const DEMO_NATIVE_CURRENCIES = new Set(["XRP", "RLUSD"]);

const DEFAULT_DEMO_WALLETS = {
  A: {
    id: "A",
    label: "Mr et Mme Dupont",
    labelLocked: false,
    address: "GtxxxxXcannes123xxxxxxxxxxx",
    allocations: {
      XRP: 12.345678,
      RLUSD: 1000,
      EUR: 420,
      CAD: 380,
      CHF: 260,
      JPY: 52000,
      GBP: 210,
      MXN: 6200,
      ARS: 54000,
      BRL: 980,
      AED: 0,
      NGN: 85000,
      INR: 120000,
      PHP: 3100,
      XAF: 180000,
    },
  },
};

const DEMO_EVENT_SPREAD_BPS = 100;
const DEMO_EVENTS_MONTHS = 12;
const DEMO_COUNTERPARTIES = [
  {
    label: "Merchant",
    address: "rDe_Receverpresentation_xxxxxxxxxxxxxxxxxxxxxx",
  },
  { label: "Payroll", address: "rDEMO_PAYROLL_xxxxxxxxxxxxxxxxxxxxxxx" },
  { label: "Friend", address: "rDEMO_FRIEND_xxxxxxxxxxxxxxxxxxxxxxxx" },
];

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function isDemoNativeCurrency(code) {
  return DEMO_NATIVE_CURRENCIES.has(String(code || "").toUpperCase());
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function newId() {
  if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `demo_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createSeededRandom(seed) {
  let t = Number(seed) || 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (max != null && value > max) return max;
  if (min != null && value < min) return min;
  return value;
}

function formatUnits(value) {
  return Number(Number(value).toFixed(6));
}

function normalizeAllocationUsd(currency, amountUnits, ratesUsdPerUnit) {
  const upper = String(currency || "").toUpperCase();
  const numeric = safeNumber(amountUnits) ?? 0;
  if (!numeric) return 0;
  if (isDemoNativeCurrency(upper)) return formatUnits(numeric);
  const rate = Number(ratesUsdPerUnit?.[upper]);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return formatUnits(numeric * rate);
}

function normalizeWalletAllocationsToUsd(wallet, ratesUsdPerUnit) {
  if (!wallet?.allocations) return;
  const next = {};
  let totalAllocatedUsd = 0;
  let rlusdOnChain = 0;
  Object.entries(wallet.allocations).forEach(([code, value]) => {
    const upper = String(code || "").toUpperCase();
    const normalized = normalizeAllocationUsd(upper, value, ratesUsdPerUnit);
    next[upper] = normalized;
    if (upper === "RLUSD") {
      rlusdOnChain = normalized;
    } else if (!isDemoNativeCurrency(upper)) {
      totalAllocatedUsd += normalized;
    }
  });
  if (rlusdOnChain > 0) {
    const reserve = Math.max(0, Math.min(DEMO_UNALLOCATED_USD, rlusdOnChain));
    const maxAllocated = Math.max(0, rlusdOnChain - reserve);
    if (totalAllocatedUsd > maxAllocated && totalAllocatedUsd > 0) {
      const scale = maxAllocated / totalAllocatedUsd;
      Object.entries(next).forEach(([code, value]) => {
        const upper = String(code || "").toUpperCase();
        if (!isDemoNativeCurrency(upper)) {
          next[upper] = formatUnits(Number(value || 0) * scale);
        }
      });
    }
  }
  wallet.allocations = next;
}

function scaleWalletAllocationsToReserve(wallet) {
  if (!wallet?.allocations) return;
  const allocations = wallet.allocations;
  const rlusdOnChain = safeNumber(allocations.RLUSD) ?? 0;
  if (rlusdOnChain <= 0) return;
  const reserve = Math.max(0, Math.min(DEMO_UNALLOCATED_USD, rlusdOnChain));
  const maxAllocated = Math.max(0, rlusdOnChain - reserve);
  const totalAllocatedUsd = Object.entries(allocations).reduce(
    (sum, [code, value]) => {
      const upper = String(code || "").toUpperCase();
      if (upper === "RLUSD" || upper === "XRP") return sum;
      return sum + (safeNumber(value) ?? 0);
    },
    0,
  );
  if (totalAllocatedUsd > maxAllocated && totalAllocatedUsd > 0) {
    const scale = maxAllocated / totalAllocatedUsd;
    Object.entries(allocations).forEach(([code, value]) => {
      const upper = String(code || "").toUpperCase();
      if (!isDemoNativeCurrency(upper)) {
        allocations[upper] = formatUnits(Number(value || 0) * scale);
      }
    });
  }
}

function resolveDemoUnitsFromAllocation(
  currency,
  allocationValue,
  ratesUsdPerUnit,
) {
  const upper = String(currency || "").toUpperCase();
  const allocation = safeNumber(allocationValue) ?? 0;
  if (!allocation) return 0;
  if (isDemoNativeCurrency(upper)) return allocation;
  const rate = Number(ratesUsdPerUnit?.[upper]);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return formatUnits(allocation / rate);
}

function buildDemoTimestamp(nextIndex, rand) {
  const monthsAgo = nextIndex % DEMO_EVENTS_MONTHS;
  const now = new Date();
  const date = new Date(now.getTime());
  date.setMonth(now.getMonth() - monthsAgo);
  const maxDay = monthsAgo === 0 ? now.getDate() : 26;
  const safeMax = Math.max(1, maxDay);
  date.setDate(1 + Math.floor(rand() * safeMax));
  date.setHours(
    9 + Math.floor(rand() * 9),
    Math.floor(rand() * 60),
    Math.floor(rand() * 60),
    0,
  );
  return date.getTime();
}

function buildCurrentMonthTimestamp(rand) {
  const now = new Date();
  const date = new Date(now.getTime());
  const maxDay = now.getDate();
  const safeMax = Math.max(1, maxDay);
  date.setDate(1 + Math.floor(rand() * safeMax));
  date.setHours(
    9 + Math.floor(rand() * 9),
    Math.floor(rand() * 60),
    Math.floor(rand() * 60),
    0,
  );
  return date.getTime();
}

function buildSendEvent({
  fromWalletId,
  toWalletId,
  fromAddress,
  toAddress,
  fromLabel,
  toLabel,
  currency,
  amount,
  ratesUsdPerUnit,
  memo,
  ts,
}) {
  const usdPerUnit = ratesUsdPerUnit?.[currency] ?? 0;
  const evt = {
    id: newId(),
    ts,
    kind: "send",
    currency,
    amount: formatUnits(amount),
    usdValue: formatUnits(amount * usdPerUnit),
    memo: memo ? String(memo).slice(0, 80) : "",
  };
  if (fromWalletId) evt.from = fromWalletId;
  if (toWalletId) evt.to = toWalletId;
  if (fromAddress) evt.fromAddress = String(fromAddress);
  if (toAddress) evt.toAddress = String(toAddress);
  if (fromLabel) evt.fromLabel = String(fromLabel).slice(0, 60);
  if (toLabel) evt.toLabel = String(toLabel).slice(0, 60);
  return evt;
}

function buildConvertEvent({
  walletId,
  fromCurrency,
  toCurrency,
  amount,
  ratesUsdPerUnit,
  spreadBps = DEMO_EVENT_SPREAD_BPS,
  ts,
}) {
  const fromUsdPerUnit = ratesUsdPerUnit?.[fromCurrency] ?? null;
  const toUsdPerUnit = ratesUsdPerUnit?.[toCurrency] ?? null;
  if (!fromUsdPerUnit || !toUsdPerUnit) return null;
  const usdGross = amount * fromUsdPerUnit;
  const feeUsd = (usdGross * spreadBps) / 10_000;
  const usdNet = Math.max(0, usdGross - feeUsd);
  const toAmount = usdNet / toUsdPerUnit;
  return {
    id: newId(),
    ts,
    kind: "convert",
    wallet: walletId,
    fromCurrency,
    toCurrency,
    fromAmount: formatUnits(amount),
    toAmount: formatUnits(toAmount),
    usdGross: formatUnits(usdGross),
    feeUsd: formatUnits(feeUsd),
    usdNet: formatUnits(usdNet),
    spreadBps,
  };
}

function buildCashEvent({
  walletId,
  side,
  currency,
  amount,
  ratesUsdPerUnit,
  memo,
  ts,
}) {
  const usdPerUnit = ratesUsdPerUnit?.[currency] ?? 0;
  return {
    id: newId(),
    ts,
    kind: side === "sell" ? "sell" : "buy",
    wallet: walletId,
    currency,
    amount: formatUnits(amount),
    usdValue: formatUnits(amount * usdPerUnit),
    memo: memo ? String(memo).slice(0, 80) : "",
  };
}

function resolveWalletAllocation(wallet, currency) {
  const allocation = safeNumber(wallet?.allocations?.[currency]);
  return allocation && allocation > 0 ? allocation : 0;
}

function pickDemoAmount(
  allocation,
  { factor, min, maxFraction = 0.25, maxAbsolute = 5000 },
) {
  if (!Number.isFinite(allocation) || allocation <= 0) return 0;
  const base = allocation * factor;
  const maxByFraction = allocation * maxFraction;
  const capped = clampNumber(base, min, Math.min(maxByFraction, maxAbsolute));
  return formatUnits(capped);
}

function buildDemoEvents(wallets, ratesUsdPerUnit) {
  if (!wallets?.A) return [];
  const rand = createSeededRandom(0xcafebabe);
  let index = 0;
  const nextTs = () => {
    const ts = buildDemoTimestamp(index, rand);
    index += 1;
    return ts;
  };

  const events = [];
  const walletA = wallets.A;
  const allocations = walletA?.allocations || {};
  const currencyCodes = Object.keys(allocations)
    .map((code) => String(code).toUpperCase())
    .filter((code) => code);

  const uniqueCurrencies = Array.from(new Set(currencyCodes));
  const counterpartyForIndex = (i) =>
    DEMO_COUNTERPARTIES[i % DEMO_COUNTERPARTIES.length];

  const pushTrustlineEvent = ({ walletId, currency, action }) => {
    events.push({
      id: newId(),
      ts: nextTs(),
      kind: action === "remove" ? "trustline_remove" : "trustline_add",
      wallet: walletId,
      currency: String(currency || "").toUpperCase(),
    });
  };

  uniqueCurrencies.forEach((currency, idx) => {
    const allocation = resolveWalletAllocation(walletA, currency);
    if (!allocation) return;
    const displayUnits = resolveDemoUnitsFromAllocation(
      currency,
      allocation,
      ratesUsdPerUnit,
    );

    // Occasional trustline operations for non-native currencies.
    if (currency !== "XRP" && currency !== "RLUSD") {
      if (idx % 4 === 0)
        pushTrustlineEvent({ walletId: "A", currency, action: "add" });
      if (idx % 11 === 0)
        pushTrustlineEvent({ walletId: "A", currency, action: "remove" });
    }

    // Outgoing payments.
    const counterparty = counterpartyForIndex(idx);
    const debitAmount = pickDemoAmount(displayUnits, {
      factor: 0.012,
      min: 0.2,
    });
    if (debitAmount) {
      events.push(
        buildSendEvent({
          fromWalletId: "A",
          toWalletId: null,
          toAddress: counterparty.address,
          toLabel: counterparty.label,
          currency,
          amount: debitAmount,
          ratesUsdPerUnit,
          memo: "Payment (demo)",
          ts: nextTs(),
        }),
      );
    }

    // Incoming settlements (credit) for realism.
    const creditAmount = pickDemoAmount(displayUnits, {
      factor: 0.006,
      min: 0.2,
    });
    if (creditAmount && idx % 3 === 0) {
      const fromParty = counterpartyForIndex(idx + 1);
      events.push(
        buildSendEvent({
          fromWalletId: null,
          toWalletId: "A",
          fromAddress: fromParty.address,
          fromLabel: fromParty.label,
          currency,
          amount: creditAmount,
          ratesUsdPerUnit,
          memo: "Settlement (demo)",
          ts: nextTs(),
        }),
      );
    }

    // Conversions (exclude RLUSD->RLUSD).
    if (currency !== "RLUSD") {
      const convertAmount = pickDemoAmount(displayUnits, {
        factor: 0.004,
        min: 0.1,
      });
      const event = buildConvertEvent({
        walletId: "A",
        fromCurrency: currency,
        toCurrency: "RLUSD",
        amount: convertAmount,
        ratesUsdPerUnit,
        spreadBps: DEMO_EVENT_SPREAD_BPS,
        ts: nextTs(),
      });
      if (event) events.push(event);
    }
  });

  // A few buys / sells to enrich statements.
  const rlusdAllocation = resolveWalletAllocation(walletA, "RLUSD");
  if (rlusdAllocation) {
    const amount = pickDemoAmount(rlusdAllocation, {
      factor: 0.08,
      min: 25,
      maxAbsolute: 180,
    });
    events.push(
      buildCashEvent({
        walletId: "A",
        side: "buy",
        currency: "RLUSD",
        amount,
        ratesUsdPerUnit,
        memo: "MoonPay (demo)",
        ts: nextTs(),
      }),
    );
  }
  const xrpAllocation = resolveWalletAllocation(walletA, "XRP");
  if (xrpAllocation) {
    const amount = pickDemoAmount(xrpAllocation, {
      factor: 0.5,
      min: 2,
      maxAbsolute: 25,
    });
    events.push(
      buildCashEvent({
        walletId: "A",
        side: "buy",
        currency: "XRP",
        amount,
        ratesUsdPerUnit,
        memo: "MoonPay (demo)",
        ts: nextTs(),
      }),
    );
  }

  ["EUR", "MXN", "INR", "XAF"].forEach((code) => {
    const currency = String(code).toUpperCase();
    const allocation = resolveWalletAllocation(walletA, currency);
    if (!allocation) return;
    const displayUnits = resolveDemoUnitsFromAllocation(
      currency,
      allocation,
      ratesUsdPerUnit,
    );
    const amount = pickDemoAmount(displayUnits, { factor: 0.007, min: 0.2 });
    events.push(
      buildCashEvent({
        walletId: "A",
        side: "sell",
        currency,
        amount,
        ratesUsdPerUnit,
        memo: "MoonPay (demo)",
        ts: nextTs(),
      }),
    );
  });

  return events.sort((a, b) => b.ts - a.ts);
}

export function getDemoRatesUsdPerUnit(overrides = {}) {
  return { ...DEFAULT_RATES_USD_PER_UNIT, ...(overrides || {}) };
}

export function buildDefaultDemoState() {
  const wallets = clone(DEFAULT_DEMO_WALLETS);
  Object.values(wallets).forEach((wallet) => {
    normalizeWalletAllocationsToUsd(wallet, DEFAULT_RATES_USD_PER_UNIT);
  });
  return {
    wallets,
    events: buildDemoEvents(wallets, DEFAULT_RATES_USD_PER_UNIT),
    meta: { allocationsMode: DEMO_ALLOCATIONS_MODE },
  };
}

export function migrateDemoState(state) {
  if (!state || typeof state !== "object") return state;
  const base = buildDefaultDemoState();
  const previousMode = state?.meta?.allocationsMode || null;
  const shouldNormalizeAllocations = previousMode !== DEMO_ALLOCATIONS_MODE;
  const wallets = state.wallets || {};
  const allowedWalletIds = new Set(Object.keys(base.wallets || {}));

  Object.entries(wallets).forEach(([walletId, wallet]) => {
    if (!wallet || typeof wallet !== "object") return;
    if (!allowedWalletIds.has(walletId)) return;
    const target = base.wallets[walletId] || {};
    const { allocations, ...rest } = wallet;
    Object.assign(target, rest);
    if (!target.allocations || typeof target.allocations !== "object") {
      target.allocations = {};
    }
    Object.entries(allocations || {}).forEach(([code, value]) => {
      const upper = String(code || "").toUpperCase();
      target.allocations[upper] = value;
    });
    if (shouldNormalizeAllocations) {
      if (previousMode === "usd") {
        scaleWalletAllocationsToReserve(target);
      } else {
        normalizeWalletAllocationsToUsd(target, DEFAULT_RATES_USD_PER_UNIT);
      }
    }

    // Wallet label rules (demo): default is "Mr et Mme Dupont", user can rename once then lock.
    if (walletId === "A") {
      const defaultLabel = "Mr et Mme Dupont";
      const legacyDefaultLabels = new Set([
        "Wallet A",
        "Compte démo",
        "Compte demo",
      ]);
      const normalizedLabel = String(target?.label || "").trim();
      if (!normalizedLabel || legacyDefaultLabels.has(normalizedLabel)) {
        target.label = defaultLabel;
        target.labelLocked = false;
      } else if (typeof target.labelLocked !== "boolean") {
        target.labelLocked = normalizedLabel !== defaultLabel;
      } else if (target.labelLocked && normalizedLabel === defaultLabel) {
        target.labelLocked = false;
      }

      const normalizedAddress = String(target?.address || "").trim();
      if (
        !normalizedAddress ||
        normalizedAddress === "rDEMO_WALLET_A_xxxxxxxxxxxxxxxxxxxxxxxx" ||
        normalizedAddress.startsWith("rGt_Comptedepresentation_")
      ) {
        target.address = base.wallets?.A?.address || target.address;
      }
    } else if (typeof target.labelLocked !== "boolean") {
      target.labelLocked = false;
    }

    base.wallets[walletId] = target;
  });

  const incomingEvents = Array.isArray(state.events) ? clone(state.events) : [];
  base.events = incomingEvents.length ? incomingEvents : base.events;
  base.meta = { ...(base.meta || {}), allocationsMode: DEMO_ALLOCATIONS_MODE };

  return base;
}

export function walletUsdTotal(wallet, ratesUsdPerUnit) {
  const rlusd = safeNumber(wallet?.allocations?.RLUSD);
  return rlusd && rlusd > 0 ? rlusd : 0;
}

export function ensureAllocation(wallet, currencyCode) {
  const upper = String(currencyCode || "").toUpperCase();
  const allocations = wallet?.allocations || {};
  if (allocations[upper] === undefined) {
    allocations[upper] = 0;
  }
  return allocations;
}

export function getWalletAddress(state, walletId) {
  const wallet = state?.wallets?.[walletId];
  return wallet?.address || "";
}

function listWalletCurrencies(wallet) {
  const allocations = wallet?.allocations || {};
  return Object.keys(allocations).map((c) => String(c).toUpperCase());
}

function listStateCurrencies(state) {
  const wallets = state?.wallets || {};
  const used = new Set();
  Object.values(wallets).forEach((w) => {
    listWalletCurrencies(w).forEach((c) => used.add(c));
  });
  return Array.from(used).sort((a, b) => a.localeCompare(b));
}

function pushEvent(state, event) {
  if (!state.events) state.events = [];
  state.events.unshift(event);
}

function resolveDemoAmountUsd(currency, amountUnits, ratesUsdPerUnit) {
  const upper = String(currency || "").toUpperCase();
  const usdPerUnit = ratesUsdPerUnit?.[upper];
  if (!usdPerUnit) return null;
  const units = safeNumber(amountUnits);
  if (units === null) return null;
  return units * usdPerUnit;
}

function resolveDemoAvailableUsd(wallet, currency, ratesUsdPerUnit) {
  const upper = String(currency || "").toUpperCase();
  const usdPerUnit = ratesUsdPerUnit?.[upper];
  if (!usdPerUnit) return null;
  const stored = safeNumber(wallet?.allocations?.[upper]) ?? 0;
  if (isDemoNativeCurrency(upper)) return stored * usdPerUnit;
  return stored;
}

function applyDemoDebitAllocation(wallet, currency, amountUnits, amountUsd) {
  const upper = String(currency || "").toUpperCase();
  ensureAllocation(wallet, upper);
  const current = safeNumber(wallet.allocations[upper]) ?? 0;
  if (isDemoNativeCurrency(upper)) {
    wallet.allocations[upper] = Number((current - amountUnits).toFixed(6));
  } else {
    wallet.allocations[upper] = Number((current - amountUsd).toFixed(6));
  }
}

function applyDemoCreditAllocation(wallet, currency, amountUnits, amountUsd) {
  const upper = String(currency || "").toUpperCase();
  ensureAllocation(wallet, upper);
  const current = safeNumber(wallet.allocations[upper]) ?? 0;
  if (isDemoNativeCurrency(upper)) {
    wallet.allocations[upper] = Number((current + amountUnits).toFixed(6));
  } else {
    wallet.allocations[upper] = Number((current + amountUsd).toFixed(6));
  }
}

export function applyDemoSend({
  state,
  fromWalletId,
  toWalletId,
  toAddress,
  currencyCode,
  amountUnits,
  memo,
  ratesUsdPerUnit,
}) {
  const amount = safeNumber(amountUnits);
  if (!state || !state.wallets) return { ok: false, error: "invalid_state" };
  if (!amount || amount <= 0) return { ok: false, error: "invalid_amount" };

  const fromWallet = state.wallets[fromWalletId];
  const toWallet = toWalletId ? state.wallets[toWalletId] : null;
  if (!fromWallet) return { ok: false, error: "invalid_wallet" };
  if (toWalletId && !toWallet) return { ok: false, error: "invalid_wallet" };

  const currency = String(currencyCode || "").toUpperCase();
  const amountUsd = resolveDemoAmountUsd(currency, amount, ratesUsdPerUnit);
  if (!amountUsd) return { ok: false, error: "unsupported_currency" };

  const availableUsd = resolveDemoAvailableUsd(
    fromWallet,
    currency,
    ratesUsdPerUnit,
  );
  if (availableUsd === null)
    return { ok: false, error: "unsupported_currency" };
  if (amountUsd > availableUsd)
    return { ok: false, error: "insufficient_funds" };

  applyDemoDebitAllocation(fromWallet, currency, amount, amountUsd);
  if (!isDemoNativeCurrency(currency)) {
    ensureAllocation(fromWallet, "RLUSD");
    const rlusdCurrent = safeNumber(fromWallet.allocations.RLUSD) ?? 0;
    fromWallet.allocations.RLUSD = Number(
      (rlusdCurrent - amountUsd).toFixed(6),
    );
  }
  if (toWallet) {
    applyDemoCreditAllocation(toWallet, currency, amount, amountUsd);
    if (!isDemoNativeCurrency(currency)) {
      ensureAllocation(toWallet, "RLUSD");
      const rlusdCurrent = safeNumber(toWallet.allocations.RLUSD) ?? 0;
      toWallet.allocations.RLUSD = Number(
        (rlusdCurrent + amountUsd).toFixed(6),
      );
    }
  }

  const event = {
    id: newId(),
    ts: Date.now(),
    kind: "send",
    from: fromWalletId,
    currency,
    amount,
    usdValue: amountUsd,
    memo: String(memo || "").slice(0, 80),
  };
  if (toWalletId) event.to = toWalletId;
  if (toAddress) event.toAddress = String(toAddress);
  pushEvent(state, event);

  return { ok: true, event };
}

export function applyDemoConvert({
  state,
  walletId,
  fromCurrencyCode,
  toCurrencyCode,
  amountUnits,
  spreadBps = 100,
  ratesUsdPerUnit,
}) {
  const amount = safeNumber(amountUnits);
  if (!state || !state.wallets) return { ok: false, error: "invalid_state" };
  if (!amount || amount <= 0) return { ok: false, error: "invalid_amount" };

  const wallet = state.wallets[walletId];
  if (!wallet) return { ok: false, error: "invalid_wallet" };

  const fromCurrency = String(fromCurrencyCode || "").toUpperCase();
  const toCurrency = String(toCurrencyCode || "").toUpperCase();
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
    return { ok: false, error: "invalid_pair" };
  }

  const fromUsdPerUnit = ratesUsdPerUnit?.[fromCurrency] ?? null;
  const toUsdPerUnit = ratesUsdPerUnit?.[toCurrency] ?? null;
  if (!fromUsdPerUnit || !toUsdPerUnit) {
    return { ok: false, error: "unsupported_currency" };
  }

  const usdGross = amount * fromUsdPerUnit;
  const feeUsd = (usdGross * spreadBps) / 10_000;
  const usdNet = Math.max(0, usdGross - feeUsd);
  const toAmount = usdNet / toUsdPerUnit;

  const rlusdCurrent = safeNumber(wallet.allocations?.RLUSD) ?? 0;
  if (feeUsd > rlusdCurrent + 1e-9)
    return { ok: false, error: "insufficient_funds" };

  const isFromNative = isDemoNativeCurrency(fromCurrency);
  const isToNative = isDemoNativeCurrency(toCurrency);
  const isFromRlusd = fromCurrency === "RLUSD";
  const isToRlusd = toCurrency === "RLUSD";

  if (isFromRlusd && !isToNative) {
    const rlusdOnChain = safeNumber(wallet.allocations?.RLUSD) ?? 0;
    const totalAllocatedUsd = Object.entries(wallet.allocations || {}).reduce(
      (sum, [code, value]) => {
        const upper = String(code || "").toUpperCase();
        if (upper === "RLUSD" || upper === "XRP") return sum;
        return sum + (safeNumber(value) ?? 0);
      },
      0,
    );
    const unallocatedUsd = rlusdOnChain - totalAllocatedUsd;
    if (usdGross > unallocatedUsd)
      return { ok: false, error: "insufficient_funds" };
    applyDemoCreditAllocation(wallet, toCurrency, toAmount, usdNet);
  } else if (isToRlusd && !isFromNative) {
    const availableUsd = resolveDemoAvailableUsd(
      wallet,
      fromCurrency,
      ratesUsdPerUnit,
    );
    if (availableUsd === null)
      return { ok: false, error: "unsupported_currency" };
    if (usdGross > availableUsd)
      return { ok: false, error: "insufficient_funds" };
    applyDemoDebitAllocation(wallet, fromCurrency, amount, usdGross);
  } else {
    const availableUsd = resolveDemoAvailableUsd(
      wallet,
      fromCurrency,
      ratesUsdPerUnit,
    );
    if (availableUsd === null)
      return { ok: false, error: "unsupported_currency" };
    if (usdGross > availableUsd)
      return { ok: false, error: "insufficient_funds" };

    applyDemoDebitAllocation(wallet, fromCurrency, amount, usdGross);
    applyDemoCreditAllocation(wallet, toCurrency, toAmount, usdNet);
  }

  if (feeUsd > 0) {
    ensureAllocation(wallet, "RLUSD");
    wallet.allocations.RLUSD = Number(
      (Number(wallet.allocations.RLUSD || 0) - feeUsd).toFixed(6),
    );
  }

  const event = {
    id: newId(),
    ts: Date.now(),
    kind: "convert",
    wallet: walletId,
    fromCurrency,
    toCurrency,
    fromAmount: amount,
    toAmount,
    usdGross,
    feeUsd,
    usdNet,
    spreadBps,
  };
  pushEvent(state, event);

  return { ok: true, event };
}

export function applyDemoBuySell({
  state,
  walletId,
  side, // "buy" | "sell"
  amountUsd,
  memo,
}) {
  const amount = safeNumber(amountUsd);
  if (!state || !state.wallets) return { ok: false, error: "invalid_state" };
  if (!amount || amount <= 0) return { ok: false, error: "invalid_amount" };

  const wallet = state.wallets[walletId];
  if (!wallet) return { ok: false, error: "invalid_wallet" };

  ensureAllocation(wallet, "RLUSD");
  const current = safeNumber(wallet.allocations.RLUSD) ?? 0;

  if (side === "sell" && amount > current) {
    return { ok: false, error: "insufficient_funds" };
  }

  wallet.allocations.RLUSD = Number(
    (side === "sell" ? current - amount : current + amount).toFixed(6),
  );

  const event = {
    id: newId(),
    ts: Date.now(),
    kind: side === "sell" ? "sell" : "buy",
    wallet: walletId,
    currency: "RLUSD",
    amount,
    usdValue: amount,
    memo: String(memo || "").slice(0, 80),
  };
  pushEvent(state, event);

  return { ok: true, event };
}

export function applyDemoEnableCurrency({ state, walletId, currencyCode }) {
  if (!state || !state.wallets) return { ok: false, error: "invalid_state" };
  const wallet = state.wallets[walletId];
  if (!wallet) return { ok: false, error: "invalid_wallet" };

  const currency = String(currencyCode || "").toUpperCase();
  if (!currency) return { ok: false, error: "invalid_currency" };

  if (wallet.allocations?.[currency] !== undefined) return { ok: true };
  ensureAllocation(wallet, currency);
  pushEvent(state, {
    id: newId(),
    ts: Date.now(),
    kind: "trustline_add",
    wallet: walletId,
    currency,
  });
  return { ok: true };
}

function listWalletEvents(state, walletId) {
  const events = state?.events || [];
  return events.filter((evt) => {
    if (!evt) return false;
    if (evt.wallet && evt.wallet === walletId) return true;
    if (evt.from && evt.from === walletId) return true;
    if (evt.to && evt.to === walletId) return true;
    return false;
  });
}

function listWalletCurrencyEvents(state, walletId, currencyCode) {
  const currency = String(currencyCode || "").toUpperCase();
  return listWalletEvents(state, walletId).filter((evt) => {
    if (!evt) return false;
    if (evt.currency && String(evt.currency).toUpperCase() === currency)
      return true;
    if (evt.fromCurrency && String(evt.fromCurrency).toUpperCase() === currency)
      return true;
    if (evt.toCurrency && String(evt.toCurrency).toUpperCase() === currency)
      return true;
    return false;
  });
}
