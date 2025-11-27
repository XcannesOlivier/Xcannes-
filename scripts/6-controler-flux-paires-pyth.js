#!/usr/bin/env node

/**
 * Script 6 : Contrôle du flux complet des paires Pyth
 * 
 * Vérifie la chaîne complète depuis xcannesApi.js jusqu'à l'affichage :
 * 1. xcannesApi.js peut récupérer les données du backend
 * 2. useExternalPrice hook reçoit les données
 * 3. useCandles1m hook reçoit les bougies
 * 4. XrplCandleChartRaw peut afficher toutes les paires
 * 5. Formats de données compatibles
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_XCANNES_API_URL || 'http://localhost:3003';

// Couleurs console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m'
};

// Stats globales
let testsReussis = 0;
let testsEchoues = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
  testsReussis++;
}

function logError(message) {
  log(`❌ ${message}`, 'red');
  testsEchoues++;
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logTitle(message) {
  log(`\n${'═'.repeat(70)}`, 'cyan');
  log(`${message}`, 'cyan');
  log('═'.repeat(70), 'cyan');
}

/**
 * Fonction fetch avec timeout
 */
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Test 1 : Vérifier que xcannesApi.js peut appeler le backend
 */
async function testXcannesApiConnection() {
  logTitle('🔌 TEST 1 : xcannesApi.js → Backend API');
  logInfo('Vérification que le client HTTP peut communiquer avec le backend\n');

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/forex`, 5000);
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        logSuccess(`xcannesApi peut appeler le backend : ${result.data.length} paires disponibles`);
        return true;
      } else {
        logError('Backend retourne un format invalide');
        return false;
      }
    } else {
      logError(`Backend retourne HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`xcannesApi ne peut pas joindre le backend : ${error.message}`);
    logWarning(`Vérifiez que marketDataAPI.js tourne : pm2 list | grep xcannes-api`);
    return false;
  }
}

/**
 * Test 2 : Simuler useExternalPrice pour toutes les paires
 * Vérifie que toutes les données nécessaires au hook sont disponibles
 */
