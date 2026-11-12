import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Everything the frontend reads ends up in public JavaScript that anyone can
// download, so it must never contain a key. Refuse to build or serve if it would.
const SECRET_NAME = /KEY|SECRET|TOKEN|JWT|PASSWORD|PRIVATE|MNEMONIC/i;
// RPC URLs like .../v2/<api-key> or ?apikey=... carry a provider key.
const KEYED_URL = /\/[A-Za-z0-9_-]{20,}(\/|$|\?)|[?&](api[-_]?key|key|token)=/i;

function assertNoSecrets(env) {
  const problems = Object.keys(env)
    .filter((k) => env[k] && SECRET_NAME.test(k))
    .map((k) => `${k} looks like a secret`);

  const network = JSON.parse(
    readFileSync(new URL("./src/abis/network.json", import.meta.url), "utf8")
  );
  for (const [where, url] of [
    ["VITE_RPC_URL", env.VITE_RPC_URL],
    ["src/abis/network.json rpcUrl", network.rpcUrl],
  ]) {
    if (url && KEYED_URL.test(url)) problems.push(`${where} appears to contain an API key`);
  }

  if (problems.length) {
    throw new Error(
      "Refusing to build: the frontend is public, so it must not contain keys.\n  - " +
        problems.join("\n  - ") +
        "\nUse a public RPC URL and keep keys in the root .env (used only by Hardhat)."
    );
  }
}

export default defineConfig(({ mode }) => {
  assertNoSecrets(loadEnv(mode, process.cwd(), "VITE_"));
  return {
    plugins: [react()],
    // Relative asset paths so the build works from any sub-path
    // (e.g. GitHub Pages serves it under /<repo-name>/). Routing is hash-based,
    // so no server rewrites are needed.
    base: "./",
    server: { port: 5173 },
  };
});
