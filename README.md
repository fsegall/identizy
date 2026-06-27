# Identizy — Anonymous Credentials on Stellar

> **"Prove who you are, once. Be anyone, everywhere."**

A zero-knowledge identity system on Stellar that lets users verify their age with real documents **once** and receive a cryptographically address-bound credential — usable anonymously across any third-party service, forever.

**Hackathon:** [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) · Deadline: June 29, 2026

---

## Live Demo — Stellar Mainnet ✅

> The full end-to-end flow is **live in production** as of June 27, 2026.

**Try it:** https://identizy.lovable.app

### Mainnet (Public Network)

| | |
|---|---|
| **App** | https://identizy.lovable.app |
| **Contract** | `CBPG3KIS6NEGWANQFEKWKFYFENECUWG4KLJZ7KN25SCPKODHFO33MMTY` |
| **Explorer** | https://stellar.expert/explorer/public/contract/CBPG3KIS6NEGWANQFEKWKFYFENECUWG4KLJZ7KN25SCPKODHFO33MMTY |
| **Production tx (June 27)** | https://stellar.expert/explorer/public/tx/91c3a617620fb76e02197ca4cbe053fd4c5d9527eaa2562cdf593d677370d591 |
| **First proof tx (June 24)** | https://stellar.expert/explorer/public/tx/0d8687d641401ed1bbc98df2cb6fab67c02abeb6bd5fa4762774afba3ac2b207 |
| **Network** | Stellar Mainnet (Protocol 25 "X-Ray") |

### Testnet

| | |
|---|---|
| **Contract** | `CBY4RHLTT6CWB5K7M6IEMCI2BUVWAYAHOUS2XUG5HH2PDMDM77FIWFER` |
| **Explorer** | https://stellar.expert/explorer/testnet/contract/CBY4RHLTT6CWB5K7M6IEMCI2BUVWAYAHOUS2XUG5HH2PDMDM77FIWFER |
| **Proof tx** | https://stellar.expert/explorer/testnet/tx/c4db0d131a3d4a416087c6e0571f7cd0724be32e49f70feae8e295969e9bce76 |
| **Network** | Stellar Testnet (Protocol 25 "X-Ray") |

**What the proof transaction shows on-chain:**
- `a`, `b`, `c` — Groth16 proof (BN254 curve points, EIP-196/197 encoding)
- `[1u256, 20524…u256, 7946…u256]` — public signals: `isOldEnough=1`, `commitment`, `addressHash`
- `→ true` — Soroban contract verified the ZK proof and issued the credential

📹 **Demo video — coming June 28**

---

## The Problem

Every time you need to prove you're over 18 — to buy alcohol, access adult content, open a trading account, enter a venue — you hand over your passport, driver's license, or credit card to a company you may never trust again. That data is stored, breached, and sold. You've handed your identity to dozens of strangers.

**KYC is broken by design.** It's invasive, repetitive, and creates honeypots of sensitive data that get breached.

---

## The Solution

**One real KYC. Infinite anonymous proofs.**

Identizy lets users:

1. **Verify once** — upload a real ID document on our platform. We verify it, extract your birthdate, and sign an attestation tied to your Stellar address.
2. **Mint a credential** — your browser generates a ZK proof that you're ≥ 18 *and* that the proof belongs to your specific address. You mint a soulbound, address-bound credential on Stellar — no personal data on-chain.
3. **Use it everywhere** — any third-party site checks: "does this address hold a valid Identizy?" Stellar says yes. No document, no birthdate, no identity revealed.

The credential is:
- **Address-bound** — cryptographically tied to your Stellar address via ZK proof; useless if transferred
- **Soulbound** — non-transferable at the contract level (double protection)
- **Privacy-preserving** — the on-chain token contains zero personal information
- **Issuer-anchored** — only our signed attestations generate valid proofs; you can't fake it with a false birthdate

---

## Who Is Who (W3C Verifiable Credentials Model)

Identizy follows the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) trust triangle.

---

### Issuer — Identizy Platform (us)

> *"We checked the document. We vouch for this address."*

**What the Issuer does:**
1. Receives the user's ID document + selfie
2. Verifies authenticity (liveness check, document validity)
3. Extracts the real `birthDate` from the document
4. Receives the user's Stellar address (after the user proves they control it by signing a nonce)
5. Computes `commitment = Poseidon(birthDate, stellarAddress)`
6. Signs the commitment with the Issuer's Ed25519 private key: `issuerSig = sign(commitment)`
7. Returns `issuerSig` to the user — this is the **KYC attestation seal**

