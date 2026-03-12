import { NextResponse } from 'next/server';

/**
 * Middleware Next.js — Génère un nonce CSP unique par requête.
 *
 * Flux :
 *  1. crypto.randomUUID() → nonce (Edge-compatible)
 *  2. Le nonce est injecté dans le header de requête `x-nonce`
 *     → lu par _document.js pour le passer à <Head> et <NextScript>
 *  3. Content-Security-Policy est posé en header de réponse
 *     avec `'nonce-{nonce}' 'strict-dynamic'`
 *     → seuls les scripts portant le nonce (+ ceux qu'ils chargent) sont exécutés
 */
export function middleware(request) {
  const nonce = crypto.randomUUID();

  const isProd = process.env.NODE_ENV === 'production';

  // En production : whitelist stricte des domaines Xcannes
  // En dev : permissif pour autoriser les IP locales / ports dynamiques
  const connectSrc = isProd
    ? "connect-src 'self' https://api.xcannes.com wss://ws.xcannes.com https://moonpay.xcannes.com"
    : "connect-src 'self' http: https: ws: wss:";

  const imgSrc = isProd
    ? "img-src 'self' data: blob: https://www.xcannes.com https://api.xcannes.com"
    : "img-src 'self' data: blob: https: http:";

  const csp = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    imgSrc,
    connectSrc,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; ');

  // Transmettre le nonce au serveur via un header de requête
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

// Ne pas exécuter le middleware sur les assets statiques
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.webp$).*)',
  ],
};
