/**
 * Modal informing the user about cluster configuration.
 * On Solana, cluster switching is done via environment configuration,
 * not wallet RPC calls.
 */

import { type ReactNode } from "react";
import { getCluster } from "../lib/chain";
import { SUPPORTED_CLUSTERS } from "../contracts/contract-config";
import { ModalShell } from "./ModalShell";

export type SwitchNetworkModalProps = {
  title?: string;
  description?: ReactNode;
  onClose?: () => void;
  showClose?: boolean;
};

export function SwitchNetworkModal({
  title = "Switch cluster",
  description = `Opaque supports ${SUPPORTED_CLUSTERS.join(", ")} only. Update your VITE_SOLANA_CLUSTER env variable.`,
  onClose,
  showClose = false,
}: SwitchNetworkModalProps) {
  const cluster = getCluster();

  return (
    <ModalShell
      open
      title={title}
      description={description}
      onClose={() => onClose?.()}
      closeOnBackdrop={Boolean(showClose)}
      maxWidthClassName="max-w-md"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-mist">
          Current cluster: <span className="text-white font-mono">{cluster}</span>
        </p>
        <p className="text-sm text-mist">
          To switch clusters, set <code className="text-xs bg-ink-900 px-1.5 py-0.5 rounded">VITE_SOLANA_CLUSTER</code> in your
          environment and reload the page.
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-sol-gradient px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Close
          </button>
        )}
      </div>
    </ModalShell>
  );
}
