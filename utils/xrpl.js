/**
 * Convertit format frontend (XCS/XRP) vers format backend (XCS_XRP)
 * @param {string} pair - Format: "XCS/XRP"
 * @returns {string} - Format: "XCS_XRP"
 */
export const pairToBackendFormat = (pair) => {
  return pair.replace("/", "_");
};

export const getBookIdFromPair = (pair) => {
  // RLUSD en hexadécimal
  const RLUSD_HEX = "524C555344000000000000000000000000000000";
  const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
  
  // Issuers connus
  const issuers = {
    XCS: "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx",
    USD: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
    EUR: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
    GBP: "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g",
    CNY: "rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y",
    BTC: "rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL",
    ETH: "rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h",
  };

  // Si la paire contient RLUSD, gérer spécialement
  if (pair.includes("RLUSD")) {
    const [base, counter] = pair.split("/");
    
    let taker_gets, taker_pays;
    
    // RLUSD en base
    if (base === "RLUSD") {
      taker_gets = {
        currency: RLUSD_HEX,
        issuer: RLUSD_ISSUER,
      };
      
      if (counter === "XRP") {
        taker_pays = { currency: "XRP" };
      } else {
        taker_pays = {
          currency: counter,
          issuer: issuers[counter],
        };
      }
    }
    // RLUSD en counter
    else {
      if (base === "XRP") {
        taker_gets = { currency: "XRP" };
      } else {
        taker_gets = {
          currency: base,
          issuer: issuers[base],
        };
      }
      
      taker_pays = {
        currency: RLUSD_HEX,
        issuer: RLUSD_ISSUER,
      };
    }
    
    // Construction URL
    let url = "";
    if (taker_gets.issuer) {
      url += `${taker_gets.issuer}_${taker_gets.currency === RLUSD_HEX ? "RLUSD" : taker_gets.currency}/`;
    } else {
      url += "XRP/";
    }
    
    if (taker_pays.issuer) {
      url += `${taker_pays.issuer}_${taker_pays.currency === RLUSD_HEX ? "RLUSD" : taker_pays.currency}`;
    } else {
      url += "XRP";
    }
    
    return {
      taker_gets,
      taker_pays,
      url,
      backendPair: `${base}_${counter}`,
    };
  }

  // Génération dynamique pour toutes les autres paires
  const [base, counter] = pair.split("/");
  if (!base || !counter) return null;

  // Issuers connus (depuis dexPairs.json)
  const knownIssuers = {
    XCS: "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx",
    USD: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
    EUR: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
    GBP: "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g",
    CNY: "rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y",
    BTC: "rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL",
    ETH: "rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h",
    JPY: "rMAz5ZnK73nyNUL4foAvaxdreczCkG3vA6",
    // Ajoutez d'autres issuers au besoin
  };

  const getTakerObject = (currency) => {
    if (currency === "XRP") {
      return { currency: "XRP" };
    }
    
    const issuer = knownIssuers[currency];
    if (!issuer) {
      console.warn(`Issuer inconnu pour ${currency}, paire ${pair} pourrait ne pas fonctionner`);
      return null;
    }
    
    return {
      currency: currency,
      issuer: issuer,
    };
  };

  const takerGets = getTakerObject(base);
  const takerPays = getTakerObject(counter);

  if (!takerGets || !takerPays) return null;

  // Construction de l'URL et format backend
  let url = "";
  if (takerGets.issuer) {
    url += `${takerGets.issuer}_${takerGets.currency}/`;
  } else {
    url += "XRP/";
  }
  
  if (takerPays.issuer) {
    url += `${takerPays.issuer}_${takerPays.currency}`;
  } else {
    url += "XRP";
  }

  return {
    taker_gets: takerGets,
    taker_pays: takerPays,
    url: url,
    backendPair: `${base}_${counter}`,
  };
};
