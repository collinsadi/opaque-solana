/**
 * Solana Explorer URLs by cluster.
 */

import { getCluster, type SolanaCluster } from "./chain";

function getExplorerBase(cluster: SolanaCluster): string {
  switch (cluster) {
    case "mainnet-beta":
      return "https://explorer.solana.com";
    case "devnet":
      return "https://explorer.solana.com";
    case "testnet":
      return "https://explorer.solana.com";
    case "localnet":
      return "https://explorer.solana.com";
  }
}

function clusterParam(cluster: SolanaCluster): string {
  if (cluster === "mainnet-beta") return "";
  if (cluster === "localnet") return "?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899";
  return `?cluster=${cluster}`;
}

export function getExplorerTxUrl(txSignature: string | null): string | null {
  if (!txSignature) return null;
  const cluster = getCluster();
  const base = getExplorerBase(cluster);
  return `${base}/tx/${txSignature}${clusterParam(cluster)}`;
}

export function getExplorerAddressUrl(address: string | null): string | null {
  if (!address) return null;
  const cluster = getCluster();
  const base = getExplorerBase(cluster);
  return `${base}/address/${address}${clusterParam(cluster)}`;
}
