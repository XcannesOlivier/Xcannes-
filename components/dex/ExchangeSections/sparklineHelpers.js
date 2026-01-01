/**
 * Helpers pour la génération de sparklines à partir de candles
 */

/**
 * Construit un tableau de prix (sparkline) à partir d'un tableau de bougies
 * @param {Array} candles - Tableau de bougies avec propriété close ou price
 * @param {number} maxPoints - Nombre maximum de points à retourner (défaut: 24)
 * @returns {Array|null} - Tableau de prix ou null si données insuffisantes
 */
export function buildSparklineFromCandles(candles, maxPoints = 24) {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  
  const closes = candles
    .map((c) => Number(c?.close ?? c?.price ?? 0))
    .filter((v) => Number.isFinite(v) && v !== 0);
  
  if (closes.length < 2) return null;

  const slice =
    closes.length > maxPoints ? closes.slice(-maxPoints) : closes.slice();

  return slice;
}