---

### Holder — The End User

> *"I have the attestation. I'll prove what I need, nothing more."*

**What the Holder does to mint their credential:**
1. In the browser, runs the ZK circuit with their private data:
   - Inputs: `birthDate`, `minAge=18`, `currentDate`, `addressHash`
   - Outputs: `isOldEnough=1`, `commitment=Poseidon(birthDate, addressHash)`
2. Sends to Soroban contract:
   - The ZK proof (mathematical evidence of the above)
   - The `issuerSig` (the KYC seal from the Issuer)
3. Contract verifies both → mints a soulbound credential to the holder's address

**What the credential does NOT reveal:**
- Real name, date of birth, document number
- Which document was used or when KYC happened
- Which services the holder has accessed

---

### Verifier — Third-Party Sites and Services

> *"I don't need to know who you are. I just need to know you're verified."*

**Integration — 3 lines of code:**
```javascript
import { Contract, rpc } from "@stellar/stellar-sdk";
const contract = new Contract("CBY4RHLTT6CWB5K7M6IEMCI2BUVWAYAHOUS2XUG5HH2PDMDM77FIWFER");
const hasIt = await contract.call("has_credential", addressHashBytes);
```

No Identizy account. No Identizy API key. No Identizy server. Just Stellar.

> `has_credential` is a **Soroban smart contract function**, not an Identizy API. The Verifier calls the blockchain directly — no Identizy server is in the loop.

---

### The Trust Triangle

```
                    ┌─────────────────┐
                    │    ISSUER       │
                    │  Identizy       │
                    │  • Does KYC     │
                    │  • Signs        │
                    │    attestation  │
                    └────────┬────────┘
                             │
              signs & gives  │  trusts Issuer's
              attestation to │  public key
                    Holder   │
                             │
            ┌────────────────▼──────────────┐
            │          HOLDER               │
            │       User (browser)          │
            │  • Receives attestation       │
            │  • Generates ZK proof         │◄────────────────┐
            │  • Mints credential           │                 │
            │  • Uses credential            │                 │
            └───────────────────────────────┘                 │
                             │                                │
              presents       │  verifies            checks    │
              credential to  │  on-chain            Issuer's  │
                             ▼  credential          pub key   │
                    ┌─────────────────┐                       │
                    │   VERIFIER      │                       │
                    │  3rd-party site ├───────────────────────┘
                    │  • has_cred()   │
                    │  • Grants access│
                    └─────────────────┘

Key property: Verifier learns NOTHING about Holder from Issuer.
              All they know: "Identizy vouched for this address."
```

---

## How It Works

### User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1 — KYC  (once, on our platform)                      │
│                                                             │
│  User uploads ID + selfie                                   │
│  Platform verifies document authenticity                    │
│  Platform signs: Issuer.sign(Poseidon(birthDate, addrHash)) │
│  User receives private attestation — never goes on-chain    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  STEP 2 — Mint Credential  (once, in browser)               │
│                                                             │
│  Browser generates ZK proof (snarkjs + WASM, offline-safe)  │
│  Proof asserts — without revealing:                         │
│    ✓ I have a valid Issuer signature on my birthDate        │
│    ✓ My birthDate satisfies age ≥ 18                        │
│    ✓ This proof is bound to Stellar address A               │
│                                                             │
│  Soroban contract:                                          │
│    1. Verifies Groth16 BN254 proof (pairing_check)          │
│    2. Verifies Issuer Ed25519 signature (ed25519_verify)    │
│    3. Checks nullifier not previously used                  │
│    4. Mints soulbound credential to caller's address        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  STEP 3 — Use Anywhere  (unlimited, anonymous)              │
│                                                             │
│  Third-party site: "Is address A age-verified?"             │
│  Stellar: "Yes, credential valid, issued by Identizy"       │
│  User accesses service — no document, no data, no trace     │
│                                                             │
│  Security properties:                                       │
│  → Transfer token to another address? Proof fails (addr ≠)  │
│  → Replay the proof? Nullifier blocks it                    │
│  → Fake a birthdate? No Issuer signature → proof rejected   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

```
Off-chain                           On-chain (Stellar Testnet)
─────────────────────               ──────────────────────────
Issuer (Node.js script)             Soroban Smart Contract
  • Ed25519 keygen                    CBY4…WFER
  • sign(commitment)                  • verify()
        │                               – Groth16 BN254 pairing
        │ issuerSig                     – Ed25519 issuer check
        ▼                               – nullifier anti-replay
Browser (React + snarkjs)               – mint credential
  • addressToField(addr)            • has_credential()
  • groth16.fullProve() [WASM]      • is_nullifier_used()
  • pre-negate pi_a                       ▲
  • Stellar Wallets Kit (Freighter) ──────┘
  • verifyAgeOnChain() → RPC
```

