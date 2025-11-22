/**
 * 🎯 Exemple de composant utilisant la nouvelle intégration
 * Affiche un ticker en temps réel avec WebSocket
 */

'use client';

import { useTicker } from '../hooks/useXcannesAPI';
import { useXcannesWS } from '../context/XcannesWSContext';

export default function LivePriceTicker({ pair = 'XCS/XRP' }) {
  const { connected } = useXcannesWS();
  const { ticker, loading, error } = useTicker(pair, 5000); // Polling 5s

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-white/60 text-sm">Chargement du prix...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400 text-sm">❌ Erreur: {error}</p>
      </div>
    );
  }

  if (!ticker) {
    return null;
  }

  const priceChange = parseFloat(ticker.changePercent24h || 0);
  const isPositive = priceChange >= 0;

  return (
    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4">
      {/* Header avec statut WebSocket */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-orbitron font-bold text-white">{pair}</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <span className="text-xs text-white/40">
            {connected ? 'Live' : 'Déconnecté'}
          </span>
        </div>
      </div>

      {/* Prix principal */}
      <div className="mb-3">
        <div className="text-3xl font-bold text-white">
          {parseFloat(ticker.lastPrice).toFixed(6)}
        </div>
        <div className="text-xs text-white/40 mt-1">
          {ticker.symbol || pair}
        </div>
      </div>

      {/* Variation 24h */}
      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
        isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}>
        <span>{isPositive ? '▲' : '▼'}</span>
        <span>{isPositive ? '+' : ''}{priceChange.toFixed(2)}%</span>
        <span className="text-white/40 ml-1">
          ({isPositive ? '+' : ''}{parseFloat(ticker.change24h || 0).toFixed(6)})
        </span>
      </div>

      {/* Stats 24h */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-xs text-white/40 mb-1">High 24h</p>
          <p className="text-sm font-semibold text-white">
            {parseFloat(ticker.high24h || 0).toFixed(6)}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">Low 24h</p>
          <p className="text-sm font-semibold text-white">
            {parseFloat(ticker.low24h || 0).toFixed(6)}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">Volume 24h</p>
          <p className="text-sm font-semibold text-white">
            {parseFloat(ticker.volume24h || 0).toLocaleString(undefined, {
              maximumFractionDigits: 0
            })}
          </p>
        </div>
      </div>

      {/* Bid/Ask */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10">
        <div>
          <p className="text-xs text-green-400 mb-1">Bid (Achat)</p>
          <p className="text-sm font-semibold text-white">
            {parseFloat(ticker.bidPrice || 0).toFixed(6)}
          </p>
        </div>
        <div>
          <p className="text-xs text-red-400 mb-1">Ask (Vente)</p>
          <p className="text-sm font-semibold text-white">
            {parseFloat(ticker.askPrice || 0).toFixed(6)}
          </p>
        </div>
      </div>

      {/* Spread */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">Spread</span>
          <span className="text-sm font-semibold text-white">
            {parseFloat(ticker.spread || 0).toFixed(6)} ({ticker.spreadPercent || 0}%)
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="mt-2 text-xs text-white/30 text-center">
        Mis à jour: {new Date(ticker.timestamp).toLocaleTimeString('fr-FR')}
      </div>
    </div>
  );
}
