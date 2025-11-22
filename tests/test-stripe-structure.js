// Test de la structure Stripe (sans vraies clés)
console.log("=== AUDIT STRIPE - XCANNES ===\n");

// 1. Variables d'environnement
console.log("1️⃣ VARIABLES D'ENVIRONNEMENT:");
console.log("   NEXT_PUBLIC_STRIPE_PK:", process.env.NEXT_PUBLIC_STRIPE_PK ? "✅ Définie" : "❌ Manquante");
console.log("   STRIPE_SECRET_KEY:", process.env.STRIPE_SECRET_KEY ? "✅ Définie" : "❌ Manquante");
console.log("");

// 2. Packages NPM
console.log("2️⃣ PACKAGES NPM:");
try {
  const stripePkg = require('stripe/package.json');
  console.log("   stripe:", stripePkg.version, "✅");
} catch(e) {
  console.log("   stripe: ❌ Non installé");
}

try {
  const stripeJsPkg = require('@stripe/stripe-js/package.json');
  console.log("   @stripe/stripe-js:", stripeJsPkg.version, "✅");
} catch(e) {
  console.log("   @stripe/stripe-js: ❌ Non installé");
}
console.log("");

// 3. Fichiers requis
const fs = require('fs');
console.log("3️⃣ FICHIERS REQUIS:");
const files = [
  'lib/stripe.js',
  'pages/api/create-checkout-session.js',
  'components/AltPaymentBlock.jsx',
  'components/SetupPanel.jsx',
  'pages/success.js',
  '.env.local'
];

files.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});
console.log("");

// 4. Validation de la clé
console.log("4️⃣ VALIDATION DES CLÉS:");
const secretKey = process.env.STRIPE_SECRET_KEY || '';
const publicKey = process.env.NEXT_PUBLIC_STRIPE_PK || '';

if (secretKey.includes('XXXX') || secretKey === '***REMOVED***') {
  console.log("   ❌ STRIPE_SECRET_KEY est un placeholder");
} else if (secretKey.startsWith('sk_test_')) {
  console.log("   ✅ STRIPE_SECRET_KEY (mode TEST)");
} else if (secretKey.startsWith('sk_live_')) {
  console.log("   ✅ STRIPE_SECRET_KEY (mode PRODUCTION)");
} else if (secretKey) {
  console.log("   ⚠️  STRIPE_SECRET_KEY format invalide");
} else {
  console.log("   ❌ STRIPE_SECRET_KEY manquante");
}

if (publicKey.includes('XXXX') || publicKey === 'pk_test_XXXXXXXXXXXXXXXXXXXX') {
  console.log("   ❌ NEXT_PUBLIC_STRIPE_PK est un placeholder");
} else if (publicKey.startsWith('pk_test_')) {
  console.log("   ✅ NEXT_PUBLIC_STRIPE_PK (mode TEST)");
} else if (publicKey.startsWith('pk_live_')) {
  console.log("   ✅ NEXT_PUBLIC_STRIPE_PK (mode PRODUCTION)");
} else if (publicKey) {
  console.log("   ⚠️  NEXT_PUBLIC_STRIPE_PK format invalide");
} else {
  console.log("   ❌ NEXT_PUBLIC_STRIPE_PK manquante");
}
console.log("");

// 5. API Endpoint Structure
console.log("5️⃣ API ENDPOINT:");
const apiContent = fs.readFileSync('pages/api/create-checkout-session.js', 'utf8');
console.log("   ✅ Fichier existe");
console.log("   " + (apiContent.includes('stripe.checkout.sessions.create') ? '✅' : '❌') + " Utilise stripe.checkout.sessions.create");
console.log("   " + (apiContent.includes('success_url') ? '✅' : '❌') + " Configure success_url");
console.log("   " + (apiContent.includes('cancel_url') ? '✅' : '❌') + " Configure cancel_url");
console.log("   " + (apiContent.includes('payment_method_types') ? '✅' : '❌') + " Configure payment_method_types");
console.log("");

// 6. Frontend Integration
console.log("6️⃣ INTÉGRATION FRONTEND:");
const altPaymentContent = fs.readFileSync('components/AltPaymentBlock.jsx', 'utf8');
console.log("   " + (altPaymentContent.includes('stripePromise') ? '✅' : '❌') + " AltPaymentBlock importe stripePromise");
console.log("   " + (altPaymentContent.includes('redirectToCheckout') ? '✅' : '❌') + " AltPaymentBlock utilise redirectToCheckout");
console.log("   " + (altPaymentContent.includes('/api/create-checkout-session') ? '✅' : '❌') + " AltPaymentBlock appelle l'API");

const setupPanelContent = fs.readFileSync('components/SetupPanel.jsx', 'utf8');
console.log("   " + (setupPanelContent.includes('stripePromise') ? '✅' : '❌') + " SetupPanel importe stripePromise");
console.log("   " + (setupPanelContent.includes('redirectToCheckout') ? '✅' : '❌') + " SetupPanel utilise redirectToCheckout");
console.log("");

console.log("=== FIN DE L'AUDIT ===");