### ZK Stack

| Layer | Technology | Notes |
|---|---|---|
| Circuit DSL | Circom 2.0 | LessThan + Poseidon composites |
| Proof system | Groth16 | Most efficient for on-chain verification |
| Curve | BN254 (bn128) | Native Soroban host functions (CAP-0074) |
| Hash | Poseidon | ZK-optimized, native host function (CAP-0075) |
| On-chain verifier | Soroban (Rust) | `g1_mul`, `g1_add`, `pairing_check` |
| Proof generation | snarkjs + WASM | Client-side — secrets never leave device |
| Wallets | Stellar Wallets Kit | Freighter + xBull |

### Circuit (`circuits/age_verifier/age_verifier.circom`)

```
Private inputs:  birthDate, minAge, currentDate
Public input:    addressHash  (Stellar address as BN254 scalar field element)
Public outputs:  isOldEnough  (1 if age ≥ minAge, else 0)
                 commitment   (Poseidon(birthDate, addressHash))

Stats: 305 R1CS constraints · BN254/Groth16
```

### Contract Interface (`contracts/age_verifier/src/lib.rs`)

```rust
// Initialize once after deploy — uploads VK + Issuer pubkey on-chain
fn initialize(env: Env, vk: StoredVk, issuer_pub_key: BytesN<32>) -> Result<(), Error>

// Verify ZK proof + Issuer attestation → mint soulbound credential
// pub_inputs = [isOldEnough: Fr, commitment: Fr, addressHash: Fr]
fn verify(
    env: Env,
    proof: Groth16Proof,          // { a: G1, b: G2, c: G1 }
    pub_inputs: Vec<Fr>,          // BN254 scalar field elements
    nullifier: BytesN<32>,        // random anti-replay token
    issuer_sig: BytesN<64>,       // Ed25519 sig over commitment bytes
) -> Result<bool, Error>

// Query — called directly by third parties on Stellar, no Identizy API needed
fn has_credential(env: Env, address_hash: BytesN<32>) -> bool
fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool
```

### Key Bug Fixes During Development

Two non-obvious bugs encountered and fixed during this build — documented here for future Soroban ZK developers:

**1. `Bn254G1Affine::neg()` crash in soroban-sdk 25.1.0**
The `neg()` method calls `Bytes::slice().as_val()` which produces a `BytesVal`, but `Bn254Fp::try_from_val` expects a `BytesN<32>Val`. In WASM this hits `unwrap_optimized()` → `wasm32::unreachable()` → `UnreachableCodeReached`.
Fix: pre-negate `pi_a.y` in the frontend (`negY = BN254_FP - y`) before encoding, and call `pairing_check(proof.a, ...)` directly in the contract.

**2. `Fr` public inputs must be `scvU256`, not `scvBytes`**
`Fr::try_from_val` internally calls `U256::try_from_val` which expects a `U256Val` (`scvU256`). Passing `scvBytes` causes `unwrap_optimized()` → `UnreachableCodeReached`.
Fix: encode Fr elements as `xdr.ScVal.scvU256(new xdr.UInt256Parts({ hiHi, hiLo, loHi, loLo }))`.

---

## Repository Structure

```
ZK_Stellar/
├── CLAUDE.md                           # Agent instructions (Stellar Skills)
├── README.md                           # This file
├── Cargo.toml                          # Workspace root
├── rust-toolchain.toml                 # Rust 1.89.0 + wasm32
│
├── circuits/age_verifier/
│   ├── age_verifier.circom             # ✅ Circuit
│   ├── verification_key.json           # ✅ On-chain VK
│   ├── circuit_final.zkey              # ✅ Proving key
│   └── age_verifier_js/
│       └── age_verifier.wasm           # ✅ Browser proving
│
├── contracts/age_verifier/
│   ├── Cargo.toml                      # soroban-sdk =25.1.0 (pinned)
│   └── src/
│       ├── lib.rs                      # ✅ Groth16 verifier + Ed25519 + nullifiers
│       └── test.rs                     # ✅ 3/3 tests passing
│
├── scripts/
│   ├── address_to_field.js             # ✅ Stellar G-addr → BN254 field element
│   ├── generate_proof.js               # ✅ CLI proof generation
│   ├── sign_commitment.js              # ✅ Issuer Ed25519 keygen + signing
│   ├── convert_vk.js                   # ✅ VK JSON → Soroban hex
│   └── initialize_contract.js          # ✅ Automated testnet initialize
│
└── frontend/
    └── src/
        ├── services/zkProof.ts         # ✅ Client-side snarkjs WASM
        ├── services/stellar.ts         # ✅ Soroban RPC + Wallets Kit
        └── pages/
            ├── ProofGeneration.tsx     # ✅ Date input → proof → Freighter sign
            └── Dashboard.tsx           # ✅ Credential status display
```

