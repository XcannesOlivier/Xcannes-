#!/bin/bash

# Script de test rapide Stripe - XCANNES
# Usage: ./test-stripe.sh

echo "═══════════════════════════════════════════════════════"
echo "  🔍 TEST RAPIDE STRIPE - XCANNES"
echo "═══════════════════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Charger les variables d'environnement
if [ -f .env.local ]; then
    source <(grep -v '^#' .env.local | sed 's/^/export /')
else
    echo -e "${RED}❌ Fichier .env.local introuvable${NC}"
    exit 1
fi

echo "1️⃣ VARIABLES D'ENVIRONNEMENT"
echo "─────────────────────────────────────────────────────"

# Vérifier NEXT_PUBLIC_STRIPE_PK
if [ -z "$NEXT_PUBLIC_STRIPE_PK" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_STRIPE_PK non définie${NC}"
elif [[ "$NEXT_PUBLIC_STRIPE_PK" == *"XXXX"* ]]; then
    echo -e "${YELLOW}⚠️  NEXT_PUBLIC_STRIPE_PK est un placeholder${NC}"
    echo "   Valeur: $NEXT_PUBLIC_STRIPE_PK"
elif [[ "$NEXT_PUBLIC_STRIPE_PK" == pk_test_* ]]; then
    echo -e "${GREEN}✅ NEXT_PUBLIC_STRIPE_PK (mode TEST)${NC}"
    echo "   Valeur: ${NEXT_PUBLIC_STRIPE_PK:0:20}..."
elif [[ "$NEXT_PUBLIC_STRIPE_PK" == pk_live_* ]]; then
    echo -e "${GREEN}✅ NEXT_PUBLIC_STRIPE_PK (mode PRODUCTION)${NC}"
    echo "   Valeur: ${NEXT_PUBLIC_STRIPE_PK:0:20}..."
else
    echo -e "${RED}❌ NEXT_PUBLIC_STRIPE_PK format invalide${NC}"
fi

# Vérifier STRIPE_SECRET_KEY
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "${RED}❌ STRIPE_SECRET_KEY non définie${NC}"
elif [[ "$STRIPE_SECRET_KEY" == *"XXXX"* ]]; then
    echo -e "${YELLOW}⚠️  STRIPE_SECRET_KEY est un placeholder${NC}"
    echo "   Valeur: $STRIPE_SECRET_KEY"
elif [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
    echo -e "${GREEN}✅ STRIPE_SECRET_KEY (mode TEST)${NC}"
    echo "   Valeur: ${STRIPE_SECRET_KEY:0:20}..."
elif [[ "$STRIPE_SECRET_KEY" == sk_live_* ]]; then
    echo -e "${GREEN}✅ STRIPE_SECRET_KEY (mode PRODUCTION)${NC}"
    echo "   Valeur: ${STRIPE_SECRET_KEY:0:20}..."
else
    echo -e "${RED}❌ STRIPE_SECRET_KEY format invalide${NC}"
fi

echo ""
echo "2️⃣ TEST API ENDPOINT"
echo "─────────────────────────────────────────────────────"

# Vérifier que le serveur tourne
if ! curl -s http://localhost:2500 > /dev/null; then
    echo -e "${RED}❌ Serveur non accessible sur http://localhost:2500${NC}"
    echo "   Démarrez le serveur avec: pm2 start xcannes-frontend"
    exit 1
fi

# Tester l'API
echo "Testing POST /api/create-checkout-session..."
RESPONSE=$(curl -s -X POST http://localhost:2500/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:2500")

# Analyser la réponse
if echo "$RESPONSE" | grep -q '"id":"cs_test_'; then
    echo -e "${GREEN}✅ API fonctionne (mode TEST)${NC}"
    SESSION_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo "   Session ID: $SESSION_ID"
elif echo "$RESPONSE" | grep -q '"id":"cs_live_'; then
    echo -e "${GREEN}✅ API fonctionne (mode PRODUCTION)${NC}"
    SESSION_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo "   Session ID: $SESSION_ID"
elif echo "$RESPONSE" | grep -q '"error"'; then
    ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
    echo -e "${RED}❌ Erreur API: $ERROR${NC}"
    
    if [[ "$ERROR" == *"not configured"* ]]; then
        echo "   → Les clés Stripe sont des placeholders"
        echo "   → Configurez vos vraies clés dans .env.local"
    elif [[ "$ERROR" == *"Invalid API Key"* ]]; then
        echo "   → La clé STRIPE_SECRET_KEY est invalide"
        echo "   → Vérifiez vos clés sur https://dashboard.stripe.com/apikeys"
    fi
else
    echo -e "${RED}❌ Réponse inattendue: $RESPONSE${NC}"
fi

echo ""
echo "3️⃣ STATUT DU SERVEUR"
echo "─────────────────────────────────────────────────────"
pm2 list | grep xcannes-frontend

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  📋 PROCHAINES ÉTAPES"
echo "═══════════════════════════════════════════════════════"
echo ""

if [[ "$STRIPE_SECRET_KEY" == *"XXXX"* ]] || [[ "$NEXT_PUBLIC_STRIPE_PK" == *"XXXX"* ]]; then
    echo "⚠️  VOS CLÉS STRIPE SONT DES PLACEHOLDERS"
    echo ""
    echo "1. Obtenez vos clés sur: https://dashboard.stripe.com/apikeys"
    echo "2. Éditez .env.local:"
    echo "   nano /root/xcannes-dex/Xcannes-/.env.local"
    echo "3. Redémarrez le serveur:"
    echo "   pm2 restart xcannes-frontend --update-env"
    echo "4. Relancez ce test:"
    echo "   ./test-stripe.sh"
else
    echo "✅ Configuration OK !"
    echo ""
    echo "Pour tester le paiement:"
    echo "1. Ouvrez http://localhost:2500 dans votre navigateur"
    echo "2. Cliquez sur 'Buy with Card / Apple Pay'"
    echo "3. Utilisez la carte de test: 4242 4242 4242 4242"
    echo "   Date: 12/28, CVV: 123, ZIP: 12345"
    echo ""
    echo "Dashboard Stripe: https://dashboard.stripe.com/test/payments"
fi

echo ""
