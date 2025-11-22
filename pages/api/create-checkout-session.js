/**
 * Create Checkout Session - Stripe Payment
 * Modifié pour inclure metadata (wallet, XCS amount) et rate limiting
 */

import rateLimit from '../../middleware/rateLimit';
import winstonLogger from '../../lib/winstonLogger';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Vérifier que Stripe est configuré AVANT d'initialiser
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('XXXX') || process.env.STRIPE_SECRET_KEY === '***REMOVED***') {
    winstonLogger.stripe.error({
      action: 'checkout_session',
      error: 'STRIPE_SECRET_KEY not configured',
    });
    return res.status(500).json({ 
      error: 'Stripe payment is not configured. Please configure your Stripe API keys in .env.local' 
    });
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  try {
    // Récupérer les données du body
    const { walletAddress, xcsAmount = 100, packageType = 'basic' } = req.body || {};

    // Calculer le prix (ex: 1 XCS = 0.10 USD, donc 100 XCS = $10)
    const pricePerXCS = parseFloat(process.env.XCS_PRICE_USD || '0.10');
    const totalAmount = Math.round(xcsAmount * pricePerXCS * 100); // En cents

    winstonLogger.stripe.payment({
      action: 'create_checkout_session',
      walletAddress,
      xcsAmount,
      totalAmount,
      packageType,
    });

    // Créer la session Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `XCS Token Pack - ${xcsAmount} XCS`,
              description: `Purchase of ${xcsAmount} XCS tokens on XCANNES DEX`,
              images: [`${req.headers.origin}/assets/img/xcs-logo.png`],
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      // Metadata pour retrouver les infos lors du webhook
      metadata: {
        walletAddress: walletAddress || 'to_be_provided',
        xcsAmount: xcsAmount.toString(),
        packageType,
        timestamp: new Date().toISOString(),
      },
      // Customer email pour suivi
      customer_email: req.body.email || undefined,
      // URLs de redirection
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      // Expiration
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    });

    winstonLogger.stripe.payment({
      action: 'checkout_session_created',
      sessionId: session.id,
      walletAddress,
      xcsAmount,
    });

    res.status(200).json({ 
      id: session.id,
      url: session.url,
    });
  } catch (err) {
    winstonLogger.stripe.error({
      action: 'checkout_session_failed',
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: err.message });
  }
}

// Export avec rate limiting : 5 checkouts / heure / IP
export default rateLimit(handler, { type: 'checkout' });
