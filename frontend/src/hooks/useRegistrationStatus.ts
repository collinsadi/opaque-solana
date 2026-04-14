/**
 * Checks whether the connected wallet has a stealth meta-address registered on the current cluster.
 * Re-runs automatically when address or cluster changes.
 */

import { useState, useEffect } from "react";
import { isRegistered } from "../lib/registry";

export type RegistrationStatus = {
  isRegistered: boolean;
  isLoading: boolean;
};

export function useRegistrationStatus(
  address: string | null,
  cluster: string | null
): RegistrationStatus {
  const [isRegisteredOnChain, setIsRegisteredOnChain] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!address || cluster == null) {
      setIsRegisteredOnChain(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    isRegistered(address)
      .then((registered) => {
        if (!cancelled) {
          setIsRegisteredOnChain(registered);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsRegisteredOnChain(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, cluster]);

  return { isRegistered: isRegisteredOnChain, isLoading };
}