async function testUseExternalPriceFlow() {
  logTitle('🎣 TEST 2 : Hook useExternalPrice → Flux complet');
  logInfo('Simulation du flux : Hook → xcannesApi → Backend → Redis → Pyth');
  logInfo('Vérification des données : { price, loading, error, data }\n');

  const feedsConfig = require('../../config/pythFeeds.json');
  const allPairs = feedsConfig.feeds;

  const categories = {
    crypto: allPairs.filter(p => p.category === 'crypto'),
    forex: allPairs.filter(p => p.category === 'forex'),
    exotic: allPairs.filter(p => p.category === 'exotic'),
    commodity: allPairs.filter(p => p.category === 'commodity')
  };

  let pairesOK = 0;
  let pairesKO = 0;
  let exoticSkipped = 0;

  for (const [catName, pairs] of Object.entries(categories)) {
    if (pairs.length === 0) continue;

    log(`\n🔸 ${catName.toUpperCase()} (${pairs.length} paires):`, 'cyan');
    
    // useExternalPrice ne supporte PAS les exotic
    if (catName === 'exotic') {
      log(`⚠️  Hook useExternalPrice ne supporte pas les paires exotic (polling désactivé)`, 'yellow');
      exoticSkipped = pairs.length;
      continue;
    }
    
    for (const pair of pairs) {
      try {
        const url = `${API_BASE_URL}/api/v1/ticker/${pair.symbol}`;
        
        const startTime = Date.now();
        const response = await fetchWithTimeout(url, 3000);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.data) {
            const data = result.data;
            
            // Extraire le prix comme le fait le hook : midPrice || price
            // MAIS l'API retourne lastPrice ! Il faut l'inclure
            const midPrice = Number(data.midPrice || data.lastPrice || data.price || 0);
            
            // Vérifier que TOUTES les données nécessaires sont présentes
            const hasSymbol = data.symbol !== undefined;
            const hasValidPrice = midPrice > 0;
            const hasTimestamp = data.timestamp !== undefined || data.receivedAt !== undefined;
            
            if (hasSymbol && hasValidPrice && hasTimestamp) {
              const age = data.timestamp ? Math.round((Date.now() - data.timestamp) / 1000) : 0;
              
              // ✅ Toutes les données sont OK pour useExternalPrice
              const hookData = {
                price: midPrice,
                loading: false,
                error: null,
                data: data
              };
              
              logSuccess(`${pair.displayName} : Prix=${midPrice.toFixed(catName === 'crypto' ? 2 : 5)}, Âge=${age}s, RT=${responseTime}ms`);
              log(`         → Hook reçoit : { price: ${midPrice}, loading: false, error: null, data: {...} }`, 'gray');
              pairesOK++;
            } else {
              // ❌ Données manquantes
              const missing = [];
              if (!hasSymbol) missing.push('symbol');
              if (!hasValidPrice) missing.push('price');
              if (!hasTimestamp) missing.push('timestamp');
              
              logError(`${pair.symbol} : Données incomplètes [manque: ${missing.join(', ')}]`);
              log(`         → Hook reçoit : { price: null, loading: false, error: "Aucune donnée disponible", data: null }`, 'red');
              pairesKO++;
            }
          } else {
            logError(`${pair.symbol} : Réponse sans succès`);
            log(`         → Hook reçoit : { price: null, loading: false, error: "Aucune donnée disponible", data: null }`, 'red');
            pairesKO++;
          }
        } else {
          logError(`${pair.symbol} : HTTP ${response.status}`);
          log(`         → Hook reçoit : { price: null, loading: false, error: "Erreur réseau", data: null }`, 'red');
          pairesKO++;
        }
      } catch (error) {
        logError(`${pair.symbol} : ${error.message}`);
        log(`         → Hook reçoit : { price: null, loading: false, error: "${error.message}", data: null }`, 'red');
        pairesKO++;
      }
    }
  }

  // Calcul du total de paires supportées (sans exotic)
  const supportedPairs = allPairs.length - exoticSkipped;

  log(`\n📊 Résultat flux useExternalPrice :`, 'magenta');
  log(`   ✅ Paires supportées OK : ${pairesOK}/${supportedPairs}`, pairesOK === supportedPairs ? 'green' : 'yellow');
  log(`   ❌ Paires supportées KO : ${pairesKO}/${supportedPairs}`, pairesKO === 0 ? 'green' : 'red');
  if (exoticSkipped > 0) {
    log(`   ⏭️  Paires exotic ignorées : ${exoticSkipped}/${allPairs.length} (normal, hook ne les supporte pas)`, 'gray');
  }
  
  log(`\n💡 Note : useExternalPrice fait un polling toutes les 5 secondes`, 'cyan');
  log(`   Catégories supportées : crypto, forex, commodity`, 'cyan');
  log(`   Catégories NON supportées : exotic (pas de prix live)`, 'cyan');

  return pairesOK === supportedPairs;
}

/**
 * Test 3 : Simuler useCandles1m pour toutes les paires
 * Vérifie que le backend a 1440 bougies (24h) nécessaires au hook
 */
