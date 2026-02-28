/** @type {import('next').NextConfig} */
const { i18n } = require("./next-i18next.config");

const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss: ws:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

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
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspReportOnly,
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
    // Autoriser les images distantes utilisées dans l'app (ex: images de news)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.wsj.com',
      },
      {
        protocol: 'https',
        hostname: '**.wsj.net',
      },
      {
        protocol: 'https',
        hostname: '**.nytimes.com',
      },
      {
        protocol: 'https',
        hostname: '**.ft.com',
      },
      {
        protocol: 'https',
        hostname: '**.ftimg.net',
      },
      {
        protocol: 'https',
        hostname: '**.reuters.com',
      },
      {
        protocol: 'https',
        hostname: '**.bloomberg.com',
      },
      {
        protocol: 'https',
        hostname: '**.cnbc.com',
      },
      {
        protocol: 'https',
        hostname: '**.bbc.com',
      },
      {
        protocol: 'https',
        hostname: '**.bbc.co.uk',
      },
      {
        protocol: 'https',
        hostname: '**.theguardian.com',
      },
      {
        protocol: 'https',
        hostname: '**.telegraph.co.uk',
      },
      {
        protocol: 'https',
        hostname: '**.economist.com',
      },
      {
        protocol: 'https',
        hostname: '**.lemonde.fr',
      },
      {
        protocol: 'https',
        hostname: '**.lesechos.fr',
      },
      {
        protocol: 'https',
        hostname: '**.lefigaro.fr',
      },
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
    const apiUrl = (process.env.NEXT_PUBLIC_XCANNES_API_URL || 'http://149.28.238.173:3001').replace(/\/$/, '');
    return [
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
          "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
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
