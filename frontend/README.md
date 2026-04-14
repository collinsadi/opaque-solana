# Frontend — Opaque Wallet UI

Reference wallet application for the Opaque protocol. Built with React, TypeScript, Vite, and Tailwind CSS. Connects to Solana via wallet adapters (Phantom, Solflare) and runs stealth address cryptography and ZK proof generation entirely in the browser.

## Features

| View | Description |
|:-----|:------------|
| **Landing / Setup** | Wallet connection and stealth key derivation (keys are derived from a wallet signature via HKDF-SHA256) |
| **Registration Wizard** | Guides the user through registering their stealth meta-address on-chain via the Registry program |
| **Dashboard** | Overview of wallet balance and quick-action navigation |
| **Send** | Derive a one-time stealth address for a recipient and send SOL — announces on-chain for scanner discovery |
| **Receive** | Share your stealth meta-address (QR code or copyable text), or generate ghost addresses for offline use |
| **Private Balance** | Scan on-chain announcements via WASM to discover incoming stealth transfers, then sweep funds to your main wallet |
| **Reputation Dashboard** | View discovered traits, issue attestations to others, generate Groth16 ZK proofs, and submit on-chain verification |
| **Transaction History** | Locally tracked history of stealth sends, receives, and sweeps |
| **Profile** | View your stealth meta-address, registered pubkey, and manage settings |

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite 7** — Build tool with WASM plugin support
- **Tailwind CSS 4** — Styling
- **Zustand** — Lightweight state management (vault store, ghost address store, reputation store, tx history)
- **@solana/web3.js** + **@coral-xyz/anchor** — Solana RPC and program interaction
- **@solana/wallet-adapter** — Phantom, Solflare wallet connectors
- **@noble/curves** + **@noble/hashes** — secp256k1 DKSAP cryptography (stealth address derivation)
- **snarkjs** — In-browser Groth16 proof generation
- **circomlibjs** — Poseidon hashing for witness preparation
- **WASM scanner** — Rust-compiled WebAssembly module for high-performance announcement scanning
- **Framer Motion** — Animations
- **driver.js** — Onboarding tour
- **qrcode.react** — QR code generation for receive addresses
- **Zod** — Runtime schema validation for scanner output

## Getting Started

### Prerequisites

- Node.js 18+
- A Solana wallet browser extension (Phantom or Solflare)

### Install & Run

```bash
npm install
npm run dev
```

The app starts at `http://localhost:5173`.

### Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
VITE_SOLANA_CLUSTER=devnet
```

You can optionally set a custom RPC endpoint:

```env
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── App.tsx                    # Root app with routing and layout
├── main.tsx                   # Entry point
├── polyfills.ts               # Buffer polyfill for browser
├── components/                # All UI views and modals
│   ├── DashboardView.tsx
│   ├── SendView.tsx
│   ├── ReceiveView.tsx
│   ├── PrivateBalanceView.tsx  # Announcement scanning + sweep
│   ├── ReputationDashboardView.tsx
│   ├── RegistrationWizard.tsx
│   ├── ProveTraitModal.tsx     # ZK proof generation UI
│   ├── IssueTraitModal.tsx     # Attestation issuance UI
│   ├── ClaimModal.tsx
│   ├── GhostAnnounceModal.tsx
│   └── ...
├── context/
│   ├── KeysContext.tsx         # Stealth key derivation + storage
│   ├── ProtocolLogContext.tsx   # Step-by-step protocol logging
│   ├── SolanaWalletProviders.tsx
│   └── ToastContext.tsx
├── contracts/
│   ├── config.ts               # Program ID resolution
│   ├── deployedAddresses.ts    # Devnet program IDs
│   ├── contract-config.ts      # Cluster-aware config
│   └── deployed-addresses.json
├── hooks/
│   ├── useWallet.ts            # Wallet adapter wrapper
│   ├── useOpaqueWasm.ts        # WASM scanner module loader
│   ├── useScanner.ts           # Announcement scanning hook
│   ├── useRegistrationStatus.ts
│   └── useWatchlist.ts
├── lib/
│   ├── stealth.ts              # DKSAP cryptography (TypeScript)
│   ├── reputation.ts           # Trait definitions + proof types
│   ├── stealthLifecycle.ts     # Send/receive/sweep orchestration
│   ├── tokens.ts               # Token configuration (SOL)
│   ├── chain.ts                # RPC + cluster utilities
│   ├── explorer.ts             # Solana Explorer URL helpers
│   ├── opaqueCache.ts          # IndexedDB announcement cache
│   └── onboardingTour.ts       # First-time user tour
├── store/
│   ├── vaultStore.ts           # Encrypted key vault
│   ├── ghostAddressStore.ts    # Offline ghost address management
│   ├── reputationStore.ts      # Discovered traits + proof state
│   ├── txHistoryStore.ts       # Transaction history
│   └── ghostAnnouncementStore.ts
├── types/                      # Shared TypeScript types
└── wasm.d.ts                   # WASM module type declarations
```

## Key Flows

### Stealth Send

1. User enters a recipient meta-address or registered Solana pubkey.
2. `stealth.ts` derives a one-time stealth address using DKSAP (ephemeral key + ECDH + Keccak).
3. A Solana transfer sends SOL to the derived stealth Solana address.
4. The `StealthAddressAnnouncer` program is called with the ephemeral pubkey, view tag, and optional attestation metadata.

### Private Balance Scan

1. `useScanner` fetches announcement logs from the Announcer program.
2. The WASM scanner (`useOpaqueWasm`) performs view-tag pre-filtering, then full EC derivation for candidates.
3. Matching stealth addresses are displayed with their balances.
4. User can sweep funds by reconstructing the one-time stealth private key and signing a transfer.

### ZK Reputation Proof

1. `ProveTraitModal` prepares the witness from discovered attestations (stealth key, Merkle path, attestation ID).
2. snarkjs generates a Groth16 proof in-browser using the circuit WASM and zkey.
3. The proof is submitted to the `OpaqueReputationVerifier` program, which CPI-calls the `Groth16Verifier`.
4. On success, the nullifier is consumed on-chain and a `ReputationVerified` event is emitted.
