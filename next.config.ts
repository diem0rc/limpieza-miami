import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en el home del usuario; sin esto Turbopack
  // lo toma como raíz del workspace y avisa en cada build.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default withNextIntl(nextConfig);
