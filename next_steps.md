# Next Steps — Getting V2 Live on Solana Devnet

This document walks through every action required to go from the current
state of the codebase to a fully functional V2 deployment on Solana devnet.
Work through the phases in order — each phase unblocks the next.

---

## Phase 1 — V2 Circuit Trusted Setup

The V2 Circom circuit (`circuits/v2/stealth_reputation.circom`) uses a new
constraint system that is incompatible with the V1 proving/verification keys.
New keys must be generated before any on-chain verifier can be deployed.

### 1.1 Install tooling

```bash
npm install -g circom snarkjs
# Circom compiler (native binary — faster than npm)
curl -L https://github.com/iden3/circom/releases/latest/download/circom-linux-amd64 \
  -o /usr/local/bin/circom && chmod +x /usr/local/bin/circom
```

### 1.2 Add circomlib to the v2 circuit directory

```bash
cd circuits/v2
npm init -y
npm install circomlib
```

### 1.3 Compile the V2 circuit

```bash
circom stealth_reputation.circom --r1cs --wasm --sym -o build/
```

Check the constraint count — the existing `pot16_final.ptau` (2^16 ≈ 65k
constraints) must cover the new circuit:

```bash
snarkjs r1cs info build/stealth_reputation.r1cs
# Look for "# of Constraints". If > 65536, see §1.3a below.
```

**1.3a — If constraints exceed 2^16:** generate a larger ptau file:
```bash
snarkjs powersoftau new bn128 20 pot20_0000.ptau -v
snarkjs powersoftau contribute pot20_0000.ptau pot20_final.ptau \
  --name="Opaque V2 Phase1" -v -e="$(openssl rand -hex 32)"
snarkjs powersoftau prepare phase2 pot20_final.ptau pot20_prepared.ptau -v
# Then use pot20_prepared.ptau in place of pot16_final.ptau below.
```

### 1.4 Phase 2 setup (circuit-specific keys)

```bash
snarkjs groth16 setup \
  build/stealth_reputation.r1cs \
  ../../pot16_final.ptau \
  build/stealth_reputation_v2_0000.zkey

# Contribute entropy (at minimum one round; MPC ceremony recommended for mainnet)
snarkjs zkey contribute \
  build/stealth_reputation_v2_0000.zkey \
  build/stealth_reputation_v2_final.zkey \
  --name="Opaque V2 Contributor 1" \
  -e="$(openssl rand -hex 64)"
```

### 1.5 Export the verification key

```bash
snarkjs zkey export verificationkey \
  build/stealth_reputation_v2_final.zkey \
  build/verification_key_v2.json
```

### 1.6 Copy WASM + zkey to the frontend

```bash
mkdir -p ../frontend/public/circuits/v2
cp build/stealth_reputation_v2_js/stealth_reputation_v2.wasm \
   ../frontend/public/circuits/v2/stealth_reputation.wasm
cp build/stealth_reputation_v2_final.zkey \
   ../frontend/public/circuits/v2/stealth_reputation_final.zkey
```

### 1.7 Update VK_IC_V2 in the on-chain verifier

Open `build/verification_key_v2.json`. It contains `IC` as an array of
`[x, y]` decimal strings. Convert each to big-endian 32-byte arrays and
replace the placeholder values in
`programs/groth16-verifier/src/lib.rs` (`VK_IC_V2`).

Also replace `VK_ALPHA`, `VK_BETA`, `VK_GAMMA`, `VK_DELTA` if your ptau
file differs from the V1 setup. If you reused `pot16_final.ptau` for both
circuits these four constants stay the same.

A helper script to do this conversion:

```bash
node -e "
const vk = require('./circuits/v2/build/verification_key_v2.json');
vk.IC.forEach((pt, i) => {
  const x = BigInt(pt[0]).toString(16).padStart(64,'0');
  const y = BigInt(pt[1]).toString(16).padStart(64,'0');
  console.log('// IC' + i);
  console.log('[');
  for(let j=0;j<64;j+=2) process.stdout.write('0x'+x.slice(j,j+2)+',');
  console.log();
  for(let j=0;j<64;j+=2) process.stdout.write('0x'+y.slice(j,j+2)+',');
  console.log('\n],');
});
"
```

---

## Phase 2 — Build All Programs

### 2.1 Add V2 programs to Anchor.toml

```toml
# Anchor.toml — add to [programs.localnet] and [programs.devnet]
schema_registry     = "SCHreg1111111111111111111111111111111111111"
attestation_engine_v2 = "ATTv2111111111111111111111111111111111111111"
```

> The placeholder IDs above are invalid base58. In step 2.2 you will
> generate real keypairs and replace them everywhere.

