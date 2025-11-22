#!/bin/bash

# 🚀 CONFIGURATION RAPIDE - XCANNES
# Exécuter après le rebuild

echo "═══════════════════════════════════════════════════════"
echo "  ⚙️  CONFIGURATION XCANNES - GUIDE INTERACTIF"
echo "═══════════════════════════════════════════════════════"
echo ""

# Vérifier si .env.local existe
if [ ! -f .env.local ]; then
    echo "❌ Fichier .env.local introuvable"
    echo "Créer un nouveau fichier .env.local avec les variables nécessaires"
    exit 1
fi

echo "📋 ÉTAPES DE CONFIGURATION"
echo "─────────────────────────────────────────────────────"
echo ""

echo "1️⃣  STRIPE (Paiements Fiat → XCS)"
echo "──────────────────────────────────────────────"
echo ""
echo "Actions requises:"
echo "  • Aller sur https://dashboard.stripe.com/apikeys"
echo "  • Copier 'Secret key' (sk_live_...)"
echo "  • Copier 'Publishable key' (pk_live_...)"
echo ""
echo "Dans .env.local, remplacer:"
echo "  STRIPE_SECRET_KEY=sk_live_VOTRE_CLE"
echo "  NEXT_PUBLIC_STRIPE_PK=pk_live_VOTRE_CLE"
echo ""
echo "Configuration Webhook:"
echo "  • Aller sur https://dashboard.stripe.com/webhooks"
echo "  • Add endpoint: https://$(hostname -I | awk '{print $1}')/api/stripe/webhook"
echo "  • Events: checkout.session.completed"
echo "  • Copier 'Signing secret'"
echo "  • STRIPE_WEBHOOK_SECRET=whsec_VOTRE_SECRET"
echo ""
read -p "Appuyez sur Entrée après avoir configuré Stripe..."
echo ""

echo "2️⃣  XUMM (Connexion Wallet)"
echo "──────────────────────────────────────────────"
echo ""
echo "Actions requises:"
echo "  • Aller sur https://apps.xumm.dev/"
echo "  • Create new app 'XCANNES DEX'"
echo "  • Copier API Key"
echo "  • Copier API Secret"
echo ""
echo "Dans .env.local, remplacer:"
echo "  XUMM_API_KEY=votre-api-key"
echo "  XUMM_API_SECRET=votre-api-secret"
echo ""
read -p "Appuyez sur Entrée après avoir configuré XUMM..."
echo ""

echo "3️⃣  XRPL Wallet Émetteur (Hot Wallet)"
echo "──────────────────────────────────────────────"
echo ""
echo "Avez-vous déjà un wallet émetteur XCS? (o/n)"
read -r has_wallet

if [ "$has_wallet" = "n" ]; then
    echo ""
    echo "Génération d'un nouveau wallet XRPL..."
    node -e "const xrpl = require('xrpl'); const wallet = xrpl.Wallet.generate(); console.log('Address:', wallet.address, '\nSecret:', wallet.seed);"
    echo ""
    echo "⚠️  IMPORTANT: Sauvegarder ces informations en lieu sûr!"
    echo ""
    echo "Actions requises:"
    echo "  1. Envoyer minimum 10 XRP à cette adresse pour l'activer"
    echo "  2. Émettre le token XCS depuis ce wallet"
    echo ""
fi

echo "Dans .env.local, configurer:"
echo "  ISSUER_WALLET_ADDRESS=rVOTRE_ADRESSE"
echo "  ISSUER_WALLET_SECRET=sVOTRE_SECRET"
echo "  XCS_CURRENCY_CODE=XCS"
echo "  XCS_PRICE_USD=0.10"
echo ""
read -p "Appuyez sur Entrée après avoir configuré le wallet..."
echo ""

echo "4️⃣  TESTS"
echo "──────────────────────────────────────────────"
echo ""
echo "Lancement des tests..."
echo ""

# Test Stripe
echo "📊 Test Stripe..."
./test-stripe.sh 2>/dev/null || echo "⚠️  Test Stripe échoué (normal si clés non configurées)"
echo ""

# Test XUMM
echo "📊 Test XUMM..."
./test-xumm.sh 2>/dev/null || echo "⚠️  Test XUMM échoué (normal si clés non configurées)"
echo ""

echo "5️⃣  REDÉMARRAGE"
echo "──────────────────────────────────────────────"
echo ""
echo "Redémarrage PM2 avec nouvelles variables..."
pm2 restart xcannes-frontend --update-env
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  ✅ CONFIGURATION TERMINÉE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "🌐 Votre site: http://$(hostname -I | awk '{print $1}'):2500"
echo ""
echo "📚 Documentation complète: IMPLEMENTATION_COMPLETE.md"
echo ""
echo "🧪 Tests à effectuer:"
echo "  1. Connexion XUMM (bouton Connect Wallet)"
echo "  2. Achat XCS avec carte test: 4242 4242 4242 4242"
echo "  3. Trading DEX (placer un ordre)"
echo ""
echo "📊 Monitoring:"
echo "  pm2 logs xcannes-frontend"
echo "  tail -f logs/stripe.log"
echo "  tail -f logs/xumm.log"
echo ""
echo "🆘 Support:"
echo "  Stripe: https://dashboard.stripe.com/support"
echo "  XUMM: https://apps.xumm.dev/"
echo ""
