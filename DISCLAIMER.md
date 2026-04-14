# Disclaimer

## Experimental Software

Opaque is **experimental, unaudited software** provided on an "as-is" basis. It has **not** undergone a formal security audit. Use it at your own risk.

## No Guarantees of Privacy

While the protocol is designed to provide unlinkable receive addresses and selective disclosure of reputation, **no privacy system is perfect**. Specific risks include:

- **Metadata leakage.** On-chain transactions carry timing, amount, and fee-payer information that sophisticated observers may use for statistical linkage analysis, even when stealth addresses are used correctly.
- **Local data loss.** Ghost addresses (offline stealth addresses generated without on-chain announcements) rely entirely on local device storage. If local data is lost, those funds may become **permanently inaccessible**. There is no recovery mechanism from chain state for ghost addresses.
- **Scanner limitations.** The WASM scanner runs in-browser and depends on complete announcement data from the RPC endpoint or indexer. Missed or delayed announcements may cause stealth transfers to go undetected until a rescan is performed.
- **View-tag false positives.** View tags reduce scanning cost but do not eliminate it. Approximately 1 in 256 announcements will pass the view-tag filter even if they are not intended for you, requiring a full EC derivation to confirm or reject.

## Cryptographic Assumptions

The protocol's security relies on:

- The **hardness of the Elliptic Curve Discrete Logarithm Problem (ECDLP)** on secp256k1.
- The **soundness of the Groth16 proof system** under the BN254 (alt_bn128) curve, which requires a trusted setup ceremony. The ceremony artifacts included in this repository are for development and testing only.
- The **collision resistance of Keccak-256** and **Poseidon hash** functions.

If any of these assumptions are broken, the privacy and integrity guarantees of the protocol may be compromised.

## Trusted Setup

The Groth16 ZK-SNARK system used for Programmable Stealth Reputation (PSR) requires a **trusted setup**. The Powers of Tau ceremony files and zkey contributions included in this repository are intended for **development and testing purposes only**. A production deployment should conduct a properly audited, multi-party trusted setup ceremony.

## Smart Contract Risks

The Anchor programs deployed on Solana Devnet have **not been formally verified**. Potential risks include:

- **Logic bugs** that could allow unauthorized access to funds or state.
- **Merkle root management** is currently admin-controlled. A compromised admin key could submit invalid roots, enabling fraudulent proofs.
- **Nullifier exhaustion** — the on-chain nullifier registry grows indefinitely. In a production system, garbage collection or state compression would be necessary.
- **Program upgradability** — unless the programs are made immutable after deployment, the upgrade authority could alter program logic.

## Not Financial Advice

Nothing in this repository constitutes financial, legal, or tax advice. Do not use this protocol for activities that violate applicable laws in your jurisdiction. Stealth address technology may be subject to regulatory requirements depending on your location.

## Testnet Only

The current deployment targets **Solana Devnet**. Devnet tokens have no monetary value. Do not send real funds (mainnet SOL or tokens) to addresses or programs associated with this deployment.

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

By using this software, you acknowledge that you have read, understood, and accepted the risks described above.
