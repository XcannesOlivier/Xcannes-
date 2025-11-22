#!/bin/bash

# 🧪 Script de test d'intégration Frontend ↔ Backend
# Vérifie que tout fonctionne correctement

echo "🔍 Test d'intégration XCANNES DEX"
echo "=================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend URLs
API_URL="${NEXT_PUBLIC_XCANNES_API_URL:-http://149.28.238.173:3003}"
WS_URL="${NEXT_PUBLIC_XCANNES_WS_URL:-ws://149.28.238.173:3002}"

# Compteurs
PASSED=0
FAILED=0

# Fonction de test
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"
    
    echo -n "  Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 5)
    
    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response, expected $expected)"
        ((FAILED++))
        return 1
    fi
}

# Fonction de test JSON
test_json_endpoint() {
    local name="$1"
    local url="$2"
    
    echo -n "  Testing $name... "
    
    response=$(curl -s "$url" --max-time 5)
    
    if echo "$response" | grep -q '"success".*true'; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "    Response: $response"
        ((FAILED++))
        return 1
    fi
}

echo "1️⃣  Backend Health Check"
echo "------------------------"
test_endpoint "Health endpoint" "$API_URL/health" "200"
echo ""

echo "2️⃣  API REST Endpoints"
echo "----------------------"
test_json_endpoint "Markets" "$API_URL/api/v1/markets"
test_json_endpoint "Ticker XCS_XRP" "$API_URL/api/v1/ticker?pair=XCS_XRP"
test_json_endpoint "Orderbook XCS_XRP" "$API_URL/api/v1/orderbook?pair=XCS_XRP&limit=10"
test_json_endpoint "Trades XCS_XRP" "$API_URL/api/v1/trades?pair=XCS_XRP&limit=10"
test_json_endpoint "Klines XCS_XRP" "$API_URL/api/v1/klines?pair=XCS_XRP&interval=1h&limit=10"
echo ""

echo "3️⃣  WebSocket Server"
echo "--------------------"
# Test simple de connexion WebSocket (vérifie juste que le port est ouvert)
if timeout 2 bash -c "echo > /dev/tcp/${WS_URL#ws://}" 2>/dev/null; then
    echo -e "  ${GREEN}✓ PASS${NC} WebSocket port is open"
    ((PASSED++))
else
    echo -e "  ${RED}✗ FAIL${NC} WebSocket port is not accessible"
    ((FAILED++))
fi
echo ""

echo "4️⃣  Frontend Configuration"
echo "-------------------------"

# Vérifier que les fichiers existent
files=(
    "lib/config.js"
    "lib/xcannesApi.js"
    "lib/xcannesWebSocket.js"
    "hooks/useXcannesAPI.js"
    "components/LivePriceTicker.jsx"
    "docs/INTEGRATION_GUIDE.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓ PASS${NC} $file exists"
        ((PASSED++))
    else
        echo -e "  ${RED}✗ FAIL${NC} $file not found"
        ((FAILED++))
    fi
done
echo ""

echo "5️⃣  Environment Variables"
echo "-------------------------"

if [ -f ".env.local" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} .env.local exists"
    ((PASSED++))
    
    # Vérifier les variables
    if grep -q "NEXT_PUBLIC_XCANNES_API_URL" .env.local; then
        echo -e "  ${GREEN}✓ PASS${NC} NEXT_PUBLIC_XCANNES_API_URL is set"
        ((PASSED++))
    else
        echo -e "  ${YELLOW}⚠ WARNING${NC} NEXT_PUBLIC_XCANNES_API_URL not found"
    fi
    
    if grep -q "NEXT_PUBLIC_XCANNES_WS_URL" .env.local; then
        echo -e "  ${GREEN}✓ PASS${NC} NEXT_PUBLIC_XCANNES_WS_URL is set"
        ((PASSED++))
    else
        echo -e "  ${YELLOW}⚠ WARNING${NC} NEXT_PUBLIC_XCANNES_WS_URL not found"
    fi
else
    echo -e "  ${YELLOW}⚠ WARNING${NC} .env.local not found"
fi
echo ""

echo "6️⃣  Dependencies"
echo "---------------"

if [ -f "package.json" ]; then
    if grep -q '"xrpl"' package.json; then
        echo -e "  ${GREEN}✓ PASS${NC} xrpl package found"
        ((PASSED++))
    fi
    
    if grep -q '"lightweight-charts"' package.json; then
        echo -e "  ${GREEN}✓ PASS${NC} lightweight-charts package found"
        ((PASSED++))
    fi
fi
echo ""

# Résumé
echo "=================================="
echo "📊 Test Summary"
echo "=================================="
echo -e "  ${GREEN}Passed:${NC} $PASSED"
echo -e "  ${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "🎉 Integration is working perfectly!"
    echo ""
    echo "Next steps:"
    echo "  1. Run 'npm install' if you haven't already"
    echo "  2. Run 'npm run dev' to start the dev server"
    echo "  3. Check docs/INTEGRATION_GUIDE.md for usage examples"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if backend services are running: pm2 list"
    echo "  2. Check backend logs: pm2 logs"
    echo "  3. Verify .env.local configuration"
    echo "  4. Consult docs/INTEGRATION_GUIDE.md"
    echo ""
    exit 1
fi
