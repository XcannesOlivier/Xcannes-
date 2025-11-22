/**
 * API: XUMM Check Status
 * Vérifie le statut d'un payload XUMM
 * 
 * GET /api/xumm/check?uuid=xxx
 * Response: { signed, wallet, txHash }
 */

import { XummSdk } from 'xumm-sdk';
import winstonLogger from '../../../lib/winstonLogger';

let xumm;
try {
  if (process.env.XUMM_API_KEY && process.env.XUMM_API_SECRET) {
    xumm = new XummSdk(
      process.env.XUMM_API_KEY,
      process.env.XUMM_API_SECRET
    );
  }
} catch (error) {
  winstonLogger.xumm.error({
    action: 'sdk_init',
    error: error.message,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!xumm) {
    return res.status(500).json({ 
      error: 'XUMM not configured'
    });
  }

  const { uuid } = req.query;

  if (!uuid) {
    return res.status(400).json({ 
      error: 'Missing uuid parameter' 
    });
  }

  try {
    // Récupérer le statut du payload
    const payload = await xumm.payload.get(uuid);

    winstonLogger.xumm.connect({
      action: 'check_status',
      uuid,
      signed: payload.meta.signed,
      resolved: payload.meta.resolved,
    });

    // Si signé, récupérer l'adresse wallet
    let walletAddress = null;
    if (payload.meta.signed && payload.response) {
      walletAddress = payload.response.account;
    }

    res.status(200).json({
      signed: payload.meta.signed,
      resolved: payload.meta.resolved,
      expired: payload.meta.expired,
      wallet: walletAddress,
      returnUrl: payload.response?.return_url,
    });
  } catch (error) {
    winstonLogger.xumm.error({
      action: 'check_status_failed',
      uuid,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to check XUMM status',
      message: error.message,
    });
  }
}
