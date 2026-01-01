/** @type {import('next').NextConfig} */
const { i18n } = require("./next-i18next.config");

const nextConfig = {
  reactStrictMode: true,
  i18n,

  // ✅ Optimisation des images
  images: {
    // Autoriser les images distantes utilisées dans l'app (ex: QR Xumm, images de news)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xumm.app',
      },
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

  // ✅ Headers sécurité pour production
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
