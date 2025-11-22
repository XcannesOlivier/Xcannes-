/**
 * API: XUMM Connect
 * Initie une connexion wallet via QR code XUMM
 * 
 * POST /api/xumm/connect
 * Body: { returnUrl?: string }
 * Response: { uuid, qrUrl, deepLink, websocket }
 */

import { XummSdk } from 'xumm-sdk';
import rateLimit from '../../../middleware/rateLimit';
import winstonLogger from '../../../lib/winstonLogger';

// Initialiser XUMM SDK
let xumm;
try {
  if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
    throw new Error('XUMM API credentials not configured');
  }
  
  xumm = new XummSdk(
    process.env.XUMM_API_KEY,
    process.env.XUMM_API_SECRET
  );
} catch (error) {
  winstonLogger.xumm.error({
    action: 'sdk_init',
    error: error.message,
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!xumm) {
    return res.status(500).json({ 
      error: 'XUMM not configured',
      message: 'Please set XUMM_API_KEY and XUMM_API_SECRET in .env.local'
    });
  }

  try {
    const { returnUrl } = req.body || {};

    winstonLogger.xumm.connect({
      action: 'create_payload',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    // Créer un payload SignIn
    const payload = await xumm.payload.create({
      txjson: {
        TransactionType: 'SignIn',
      },
      options: {
        submit: false, // Pas de soumission, juste signature
        return_url: {
          web: returnUrl || process.env.NEXT_PUBLIC_RETURN_URL_WEB || 'https://xcannes.com',
        },
      },
      custom_meta: {
        identifier: `xcannes_connect_${Date.now()}`,
        blob: {
          purpose: 'Connect wallet to XCANNES DEX',
        },
      },
    });

    winstonLogger.xumm.connect({
      action: 'payload_created',
      uuid: payload.uuid,
      qrUrl: payload.refs.qr_png,
    });

    // Retourner les infos pour afficher le QR code
    res.status(200).json({
      uuid: payload.uuid,
      qrUrl: payload.refs.qr_png,
      qrSvg: payload.refs.qr_svg,
      deepLink: payload.next.always,
      websocket: payload.refs.websocket_status,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    winstonLogger.xumm.error({
      action: 'connect_failed',
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to create XUMM connection',
      message: error.message,
    });
  }
}

// Rate limit: 10 connexions / heure / IP
export default rateLimit(handler, { type: 'xummConnect' });
