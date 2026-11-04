import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:5080";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack(config) {
    // The Tailwind loader uses the standard loader API and also supports the Webpack build fallback.
    config.module.rules.push({
      test: /[\\/]app[\\/]globals\.css$/,
      enforce: "pre",
      use: ["@tailwindcss/turbopack"],
    });
    return config;
  },
};

export default nextConfig;
