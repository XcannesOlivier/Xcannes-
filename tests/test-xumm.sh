#!/bin/bash

# Script d'audit XUMM - XCANNES
# Usage: ./test-xumm.sh

echo "═══════════════════════════════════════════════════════"
echo "  🔍 AUDIT XUMM - XCANNES DEX"
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

echo "1️⃣ PACKAGES NPM"
echo "─────────────────────────────────────────────────────"

# Vérifier xrpl
if npm list xrpl 2>/dev/null | grep -q "xrpl@"; then
    VERSION=$(npm list xrpl 2>/dev/null | grep "xrpl@" | grep -oP '\d+\.\d+\.\d+' | head -1)
    echo -e "${GREEN}✅ xrpl v${VERSION}${NC}"
else
    echo -e "${RED}❌ xrpl non installé${NC}"
fi

# Vérifier xumm-sdk
if npm list xumm-sdk 2>/dev/null | grep -q "xumm-sdk@"; then
    VERSION=$(npm list xumm-sdk 2>/dev/null | grep "xumm-sdk@" | grep -oP '\d+\.\d+\.\d+' | head -1)
    echo -e "${GREEN}✅ xumm-sdk v${VERSION}${NC}"
else
    echo -e "${YELLOW}⚠️  xumm-sdk non installé (requis pour QR code)${NC}"
fi

# Vérifier xumm
if npm list xumm 2>/dev/null | grep -q "xumm@"; then
    VERSION=$(npm list xumm 2>/dev/null | grep "xumm@" | grep -oP '\d+\.\d+\.\d+' | head -1)
    echo -e "${GREEN}✅ xumm v${VERSION}${NC}"
else
    echo -e "${YELLOW}⚠️  xumm non installé (alternative moderne)${NC}"
fi

echo ""
echo "2️⃣ VARIABLES D'ENVIRONNEMENT"
echo "─────────────────────────────────────────────────────"

# Vérifier XUMM_API_KEY
if [ -z "$XUMM_API_KEY" ]; then
    echo -e "${RED}❌ XUMM_API_KEY non définie${NC}"
elif [[ "$XUMM_API_KEY" == "your_xumm_api_key_here" ]]; then
    echo -e "${YELLOW}⚠️  XUMM_API_KEY est un placeholder${NC}"
    echo "   Valeur: $XUMM_API_KEY"
else
    echo -e "${GREEN}✅ XUMM_API_KEY configurée${NC}"
    echo "   Valeur: ${XUMM_API_KEY:0:10}..."
fi

# Vérifier XUMM_API_SECRET
if [ -z "$XUMM_API_SECRET" ]; then
    echo -e "${RED}❌ XUMM_API_SECRET non définie${NC}"
elif [[ "$XUMM_API_SECRET" == "your_xumm_api_secret_here" ]]; then
    echo -e "${YELLOW}⚠️  XUMM_API_SECRET est un placeholder${NC}"
    echo "   Valeur: $XUMM_API_SECRET"
else
    echo -e "${GREEN}✅ XUMM_API_SECRET configurée${NC}"
    echo "   Valeur: ${XUMM_API_SECRET:0:10}..."
fi

echo ""
echo "3️⃣ FICHIERS XUMM"
echo "─────────────────────────────────────────────────────"

