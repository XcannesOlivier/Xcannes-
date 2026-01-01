// Helpers de timeframe partagés entre hooks du chart

const INTERVAL_KEY_MAP = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

const INTERVAL_SECONDS_MAP = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export function getBackendInterval(interval) {
  return INTERVAL_KEY_MAP[interval] || "1h";
}

export function getIntervalSeconds(interval) {
  return INTERVAL_SECONDS_MAP[interval] || 3600;
}

