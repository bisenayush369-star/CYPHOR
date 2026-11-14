import type { NextConfig } from "next"

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The libsql client ships a native binary. Keep it out of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
}

export default config
