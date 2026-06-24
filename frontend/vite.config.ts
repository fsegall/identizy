import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    global: "globalThis",
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force stellar-sdk to use CJS source (lib/) instead of the browser bundle
      // (dist/stellar-sdk.min.js). The browser bundle embeds stellar-base@13 internally,
      // but stellar-sdk/rpc has no "browser" export so it uses lib/rpc which imports
      // stellar-base from npm (@14). Two Transaction classes → instanceof fails in
      // TransactionBuilder.cloneFrom() → "expected a 'Transaction'" after Freighter signs.
      // Forcing lib/ for all entries means both use npm stellar-base@14 → one class.
      // Sub-paths must come BEFORE the bare specifier so Vite matches them first.
      "@stellar/stellar-sdk/rpc": path.resolve(__dirname, "node_modules/@stellar/stellar-sdk/lib/rpc/index.js"),
      "@stellar/stellar-sdk/contract": path.resolve(__dirname, "node_modules/@stellar/stellar-sdk/lib/contract/index.js"),
      "@stellar/stellar-sdk": path.resolve(__dirname, "node_modules/@stellar/stellar-sdk/lib/index.js"),
    },
    dedupe: ["@stellar/stellar-base"],
  },
}));
