import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Pages Router (pages/) to coexist with App Router (app/)
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;