---

## Running Locally

### Prerequisites

```bash
# Rust (cargo needed for contract build)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Stellar CLI (prebuilt binary — compiling needs Rust 1.93+)
wget https://github.com/stellar/stellar-cli/releases/download/v27.0.0/stellar-cli-27.0.0-x86_64-unknown-linux-gnu.tar.gz
tar xzf stellar-cli-27.0.0-*.tar.gz -C ~/.local/bin

# Circom (prebuilt binary)
wget https://github.com/iden3/circom/releases/download/v2.1.9/circom-linux-amd64 -O ~/.local/bin/circom
chmod +x ~/.local/bin/circom

# Node dependencies
npm install                              # snarkjs in project root
npm install --prefix circuits circomlib  # circomlib for circuit compilation
```

### Build & Test the Contract

```bash
source "$HOME/.cargo/env"
cargo test -p age-verifier      # 3/3 tests must pass
stellar contract build          # produces target/wasm32v1-none/release/age_verifier.wasm
```

### Compile Circuit & Generate Keys

```bash
# Only needed after circuit changes — artifacts already committed
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
circom circuits/age_verifier/age_verifier.circom \
  --r1cs --wasm --sym --output circuits/age_verifier \
  -l circuits/node_modules

node node_modules/.bin/snarkjs groth16 setup \
  circuits/age_verifier/age_verifier.r1cs \
  zk-threshold-proof-saas/packages/circuits/powersOfTau28_hez_final_12.ptau \
  circuits/age_verifier/circuit_0000.zkey

node node_modules/.bin/snarkjs zkey contribute \
  circuits/age_verifier/circuit_0000.zkey \
  circuits/age_verifier/circuit_final.zkey --name="contribution" -e="random"

node node_modules/.bin/snarkjs zkey export verificationkey \
  circuits/age_verifier/circuit_final.zkey \
  circuits/age_verifier/verification_key.json
```

### Deploy to Testnet

```bash
# Fund a new account via Friendbot
stellar keys generate alice
stellar keys address alice   # → fund at https://laboratory.stellar.org/ (Friendbot)

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/age_verifier.wasm \
  --source alice --network testnet

# Initialize (updates CONTRACT_ID in .env first)
node scripts/initialize_contract.js
```

### Run Frontend

```bash
cd frontend
npm install
npm run dev   # → http://localhost:8080
```

Connect Freighter wallet (testnet), enter a birthdate ≥ 18 years ago, click "Generate & Mint Credential".

---

## Implementation Status

### ✅ Complete — End-to-End Flow Working

- [x] **Dev environment** — Rust 1.89, Circom 2.1.9, Stellar CLI 27.0, snarkjs 0.7.6
- [x] **Circom circuit compiled** — 305 R1CS constraints, BN254/Groth16
  - Private: `birthDate`, `minAge`, `currentDate`
  - Public input: `addressHash` (Stellar address as BN254 scalar field element)
  - Public outputs: `isOldEnough`, `commitment = Poseidon(birthDate, addressHash)`
- [x] **Soroban Groth16 BN254 verifier** — `pairing_check` + Ed25519 + nullifiers
- [x] **Contract tests: 3/3 passing** — real proof values hardcoded
- [x] **Deployed to Stellar testnet** — `CBY4RHLTT6CWB5K7M6IEMCI2BUVWAYAHOUS2XUG5HH2PDMDM77FIWFER`
- [x] **Contract initialized** — real VK + Issuer Ed25519 pubkey uploaded on-chain
- [x] **Frontend: Freighter wallet connection** — Stellar Wallets Kit
- [x] **Frontend: client-side proof generation** — snarkjs WASM in browser
- [x] **Frontend: submit to testnet contract** — RPC + transaction signing
- [x] **End-to-end demo working** — browser → Freighter → on-chain ZK verification → credential
- [x] **Dashboard: credential status** — `has_credential()` query on Stellar

### ⏳ Remaining for Submission

