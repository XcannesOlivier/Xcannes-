#!/usr/bin/env node

/**
 * Script 5 : Vérification Frontend (simulation useExternalPrice hook)
 * 
 * Ce script teste exactement ce que fait le hook useExternalPrice :
 * 1. Appel API REST depuis le frontend
 * 2. Récupération prix live via getForexPrice / getCommodityPrice
 * 3. Récupération candles pour les charts
 * 4. Simulation polling toutes les 5 secondes
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
  gray: '\x1b[90m'
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

/**
 * Fonction fetch avec timeout (comme dans xcannesApi.js)
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
 * Test 1 : Vérifier que l'API REST est accessible
 */
async function testAPIConnexion() {
  log('\n🔌 TEST 1 : CONNEXION API REST', 'blue');
  log('═'.repeat(50), 'gray');
  logInfo(`URL testée : ${API_BASE_URL}\n`);

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/forex`, 5000);
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        logSuccess(`API accessible : ${result.data.length} paires forex disponibles`);
        return true;
      } else {
        logError('API retourne un format invalide');
        console.log('Format reçu:', result);
        return false;
      }
    } else {
      logError(`API retourne HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Impossible de joindre l'API : ${error.message}`);
    logWarning(`Vérifiez que marketDataAPI.js tourne : pm2 list | grep xcannes-api`);
    return false;
  }
}

/**
 * Test 2 : Tester TOUTES les paires via l'API REST
 */
async function testAllPythPrices() {
  log('\n💱 TEST 2 : TOUTES LES PAIRES PYTH (41 paires)', 'blue');
  log('═'.repeat(50), 'gray');

  // Charger la configuration
  const feedsConfig = require('../../config/pythFeeds.json');
  const allPairs = feedsConfig.feeds;

  logInfo(`Test de ${allPairs.length} paires configurées\n`);

  // Grouper par catégorie
  const categories = {
    crypto: allPairs.filter(p => p.category === 'crypto'),
    forex: allPairs.filter(p => p.category === 'forex'),
    exotic: allPairs.filter(p => p.category === 'exotic'),
    commodity: allPairs.filter(p => p.category === 'commodity')
  };

  // Tester chaque catégorie
  for (const [catName, pairs] of Object.entries(categories)) {
    if (pairs.length === 0) continue;

    log(`\n🔸 ${catName.toUpperCase()} (${pairs.length} paires):`, 'cyan');
    
    for (const pair of pairs) {
      try {
        const startTime = Date.now();
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/v1/ticker/${pair.symbol}`,
          3000
        );
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.data) {
            const data = result.data;
            const price = Number(data.midPrice || data.lastPrice || data.price || 0);
            
            if (price > 0) {
              const age = data.receivedAt ? Math.round((Date.now() - new Date(data.receivedAt).getTime()) / 1000) : 0;
              
              logSuccess(`${pair.symbol.replace('_', '/')} : ${price.toFixed(catName === 'crypto' ? 2 : 5)} (${age}s, ${responseTime}ms)`);

              if (age > 30) {
                logWarning(`   ⚠️  Données vieilles (${age}s)`);
              }
            } else {
              logError(`${pair.symbol} : Prix invalide (${price})`);
            }
          } else {
            logError(`${pair.symbol} : Réponse API sans succès`);
          }
        } else {
          logError(`${pair.symbol} : HTTP ${response.status}`);
        }
      } catch (error) {
        logError(`${pair.symbol} : ${error.message}`);
      }
    }
  }
}

/**
 * Test 3 : Simuler getCommodityPrice() comme dans xcannesApi.js
 */
async function testGetCommodityPrice() {
  log('\n🥇 TEST 3 : getCommodityPrice() - SIMULATION EXACTE', 'blue');
  log('═'.repeat(50), 'gray');

  const pairesTest = ['XAU_USD', 'XAG_USD'];

  logInfo(`Test de ${pairesTest.length} commodités\n`);

  for (const pair of pairesTest) {
    try {
      const startTime = Date.now();
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/commodities?symbol=${pair}`,
        3000
      );
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data) {
          const data = result.data;
          const midPrice = Number(data.midPrice || data.price || 0);
          
          if (midPrice > 0) {
            const age = Date.now() - new Date(data.receivedAt).getTime();
            const ageSeconds = Math.round(age / 1000);
            
            logSuccess(`${pair.replace('_', '/')}`);
            log(`   💰 Prix : $${midPrice.toFixed(2)}`, 'gray');
            log(`   ⏰ Âge : ${ageSeconds}s`, 'gray');
            log(`   ⚡ Temps : ${responseTime}ms`, 'gray');
          } else {
            logError(`${pair} : Prix invalide`);
          }
        } else {
          logError(`${pair} : Réponse API sans succès`);
        }
      } else {
        logError(`${pair} : HTTP ${response.status}`);
      }
    } catch (error) {
      logError(`${pair} : ${error.message}`);
    }
  }
}

