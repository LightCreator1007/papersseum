import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lessons are .mdx files (generated into generated/learn/ from ../resources).
  pageExtensions: ["ts", "tsx", "md", "mdx"],
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
      // Not CSS Modules: `as: "*.css"` would turn them into global CSS and `styles.x` would be undefined.
      "*.css": {
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Turbopack takes plugins by name (strings), with options that can be serialised.
// throwOnError makes a broken equation fail the build instead of showing red text.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm", "remark-math"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-katex", { throwOnError: true, strict: "error" }],
      ["rehype-highlight", { detect: false, ignoreMissing: true }],
    ],
  },
});

export default withMDX(nextConfig);