- [ ] Record 2–3 min demo video
- [ ] Push repo to GitHub (public)
- [ ] Submit on DoraHacks with video link

### 📋 Roadmap

**In-circuit EdDSA (Option B):** Move the Issuer signature verification inside the ZK circuit to eliminate the Ed25519 check in the contract (~+3,000 constraints, needs powersOfTau17).

**NFT as Identity:** Turn the credential into a real SEP-0041 soulbound token — appears in Freighter/Lobstr, composable with any Stellar DeFi protocol, standard `balance()` interface for verifiers.

**Production:** Real KYC provider (Jumio/Onfido), mainnet deployment, circuit + contract audit.

---

## Use Cases

Any service that today asks "are you 18+?" can replace that flow with a single blockchain query — no document stored, no API key needed, no Identizy server in the loop.

| Sector | Today | With Identizy |
|---|---|---|
| Alcohol e-commerce | Upload driver's license → store stores it | `has_credential(address)` → `true` |
| Adult content | "Upload selfie + ID" → data breach risk | Wallet connect → credential check |
| DeFi protocols | Full KYC on every platform × 5 platforms | One KYC, one credential, infinite use |
| Events & venues | Line, ID check per person | Ticket purchase gated at `has_credential` |
| Online gambling | Platform stores passport copies | One contract call, zero document stored |
| **Clinical research** | Identified patient records cross org perimeter → HIPAA/GDPR/LGPD liability | ZK credential + pseudonymous data delivery — identity never enters the platform |

---

## Extended Use Case: Privacy-Compliant Clinical Research

> **"Consent once. Your health data flows to research — anonymized. You can stop it at any time."**

Clinical research depends on patient data, but collecting identified records creates compliance liability under HIPAA, GDPR, and LGPD the moment that data crosses an organization's perimeter. The standard model — collect identified, de-identify internally — means the raw data was already received and held, which is itself a reportable event under a breach.

Identizy's credential infrastructure provides the **ZK identity and consent primitive** for a de-identification-first architecture:

| Phase | What happens | Identizy's role |
|---|---|---|
| **Once — identity & consent** | Patient proves eligibility and grants data access consent | ZK credential minted on Stellar; patient's identity never reaches the research platform |
| **Ongoing — anonymized delivery** | Health records retrieved from source and stripped of identifiers before delivery | On-chain credential authorizes each retrieval; patient can revoke at any time |

The research platform receives only pseudonymous, anonymized records. The **Stellar wallet address is the persistent pseudonymous subject identifier** — controlled exclusively by the patient's private key. No service holds a mapping between identity and health data.

This architecture addresses each regulatory regime on its own terms:
- **HIPAA** — identified data never enters the covered entity's perimeter
- **GDPR** — data subject retains revocable, auditable control via on-chain credential
- **LGPD** — consent is a verifiable, time-stamped on-chain event, not a checkbox

> This repository provides the ZK credential and on-chain consent primitive. The same infrastructure applies to any domain requiring verified identity, scoped consent, and pseudonymous data flow — healthcare is one application. A broader service layer built on this primitive is under active development.

---

## Why Stellar

Protocol 25 "X-Ray" added BN254 elliptic curve host functions (`g1_add`, `g1_mul`, `pairing_check`) and Poseidon hash natively to Soroban — enabling efficient on-chain Groth16 proof verification for the first time on Stellar. BN254 on Stellar mirrors Ethereum's EIP-196/197 precompiles, so existing Circom circuits port without modification.

Identizy brings battle-tested ZK infrastructure (Circom + snarkjs) to Stellar's payment rails and institutional settlement network — the natural home for compliant, privacy-preserving identity.

---

## References

- [Nethermind Stellar Private Payments](https://github.com/NethermindEth/stellar-private-payments) — BN254 Groth16 verifier pattern on Soroban
- [soroban-examples / groth16_verifier](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier) — reference Soroban verifier
- [Stellar Skills — ZK Proofs](https://skills.stellar.org/skills/zk-proofs/SKILL.md) — official ZK dev guidance
- [Stellar Skills — Soroban](https://skills.stellar.org/skills/soroban/SKILL.md) — contract patterns
- [circomlib](https://github.com/iden3/circomlib) — circuit primitives (LessThan, Poseidon)
- [snarkjs](https://github.com/iden3/snarkjs) — browser-side Groth16 proving

---

## Team

> Felipe Segall — [@fsegall](https://github.com/fsegall)

Built for **Stellar Hacks: Real-World ZK** · June 2026
