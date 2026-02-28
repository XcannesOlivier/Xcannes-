const XCANNES_MEMO_TYPE = 'XCANNES';
const XCANNES_MEMO_FORMAT = 'application/json';

const XCANNES_MEMO_SCHEMAS = {
  wallet_label: { schema: 'xcannes-wallet-label-v1', version: 1 },
  currency_line: { schema: 'xcannes-currency-line-v1', version: 1 },
  conversion: { schema: 'xcannes-convert-v1', version: 1 },
  payreq: { schema: 'xcannes-payreq-v1', version: 1 },
  allocation_adjust: { schema: 'xcannes-allocation-v1', version: 1 },
  moonpay: { schema: 'xcannes-moonpay-v1', version: 1 },
};

const SCHEMA_TO_TYPE = Object.entries(XCANNES_MEMO_SCHEMAS).reduce((acc, [type, meta]) => {
  acc[meta.schema.toLowerCase()] = type;
  return acc;
}, {});

const VALID_ORIGINS = new Set(['payreq', 'manual', 'spread']);
const VALID_LINE_ACTIONS = new Set(['activate']);
const VALID_ALLOC_ACTIONS = new Set(['allocate', 'deallocate']);
const VALID_MOONPAY_SIDES = new Set(['sell', 'buy']);
const XRPL_ASSET_CODES = new Set(['XRP', 'RLUSD', 'RLUSD']);

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

function normalizeCurrencyCode(value) {
  const code = normalizeUpper(value);
  if (!code) return null;
  if (code.length < 2 || code.length > 12) return null;
  return code;
}

function normalizeMemoTypeMarker(value) {
  const marker = normalizeString(value);
  if (!marker) return null;
  const lower = marker.toLowerCase();
  if (lower === 'wallet_label' || lower.includes('wallet-label')) return 'wallet_label';
  if (lower === 'currency_line' || lower.includes('currency-line')) return 'currency_line';
  if (lower === 'conversion' || lower === 'convert' || lower.includes('convert')) return 'conversion';
  if (lower === 'allocation_adjust' || lower.includes('allocation')) return 'allocation_adjust';
  if (lower === 'moonpay' || lower.includes('moonpay')) return 'moonpay';
  if (lower === 'payreq' || lower.includes('payreq')) return 'payreq';
  return null;
}

