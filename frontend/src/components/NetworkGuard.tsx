import type { ReactNode } from "react";
import { getCluster } from "../lib/chain";
import { isClusterSupported } from "../contracts/contract-config";

type NetworkGuardProps = {
  children: ReactNode;
};

export function NetworkGuard({ children }: NetworkGuardProps) {
  const cluster = getCluster();
  const showUnsupported = !isClusterSupported(cluster);

  if (!showUnsupported) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="network-guard-title"
      >
        <div className="max-w-md w-full">
          <div className="card text-center">
            <h2 id="network-guard-title" className="text-lg font-semibold text-white mb-2">
              Unsupported cluster
            </h2>
            <p className="text-sm text-neutral-400">
              Opaque supports devnet only. Set VITE_SOLANA_CLUSTER=devnet in your environment to continue.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
