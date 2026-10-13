import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase's site_url and the Google sign-in flow use 127.0.0.1, so the dev
  // server is opened on that host; without this Next blocks hydration there.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    agentFeedback: true,
    // Uploads are capped at 1 MB by our own checks; the default 1 MB body
    // limit would refuse a 1 MB file plus form overhead before they run.
    serverActions: { bodySizeLimit: "2mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
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