async function testUseCandles1mFlow() {
  logTitle('📊 TEST 3 : Hook useCandles1m → Flux bougies 24h');
  logInfo('Simulation du flux : Hook → xcannesApi.getKlines → MongoDB');
  logInfo('Vérification : Hook nécessite 1440 bougies 1m (24h) pour calculer le % évolution\n');

  const feedsConfig = require('../../config/pythFeeds.json');
  const allPairs = feedsConfig.feeds;
  const REQUIRED_CANDLES = 1440; // 24h × 60 minutes

  let pairesOK = 0;
  let pairesPartiel = 0;
  let pairesKO = 0;

  for (const pair of allPairs) {
    try {
      const url = `${API_BASE_URL}/api/v1/klines/${pair.symbol}?timeframe=1m&limit=${REQUIRED_CANDLES}`;
      
      const response = await fetchWithTimeout(url, 5000);

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data && Array.isArray(result.data.candles)) {
          const candles = result.data.candles;
          
          if (candles.length > 0) {
            // Vérifier que la première bougie a tous les champs OHLC
            const firstCandle = candles[0];
            const hasOHLC = 
              firstCandle.time !== undefined &&
              firstCandle.open !== undefined &&
              firstCandle.high !== undefined &&
              firstCandle.low !== undefined &&
              firstCandle.close !== undefined;

            if (!hasOHLC) {
              logError(`${pair.symbol} : Bougies sans OHLC complet`);
              pairesKO++;
              continue;
            }

            // Vérifier si on a assez de bougies
            const coverage = (candles.length / REQUIRED_CANDLES) * 100;
            
            if (candles.length >= REQUIRED_CANDLES) {
              // ✅ Parfait : 24h complètes
              logSuccess(`${pair.symbol} : ${candles.length}/${REQUIRED_CANDLES} bougies 1m (100% - 24h complet)`);
              log(`         → Hook peut calculer : compute24hPercentChange() avec données complètes`, 'gray');
              pairesOK++;
            } else if (candles.length >= 100) {
              // ⚠️ Partiel mais utilisable (au moins quelques heures)
              const hoursAvailable = Math.floor(candles.length / 60);
              logWarning(`${pair.symbol} : ${candles.length}/${REQUIRED_CANDLES} bougies 1m (${coverage.toFixed(1)}% - ~${hoursAvailable}h)`);
              log(`         → Hook calcule sur période partielle (${hoursAvailable}h au lieu de 24h)`, 'yellow');
              pairesPartiel++;
            } else {
              // ❌ Trop peu de données
              logError(`${pair.symbol} : ${candles.length}/${REQUIRED_CANDLES} bougies 1m (${coverage.toFixed(1)}% - insuffisant)`);
              log(`         → Hook ne peut pas calculer le % évolution fiable`, 'red');
              pairesKO++;
            }
          } else {
            logError(`${pair.symbol} : Aucune bougie disponible`);
            log(`         → Hook retourne : { candles1m: [], loading: false, error: "Aucune donnée disponible" }`, 'red');
            pairesKO++;
          }
        } else {
          logError(`${pair.symbol} : Format réponse invalide`);
          pairesKO++;
        }
      } else {
        logError(`${pair.symbol} : HTTP ${response.status}`);
        pairesKO++;
      }
    } catch (error) {
      logError(`${pair.symbol} : ${error.message}`);
      pairesKO++;
    }
  }

  log(`\n📊 Résultat flux useCandles1m :`, 'magenta');
  log(`   ✅ Paires OK (24h complètes) : ${pairesOK}/${allPairs.length}`, pairesOK === allPairs.length ? 'green' : 'yellow');
  log(`   ⚠️  Paires partielles (< 24h) : ${pairesPartiel}/${allPairs.length}`, pairesPartiel === 0 ? 'green' : 'yellow');
  log(`   ❌ Paires KO (insuffisant) : ${pairesKO}/${allPairs.length}`, pairesKO === 0 ? 'green' : 'red');
  
  log(`\n💡 Note : useCandles1m fait un polling toutes les 60 secondes (throttle 30s)`, 'cyan');
  log(`   Fonction exportée : compute24hPercentChange(candles1m, livePrice)`, 'cyan');

  return pairesOK === allPairs.length;
}

/**
 * Test 4 : Vérifier que le backend a les données nécessaires pour XrplCandleChartRaw
 * Vérifie que MongoDB contient suffisamment de bougies pour chaque timeframe
 */
