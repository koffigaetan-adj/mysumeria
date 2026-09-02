import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
});

// pdfkit charge ses polices à l'exécution via des imports internes ("#standard-fonts/*"
// → js/standard-fonts/*.cjs) que le traçage de Vercel ne suit pas : on le laisse hors du
// bundle et on force l'inclusion de tout le paquet dans les fonctions qui l'utilisent.
const PDFKIT_FILES = ["./node_modules/pdfkit/**/*"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/statement-pdf": PDFKIT_FILES,
    "/api/statement-email": PDFKIT_FILES,
    "/api/monthly-statement": PDFKIT_FILES,
  },
};

export default withPWA(nextConfig);
