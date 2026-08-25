import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  agentRules: false, // don't let `next dev` regenerate AGENTS.md/CLAUDE.md over the repo's own
  async rewrites() {
    if (!process.env.BACKEND_URL) {
      // Rewrites are resolved at build time; a missing value would silently
      // produce "undefined/api/v1/..." and break every API call.
      throw new Error("BACKEND_URL must be set at build time (see .env.example)");
    }
    // Server-to-server proxy: the browser only ever talks to this Next.js
    // origin, so the refresh cookie set by the backend stays first-party
    // (no cross-site cookie, no CORS/withCredentials dance). BACKEND_URL is
    // resolved at `next build` time, not per request — see .env.example.
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
