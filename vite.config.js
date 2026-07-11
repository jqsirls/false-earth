import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";
import basicSsl from "@vitejs/plugin-basic-ssl";

/** Root deploy on booster.storytailor.com uses `/`; relative `./` stays for local preview / iframe embeds. */
const base = process.env.VITE_BASE_PATH || "./";

export default {
  base,
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'packages/three-core/src')
    },
  },
  plugins: [react(), glsl(), basicSsl()],
  server: {
    host: true,
    https: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
};