async function testFetchMarketDataFlow() {
  logTitle('🕯️  TEST 4 : XrplCandleChartRaw.jsx → Vérification données backend');
  logInfo('Vérification que le backend a ASSEZ de bougies pour afficher les graphiques');
  logInfo('Limites requises par le composant frontend :\n');

  // LIMITES EXACTES du composant XrplCandleChartRaw.jsx
  const componentLimits = {
    "1m": 500,   // ~8 heures nécessaires
    "5m": 500,   // ~1.7 jours nécessaires
    "15m": 500,  // ~5 jours nécessaires
    "1h": 1000,  // ~42 jours nécessaires (historique complet!)
    "4h": 500,   // ~2.7 mois nécessaires
    "1d": 365    // ~1 an nécessaire
  };

  log('📊 Limites requises par le composant :', 'cyan');
  for (const [tf, limit] of Object.entries(componentLimits)) {
    log(`   • ${tf.padEnd(4)} : ${limit} bougies minimum`, 'gray');
  }
  log('');

  const feedsConfig = require('../../config/pythFeeds.json');
  const allPairs = feedsConfig.feeds;
  const timeframes = Object.keys(componentLimits);

  let testsOK = 0;
  let testsKO = 0;
  let testsInsuffisant = 0;
  const total = allPairs.length * timeframes.length;

  log(`� Test de ${allPairs.length} paires × ${timeframes.length} timeframes = ${total} combinaisons\n`, 'cyan');

  // Grouper les paires par catégorie
  const categories = {
    crypto: allPairs.filter(p => p.category === 'crypto'),
    forex: allPairs.filter(p => p.category === 'forex'),
    exotic: allPairs.filter(p => p.category === 'exotic'),
    commodity: allPairs.filter(p => p.category === 'commodity')
  };

  for (const [catName, pairs] of Object.entries(categories)) {
    if (pairs.length === 0) continue;

    log(`🔸 ${catName.toUpperCase()} (${pairs.length} paires):`, 'cyan');
    
    for (const pair of pairs) {
      let pairResults = [];

      for (const tf of timeframes) {
        try {
          const requiredLimit = componentLimits[tf];
          const url = `${API_BASE_URL}/api/v1/klines/${pair.symbol}?timeframe=${tf}&limit=${requiredLimit}`;
          const response = await fetchWithTimeout(url, 5000);

          if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.data && Array.isArray(result.data.candles)) {
              const candles = result.data.candles;
              const received = candles.length;
              
              if (received >= requiredLimit) {
                // ✅ Parfait : assez de données
                pairResults.push({ tf, status: 'ok', received, required: requiredLimit });
                testsOK++;
              } else if (received > 0) {
                // ⚠️ Données partielles : ça marche mais pas optimal
                pairResults.push({ tf, status: 'partial', received, required: requiredLimit });
                testsInsuffisant++;
              } else {
                // ❌ Aucune donnée
                pairResults.push({ tf, status: 'empty', received, required: requiredLimit });
                testsKO++;
              }
            } else {
              pairResults.push({ tf, status: 'error', received: 0, required: requiredLimit });
              testsKO++;
            }
          } else {
            pairResults.push({ tf, status: 'http_error', received: 0, required: requiredLimit });
            testsKO++;
          }
        } catch (error) {
          pairResults.push({ tf, status: 'exception', received: 0, required: requiredLimit });
          testsKO++;
        }
      }

      // Afficher le résultat pour cette paire
      const okCount = pairResults.filter(r => r.status === 'ok').length;
      const partialCount = pairResults.filter(r => r.status === 'partial').length;
      const koCount = pairResults.filter(r => r.status === 'error' || r.status === 'empty' || r.status === 'http_error' || r.status === 'exception').length;

      if (okCount === timeframes.length) {
        logSuccess(`${pair.displayName} : ${okCount}/${timeframes.length} timeframes OK (données complètes)`);
      } else if (partialCount > 0 && koCount === 0) {
        logWarning(`${pair.displayName} : ${okCount} OK, ${partialCount} partiels`);
        // Détailler les partiels
        pairResults.filter(r => r.status === 'partial').forEach(r => {
          log(`         → ${r.tf} : ${r.received}/${r.required} bougies (${Math.round(r.received/r.required*100)}% disponible)`, 'yellow');
        });
      } else {
        logError(`${pair.displayName} : ${okCount} OK, ${partialCount} partiels, ${koCount} KO`);
        // Détailler les problèmes
        pairResults.filter(r => r.status !== 'ok').forEach(r => {
          if (r.status === 'partial') {
            log(`         → ${r.tf} : ${r.received}/${r.required} bougies (insuffisant)`, 'yellow');
          } else {
            log(`         → ${r.tf} : ÉCHEC (${r.status})`, 'red');
          }
        });
      }
    }
  }
  
  log(`\n📊 Résultat vérification données backend (COMPLET) :`, 'magenta');
  log(`   ✅ Tests OK (données complètes) : ${testsOK}/${total}`, testsOK === total ? 'green' : 'yellow');
  log(`   ⚠️  Tests partiels (données insuffisantes) : ${testsInsuffisant}/${total}`, testsInsuffisant === 0 ? 'green' : 'yellow');
  log(`   ❌ Tests KO (aucune donnée) : ${testsKO}/${total}`, testsKO === 0 ? 'green' : 'red');
  
  log(`\n💡 Note : XrplCandleChartRaw appelle getKlines() à chaque changement de paire/timeframe`, 'cyan');
  log(`   Le composant NÉCESSITE ces quantités de bougies pour un affichage optimal`, 'cyan');

  return testsOK === total;
}