### 2.2 Generate deploy keypairs for the two new programs

```bash
solana-keygen new -o target/deploy/schema_registry-keypair.json --no-bip39-passphrase
solana-keygen new -o target/deploy/attestation_engine_v2-keypair.json --no-bip39-passphrase

# Print the public keys — these become your program IDs
solana-keygen pubkey target/deploy/schema_registry-keypair.json
solana-keygen pubkey target/deploy/attestation_engine_v2-keypair.json
```

Replace every occurrence of the placeholder IDs with the real ones:
- `programs/schema-registry/src/lib.rs` → `declare_id!(...)`
- `programs/attestation-engine-v2/src/lib.rs` → `declare_id!(...)`
- `Anchor.toml` → `[programs.devnet]` and `[programs.localnet]`
- `frontend/src/lib/schema.ts` → `SCHEMA_REGISTRY_PROGRAM_ID` and
  `ATTESTATION_ENGINE_V2_PROGRAM_ID`

### 2.3 Compile

```bash
anchor build
# Produces .so files in target/deploy/ and IDLs in target/idl/
```

If you see `BPF SDK not found` errors, install the Solana toolchain:
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
```

---

## Phase 3 — Deploy to Devnet

### 3.1 Fund your deployer wallet

```bash
solana config set --url devnet
solana airdrop 5        # 5 SOL — enough for all program deployments
solana balance
```

Each program deployment costs roughly 2–3 SOL in rent. If you run short,
airdrop again (devnet limit is 2 SOL per request, retry a few times).

### 3.2 Deploy in dependency order

Deploy `schema_registry` first because `attestation_engine_v2` references
its account type at runtime.

```bash
# 1. Schema Registry (new)
anchor deploy --program-name schema_registry \
  --program-keypair target/deploy/schema_registry-keypair.json \
  --provider.cluster devnet

# 2. Attestation Engine V2 (new)
anchor deploy --program-name attestation_engine_v2 \
  --program-keypair target/deploy/attestation_engine_v2-keypair.json \
  --provider.cluster devnet

# 3. Groth16 Verifier (upgraded — already deployed, use upgrade)
anchor upgrade \
  target/deploy/groth16_verifier.so \
  --program-id 6mFaKyp7F4NqNeoiBLEWSqy5wJSk7rWf1EYumVXgHvhQ \
  --provider.cluster devnet
```

> For the groth16 verifier upgrade, you must be the upgrade authority
> (the wallet that originally deployed it). If you lost that keypair,
> deploy a fresh instance with a new keypair and update the ID everywhere.

### 3.3 Update deployed-addresses.json

```json
// frontend/src/contracts/deployed-addresses.json
{
  "cluster": "devnet",
  "registry": "E9LBRG5eP2kvuNfveouqQ9tA5P6nrpyLyWFjH9MFYVno",
  "announcer": "HGFn2fH7bVQ5cSuiG52NjzN9m11YrB3FZUfoN9b9A5jf",
  "groth16Verifier": "6mFaKyp7F4NqNeoiBLEWSqy5wJSk7rWf1EYumVXgHvhQ",
  "reputationVerifier": "BSnkCDoTpgNVN5BbF3aN5L5EJPiaYUkqqj9MHp8kaqWM",
  "schemaRegistry": "<schema_registry program ID>",
  "attestationEngineV2": "<attestation_engine_v2 program ID>",
  "deployedSlot": 0
}
```

Also update `frontend/src/contracts/config.ts` to expose the two new
program names (`SchemaRegistry`, `AttestationEngineV2`) through
`getProgramId()`.

### 3.4 Verify deployments are live

```bash
solana program show <schema_registry_id> --url devnet
solana program show <attestation_engine_v2_id> --url devnet
```

---

## Phase 4 — Wire Anchor IDL Clients into the Frontend

The frontend components (`SchemaStudio`, `AttestationManager`) currently
use stub functions that return mocked data. They need to call the real
programs.

### 4.1 Export IDLs and copy them to the frontend

```bash
# After anchor build, IDLs are in target/idl/
cp target/idl/schema_registry.json frontend/src/contracts/abis/
cp target/idl/attestation_engine_v2.json frontend/src/contracts/abis/
```

### 4.2 Install @coral-xyz/anchor in the frontend

```bash
cd frontend
npm install @coral-xyz/anchor
```

### 4.3 Create program client helpers

```typescript
// frontend/src/lib/programs.ts  (new file)
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import schemaRegistryIdl from "../contracts/abis/schema_registry.json";
import attestationEngineIdl from "../contracts/abis/attestation_engine_v2.json";
import { SCHEMA_REGISTRY_PROGRAM_ID, ATTESTATION_ENGINE_V2_PROGRAM_ID }
  from "./schema";

