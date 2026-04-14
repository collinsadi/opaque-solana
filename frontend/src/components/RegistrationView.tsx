import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction } from "@solana/web3.js";
import { getCluster, getRpcUrl } from "../lib/chain";
import { useKeys } from "../context/KeysContext";
import { isRegistered } from "../lib/registry";
import { buildRegisterKeysInstruction, SCHEME_ID_SECP256K1 } from "../lib/contracts";
import { hexToBytes, type Hex } from "../lib/stealth";
import { getConfigForCluster } from "../contracts/contract-config";

export function RegistrationView() {
  const { isSetup, stealthMetaAddressHex } = useKeys();
  const { publicKey, connected, sendTransaction } = useWallet();
  const cluster = getCluster();
  const currentConfig = getConfigForCluster(cluster);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!address) {
      setRegistered(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    isRegistered(address)
      .then(setRegistered)
      .catch(() => setRegistered(null))
      .finally(() => setChecking(false));
  }, [address, cluster]);

  const handleRegister = async () => {
    if (!stealthMetaAddressHex || !publicKey || !currentConfig) return;
    setError(null);
    setTxSig(null);
    setRegistering(true);
    try {
      const connection = new Connection(getRpcUrl(), "confirmed");
      const metaBytes = hexToBytes(stealthMetaAddressHex as Hex);
      const ix = buildRegisterKeysInstruction(
        publicKey,
        SCHEME_ID_SECP256K1,
        metaBytes,
      );
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const sig = await sendTransaction(tx, connection);
      setTxSig(sig);
      setRegistered(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  if (!isSetup) {
    return (
      <div className="card max-w-lg mx-auto text-center text-neutral-500">
        Complete key setup first so you have a stealth meta-address to register.
      </div>
    );
  }

  if (!connected || !address) {
    return (
      <div className="card max-w-lg mx-auto text-center text-neutral-500">
        Connect your wallet to register your stealth meta-address on-chain.
      </div>
    );
  }

  return (
    <div className="card max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-white mb-1">Register</h2>
      <p className="text-sm text-neutral-500 mb-6">
        Save your stealth meta-address on the registry so others can send to you using your Solana address.
      </p>

      <div className="space-y-4">
        {checking && (
          <p className="text-neutral-600 text-sm">Checking registration…</p>
        )}
        {!checking && registered === true && (
          <div className="p-3 rounded-lg bg-neutral-900 border border-border text-sm text-success">
            Already registered. Others can resolve your stealth meta-address from your Solana address.
          </div>
        )}
        {!checking && registered === false && (
          <>
            <p className="text-neutral-400 text-sm">
              Your meta-address will be stored on-chain for{" "}
              <span className="font-mono text-neutral-300">{address.slice(0, 6)}…{address.slice(-4)}</span>.
            </p>
            {error && <p className="text-error text-sm">{error}</p>}
            {txSig && (
              <p className="text-success text-sm">
                Registered. Tx: <span className="font-mono break-all text-neutral-400">{txSig}</span>
              </p>
            )}
            <button
              type="button"
              onClick={handleRegister}
              disabled={registering || !currentConfig}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium btn-primary"
            >
              {registering ? "Registering…" : "Register"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