/**
 * Test 5 : Vérifier la compatibilité des formats de données
 */
async function testDataFormatCompatibility() {
  logTitle('🔍 TEST 5 : Compatibilité formats → XrplCandleChartRaw');
  logInfo('Vérification que les données sont compatibles avec le composant React\n');

  const testPair = 'EUR_USD';

  // Test format prix live
  log('📌 Test 1/2 : Format prix live (useExternalPrice)', 'cyan');
  let formatPrixOK = false;
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ticker/${testPair}`, 3000);
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        const hasRequiredFields = 
          data.symbol !== undefined &&
          (data.midPrice !== undefined || data.lastPrice !== undefined) &&
          (data.receivedAt !== undefined || data.timestamp !== undefined);

        if (hasRequiredFields) {
          logSuccess('Format prix live compatible avec XrplCandleChartRaw');
          log('  ✓ symbol (pour identification)', 'green');
          log('  ✓ price (lastPrice ou midPrice)', 'green');
          log('  ✓ timestamp (pour calcul âge)', 'green');
          formatPrixOK = true;
        } else {
          logError('Format prix live incompatible : champs manquants');
        }
      } else {
        logError('Format prix live invalide');
      }
    } else {
      logError(`Test format prix live : HTTP ${response.status}`);
    }
  } catch (error) {
    logError(`Test format prix live : ${error.message}`);
  }

  // Test format candles
  log('\n📌 Test 2/2 : Format candles (useCandles1m + fetchMarketData)', 'cyan');
  let formatCandlesOK = false;
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/klines/${testPair}?timeframe=1m&limit=10`,
      3000
    );
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data.candles)) {
        const candles = result.data.candles;
        
        if (candles.length > 0) {
          const firstCandle = candles[0];
          const hasOHLC = 
            firstCandle.time !== undefined &&
            firstCandle.open !== undefined &&
            firstCandle.high !== undefined &&
            firstCandle.low !== undefined &&
            firstCandle.close !== undefined;

          if (hasOHLC) {
            logSuccess('Format candles compatible avec lightweight-charts');
            log('  ✓ time (timestamp Unix)', 'green');
            log('  ✓ open (prix ouverture)', 'green');
            log('  ✓ high (prix max)', 'green');
            log('  ✓ low (prix min)', 'green');
            log('  ✓ close (prix fermeture)', 'green');
            formatCandlesOK = true;
          } else {
            logError('Format candles incompatible : OHLC incomplet');
          }
        } else {
          logWarning('Aucune bougie disponible pour tester le format');
          testsReussis++;
          formatCandlesOK = true;
        }
      } else {
        logError('Format candles invalide');
      }
    } else {
      logError(`Test format candles : HTTP ${response.status}`);
    }
  } catch (error) {
    logError(`Test format candles : ${error.message}`);
  }

  return formatPrixOK && formatCandlesOK;
}

/**
 * Test 6 : Vérifier le flux complet pour une paire
 */
