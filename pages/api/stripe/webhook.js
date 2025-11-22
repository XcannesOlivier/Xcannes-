/**
 * Stripe Webhook Handler
 * Reçoit les événements Stripe (abonnements, paiements, etc.)
 * 
 * Configuration Stripe Dashboard:
 * 1. https://dashboard.stripe.com/webhooks
 * 2. Add endpoint: https://votresite.com/api/stripe/webhook
 * 3. Events: customer.subscription.*, invoice.*, checkout.session.completed
 * 4. Copier WEBHOOK_SECRET dans .env.local
 */

import Stripe from 'stripe';
import { buffer } from 'micro';
import winstonLogger from '../../../lib/winstonLogger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Désactiver le body parser pour les webhooks
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Handler principal du webhook
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    winstonLogger.stripe.error({
      action: 'webhook',
      error: 'STRIPE_WEBHOOK_SECRET not configured',
    });
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let event;

  try {
    // Vérifier la signature du webhook
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    
    winstonLogger.stripe.webhook({
      type: event.type,
      id: event.id,
    });
  } catch (err) {
    winstonLogger.stripe.error({
      action: 'webhook_verify',
      error: err.message,
    });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Traiter l'événement
  try {
    switch (event.type) {
      // Abonnements
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      // Paiements
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      default:
        winstonLogger.stripe.webhook({
          action: 'unhandled_event',
          type: event.type,
        });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    winstonLogger.stripe.error({
      action: 'webhook_process',
      event: event.type,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Abonnement créé
 */
async function handleSubscriptionCreated(subscription) {
  winstonLogger.stripe.payment({
    action: 'subscription_created',
    subscriptionId: subscription.id,
    customer: subscription.customer,
    status: subscription.status,
    plan: subscription.items.data[0]?.price.id,
  });

  // TODO: Activer les fonctionnalités premium pour l'utilisateur
  // TODO: Envoyer email de bienvenue
}

/**
 * Abonnement mis à jour
 */
async function handleSubscriptionUpdated(subscription) {
  winstonLogger.stripe.payment({
    action: 'subscription_updated',
    subscriptionId: subscription.id,
    customer: subscription.customer,
    status: subscription.status,
  });

  // TODO: Mettre à jour les accès utilisateur
}

/**
 * Abonnement annulé
 */
async function handleSubscriptionDeleted(subscription) {
  winstonLogger.stripe.payment({
    action: 'subscription_deleted',
    subscriptionId: subscription.id,
    customer: subscription.customer,
  });

  // TODO: Désactiver les fonctionnalités premium
  // TODO: Envoyer email d'annulation
}

/**
 * Facture payée
 */
async function handleInvoicePaid(invoice) {
  winstonLogger.stripe.payment({
    action: 'invoice_paid',
    invoiceId: invoice.id,
    customer: invoice.customer,
    amount: invoice.amount_paid,
    subscription: invoice.subscription,
  });

  // TODO: Confirmer le renouvellement d'abonnement
}

/**
 * Paiement de facture échoué
 */
async function handleInvoicePaymentFailed(invoice) {
  winstonLogger.stripe.error({
    action: 'invoice_payment_failed',
    invoiceId: invoice.id,
    customer: invoice.customer,
    amount: invoice.amount_due,
  });

  // TODO: Envoyer alerte à l'utilisateur
  // TODO: Suspendre l'abonnement après X tentatives
}

/**
 * Checkout complété (paiement one-time ou début d'abonnement)
 */
async function handleCheckoutCompleted(session) {
  winstonLogger.stripe.payment({
    action: 'checkout_completed',
    sessionId: session.id,
    amount: session.amount_total,
    currency: session.currency,
    customer: session.customer_details?.email,
    mode: session.mode, // 'payment' ou 'subscription'
    paymentStatus: session.payment_status,
  });

  // TODO: Traiter selon le type (abonnement ou paiement one-time)
  if (session.mode === 'subscription') {
    // Géré par les events customer.subscription.*
  } else if (session.mode === 'payment') {
    // TODO: Gérer les paiements one-time si besoin
  }
}
