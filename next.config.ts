import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Los informes trimestrales guardan el informe entero ({meta, slides}) y el
      // texto de los documentos del trimestre en una Server Action: pasan de 1 MB.
      bodySizeLimit: "5mb",
    },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/dashboard/portfolio", permanent: false },
      {
        source: "/dashboard/rentabilidad",
        destination: "/dashboard/portfolio/rentabilidad",
        permanent: false,
      },
      {
        source: "/dashboard/proyectos",
        destination: "/dashboard/portfolio/proyectos",
        permanent: false,
      },
      {
        source: "/dashboard/tendencias",
        destination: "/dashboard/portfolio/tendencias",
        permanent: false,
      },
    ];
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
