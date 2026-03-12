/** @type {import('next').NextConfig} */
const { i18n } = require("./next-i18next.config");

// CSP gérée dynamiquement par src/middleware.js (nonce par requête).
// Seuls les headers non-CSP restent ici (statiques).
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
];

const nextConfig = {
  reactStrictMode: true,
  i18n,
  experimental: {
    externalDir: true,
  },

  // ✅ Optimisation des images
  images: {
    // Autoriser toutes les images HTTPS distantes (news, logos, etc.)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ✅ Compression pour performance
  compress: true,

  // ✅ Proxy wallet-relay vers le VPS API (permet au PWA sur Vercel d'atteindre le backend)
  async rewrites() {
    const apiUrl = (process.env.NEXT_PUBLIC_XCANNES_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    return [
      // Wallet-app PWA: serve index.html for directory-style URLs
      {
        source: '/wallet-app',
        destination: '/wallet-app/index.html',
      },
      {
        source: '/wallet-relay/:path*',
        destination: `${apiUrl}/wallet-relay/:path*`,
      },
    ];
  },

  // ✅ Headers sécurité pour production
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source:
          "/((?!api|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
