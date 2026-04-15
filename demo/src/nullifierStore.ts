/**
 * Nullifier Store — localStorage-backed set of consumed nullifier hashes.
 *
 * In production replace this with an on-chain nullifier registry (e.g. the
 * Groth16 Verifier program's verify_proof_v2 instruction already enforces
 * uniqueness on-chain when called with the Solana wallet path).
 *
 * For this standalone demo we persist nullifiers in localStorage so that:
 *   1. The same proof cannot be used twice in the same browser.
 *   2. The check survives page reloads.
 */

import { DEMO_CONFIG } from "./config";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(DEMO_CONFIG.NULLIFIER_STORE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function save(set: Set<string>): void {
  localStorage.setItem(
    DEMO_CONFIG.NULLIFIER_STORE_KEY,
    JSON.stringify(Array.from(set))
  );
}

/** Returns true if this nullifierHash has already been consumed. */
export function isNullifierUsed(nullifierHash: string): boolean {
  return load().has(nullifierHash.toLowerCase());
}

/** Mark a nullifierHash as consumed. */
export function consumeNullifier(nullifierHash: string): void {
  const set = load();
  set.add(nullifierHash.toLowerCase());
  save(set);
}
