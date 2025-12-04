/**
 * 🔴 COMPOSANT DEBUG - Prix externes Pyth en temps réel
 * Affiche les prix forex/commodity/crypto reçus via WebSocket
 */

'use client';

import { useXcannesWS } from '../context/XcannesWSContext';

export default function ExternalPricesDebug() {
  const { externalPrices, externalPricesVersion, connected } = useXcannesWS();

  // Grouper par catégorie
  const forex = [];
  const commodities = [];
  const crypto = [];

  externalPrices.forEach((data, symbol) => {
    const item = { symbol, ...data };
    if (data.category === 'forex') {
      forex.push(item);
    } else if (data.category === 'commodity') {
      commodities.push(item);
    } else if (data.category === 'crypto') {
      crypto.push(item);
    }
  });

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return Number(price).toFixed(6);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR');
  };

  return (
    <div className="bg-black/60 backdrop-blur-sm border border-white/20 rounded-lg p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-orbitron font-bold text-white">
          📡 Prix Externes Live (WebSocket)
        </h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <span className={`text-sm font-semibold ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'Connecté' : 'Déconnecté'}
          </span>
          <span className="text-xs text-white/40 ml-2">
            v{externalPricesVersion}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="text-blue-400 text-sm mb-1">Forex</div>
          <div className="text-2xl font-bold text-white">{forex.length}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="text-yellow-400 text-sm mb-1">Commodities</div>
          <div className="text-2xl font-bold text-white">{commodities.length}</div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="text-purple-400 text-sm mb-1">Crypto</div>
          <div className="text-2xl font-bold text-white">{crypto.length}</div>
        </div>
      </div>

      {/* Forex */}
      {forex.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-blue-400 mb-3">💱 Forex</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {forex.slice(0, 12).map((item) => (
              <div key={item.symbol} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">{item.symbol}</span>
                  <span className="text-xs text-white/40">{formatTime(item.publishTime)}</span>
                </div>
                <div className="text-xl font-bold text-green-400">
                  {formatPrice(item.midPrice)}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {item.displayName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commodities */}
      {commodities.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-yellow-400 mb-3">🥇 Commodities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {commodities.map((item) => (
              <div key={item.symbol} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">{item.symbol}</span>
                  <span className="text-xs text-white/40">{formatTime(item.publishTime)}</span>
                </div>
                <div className="text-xl font-bold text-yellow-400">
                  {formatPrice(item.midPrice)}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {item.displayName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crypto */}
      {crypto.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-purple-400 mb-3">₿ Crypto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {crypto.map((item) => (
              <div key={item.symbol} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">{item.symbol}</span>
                  <span className="text-xs text-white/40">{formatTime(item.publishTime)}</span>
                </div>
                <div className="text-xl font-bold text-purple-400">
                  {formatPrice(item.midPrice)}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {item.displayName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message si aucune donnée */}
      {externalPrices.size === 0 && (
        <div className="text-center py-12">
          <div className="text-white/40 mb-2">⏳ En attente des données...</div>
          <div className="text-xs text-white/20">
            Les prix Pyth devraient arriver dans quelques secondes
          </div>
        </div>
      )}
    </div>
  );
}