export function getSchemaRegistryProgram(provider: AnchorProvider) {
  return new Program(schemaRegistryIdl as any, provider);
}

export function getAttestationEngineProgram(provider: AnchorProvider) {
  return new Program(attestationEngineIdl as any, provider);
}
```

### 4.4 Replace stubs in SchemaStudio and AttestationManager

In `SchemaStudio.tsx`, replace the `handleSubmit` stub with a real call:

```typescript
// Replace the stub in handleSubmit:
const program = getSchemaRegistryProgram(provider);
const tx = await program.methods
  .registerSchema(
    Array.from(schemaIdBytes),   // schema_id: [u8; 32]
    name,
    fieldDefinitionsString,
    revocable,
    resolver ? new PublicKey(resolver) : null,
    new BN(expirySlot)
  )
  .accounts({
    schemaPda: schemaPda,
    authority: publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

In `AttestationManager.tsx`, replace the stub similarly using
`program.methods.attest(...)`.

### 4.5 Replace stubs in ProofGeneratorModal

Replace the mock proof with a real snarkjs call:

```typescript
import { groth16 } from "snarkjs";
// In handleGenerate():
const witness = await generateReputationWitnessV2WASM(...);
const { proof, publicSignals } = await groth16.fullProve(
  JSON.parse(witness),
  "/circuits/v2/stealth_reputation.wasm",
  "/circuits/v2/stealth_reputation_final.zkey"
);
```

---

## Phase 5 — Build and Deploy the WASM Scanner

### 5.1 Add sha2 to scanner Cargo.toml

The V2 scan code added `sha2` indirectly via attestation.rs. Add it
explicitly if `cargo check` in the scanner crate reports it missing:

```toml
# scanner/Cargo.toml
sha2 = "0.10"
```

### 5.2 Build the WASM package

```bash
cd scanner
wasm-pack build --target web --out-dir ../frontend/src/wasm
```

This generates `../frontend/src/wasm/cryptography.js` and
`cryptography_bg.wasm`. The existing `useOpaqueWasm.ts` hook loads this
package — it should pick up the new V2 exports automatically.

### 5.3 Confirm V2 exports are visible

After the build, check that the new functions appear in the generated JS:

```bash
grep -E "scan_attestations_v2|generate_reputation_witness_v2|encode_v2" \
  frontend/src/wasm/cryptography.js
```

---

## Phase 6 — Run an End-to-End Devnet Test

Work through this flow manually to confirm every piece is connected.

### 6.1 Register a test schema

1. Open the frontend (`npm run dev`), connect your wallet (devnet).
2. Navigate to **Schema Studio** (menu → Schema Studio).
3. Create a schema named `"Test Badge"`, add one field: `bool passed`.
4. Leave revocable on, no resolver, no expiry.
5. Submit. Confirm the transaction on devnet.
6. Verify on-chain:
   ```bash
   solana account <schema_pda_address> --url devnet
   ```

### 6.2 Issue a test attestation

1. Navigate to **Issue Attestation**.
2. Select the `Test Badge` schema.
3. Paste any 32-byte hash for the stealth address (or use
   `0x` + `aa` × 32 for testing).
4. Set `passed = true`.
5. Submit and confirm.
6. Verify on-chain:
   ```bash
   solana account <attestation_pda_address> --url devnet
   ```

### 6.3 Make an announcement with V2 metadata

Use the existing `announce` or `announce_with_log` instruction, but
encode the metadata using `encode_v2_attestation_metadata_wasm`:

```typescript
const metadata = encode_v2_attestation_metadata_wasm(
  viewTag,
  schemaIdHex,     // 32 bytes
  issuerHex,       // 32 bytes
  attestationUidHex, // 32 bytes
  nonceHex         // 32 bytes
);
// Pass metadata to stealth_announcer.announce(...)
```

### 6.4 Scan and discover the trait

1. Navigate to **My Traits** and click **Rescan**.
2. The scanner should call `scan_attestations_v2_wasm` with the schema
   registry snapshot and find the announcement.
3. Confirm the trait appears with status **Active** and issuer authorized.

### 6.5 Generate a ZK proof

1. Click **Generate ZK Proof** on the discovered trait.
2. Enter any decimal string as the external nullifier (e.g. `"12345"`).
3. Wait for the in-browser Groth16 prover to finish (10–60 seconds).
4. Click **Submit On-Chain** to call `groth16_verifier.verify_proof_v2`.
5. Verify the nullifier PDA was created on devnet:
   ```bash
   solana account <nullifier_pda_address> --url devnet
   ```

---

## Phase 7 — Devnet Smoke Tests

Write Anchor integration tests for the two new programs. Place them in
`tests/` alongside the existing test files.

### schema_registry.test.ts (key cases)
```
✓ register_schema creates PDA with correct seeds and data
✓ register_schema rejects duplicate schema_id for same authority
✓ add_delegate: only authority succeeds; third party fails
✓ remove_delegate: removes existing delegate; fails for unknown delegate
✓ deprecate_schema: blocks new attestations after calling
✓ expired schema (schema_expiry_slot in the past): blocks new attestations
```

### attestation_engine_v2.test.ts (key cases)
```
✓ attest succeeds when caller is schema authority
✓ attest succeeds when caller is a delegate
✓ attest fails when caller is a random third party  ← core V2 invariant
✓ attest against deprecated schema fails
✓ revoke sets revocation_slot without deleting data
✓ revoke fails for non-authority caller
✓ revoke fails for non-revocable schema
✓ second revoke on already-revoked attestation fails
```

Run against devnet:
```bash
anchor test --provider.cluster devnet
```

---

## Phase 8 — Frontend Config Cleanup

Once all program IDs are final, clean up the placeholder values that
were used during development:

| File | Change |
|------|--------|
| `frontend/src/lib/schema.ts` | Replace `SCHreg111…` and `ATTv2111…` with real IDs |
| `frontend/src/contracts/deployed-addresses.json` | Add `schemaRegistry` and `attestationEngineV2` |
| `frontend/src/contracts/config.ts` | Add `SchemaRegistry` and `AttestationEngineV2` to `OpaqueProgramName` |
| `Anchor.toml` | Replace placeholder IDs in `[programs.devnet]` |

---

## Phase 9 — V1 Migration Notice

During the devnet rollout, communicate the V1 → V2 transition to anyone
testing with V1 attestations:

1. **Both scanners run in parallel.** The `scan_attestations_v2_wasm`
   export handles V2 announcements (0xB2 marker); the existing
   `scan_attestations_wasm` continues to handle V1. The **My Traits**
   view already separates them into two sections.

2. **New attestations require a schema.** Calls to the old
   `reputation_verifier` program still work for V1 nullifiers during the
   transition window.

3. **No V1 proof can satisfy the V2 verifier.** The circuits produce
   different nullifier hashes because the inputs changed. This is
   intentional.

4. **Set a sunset slot** in Anchor.toml once V2 has been stable on devnet
   for 2–4 weeks. After that slot, stop accepting V1 announcements in the
   scanner.

---

## Quick Reference — Command Cheatsheet

```bash
# Circuit
circom circuits/v2/stealth_reputation.circom --r1cs --wasm --sym -o circuits/v2/build/
snarkjs r1cs info circuits/v2/build/stealth_reputation.r1cs
snarkjs groth16 setup circuits/v2/build/stealth_reputation.r1cs pot16_final.ptau circuits/v2/build/v2_0000.zkey
snarkjs zkey contribute circuits/v2/build/v2_0000.zkey circuits/v2/build/v2_final.zkey -e="$(openssl rand -hex 64)"
snarkjs zkey export verificationkey circuits/v2/build/v2_final.zkey circuits/v2/build/vk_v2.json

# Programs
anchor build
anchor deploy --program-name schema_registry --provider.cluster devnet
anchor deploy --program-name attestation_engine_v2 --provider.cluster devnet
anchor upgrade target/deploy/groth16_verifier.so --program-id 6mFaKyp7F4NqNeoiBLEWSqy5wJSk7rWf1EYumVXgHvhQ --provider.cluster devnet

# Scanner WASM
cd scanner && wasm-pack build --target web --out-dir ../frontend/src/wasm

# Frontend
cd frontend && npm run dev        # local dev
cd frontend && npm run build      # production build

# Tests
anchor test --provider.cluster devnet
```

---

## Estimated Effort

| Phase | Work | Rough Estimate |
|-------|------|----------------|
| 1 — Trusted setup | Circuit compile + key generation | 2–4 hours |
| 2 — Build programs | anchor build + keypair generation | 30 min |
| 3 — Deploy | anchor deploy × 3 + config updates | 1 hour |
| 4 — Wire IDL clients | Replace stubs with real Anchor calls | 1–2 days |
| 5 — WASM scanner | wasm-pack build + integration test | 2 hours |
| 6 — E2E manual test | Full flow on devnet | 2–3 hours |
| 7 — Anchor tests | Write + run integration test suite | 1–2 days |
| 8 — Config cleanup | Update IDs everywhere | 1 hour |
| **Total** | | **~5–8 days** |

The largest chunks are writing the Anchor integration tests (Phase 7) and
wiring the real Anchor IDL calls into the frontend (Phase 4). Everything
else is mostly configuration and running commands.
