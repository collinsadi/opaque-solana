/**
 * Solana cluster config. Use getCluster() for the app's target cluster.
 *
 * RPC resolution (first match wins):
 * - VITE_SOLANA_RPC_URL — Solana JSON-RPC only (recommended).
 * - localnet cluster — always http://127.0.0.1:8899 (local `solana-test-validator`).
 * - VITE_RPC_URL — legacy; ignored if it looks like an Ethereum/other chain URL
 *   (Solana’s client sends the `solana-client` header and non-Solana RPCs fail CORS).
 * - Public RPC for the selected cluster.
 */

import { type Cluster } from "@solana/web3.js";

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet" | "localnet";

export const CLUSTER_ENDPOINTS: Record<SolanaCluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  localnet: "http://localhost:8899",
};

let rpcWarnLogged = false;
let nonSolanaRpcWarned = false;

/** True when URL is almost certainly not a Solana JSON-RPC (e.g. Ethereum QuickNode). */
function isLikelyNonSolanaJsonRpc(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const h = hostname.toLowerCase();
    if (h.includes("solana")) return false;
    if (h.includes("ethereum")) return true;
    if (h.includes("sepolia") || h.includes("holesky") || h.includes("goerli")) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns the RPC URL for the configured cluster.
 */
export function getRpcUrl(): string {
  const solanaRpc = (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined)?.trim();
  if (solanaRpc) return solanaRpc;

  const cluster = getCluster();
  if (cluster === "localnet") {
    return CLUSTER_ENDPOINTS.localnet;
  }

  const legacy = (import.meta.env.VITE_RPC_URL as string | undefined)?.trim();
  if (legacy) {
    if (isLikelyNonSolanaJsonRpc(legacy)) {
      if (!nonSolanaRpcWarned) {
        nonSolanaRpcWarned = true;
        console.warn(
          "[Opaque] VITE_RPC_URL looks like a non-Solana endpoint; ignoring it for Solana RPC.",
          "Use VITE_SOLANA_RPC_URL or a Solana host (e.g. *.solana-devnet.quiknode.pro), or set VITE_SOLANA_CLUSTER=localnet for solana-test-validator at http://127.0.0.1:8899.",
        );
      }
    } else {
      return legacy;
    }
  }

  const url = CLUSTER_ENDPOINTS[cluster];
  if (!rpcWarnLogged) {
    rpcWarnLogged = true;
    console.warn(
      "[Opaque] No Solana RPC override. Using public RPC for",
      cluster,
      "— set VITE_SOLANA_RPC_URL (or a Solana-compatible VITE_RPC_URL) for better limits.",
    );
  }
  return url;
}

/**
 * Returns the Solana cluster the dApp should use.
 * Set VITE_SOLANA_CLUSTER in .env (default: devnet).
 */
export function getCluster(): SolanaCluster {
  const raw = import.meta.env.VITE_SOLANA_CLUSTER as string | undefined;
  if (raw && (raw === "mainnet-beta" || raw === "devnet" || raw === "testnet" || raw === "localnet")) {
    return raw;
  }
  return "devnet";
}

/**
 * Returns the Solana Cluster type for wallet-adapter compatibility.
 */
export function getWalletAdapterCluster(): Cluster {
  const cluster = getCluster();
  if (cluster === "localnet") return "devnet";
  return cluster;
}
