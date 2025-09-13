import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Explicitly set the Turbopack root so Next.js doesn't try to infer it from
   * other lockfiles elsewhere on the machine. This silences the multiple
   * lockfiles warning during dev/build.
   */
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
