import type { NextConfig } from "next";

// When running locally in dev or production, proxy to local FastAPI on port 8000.
// On cloud deployments (Vercel), only proxy if a public BACKEND_URL is explicitly configured.
const backendUrl =
  process.env.BACKEND_URL ||
  (!process.env.VERCEL ? "http://127.0.0.1:8000" : "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendUrl) return [];
    return {
      beforeFiles: [
        {
          source: "/api/health",
          destination: `${backendUrl}/api/health`,
        },
        {
          source: "/api/capabilities",
          destination: `${backendUrl}/api/capabilities`,
        },
        {
          source: "/api/jobs",
          destination: `${backendUrl}/api/jobs`,
        },
        {
          source: "/api/jobs/:path*",
          destination: `${backendUrl}/api/jobs/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
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
