/**
 * Normalise un code de devise côté frontend : trim + uppercase.
 * Retourne une chaîne vide si la valeur est nulle/indéfinie.
 *
 * Correspond au comportement de `String(code || "").trim().toUpperCase()`
 * utilisé partout dans les hooks wallet.
 *
 * @param {*} code
 * @returns {string}
 */
export function normalizeCurrencyCode(code) {
  if (code == null) return "";
  return String(code).trim().toUpperCase();
}
