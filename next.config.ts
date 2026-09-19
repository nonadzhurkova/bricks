import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pixi owns an imperative WebGL context tied to a single canvas element;
  // StrictMode's dev-only double-mount tears that context down and back up
  // on the same node, which the GPU driver surfaces as a lost context.
  reactStrictMode: false,
};

export default nextConfig;
