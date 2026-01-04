/**
 * Hook pour la gestion des paires custom Fawaz
 * - Ajout/suppression de paires personnalisées
 * - Persistance dans localStorage
 * - Vérification des doublons
 */

import { useState, useEffect } from "react";

export function useCustomPairs(basePairs = [], loadEODData = null) {
  const [customPairs, setCustomPairs] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("eod-custom-pairs");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("eod-custom-pairs", JSON.stringify(customPairs));
    }
  }, [customPairs]);

  /**
   * Ajouter une paire custom
   */
  const handleAddCustomPair = (selectedPair) => {
    const { base, quote } = selectedPair;
    if (base && quote && base !== quote) {
      const exists = customPairs.some(
        (p) => p.base === base && p.quote === quote
      );
      const existsInBase = basePairs.some(
        (p) => p.base === base && p.quote === quote
      );
      if (!exists && !existsInBase) {
        setCustomPairs((prev) => [{ base, quote }, ...prev]);
        // Charger immédiatement les données si loadEODData fourni
        if (loadEODData) {
          loadEODData(base, quote, "eod");
        }
        return true; // Succès
      }
    }
    return false; // Échec (doublon ou invalide)
  };

  /**
   * Supprimer une paire custom
   */
  const handleRemoveCustomPair = (base, quote) => {
    setCustomPairs((prev) =>
      prev.filter((p) => !(p.base === base && p.quote === quote))
    );
  };

  /**
   * Vérifier si une paire est custom
   */
  const isCustomPair = (base, quote) => {
    return customPairs.some((p) => p.base === base && p.quote === quote);
  };

  return {
    customPairs,
    handleAddCustomPair,
    handleRemoveCustomPair,
    isCustomPair,
  };
}
