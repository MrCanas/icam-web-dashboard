import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.imparcapital.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