function isValidWalletLabel(label) {
  if (!label) return false;
  const parts = String(label).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return false;
  const wordPattern = /^[A-Za-z]+$/;
  return parts.every((part) => part.length <= 7 && wordPattern.test(part));
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

function getXcannesMemoSchema(type) {
  return XCANNES_MEMO_SCHEMAS[type] ? { type, ...XCANNES_MEMO_SCHEMAS[type] } : null;
}

function inferXcannesMemoType(payload) {
  if (!isPlainObject(payload)) return null;
  const schemaRaw = normalizeString(payload.schema);
  if (schemaRaw) {
    const schemaLower = schemaRaw.toLowerCase();
    if (SCHEMA_TO_TYPE[schemaLower]) return SCHEMA_TO_TYPE[schemaLower];
    const fromSchema = normalizeMemoTypeMarker(schemaLower);
    if (fromSchema) return fromSchema;
  }

  const marker = normalizeMemoTypeMarker(
    payload?.xcannes ?? payload?.xc ?? payload?.kind ?? payload?.type ?? null
  );
  if (marker) return marker;

  if (payload?.targetCurrency || payload?.targetCurrencyCode) return 'payreq';

  return null;
}

function normalizeWalletLabelPayload(payload, errors) {
  const label = normalizeString(payload?.label);
  if (!label || !isValidWalletLabel(label)) errors.push('wallet_label.label');
  const defaultCurrency = normalizeCurrencyCode(payload?.defaultCurrency);
  const normalized = { label };
  if (defaultCurrency) normalized.defaultCurrency = defaultCurrency;
  return normalized;
}

function normalizeCurrencyLinePayload(payload, errors) {
  const action = normalizeString(payload?.action);
  const normalizedAction = action ? action.toLowerCase() : null;
  if (!normalizedAction || !VALID_LINE_ACTIONS.has(normalizedAction)) {
    errors.push('currency_line.action');
  }
  const currencyCode = normalizeCurrencyCode(payload?.currencyCode ?? payload?.currency);
  if (!currencyCode) errors.push('currency_line.currencyCode');
  const allocatedAfterRes = parseOptionalNumber(payload?.allocatedRlusdAfter, { min: 0 });
  if (!allocatedAfterRes.ok) errors.push('currency_line.allocatedRlusdAfter');
  const normalized = { action: normalizedAction, currencyCode };
  if (allocatedAfterRes.value != null) normalized.allocatedRlusdAfter = allocatedAfterRes.value;
  return normalized;
}

function normalizeConversionPayload(payload, errors) {
  const base = normalizeCurrencyCode(payload?.base);
  const quote = normalizeCurrencyCode(payload?.quote);
  if (!base) errors.push('conversion.base');
  if (!quote) errors.push('conversion.quote');

  const amountRlusdRes = parseRequiredNumber(payload?.amountRlusd, {
    min: 0,
    minExclusive: true,
  });
  if (!amountRlusdRes.ok) errors.push('conversion.amountRlusd');

  const amountRlusdGrossRes = parseOptionalNumber(payload?.amountRlusdGross, {
    min: 0,
  });
  if (!amountRlusdGrossRes.ok) errors.push('conversion.amountRlusdGross');

  const amountBaseRes = parseOptionalNumber(payload?.amountBase, { min: 0 });
  if (!amountBaseRes.ok) errors.push('conversion.amountBase');

  const amountQuoteRes = parseOptionalNumber(payload?.amountQuote, { min: 0 });
  if (!amountQuoteRes.ok) errors.push('conversion.amountQuote');

  const fxRateRes = parseOptionalNumber(payload?.fxRate, {
    min: 0,
    minExclusive: true,
  });
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

  const lineStatesRaw =
    Array.isArray(payload?.lineStates) ? payload.lineStates : Array.isArray(payload?.line_states) ? payload.line_states : null;
  let lineStates = null;
  if (lineStatesRaw && lineStatesRaw.length > 0) {
    const normalizedStates = [];
    lineStatesRaw.forEach((entry) => {
      const currencyCode = normalizeCurrencyCode(entry?.currencyCode ?? entry?.currency);
      if (!currencyCode) {
        errors.push('conversion.lineStates.currencyCode');
        return;
      }
      const amountRes = parseRequiredNumber(entry?.allocatedRlusdAfter ?? entry?.allocated_after, {
        min: 0,
      });
      if (!amountRes.ok) {
        errors.push('conversion.lineStates.allocatedRlusdAfter');
        return;
      }
      normalizedStates.push({
        currencyCode,
        allocatedRlusdAfter: amountRes.value,
      });
    });

    if (normalizedStates.length === 0) {
      errors.push('conversion.lineStates');
    } else {
      lineStates = normalizedStates;
    }
  }

  const normalized = {
    base,
    quote,
    amountRlusd: amountRlusdRes.value,
  };
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
  const targetCurrencyCode = normalizeCurrencyCode(
    payload?.targetCurrencyCode ??
      payload?.targetCurrency ??
      payload?.target_currency ??
      payload?.displayCurrencyCode ??
      payload?.displayCurrency ??
      payload?.display_currency
  );
  if (!targetCurrencyCode) errors.push('payreq.targetCurrencyCode');

  const amountRlusdRes = parseRequiredNumber(
    payload?.amountRlusd ?? payload?.rlusd,
    { min: 0, minExclusive: true }
  );
  if (!amountRlusdRes.ok) errors.push('payreq.amountRlusd');

  const displayAmountRes = parseOptionalNumber(
    payload?.displayAmount ?? payload?.display_amount ?? payload?.amount ?? payload?.display,
    { min: 0 }
  );
  if (!displayAmountRes.ok) errors.push('payreq.displayAmount');

  const displayCurrencyCode =
    normalizeCurrencyCode(
      payload?.displayCurrencyCode ?? payload?.displayCurrency ?? payload?.display_currency
    ) || targetCurrencyCode;

  const fxRateRes = parseOptionalNumber(payload?.fxRate, { min: 0, minExclusive: true });
  if (!fxRateRes.ok) errors.push('payreq.fxRate');

  const allocatedAfterRes = parseOptionalNumber(payload?.allocatedRlusdAfter, { min: 0 });
  if (!allocatedAfterRes.ok) errors.push('payreq.allocatedRlusdAfter');

  const fxSource = normalizeUpper(payload?.fxSource);
  const note = normalizeString(payload?.note ?? payload?.memo);

  const originRaw = normalizeString(payload?.origin);
  const origin = originRaw ? originRaw.toLowerCase() : null;
  if (origin && !VALID_ORIGINS.has(origin)) {
    errors.push('payreq.origin');
  }
  if (!origin && requireOrigin) {
    errors.push('payreq.origin');
  }

  const normalized = {
    targetCurrencyCode,
    amountRlusd: amountRlusdRes.value,
  };
  if (origin) normalized.origin = origin;
  if (displayAmountRes.value != null) normalized.displayAmount = displayAmountRes.value;
  if (displayCurrencyCode) normalized.displayCurrencyCode = displayCurrencyCode;
  if (fxRateRes.value != null) normalized.fxRate = fxRateRes.value;
  if (allocatedAfterRes.value != null) normalized.allocatedRlusdAfter = allocatedAfterRes.value;
  if (fxSource) normalized.fxSource = fxSource;
  if (note) normalized.note = note;

  return normalized;
}

function normalizeAllocationAdjustPayload(payload, errors) {
  const defaultActionRaw = normalizeString(payload?.action);
  const defaultAction = defaultActionRaw ? defaultActionRaw.toLowerCase() : null;
  const reason = normalizeString(payload?.reason);
  const method = normalizeString(payload?.method);

  const adjustments = Array.isArray(payload?.adjustments) ? payload.adjustments : null;
  if (adjustments && adjustments.length > 0) {
    const normalizedAdjustments = [];
    adjustments.forEach((entry) => {
      const entryActionRaw = normalizeString(entry?.action);
      const entryAction = entryActionRaw ? entryActionRaw.toLowerCase() : defaultAction;
      if (!entryAction || !VALID_ALLOC_ACTIONS.has(entryAction)) {
        errors.push('allocation_adjust.adjustments.action');
        return;
      }

      const currencyCode = normalizeCurrencyCode(entry?.currencyCode ?? entry?.currency);
      if (!currencyCode) {
        errors.push('allocation_adjust.adjustments.currencyCode');
        return;
      }

      const amountRes = parseRequiredNumber(entry?.amountRlusd ?? entry?.amount, {
        min: 0,
        minExclusive: true,
      });
      if (!amountRes.ok) {
        errors.push('allocation_adjust.adjustments.amountRlusd');
        return;
      }

      const allocatedAfterRes = parseOptionalNumber(entry?.allocatedRlusdAfter, { min: 0 });
      if (!allocatedAfterRes.ok) {
        errors.push('allocation_adjust.adjustments.allocatedRlusdAfter');
        return;
      }

      const normalizedEntry = {
        currencyCode,
        amountRlusd: amountRes.value,
      };
      if (entryAction && entryAction !== defaultAction) normalizedEntry.action = entryAction;
      if (allocatedAfterRes.value != null) normalizedEntry.allocatedRlusdAfter = allocatedAfterRes.value;
      normalizedAdjustments.push(normalizedEntry);
    });

    if (normalizedAdjustments.length === 0) {
      errors.push('allocation_adjust.adjustments');
    }

    const normalized = {
      adjustments: normalizedAdjustments,
    };
    if (defaultAction) normalized.action = defaultAction;
    if (reason) normalized.reason = reason;
    if (method) normalized.method = method;
    return normalized;
  }

  if (!defaultAction || !VALID_ALLOC_ACTIONS.has(defaultAction)) {
    errors.push('allocation_adjust.action');
  }

  const currencyCode = normalizeCurrencyCode(payload?.currencyCode ?? payload?.currency);
  if (!currencyCode) errors.push('allocation_adjust.currencyCode');

  const amountRes = parseRequiredNumber(payload?.amountRlusd ?? payload?.amount, {
    min: 0,
    minExclusive: true,
  });
  if (!amountRes.ok) errors.push('allocation_adjust.amountRlusd');

  const allocatedAfterRes = parseOptionalNumber(payload?.allocatedRlusdAfter, { min: 0 });
  if (!allocatedAfterRes.ok) errors.push('allocation_adjust.allocatedRlusdAfter');

  const normalized = {
    action: defaultAction,
    currencyCode,
    amountRlusd: amountRes.value,
  };
  if (reason) normalized.reason = reason;
  if (method) normalized.method = method;
  if (allocatedAfterRes.value != null) normalized.allocatedRlusdAfter = allocatedAfterRes.value;
  return normalized;
}

function normalizeMoonpayPayload(payload, errors) {
  const sideRaw = normalizeString(payload?.side);
  const side = sideRaw ? sideRaw.toLowerCase() : null;
  if (!side || !VALID_MOONPAY_SIDES.has(side)) {
    errors.push('moonpay.side');
  }

  const providerRaw = normalizeString(payload?.provider ?? 'moonpay');
  const provider = providerRaw ? providerRaw.toLowerCase() : null;
  if (!provider) errors.push('moonpay.provider');

  const currencyCode = normalizeCurrencyCode(payload?.currencyCode ?? payload?.currency);
  if (payload?.currencyCode != null || payload?.currency != null) {
    if (!currencyCode) errors.push('moonpay.currencyCode');
  }

  const amountRes = parseOptionalNumber(payload?.amount ?? payload?.displayAmount, { min: 0, minExclusive: true });
  if (!amountRes.ok) errors.push('moonpay.amount');

  const amountRlusdRes = parseOptionalNumber(payload?.amountRlusd, { min: 0, minExclusive: true });
  if (!amountRlusdRes.ok) errors.push('moonpay.amountRlusd');

  const normalized = {
    side,
    provider,
  };
  if (currencyCode) normalized.currencyCode = currencyCode;
  if (amountRes.provided) normalized.amount = amountRes.value;
  if (amountRlusdRes.provided) normalized.amountRlusd = amountRlusdRes.value;

  return normalized;
}

function validateXcannesMemoPayload(payload, options = {}) {
  const mode = options.mode || 'parse';
  const allowLegacy = options.allowLegacy != null ? options.allowLegacy : mode !== 'create';
  const errors = [];

  if (!isPlainObject(payload)) {
    return { ok: false, errors: ['payload'], type: null };
  }

  const inferredType = options.type || inferXcannesMemoType(payload);
  if (!inferredType || !XCANNES_MEMO_SCHEMAS[inferredType]) {
    return { ok: false, errors: ['type'], type: null };
  }

  const schemaMeta = XCANNES_MEMO_SCHEMAS[inferredType];
  const schemaRaw = normalizeString(payload?.schema);
  const schemaLower = schemaRaw ? schemaRaw.toLowerCase() : null;
  let legacy = false;

  if (schemaRaw) {
    if (schemaLower !== schemaMeta.schema) {
      if (!allowLegacy) errors.push('schema');
      legacy = true;
    }
  } else if (!allowLegacy && mode === 'create') {
    errors.push('schema');
  } else if (!schemaRaw) {
    legacy = true;
  }

  const versionRaw = payload?.v ?? payload?.version ?? null;
  if (versionRaw != null && versionRaw !== '') {
    const version = Number.parseInt(versionRaw, 10);
    if (!Number.isFinite(version) || version !== schemaMeta.version) {
      errors.push('version');
    }
  } else if (mode === 'create') {
    errors.push('version');
  } else {
    legacy = true;
  }

  const markerRaw = payload?.xcannes ?? payload?.xc ?? payload?.kind ?? payload?.type ?? null;
  const markerType = normalizeMemoTypeMarker(markerRaw);
  if (markerType && markerType !== inferredType) {
    errors.push('xcannes');
  } else if (!markerType && mode === 'create') {
    errors.push('xcannes');
  } else if (!markerType) {
    legacy = true;
  }

  let normalizedBody = null;
  if (inferredType === 'wallet_label') {
    normalizedBody = normalizeWalletLabelPayload(payload, errors);
  } else if (inferredType === 'currency_line') {
    normalizedBody = normalizeCurrencyLinePayload(payload, errors);
  } else if (inferredType === 'conversion') {
    normalizedBody = normalizeConversionPayload(payload, errors);
  } else if (inferredType === 'payreq') {
    normalizedBody = normalizePayreqPayload(payload, errors, {
      requireOrigin: mode === 'create',
    });
  } else if (inferredType === 'allocation_adjust') {
    normalizedBody = normalizeAllocationAdjustPayload(payload, errors);
  } else if (inferredType === 'moonpay') {
    normalizedBody = normalizeMoonpayPayload(payload, errors);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      type: inferredType,
      schema: schemaMeta.schema,
      version: schemaMeta.version,
      legacy,
    };
  }

  const normalizedPayload = {
    xcannes: inferredType,
    schema: schemaMeta.schema,
    v: schemaMeta.version,
    ...normalizedBody,
  };

  return {
    ok: true,
    type: inferredType,
    payload: normalizedPayload,
    schema: schemaMeta.schema,
    version: schemaMeta.version,
    legacy,
  };
}

