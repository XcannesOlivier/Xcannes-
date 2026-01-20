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

export function getDemoRatesUsdPerUnit(overrides = {}) {
  return { ...DEFAULT_RATES_USD_PER_UNIT, ...(overrides || {}) };
}

export function buildDefaultDemoState() {
  return {
    wallets: clone(DEFAULT_DEMO_WALLETS),
    events: [],
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

  base.events = Array.isArray(state.events) ? clone(state.events) : [];

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
