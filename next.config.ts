import type { NextConfig } from "next";

/** Salon dont les anciennes adresses (à la racine du site) sont conservées : elles redirigent vers /s/<identifiant>. */
const SALON_HISTORIQUE = process.env.SALON_SLUG ?? "la-coquette-du-faso";

const nextConfig: NextConfig = {
  async redirects() {
    return ["reserver", "videos", "realisations"].map((page) => ({
      source: `/${page}`,
      destination: `/s/${SALON_HISTORIQUE}/${page}`,
      permanent: false, // la racine du site pourra évoluer : on ne laisse pas les navigateurs mémoriser
    }));
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
