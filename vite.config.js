import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";
import basicSsl from "@vitejs/plugin-basic-ssl";

/** Root deploy on booster.storytailor.com uses `/`; relative `./` stays for local preview / iframe embeds. */
const base = process.env.VITE_BASE_PATH || "./";

/**
 * HTTPS by default: WebXR on headsets over LAN requires a secure context.
 * VITE_NO_HTTPS=1 opts into plain http for localhost tooling that rejects
 * the self-signed cert (http://localhost is still a secure context).
 */
const useHttps = process.env.VITE_NO_HTTPS !== "1";

export default {
  base,
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'packages/three-core/src')
    },
  },
  plugins: [react(), glsl(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true,
    https: useHttps,
    // Headset testing over a Cloudflare quick tunnel (`npm run dev:tunnel`).
    allowedHosts: [".trycloudflare.com"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
};
