import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Izinkan akses dev dari IP LAN (uji scanner QR via HP). Next.js 16 memblokir
  // resource dev cross-origin secara default sehingga hidrasi & kamera gagal.
  allowedDevOrigins: ["192.168.1.4", "localhost", "127.0.0.1"],
  serverExternalPackages: ["@whiskeysockets/baileys", "pino"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
