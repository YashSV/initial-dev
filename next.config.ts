import type { NextConfig } from "next";

// Node 25+ exposes global localStorage/sessionStorage via the experimental
// Web Storage API. Without --localstorage-file these globals are non-functional,
// causing "localStorage.getItem is not a function" errors during SSR.
if (typeof globalThis !== "undefined" && typeof window === "undefined") {
  delete (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage;
  delete (globalThis as typeof globalThis & { sessionStorage?: unknown }).sessionStorage;
}

const nextConfig: NextConfig = {
  devIndicators: false,
};

export default nextConfig;
