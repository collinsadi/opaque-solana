# Opaque Cash — Cryptography (Scanner Engine)

A **high-performance Rust library** that implements the **Scanner Engine** for **Opaque Cash**, a stealth-address wallet based on [EIP-5564](https://eips.ethereum.org/EIPS/eip-5564). It lets recipients **derive stealth addresses** from on-chain announcements and **efficiently filter** those announcements using **view tags** before doing expensive elliptic-curve work.

---

## Table of contents

- [What is this?](#what-is-this)
- [Concepts you need](#concepts-you-need)
- [What this codebase does](#what-this-codebase-does)
- [Project layout](#project-layout)
- [Dependencies](#dependencies)
- [Public API](#public-api)
- [How to use it](#how-to-use-it)
- [The math (DKSAP)](#the-math-dksap)
- [View-tag optimization](#view-tag-optimization)
- [Building and testing](#building-and-testing)
- [Integration notes](#integration-notes)
- [Errors and edge cases](#errors-and-edge-cases)

---

## What is this?

**Opaque Cash** is a stealth-address wallet: senders can send assets to a **one-time stealth address** that only the intended recipient can discover and spend from. Observers cannot link that address to the recipient’s long-term identity.

This crate is the **cryptography layer** for the **recipient side**:

1. **Derive** the stealth address (and view tag) from your keys and the data in each announcement.
2. **Filter** announcements quickly using the 1-byte view tag, so you only run full derivation when the tag matches (~1/256 of the time).

It does **not** handle network, RPC, or event parsing; it only does the EIP-5564 / DKSAP math and filtering. You feed it keys and announcement data (stealth address, view tag, ephemeral public key) and get back “is this for me?” and, when needed, the derived stealth address.

---

## Concepts you need

| Term | Meaning |
|------|--------|
| **Stealth address** | A one-time Ethereum address. The sender derives it; only the recipient can recognise it and derive the matching private key. |
| **Stealth meta-address** | What the recipient publishes: two public keys — **view** and **spend**. Format is often `st:eth:0x<spend_pubkey><view_pubkey>`. |
| **View key** | A private key (`p_view`) and its public key (`P_view`). Used to **detect** that a stealth transfer is for you (scanning). Sender uses `P_view` to compute a shared secret. |
| **Spend key** | A private key (`p_spend`) and its public key (`P_spend`). Used to **spend** from the stealth address. The stealth address is derived from `P_spend` plus a point derived from the shared secret. |
| **Announcement** | On-chain event (e.g. from the EIP-5564 announcer contract) that contains: **stealth address**, **ephemeral public key** `P_ephemeral`, and **metadata** whose first byte is the **view tag**. |
| **Ephemeral key** | One-time key pair used by the sender. The sender keeps `p_ephemeral` secret and publishes `P_ephemeral` in the announcement. Recipient uses `p_view` and `P_ephemeral` to get the same shared secret. |
| **View tag** | One byte (first byte of the hashed shared secret). Used to quickly reject announcements that are not for you (~255/256), without doing full EC math. |
| **DKSAP** | Dual-Key Stealth Address Protocol: the scheme that combines view key, spend key, and ephemeral key to derive a stealth address (EIP-5564 scheme id 1). |

---

## What this codebase does

- **Data structures:** Defines a **stealth meta-address** type (view + spend public keys).
- **Derivation:** Implements **derive_stealth_address**: from your view private key, spend public key, and the announcement’s ephemeral public key, it returns the stealth address and view tag (EIP-5564 steps 1–6).
- **Filtering:** Implements **check_announcement_view_tag** (view-tag-only) and **check_announcement** (view-tag then full derivation + address comparison). You use these to decide “is this announcement for me?”.
- **Compatibility:** Uses **secp256k1** (k256), **Keccak-256** (sha3), and **Ethereum-style addresses** (alloy-primitives), matching EIP-5564’s specified scheme.

It does **not**:

- Generate or parse on-chain events.
- Implement sender-side “generate stealth address from meta-address” (that’s the sender’s job).
- Derive the **stealth private key** (that’s `p_stealth = p_spend + s_h`; you can add that in a higher-level wallet layer using the same `s_h` logic).

---

## Project layout

```
cryptography/
├── Cargo.toml          # Package and dependencies
├── README.md           # This file
└── src/
    ├── main.rs         # Binary entry; only declares the scanner module
    └── scanner.rs      # Scanner engine: types, derivation, and filtering
```

All public API lives in **`scanner`**. Use the crate as a **library** and call into `scanner` from your app or wallet.

---

## Dependencies

| Crate | Role |
|-------|------|
| **k256** | secp256k1: key types, ECDH-style shared secret, scalar multiplication, point addition. Features: `ecdh`, `arithmetic`. |
| **sha3** | Keccak-256 for hashing the shared secret (EIP-5564). |
| **alloy-primitives** | Ethereum `Address` type for stealth addresses. |

No ethers/alloy RPC or provider; this crate is crypto-only.

---

## Public API

### Types

- **`StealthMetaAddress`**  
  - Fields: `view_pubkey`, `spend_pubkey` (both `k256::PublicKey`).  
  - Constructor: `StealthMetaAddress::new(view_pubkey, spend_pubkey)`.

- **`ViewTagCheck`**  
  - `NoMatch` — view tag differs; skip this announcement.  
  - `PossibleMatch` — view tag matches; run full derivation and compare addresses.

- **`StealthAddressError`**  
  - `InvalidScalar` — hashed shared secret not in curve order.  
  - `InvalidPoint` — invalid point (e.g. at infinity) when computing stealth public key.

### Functions

- **`derive_stealth_address(view_privkey, spend_pubkey, ephemeral_pubkey)`**  
  - Returns: `Result<(Address, u8), StealthAddressError>`.  
  - The `Address` is the stealth address; the `u8` is the view tag.  
  - Uses: recipient’s **view private key** (e.g. `k256::ecdsa::SigningKey`), recipient’s **spend public key**, and the announcement’s **ephemeral public key**.

- **`check_announcement_view_tag(view_tag, view_privkey, ephemeral_pubkey)`**  
  - Returns: `ViewTagCheck`.  
  - Cheap: one ECDH + one Keccak-256. Use this first; only call `derive_stealth_address` when you get `PossibleMatch`.

- **`check_announcement(announcement_stealth_address, view_tag, view_privkey, spend_pubkey, ephemeral_pubkey)`**  
  - Returns: `Result<bool, StealthAddressError>`.  
  - `true` iff the announcement’s stealth address is the one derived for this recipient. Internally uses the view-tag fast path, then full derivation.

- **`view_tag_from_hashed_secret(secret_hash)`**  
  - Returns the view tag (first byte) from a 32-byte hashed shared secret. Mainly for tests or if you already have `s_h`.

Key types in use:

- **View/spend keys:** `k256::ecdsa::SigningKey` for private keys, `k256::PublicKey` for public keys (e.g. from `PublicKey::from(signing_key.verifying_key())`).
- **Address:** `alloy_primitives::Address` (e.g. from event logs or your RPC layer).

---

## How to use it

### As a library

In your `Cargo.toml`:

```toml
[dependencies]
cryptography = { path = "../cryptography" }
```

Then:

```rust
use cryptography::scanner::{
    check_announcement,
    check_announcement_view_tag,
    derive_stealth_address,
    StealthMetaAddress,
    ViewTagCheck,
};
use alloy_primitives::Address;
use k256::{ecdsa::SigningKey, PublicKey};
```

### Typical scanner loop (recipient)

You have:

- Your **view private key** and **spend public key** (and optionally spend private key for spending).
- A stream of **announcements** from the chain (e.g. EIP-5564 `Announcement` events), each with:
  - `stealth_address: Address`
  - `ephemeral_pubkey: bytes` (decode to `PublicKey`)
  - `metadata[0]` = **view_tag: u8**

For each announcement:

1. Decode `ephemeral_pubkey` into a `k256::PublicKey`.
2. (Optional but recommended) Call **`check_announcement_view_tag(view_tag, view_privkey, ephemeral_pubkey)`**.  
   - If `ViewTagCheck::NoMatch`, skip this announcement.  
   - If `PossibleMatch`, continue.
3. Call **`check_announcement(stealth_address, view_tag, view_privkey, spend_pubkey, ephemeral_pubkey)`**.  
   - If `Ok(true)`, this transfer is for you; you can then derive the stealth private key (e.g. `p_stealth = p_spend + s_h`) in your wallet layer and spend.  
   - If `Ok(false)`, not for you (rare after view-tag match).  
   - If `Err(...)`, handle invalid scalar/point (see [Errors](#errors-and-edge-cases)).

### One-off derivation

If you already know an announcement is for you and only need the stealth address and view tag:

```rust
let (stealth_address, view_tag) = derive_stealth_address(
    &view_privkey,
    &spend_pubkey,
    &ephemeral_pubkey,
)?;
// Compare stealth_address with the announcement if needed
```

### Building a StealthMetaAddress

When you want to give someone your “receive” identity (e.g. for a registry or QR code), you build the meta-address from your two public keys:

```rust
let view_pubkey = PublicKey::from(view_privkey.verifying_key());
let spend_pubkey = PublicKey::from(spend_privkey.verifying_key());
let meta = StealthMetaAddress::new(view_pubkey, spend_pubkey);
// Publish meta.view_pubkey and meta.spend_pubkey (e.g. st:eth:0x...)
```

---

## The math (DKSAP)

EIP-5564 (scheme id 1) uses the following steps. This crate implements the **recipient side** (same math as the spec’s “Parsing” and “Private key derivation”).

1. **Shared secret**  
   \(s = p_{\text{view}} \cdot P_{\text{ephemeral}}\)  
   (scalar × point; we use the compressed encoding of the resulting point as the 33-byte “shared secret” for hashing.)

2. **Hash**  
   \(s_h = \text{Keccak256}(s)\)  
   (32 bytes.)

3. **View tag**  
   \(v = s_h[0]\)  
   (one byte, used to filter announcements.)

4. **Point from hash**  
   \(S_h = s_h \cdot G\)  
   (interpret \(s_h\) as scalar mod curve order; multiply by generator \(G\).)

5. **Stealth public key**  
   \(P_{\text{stealth}} = P_{\text{spend}} + S_h\)  
   (point addition.)

6. **Stealth address**  
   \(\text{address} = \text{keccak256}(\text{uncompressed}(P_{\text{stealth}}))[12..32]\)  
   (standard Ethereum address from uncompressed 64-byte xy, then last 20 bytes.)

Stealth private key (not computed in this crate):  
\(p_{\text{stealth}} = p_{\text{spend}} + s_h\) (mod curve order).

---

## View-tag optimization

Without view tags, for **every** announcement you would do: ECDH + hash + scalar mult + point add + address hash. With view tags:

- You do **ECDH + hash** and compare one byte.  
- Only when the view tag matches (~1/256 of announcements) do you do the rest (scalar mult, point add, address).

So most announcements are rejected with **one ECDH and one Keccak-256**, which greatly reduces CPU when scanning many events. Always use **`check_announcement_view_tag`** (or **`check_announcement`**, which uses it internally) instead of calling **`derive_stealth_address`** for every announcement.

---

## Building and testing

**Prerequisites:** Rust (e.g. `rustup`).

```bash
# Build
cargo build

# Run the binary (only prints a short message)
cargo run

# Run tests (round-trip derivation, view-tag filter, determinism)
cargo test
```

Tests include:

- **round_trip_derive_and_check** — Sender derives stealth address; scanner confirms via `check_announcement`.
- **wrong_view_tag_rejects** — Wrong view tag yields `false` without matching.
- **scanner_derive_matches_sender** — `derive_stealth_address` is deterministic for the same inputs.

---

## Integration notes

- **Where announcements come from:** This crate does not fetch events. You typically:
  - Subscribe to or query the EIP-5564 announcer contract (e.g. `0x5564…5564`) for `Announcement(schemeId, stealthAddress, caller, ephemeralPubKey, metadata)`.
  - Decode `metadata[0]` as view tag, `ephemeralPubKey` as 33-byte compressed or 65-byte uncompressed secp256k1 public key, and `stealthAddress` as `Address`.

- **Key encoding:** Keys are `k256` types. Serialise/deserialise with `SigningKey::from_bytes`, `to_bytes`, and `PublicKey::from_sec1_bytes` / `to_encoded_point` as needed. Stealth meta-address format (e.g. `st:eth:0x...`) is defined by EIP-5564; this crate only cares about the two public keys.

- **Address type:** We use `alloy_primitives::Address`. If your stack uses another address type (e.g. from `ethers`), convert to/from bytes (`.0` or `as_slice()`) at the boundary.

---

## Errors and edge cases

- **`StealthAddressError::InvalidScalar`**  
  The 32-byte Keccak-256 output, when interpreted as a scalar mod the curve order, was invalid (e.g. ≥ order). Very rare in practice; you can skip the announcement or log and continue.

- **`StealthAddressError::InvalidPoint`**  
  The computed stealth public key ended up at infinity. Also very rare; same handling as above.

- **View tag collision**  
  About 1/256 of announcements will pass the view-tag check for a given recipient even when not for them. That’s why **`check_announcement`** does a full derivation and address comparison after the view-tag check.

---

## Summary

| You want to… | Use |
|--------------|-----|
| Derive the stealth address for one announcement | `derive_stealth_address(view_privkey, spend_pubkey, ephemeral_pubkey)` |
| Quickly filter announcements by view tag | `check_announcement_view_tag(view_tag, view_privkey, ephemeral_pubkey)` |
| Fully check “is this announcement for me?” | `check_announcement(stealth_address, view_tag, view_privkey, spend_pubkey, ephemeral_pubkey)` |
| Represent your public receive identity | `StealthMetaAddress::new(view_pubkey, spend_pubkey)` |

This crate is the cryptographic core for the Opaque Cash scanner: it implements EIP-5564 DKSAP derivation and view-tag filtering so your wallet or indexer can efficiently discover incoming stealth transfers.