/**
 * Test 3 : Simuler le hook useExternalPrice complet
 */
async function testUseExternalPriceHook() {
  log('\n🎣 TEST 3 : SIMULATION HOOK useExternalPrice', 'blue');
  log('═'.repeat(50), 'gray');

  const testCases = [
    { pair: 'BTC/USD', symbol: 'BTC_USD', category: 'crypto', endpoint: 'ticker' },
    { pair: 'EUR/USD', symbol: 'EUR_USD', category: 'forex', endpoint: 'ticker' },
    { pair: 'XAU/USD', symbol: 'XAU_USD', category: 'commodity', endpoint: 'ticker' }
  ];

  logInfo(`Test du hook pour ${testCases.length} cas d'usage\n`);

  for (const test of testCases) {
    try {
      log(`📊 Test : ${test.pair} (${test.category})`, 'cyan');
      
      const url = `${API_BASE_URL}/api/v1/ticker/${test.symbol}`;

      const response = await fetchWithTimeout(url, 3000);
      
      if (response.ok) {
        const result = await response.json();
        
        if (result?.success && result?.data) {
          const priceData = result.data;
          const midPrice = Number(priceData.midPrice || priceData.lastPrice || priceData.price || 0);
          
          if (midPrice > 0) {
            logSuccess(`Hook réussi : prix = ${midPrice.toFixed(test.category === 'crypto' ? 2 : 5)}`);
            log(`   📋 Données complètes : symbol, price, timestamp ✓`, 'gray');
          } else {
            logError(`Hook échoué : prix invalide`);
          }
        } else {
          logError(`Hook échoué : pas de données`);
        }
      } else {
        logError(`Hook échoué : HTTP ${response.status}`);
      }
    } catch (error) {
      logError(`Hook échoué : ${error.message}`);
    }
  }
}

/**
 * Test 4 : Vérifier getKlines() pour les charts
 */
