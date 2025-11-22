/**
 * API: XUMM Balance
 * Récupère les soldes XRPL d'une adresse
 * 
 * GET /api/xumm/balance?address=rXXXXXXXXXX
 * Response: { xrp, tokens: [...] }
 */

import { Client } from 'xrpl';
import rateLimit from '../../../middleware/rateLimit';
import winstonLogger from '../../../lib/winstonLogger';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ 
      error: 'Missing address parameter' 
    });
  }

  // Valider le format de l'adresse
  if (!address.startsWith('r') || address.length !== 34) {
    return res.status(400).json({ 
      error: 'Invalid XRPL address format' 
    });
  }

  let client;

  try {
    // Se connecter à XRPL
    const network = process.env.XRPL_NETWORK || 'wss://xrplcluster.com';
    client = new Client(network);
    await client.connect();

    winstonLogger.xumm.balance({
      action: 'fetch_balance',
      address,
    });

    // 1. Récupérer le solde XRP
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });

    const xrpBalance = parseFloat(accountInfo.result.account_data.Balance) / 1_000_000;

    // 2. Récupérer les trustlines (tokens)
    const accountLines = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated',
    });

    const tokens = accountLines.result.lines.map((line) => ({
      currency: line.currency,
      value: parseFloat(line.balance),
      issuer: line.account,
      limit: parseFloat(line.limit),
    }));

    winstonLogger.xumm.balance({
      action: 'balance_fetched',
      address,
      xrpBalance,
      tokenCount: tokens.length,
    });

    res.status(200).json({
      address,
      xrp: xrpBalance,
      tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    winstonLogger.xumm.error({
      action: 'balance_failed',
      address,
      error: error.message,
    });

    // Gérer le cas où le compte n'existe pas
    if (error.data?.error === 'actNotFound') {
      return res.status(404).json({
        error: 'Account not found',
        message: 'This XRPL address does not exist or is not activated',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch balance',
      message: error.message,
    });
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}

// Rate limit: 30 requêtes / minute / IP
export default rateLimit(handler, { type: 'balance' });