FILES=(
    "context/XummContext.js"
    "components/XummConnectButton.jsx"
    "components/XummSecuritySection.jsx"
    "hooks/useTrade.js"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file"
    fi
done

echo ""
echo "4️⃣ ANALYSE DU CODE"
echo "─────────────────────────────────────────────────────"

# Vérifier si XummContext utilise le SDK
if grep -q "xumm-sdk\|xumm" context/XummContext.js 2>/dev/null; then
    echo -e "${GREEN}✅ XummContext utilise le SDK XUMM${NC}"
else
    echo -e "${RED}❌ XummContext n'utilise PAS le SDK XUMM${NC}"
    echo "   → Connexion via prompt() manuel"
fi

# Vérifier si on récupère les soldes
if grep -q "simulatedBalance\|simulated" hooks/useTrade.js 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Soldes simulés détectés${NC}"
    echo "   → Balance fixée à 1000 (pas récupérée depuis XRPL)"
else
    echo -e "${GREEN}✅ Soldes récupérés depuis XRPL${NC}"
fi

# Vérifier les API endpoints XUMM
echo ""
echo "5️⃣ API ENDPOINTS XUMM"
echo "─────────────────────────────────────────────────────"

XUMM_ENDPOINTS=(
    "pages/api/xumm/connect.js"
    "pages/api/xumm/check.js"
    "pages/api/xumm/balance.js"
    "pages/api/xumm/sign.js"
)

FOUND=0
for endpoint in "${XUMM_ENDPOINTS[@]}"; do
    if [ -f "$endpoint" ]; then
        echo -e "${GREEN}✅${NC} $endpoint"
        FOUND=$((FOUND + 1))
    else
        echo -e "${RED}❌${NC} $endpoint (non créé)"
    fi
done

if [ $FOUND -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Aucun endpoint XUMM API trouvé${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  📊 RÉSULTAT"
echo "═══════════════════════════════════════════════════════"
echo ""

# Compter les problèmes
ISSUES=0

# Vérifier les packages
if ! npm list xumm-sdk 2>/dev/null | grep -q "xumm-sdk@"; then
    ISSUES=$((ISSUES + 1))
fi

# Vérifier les clés
if [[ "$XUMM_API_KEY" == "your_xumm_api_key_here" ]]; then
    ISSUES=$((ISSUES + 1))
fi

if [[ "$XUMM_API_SECRET" == "your_xumm_api_secret_here" ]]; then
    ISSUES=$((ISSUES + 1))
fi

# Vérifier le code
if ! grep -q "xumm-sdk\|xumm" context/XummContext.js 2>/dev/null; then
    ISSUES=$((ISSUES + 1))
fi

if grep -q "simulatedBalance" hooks/useTrade.js 2>/dev/null; then
    ISSUES=$((ISSUES + 1))
fi

if [ $FOUND -eq 0 ]; then
    ISSUES=$((ISSUES + 1))
fi

# Afficher le résultat
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ INTÉGRATION XUMM COMPLÈTE${NC}"
    echo ""
    echo "Tous les composants XUMM sont en place !"
    echo "Vous pouvez connecter des wallets et voir les soldes."
else
    echo -e "${YELLOW}⚠️  INTÉGRATION XUMM BASIQUE - $ISSUES problème(s) détecté(s)${NC}"
    echo ""
    echo "PROBLÈMES IDENTIFIÉS:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if ! npm list xumm-sdk 2>/dev/null | grep -q "xumm-sdk@"; then
        echo "• xumm-sdk non installé"
    fi
    
    if [[ "$XUMM_API_KEY" == "your_xumm_api_key_here" ]]; then
        echo "• XUMM_API_KEY est un placeholder"
    fi
    
    if [[ "$XUMM_API_SECRET" == "your_xumm_api_secret_here" ]]; then
        echo "• XUMM_API_SECRET est un placeholder"
    fi
    
    if ! grep -q "xumm-sdk\|xumm" context/XummContext.js 2>/dev/null; then
        echo "• Pas d'intégration SDK XUMM (connexion via prompt)"
    fi
    
    if grep -q "simulatedBalance" hooks/useTrade.js 2>/dev/null; then
        echo "• Soldes simulés (pas récupérés depuis XRPL)"
    fi
    
    if [ $FOUND -eq 0 ]; then
        echo "• Aucun endpoint API XUMM créé"
    fi
    
    echo ""
    echo "PROCHAINES ÉTAPES:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Installer xumm-sdk:"
    echo "   npm install xumm-sdk"
    echo ""
    echo "2. Obtenir clés XUMM:"
    echo "   https://apps.xumm.dev/"
    echo ""
    echo "3. Configurer .env.local:"
    echo "   nano .env.local"
    echo "   → Remplacer XUMM_API_KEY et XUMM_API_SECRET"
    echo ""
    echo "4. Lire le rapport complet:"
    echo "   cat XUMM_AUDIT_REPORT.md"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📄 Documentation disponible:"
echo "   • XUMM_AUDIT_REPORT.md  - Rapport d'audit complet"
echo "   • https://xumm.readme.io/ - Documentation XUMM"
echo ""