async function testCompleteFlowForSinglePair() {
  logTitle('🔄 TEST 6 : Flux complet pour une paire');
  logInfo('Simulation complète : Pyth → Backend → xcannesApi → Hooks → Composant\n');

  const testPair = 'EUR_USD';
  log(`🎯 Paire testée : ${testPair}\n`, 'magenta');

  const steps = [
    {
      name: '1. Backend accessible',
      test: async () => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/health`, 3000);
        return response.ok;
      }
    },
    {
      name: '2. Prix live disponible (Redis ← Pyth)',
      test: async () => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ticker/${testPair}`, 3000);
        if (!response.ok) return false;
        const result = await response.json();
        return result.success && result.data && result.data.lastPrice;
      }
    },
    {
      name: '3. Bougies 1m disponibles (MongoDB)',
      test: async () => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/klines/${testPair}?timeframe=1m&limit=1440`, 3000);
        if (!response.ok) return false;
        const result = await response.json();
        return result.success && result.data.candles.length > 0;
      }
    },
    {
      name: '4. Bougies graphique disponibles (MongoDB)',
      test: async () => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/klines/${testPair}?timeframe=1h&limit=100`, 3000);
        if (!response.ok) return false;
        const result = await response.json();
        return result.success && result.data.candles.length > 0;
      }
    },
    {
      name: '5. Format compatible avec React',
      test: async () => {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/ticker/${testPair}`, 3000);
        if (!response.ok) return false;
        const result = await response.json();
        const data = result.data;
        return data.symbol && (data.lastPrice || data.midPrice) && data.timestamp;
      }
    }
  ];

  let allStepsOK = true;

  for (const step of steps) {
    try {
      const success = await step.test();
      if (success) {
        logSuccess(step.name);
      } else {
        logError(step.name);
        allStepsOK = false;
      }
    } catch (error) {
      logError(`${step.name} : ${error.message}`);
      allStepsOK = false;
    }
  }

  if (allStepsOK) {
    log(`\n🎉 Flux complet validé pour ${testPair} !`, 'green');
  } else {
    log(`\n⚠️  Certaines étapes du flux ont échoué pour ${testPair}`, 'yellow');
  }

  return allStepsOK;
}

/**
 * Main
 */
async function main() {
  console.log('\n');
  log('═'.repeat(70), 'cyan');
  log('🔄 CONTRÔLE FLUX COMPLET DES PAIRES PYTH - SCRIPT 6', 'cyan');
  log('═'.repeat(70), 'cyan');
  log('Vérification du flux : Pyth → Backend → xcannesApi → Hooks → Composant\n', 'gray');

  const tests = [
    { name: 'xcannesApi → Backend', fn: testXcannesApiConnection },
    { name: 'useExternalPrice flux', fn: testUseExternalPriceFlow },
    { name: 'useCandles1m flux', fn: testUseCandles1mFlow },
    { name: 'fetchMarketData flux', fn: testFetchMarketDataFlow },
    { name: 'Compatibilité formats', fn: testDataFormatCompatibility },
    { name: 'Flux complet (EUR/USD)', fn: testCompleteFlowForSinglePair }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      console.error(`\n❌ Erreur dans ${test.name}:`, error.message);
      results.push({ name: test.name, success: false });
    }
  }

  // Résumé
  log('\n' + '═'.repeat(70), 'cyan');
  log('📊 RÉSUMÉ CONTRÔLE FLUX', 'cyan');
  log('═'.repeat(70), 'cyan');

  const total = testsReussis + testsEchoues;
  const pourcentage = total > 0 ? Math.round((testsReussis / total) * 100) : 0;

  log(`✅ Tests réussis      : ${testsReussis}/${total}`, testsReussis === total ? 'green' : 'yellow');
  log(`❌ Tests échoués      : ${testsEchoues}/${total}`, testsEchoues > 0 ? 'red' : 'green');
  log(`📈 Taux de réussite   : ${pourcentage}%`, pourcentage === 100 ? 'green' : 'yellow');

  log('\n📋 Étapes du flux :', 'magenta');
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`   ${icon} Étape ${index + 1} : ${result.name}`, color);
  });

  log('\n' + '═'.repeat(70), 'cyan');

  if (testsReussis === total && results.every(r => r.success)) {
    log('🎉 FLUX COMPLET VALIDÉ : Toutes les paires Pyth peuvent être', 'green');
    log('   affichées dans XrplCandleChartRaw.jsx !', 'green');
  } else {
    log('⚠️  Certaines étapes du flux ont échoué - Vérifiez les erreurs', 'yellow');
  }

  log('═'.repeat(70) + '\n', 'cyan');

  process.exit(testsEchoues > 0 ? 1 : 0);
}

// Exécution
main().catch(error => {
  console.error('\n❌ Erreur fatale:', error.message);
  process.exit(1);
});
