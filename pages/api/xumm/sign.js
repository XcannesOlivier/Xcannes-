/**
 * API: XUMM Sign Transaction
 * Créer un payload XUMM pour signer une transaction DEX
 * 
 * POST /api/xumm/sign
 * Body: { txjson: {...}, userToken?: string }
 * Response: { uuid, qrUrl, deepLink }
 */

import { XummSdk } from 'xumm-sdk';
import rateLimit from '../../../middleware/rateLimit';
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

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!xumm) {
    return res.status(500).json({ 
      error: 'XUMM not configured'
    });
  }

  const { txjson, userToken } = req.body || {};

  if (!txjson) {
    return res.status(400).json({ 
      error: 'Missing txjson parameter' 
    });
  }

  try {
    winstonLogger.xumm.sign({
      action: 'create_payload',
      txType: txjson.TransactionType,
      account: txjson.Account,
    });

    // Créer le payload XUMM
    const payload = await xumm.payload.create({
      txjson,
      options: {
        submit: true, // Soumettre automatiquement après signature
        return_url: {
          web: process.env.NEXT_PUBLIC_RETURN_URL_WEB || 'https://xcannes.com/dex',
        },
      },
      custom_meta: {
        identifier: `xcannes_tx_${Date.now()}`,
        blob: {
          purpose: 'Sign transaction on XCANNES DEX',
        },
      },
      // Si userToken fourni (pour user authentifié XUMM)
      ...(userToken && { user_token: userToken }),
    });

    winstonLogger.xumm.sign({
      action: 'payload_created',
      uuid: payload.uuid,
      txType: txjson.TransactionType,
    });

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
      action: 'sign_failed',
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to create signature request',
      message: error.message,
    });
  }
}

// Rate limit: 20 signatures / heure / IP
export default rateLimit(handler, { type: 'xummSign' });
