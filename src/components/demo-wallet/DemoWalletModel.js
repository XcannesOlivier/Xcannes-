const DEFAULT_RATES_USD_PER_UNIT = {
  RLUSD: 1,
  XRP: 0.55,
  XCS: 0.1,
  EUR: 1.08,
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

const DEFAULT_DEMO_WALLETS = {
  A: {
    id: "A",
    label: "Wallet A",
    address: "rDEMO_WALLET_A_xxxxxxxxxxxxxxxxxxxxxxxx",
    allocations: {
      XRP: 12.345678,
      XCS: 250,
      RLUSD: 1000,
      EUR: 420,
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
  B: {
    id: "B",
    label: "Wallet B",
    address: "rDEMO_WALLET_B_xxxxxxxxxxxxxxxxxxxxxxxx",
    allocations: {
      XRP: 5,
      XCS: 50,
      RLUSD: 500,
      EUR: 120,
      GBP: 75,
      MXN: 4100,
      ARS: 85000,
      BRL: 620,
      AED: 0,
      NGN: 120000,
      INR: 90000,
      PHP: 2200,
      XAF: 135000,
    },
  },
  FEE: {
    id: "FEE",
    label: "XCANNES Fees",
    address: "rDEMO_WALLET_FEES_xxxxxxxxxxxxxxxxxxxxx",
    allocations: {
      RLUSD: 0,
    },
  },
};

const DEMO_EVENT_SPREAD_BPS = 60;
const DEMO_EVENTS_MONTHS = 12;

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

function buildDemoTimestamp(nextIndex, rand) {
  const monthsAgo = nextIndex % DEMO_EVENTS_MONTHS;
  const now = new Date();
  const date = new Date(now.getTime());
  date.setMonth(now.getMonth() - monthsAgo);
  const maxDay = monthsAgo === 0 ? now.getDate() : 26;
  const safeMax = Math.max(1, maxDay);
  date.setDate(1 + Math.floor(rand() * safeMax));
  date.setHours(9 + Math.floor(rand() * 9), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
  return date.getTime();
}

function buildSendEvent({
  fromWalletId,
  toWalletId,
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
    kind: "send",
    from: fromWalletId,
    to: toWalletId,
    currency,
    amount: formatUnits(amount),
    usdValue: formatUnits(amount * usdPerUnit),
    memo: memo ? String(memo).slice(0, 80) : "",
  };
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

function pickDemoAmount(allocation, { factor, min, maxFraction = 0.25, maxAbsolute = 5000 }) {
  if (!Number.isFinite(allocation) || allocation <= 0) return 0;
  const base = allocation * factor;
  const maxByFraction = allocation * maxFraction;
  const capped = clampNumber(base, min, Math.min(maxByFraction, maxAbsolute));
  return formatUnits(capped);
}

function buildDemoEvents(wallets, ratesUsdPerUnit) {
  if (!wallets?.A || !wallets?.B) return [];
  const rand = createSeededRandom(0xcafebabe);
  let index = 0;
  const nextTs = () => {
    const ts = buildDemoTimestamp(index, rand);
    index += 1;
    return ts;
  };

  const events = [];
  const walletA = wallets.A;
  const walletB = wallets.B;
  const currencyCodes = Object.keys(walletA?.allocations || {})
    .map((code) => String(code).toUpperCase())
    .filter((code) => code && code !== "FEE");

  currencyCodes.forEach((currency) => {
    const allocA = resolveWalletAllocation(walletA, currency);
    const allocB = resolveWalletAllocation(walletB, currency);
    if (!allocA || !allocB) return;

    const debitAmount = pickDemoAmount(allocA, { factor: 0.015, min: 0.2 });
    const creditAmount = pickDemoAmount(allocB, { factor: 0.012, min: 0.2 });
    if (debitAmount) {
      events.push(
        buildSendEvent({
          fromWalletId: "A",
          toWalletId: "B",
          currency,
          amount: debitAmount,
          ratesUsdPerUnit,
          memo: "Payment",
          ts: nextTs(),
        })
      );
    }
    if (creditAmount) {
      events.push(
        buildSendEvent({
          fromWalletId: "B",
          toWalletId: "A",
          currency,
          amount: creditAmount,
          ratesUsdPerUnit,
          memo: "Settlement",
          ts: nextTs(),
        })
      );
    }
  });

  currencyCodes
    .filter((code) => code !== "RLUSD")
    .forEach((currency, idx) => {
      const walletId = idx % 2 === 0 ? "A" : "B";
      const wallet = wallets[walletId];
      const allocation = resolveWalletAllocation(wallet, currency);
      if (!allocation) return;
      const amount = pickDemoAmount(allocation, { factor: 0.003, min: 0.1 });
      const event = buildConvertEvent({
        walletId,
        fromCurrency: currency,
        toCurrency: "RLUSD",
        amount,
        ratesUsdPerUnit,
        spreadBps: DEMO_EVENT_SPREAD_BPS,
        ts: nextTs(),
      });
      if (event) events.push(event);
    });

  ["A", "B"].forEach((walletId) => {
    const wallet = wallets[walletId];
    const rlusdAllocation = resolveWalletAllocation(wallet, "RLUSD");
    const xrpAllocation = resolveWalletAllocation(wallet, "XRP");
    if (rlusdAllocation) {
      const amount = pickDemoAmount(rlusdAllocation, {
        factor: 0.08,
        min: 25,
        maxAbsolute: 180,
      });
      events.push(
        buildCashEvent({
          walletId,
          side: "buy",
          currency: "RLUSD",
          amount,
          ratesUsdPerUnit,
          memo: "MoonPay (demo)",
          ts: nextTs(),
        })
      );
    }
    if (xrpAllocation) {
      const amount = pickDemoAmount(xrpAllocation, {
        factor: 0.5,
        min: 2,
        maxAbsolute: 25,
      });
      events.push(
        buildCashEvent({
          walletId,
          side: "buy",
          currency: "XRP",
          amount,
          ratesUsdPerUnit,
          memo: "MoonPay (demo)",
          ts: nextTs(),
        })
      );
    }
  });

  const sellMap = {
    A: ["EUR", "MXN", "INR", "XAF"],
    B: ["GBP", "BRL", "PHP", "NGN"],
  };
  Object.entries(sellMap).forEach(([walletId, currencies]) => {
    currencies
      .map((code) => String(code).toUpperCase())
      .filter((code) => currencyCodes.includes(code))
      .forEach((currency) => {
        const allocation = resolveWalletAllocation(wallets[walletId], currency);
        if (!allocation) return;
        const amount = pickDemoAmount(allocation, { factor: 0.007, min: 0.2 });
        events.push(
          buildCashEvent({
            walletId,
            side: "sell",
            currency,
            amount,
            ratesUsdPerUnit,
            memo: "MoonPay (demo)",
            ts: nextTs(),
          })
        );
      });
  });

  return events.sort((a, b) => b.ts - a.ts);
}

export function getDemoRatesUsdPerUnit(overrides = {}) {
  return { ...DEFAULT_RATES_USD_PER_UNIT, ...(overrides || {}) };
}

export function buildDefaultDemoState() {
  const wallets = clone(DEFAULT_DEMO_WALLETS);
  return {
    wallets,
    events: buildDemoEvents(wallets, DEFAULT_RATES_USD_PER_UNIT),
  };
}

export function migrateDemoState(state) {
  if (!state || typeof state !== "object") return state;
  const base = buildDefaultDemoState();
  const wallets = state.wallets || {};

  Object.entries(wallets).forEach(([walletId, wallet]) => {
    if (!wallet || typeof wallet !== "object") return;
    const target = base.wallets[walletId] || {};
    const { allocations, ...rest } = wallet;
    Object.assign(target, rest);
    if (!target.allocations || typeof target.allocations !== "object") {
      target.allocations = {};
    }
    Object.entries(allocations || {}).forEach(([code, value]) => {
      target.allocations[code] = value;
    });
    base.wallets[walletId] = target;
  });

  const incomingEvents = Array.isArray(state.events) ? clone(state.events) : [];
  base.events = incomingEvents.length ? incomingEvents : base.events;

  return base;
}

export function walletUsdTotal(wallet, ratesUsdPerUnit) {
  const allocations = wallet?.allocations || {};
  return Object.entries(allocations).reduce((sum, [code, units]) => {
    const usdPerUnit = ratesUsdPerUnit?.[String(code).toUpperCase()] ?? null;
    if (!usdPerUnit) return sum;
    const safeUnits = safeNumber(units);
    if (safeUnits === null || safeUnits <= 0) return sum;
    return sum + safeUnits * usdPerUnit;
  }, 0);
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

export function listWalletCurrencies(wallet) {
  const allocations = wallet?.allocations || {};
  return Object.keys(allocations).map((c) => String(c).toUpperCase());
}

export function listStateCurrencies(state) {
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

export function applyDemoSend({
  state,
  fromWalletId,
  toWalletId,
  currencyCode,
  amountUnits,
  memo,
  ratesUsdPerUnit,
}) {
  const amount = safeNumber(amountUnits);
  if (!state || !state.wallets) return { ok: false, error: "invalid_state" };
  if (!amount || amount <= 0) return { ok: false, error: "invalid_amount" };

  const fromWallet = state.wallets[fromWalletId];
  const toWallet = state.wallets[toWalletId];
  if (!fromWallet || !toWallet) return { ok: false, error: "invalid_wallet" };

  const currency = String(currencyCode || "").toUpperCase();
  const usdPerUnit = ratesUsdPerUnit?.[currency] ?? null;
  if (!usdPerUnit) return { ok: false, error: "unsupported_currency" };

  ensureAllocation(fromWallet, currency);
  ensureAllocation(toWallet, currency);

  const available = safeNumber(fromWallet.allocations[currency]) ?? 0;
  if (amount > available) return { ok: false, error: "insufficient_funds" };

  fromWallet.allocations[currency] = Number((available - amount).toFixed(6));
  const toBalance = safeNumber(toWallet.allocations[currency]) ?? 0;
  toWallet.allocations[currency] = Number((toBalance + amount).toFixed(6));

  const usdValue = amount * usdPerUnit;
  const event = {
    id: newId(),
    ts: Date.now(),
    kind: "send",
    from: fromWalletId,
    to: toWalletId,
    currency,
    amount,
    usdValue,
    memo: String(memo || "").slice(0, 80),
  };
  pushEvent(state, event);

  return { ok: true, event };
}

export function applyDemoConvert({
  state,
  walletId,
  fromCurrencyCode,
  toCurrencyCode,
  amountUnits,
  spreadBps = 60,
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

  ensureAllocation(wallet, fromCurrency);
  ensureAllocation(wallet, toCurrency);

  const available = safeNumber(wallet.allocations[fromCurrency]) ?? 0;
  if (amount > available) return { ok: false, error: "insufficient_funds" };

  const usdGross = amount * fromUsdPerUnit;
  const feeUsd = (usdGross * spreadBps) / 10_000;
  const usdNet = Math.max(0, usdGross - feeUsd);
  const toAmount = usdNet / toUsdPerUnit;

  wallet.allocations[fromCurrency] = Number((available - amount).toFixed(6));
  const prevTo = safeNumber(wallet.allocations[toCurrency]) ?? 0;
  wallet.allocations[toCurrency] = Number((prevTo + toAmount).toFixed(6));

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
    (side === "sell" ? current - amount : current + amount).toFixed(6)
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

export function applyDemoDisableCurrency({ state, walletId, currencyCode }) {
  if (!state || !state.wallets) return { ok: false, error: "invalid_state" };
  const wallet = state.wallets[walletId];
  if (!wallet) return { ok: false, error: "invalid_wallet" };

  const currency = String(currencyCode || "").toUpperCase();
  if (!currency) return { ok: false, error: "invalid_currency" };

  const current = safeNumber(wallet.allocations?.[currency]) ?? 0;
  if (current !== 0) return { ok: false, error: "non_zero_balance" };

  if (wallet.allocations && wallet.allocations[currency] !== undefined) {
    delete wallet.allocations[currency];
  }

  pushEvent(state, {
    id: newId(),
    ts: Date.now(),
    kind: "trustline_remove",
    wallet: walletId,
    currency,
  });

  return { ok: true };
}

export function listWalletEvents(state, walletId) {
  const events = state?.events || [];
  return events.filter((evt) => {
    if (!evt) return false;
    if (evt.wallet && evt.wallet === walletId) return true;
    if (evt.from && evt.from === walletId) return true;
    if (evt.to && evt.to === walletId) return true;
    return false;
  });
}

export function listWalletCurrencyEvents(state, walletId, currencyCode) {
  const currency = String(currencyCode || "").toUpperCase();
  return listWalletEvents(state, walletId).filter((evt) => {
    if (!evt) return false;
    if (evt.currency && String(evt.currency).toUpperCase() === currency) return true;
    if (evt.fromCurrency && String(evt.fromCurrency).toUpperCase() === currency) return true;
    if (evt.toCurrency && String(evt.toCurrency).toUpperCase() === currency) return true;
    return false;
  });
}