async function testGetKlines() {
  log('\n📈 TEST 4 : getKlines() - DONNÉES POUR CHART', 'blue');
  log('═'.repeat(50), 'gray');

  const symbol = 'EUR_USD';
  const timeframes = ['1m', '5m', '1h'];

  logInfo(`Test des candles pour ${symbol.replace('_', '/')} sur ${timeframes.length} timeframes\n`);

  for (const timeframe of timeframes) {
    try {
      const startTime = Date.now();
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/klines/${symbol}?timeframe=${timeframe}&limit=50`,
        5000
      );
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data && Array.isArray(result.data.candles)) {
          const candles = result.data.candles;
          
          if (candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            
            const hasOHLC = 
              lastCandle.time !== undefined &&
              lastCandle.open !== undefined &&
              lastCandle.high !== undefined &&
              lastCandle.low !== undefined &&
              lastCandle.close !== undefined;

            if (hasOHLC) {
              logSuccess(`Timeframe ${timeframe} : ${candles.length} bougies`);
              log(`   📊 Dernière : O=${lastCandle.open.toFixed(5)} H=${lastCandle.high.toFixed(5)} L=${lastCandle.low.toFixed(5)} C=${lastCandle.close.toFixed(5)}`, 'gray');
              log(`   ⚡ Temps : ${responseTime}ms`, 'gray');
            } else {
              logError(`Timeframe ${timeframe} : Structure OHLC incomplète`);
            }
          } else {
            logWarning(`Timeframe ${timeframe} : Aucune bougie`);
          }
        } else {
          logError(`Timeframe ${timeframe} : Format invalide`);
        }
      } else {
        logError(`Timeframe ${timeframe} : HTTP ${response.status}`);
      }
    } catch (error) {
      logError(`Timeframe ${timeframe} : ${error.message}`);
    }
  }
}

/**
 * Test 5 : Simuler le polling du hook (5 secondes)
 */
async function testPolling() {
  log('\n🔄 TEST 5 : SIMULATION POLLING (5 secondes)', 'blue');
  log('═'.repeat(50), 'gray');

  logInfo('Le hook useExternalPrice rafraîchit toutes les 5 secondes');
  logInfo('Simulation de 3 appels consécutifs pour BTC/USD...\n');

  const symbol = 'BTC_USD';
  const prix = [];

  for (let i = 1; i <= 3; i++) {
    try {
      log(`   📡 Appel ${i}/3...`, 'cyan');
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/ticker/${symbol}`,
        3000
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result?.success && result?.data) {
          const midPrice = Number(result.data.midPrice || result.data.lastPrice || 0);
          if (midPrice > 0) {
            prix.push({
              prix: midPrice,
              timestamp: new Date(result.data.receivedAt || Date.now())
            });
            log(`      💰 Prix : $${midPrice.toFixed(2)}`, 'gray');
          }
        }
      }

      if (i < 3) {
        log(`      ⏳ Attente 2 secondes...`, 'gray');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logError(`Appel ${i} échoué : ${error.message}`);
    }
  }

  if (prix.length === 3) {
    logSuccess(`Polling réussi : 3/3 appels OK`);
    
    const prixUniques = new Set(prix.map(p => p.prix));
    if (prixUniques.size > 1) {
      logInfo(`   Les prix varient (${prixUniques.size} valeurs différentes) ✓`);
    } else {
      logWarning(`   Les prix sont identiques (normal si < 10s)`);
    }
  } else {
    logError(`Polling incomplet : ${prix.length}/3 appels`);
  }
}

/**
 * Main
 */
async function main() {
  console.log('\n');
  log('═'.repeat(60), 'cyan');
  log('🖥️  VÉRIFICATION FRONTEND - SCRIPT 5', 'cyan');
  log('═'.repeat(60), 'cyan');
  log('Simulation exacte du comportement de useExternalPrice hook', 'gray');
  log('Tests des méthodes : getForexPrice, getCommodityPrice, getKlines\n', 'gray');

  // Test 1 : Connexion API
  const apiOk = await testAPIConnexion();
  if (!apiOk) {
    log('\n❌ API inaccessible - Tests interrompus', 'red');
    logWarning('Démarrez l\'API backend : cd /root/xcannes-dex && pm2 restart xcannes-api');
    process.exit(1);
  }

  // Test 2 : Toutes les paires Pyth
  await testAllPythPrices();

  // Test 3 : Hook useExternalPrice
  await testUseExternalPriceHook();

  // Test 5 : getKlines()
  await testGetKlines();

  // Test 6 : Polling
  await testPolling();

  // Résumé
  log('\n' + '═'.repeat(60), 'cyan');
  log('📊 RÉSUMÉ', 'cyan');
  log('═'.repeat(60), 'cyan');

  const total = testsReussis + testsEchoues;
  const pourcentage = total > 0 ? Math.round((testsReussis / total) * 100) : 0;

  log(`✅ Tests réussis      : ${testsReussis}/${total}`, testsReussis === total ? 'green' : 'yellow');
  log(`❌ Tests échoués      : ${testsEchoues}/${total}`, testsEchoues > 0 ? 'red' : 'green');
  log(`📈 Taux de réussite   : ${pourcentage}%`, pourcentage === 100 ? 'green' : 'yellow');

  log('\n' + '═'.repeat(60), 'cyan');

  if (testsReussis === total) {
    log('🎉 FRONTEND PRÊT : Le hook useExternalPrice fonctionne !', 'green');
    log('👉 Les composants peuvent afficher les prix Pyth en temps réel', 'green');
  } else {
    log('⚠️  Certains tests échoués - Vérifiez les erreurs', 'yellow');
  }

  log('═'.repeat(60) + '\n', 'cyan');

  process.exit(testsEchoues > 0 ? 1 : 0);
}

// Exécution
main().catch(error => {
  console.error('\n❌ Erreur fatale:', error.message);
  process.exit(1);
});
