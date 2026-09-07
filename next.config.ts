import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "qrcode"],
  // no external image optimization needed
  images: { unoptimized: true },
};

export default nextConfig;
