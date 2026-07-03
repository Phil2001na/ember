import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // this project is its own workspace root (a stray lockfile exists in the home dir)
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
