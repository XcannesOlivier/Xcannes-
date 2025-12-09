// Pure indicator helpers shared by XrplCandleChart

export const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
  if (data.length < period) return { upper: [], middle: [], lower: [] };

  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += parseFloat(data[i - j].close);
    }
    const sma = sum / period;

    let variance = 0;
    for (let j = 0; j < period; j++) {
      const diff = parseFloat(data[i - j].close) - sma;
      variance += diff * diff;
    }
    const std = Math.sqrt(variance / period);

    upper.push({ time: data[i].time, value: sma + stdDev * std });
    middle.push({ time: data[i].time, value: sma });
    lower.push({ time: data[i].time, value: sma - stdDev * std });
  }

  return { upper, middle, lower };
};

export const calculateEMA = (data, period) => {
  if (data.length < period) return [];

  const ema = [];
  const multiplier = 2 / (period + 1);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += parseFloat(data[i].close);
  }
  let emaValue = sum / period;
  ema.push({ time: data[period - 1].time, value: emaValue });

  for (let i = period; i < data.length; i++) {
    emaValue = (parseFloat(data[i].close) - emaValue) * multiplier + emaValue;
    ema.push({ time: data[i].time, value: emaValue });
  }

  return ema;
};

export const calculateSMA = (data, period) => {
  if (data.length < period) return [];

  const sma = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += parseFloat(data[i - j].close);
    }
    const average = sum / period;
    sma.push({ time: data[i].time, value: average });
  }
  return sma;
};

export const calculateRSI = (data, period = 14) => {
  if (data.length < period + 1) return [];

  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = parseFloat(data[i].close) - parseFloat(data[i - 1].close);
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / avgLoss;
  rsi.push({ time: data[period].time, value: 100 - 100 / (1 + rs) });

  for (let i = period + 1; i < data.length; i++) {
    const change = parseFloat(data[i].close) - parseFloat(data[i - 1].close);
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgGain / avgLoss;
    rsi.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
  }

  return rsi;
};

export const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (data.length < slowPeriod + signalPeriod) return { macd: [], signal: [], histogram: [] };

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine = [];
  const startIndex = slowPeriod - fastPeriod;

  for (let i = 0; i < slowEMA.length; i++) {
    const fastIndex = i + startIndex;
    if (fastIndex < fastEMA.length) {
      macdLine.push({
        time: slowEMA[i].time,
        value: fastEMA[fastIndex].value - slowEMA[i].value,
      });
    }
  }

  if (macdLine.length < signalPeriod) return { macd: [], signal: [], histogram: [] };

  const signalLine = [];
  const multiplier = 2 / (signalPeriod + 1);

  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLine[i].value;
  }
  let signalValue = sum / signalPeriod;
  signalLine.push({ time: macdLine[signalPeriod - 1].time, value: signalValue });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    signalValue = (macdLine[i].value - signalValue) * multiplier + signalValue;
    signalLine.push({ time: macdLine[i].time, value: signalValue });
  }

  const histogram = [];
  const signalStartIndex = signalPeriod - 1;

  for (let i = 0; i < signalLine.length; i++) {
    const macdIndex = i + signalStartIndex;
    histogram.push({
      time: signalLine[i].time,
      value: macdLine[macdIndex].value - signalLine[i].value,
      color: macdLine[macdIndex].value >= signalLine[i].value ? "#10b981c0" : "#f16262ff",
    });
  }

  return {
    macd: macdLine.slice(signalStartIndex),
    signal: signalLine,
    histogram,
  };
};

export const calculateVWAP = (data) => {
  if (data.length === 0) return [];

  const vwap = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const typical = (parseFloat(data[i].high) + parseFloat(data[i].low) + parseFloat(data[i].close)) / 3;
    const volume = parseFloat(data[i].volume || 0);

    cumulativeTPV += typical * volume;
    cumulativeVolume += volume;

    const vwapValue = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typical;
    vwap.push({ time: data[i].time, value: vwapValue });
  }

  return vwap;
};
