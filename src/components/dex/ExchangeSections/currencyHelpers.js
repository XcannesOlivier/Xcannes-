/**
 * Utilitaires pour les drapeaux de devises
 */

import Image from "next/image";
import { CURRENCY_FLAGS, CRYPTO_ICONS } from "./constants";

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}

export function getFlag(code) {
  if (!code) return "🏳️";
  const upper = String(code).toUpperCase();
  
  // Vérifier si c'est une crypto avec icône
  if (upper in CRYPTO_ICONS) {
    const iconUrl = CRYPTO_ICONS[upper];
    
    // Si pas d'image définie, afficher le texte
    if (!iconUrl) {
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 bg-gradient-to-br from-xcannes-green to-emerald-600 text-white text-[9px] font-bold rounded">
          {upper}
        </span>
      );
    }
    
    // Sinon afficher l'image (carré pour crypto)
    return (
      <Image 
        src={iconUrl} 
        alt={upper} 
        width={20}
        height={20}
        className="w-5 h-5 rounded object-cover"
      />
    );
  }
  
  // Sinon, utiliser le drapeau emoji
  if (CURRENCY_FLAGS[upper]) return CURRENCY_FLAGS[upper];
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}