function buildXcannesMemoPayload(type, data = {}, options = {}) {
  const schemaMeta = XCANNES_MEMO_SCHEMAS[type];
  if (!schemaMeta) {
    return { ok: false, errors: ['type'], type: null };
  }

  const payload = {
    xcannes: type,
    schema: schemaMeta.schema,
    v: schemaMeta.version,
    ...(data || {}),
  };

  return validateXcannesMemoPayload(payload, {
    mode: options.mode || 'create',
    allowLegacy: false,
    type,
  });
}

function createXcannesMemoPayload(type, data = {}, options = {}) {
  const result = buildXcannesMemoPayload(type, data, options);
  return result.ok ? result.payload : null;
}

function buildWalletLabelMemo(data) {
  return createXcannesMemoPayload('wallet_label', data);
}

function buildCurrencyLineMemo(data) {
  return createXcannesMemoPayload('currency_line', data);
}

function buildConversionMemo(data) {
  return createXcannesMemoPayload('conversion', data);
}

function buildPayreqMemo(data) {
  return createXcannesMemoPayload('payreq', data);
}

function buildAllocationAdjustMemo(data) {
  return createXcannesMemoPayload('allocation_adjust', data);
}

function buildMoonpayMemo(data) {
  return createXcannesMemoPayload('moonpay', data);
}

export {
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
};
