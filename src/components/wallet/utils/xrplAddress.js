/**
 * xrplAddress.js — Helper partagé pour valider les adresses XRPL.
 */

/**
 * Retourne true si `value` est une adresse XRPL valide (commence par 'r',
 * base-58, 25-35 caractères).
 */
export const isXrplAddress = (value) =>
  /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(value || "").trim());
