# Identizy — Anonymous Credentials on Stellar

> **Agent instruction:** Before writing any Stellar, Soroban, or ZK code, fetch and read the Stellar Skills at https://skills.stellar.org/ — they dramatically improve code quality. The ZK skill is at https://skills.stellar.org/skills/zk-proofs/SKILL.md.

**Project:** Identizy — Anonymous Credentials on Stellar
**Hackathon:** Stellar Hacks: Real-World ZK ([DoraHacks](https://dorahacks.io/hackathon/stellar-hacks-zk/detail))
**Submission deadline:** June 29, 2026 — 12:00 PM PST
**Prize pool:** $10,000 XLM (1st $5k · 2nd $2k · 3rd $1.25k · 4th $1k · 5th $750)

---

## What We're Building

**Identizy** is a ZK identity system on Stellar. Users prove they're ≥ 18 with a real document **once**, receive a cryptographically address-bound credential, and use it anonymously at any third-party service forever.

The system follows the **W3C Verifiable Credentials** trust model:
- **Issuer (us):** Verifies real documents, signs `commitment = Poseidon(birthDate, addressHash)` with Ed25519
- **Holder (user):** Generates ZK proof in the browser, mints credential on Stellar
- **Verifier (3rd party):** Calls `has_credential(address)` directly on Stellar — no Identizy server involved

**Requirements for submission:**
1. Open-source repo with clear README
2. 2–3 min demo video showing the ZK flow
3. ZK proof verified inside a Stellar smart contract (testnet or mainnet)

---

## Current State (as of 2026-06-23)

### ✅ Working
- **Circuit compiled:** `circuits/age_verifier/age_verifier.circom` → 305 R1CS constraints, WASM + zkey generated
- **Real proof verified:** `birthDate=2000-01-01`, `minAge=18` → `isOldEnough=true`
- **Contract tests: 3/3 passing** — `cargo test -p age-verifier`
- **Deployed to Stellar testnet** — Contract ID: `CA7ZALWIDPVDBYSZXMO4WOM4INCWD7UUAZ3XJEQICWGY6H2JDLGGDKEO`
- **Contract initialized** — real VK + Issuer Ed25519 pubkey uploaded on-chain
- **Dev environment installed:** Rust 1.89, Circom 2.1.9, Stellar CLI 27.0, snarkjs 0.7.6

### 🚧 Next Steps
1. Frontend: Freighter wallet connection via Stellar Wallets Kit
2. Frontend: client-side proof generation → submit to testnet contract
3. End-to-end demo: browser proof → on-chain verification → credential issued
4. Record 2–3 min demo video for hackathon submission

---

## Stellar Skills — Read Before Building

| Skill | URL | When to read |
|---|---|---|
| **All skills** | https://skills.stellar.org/ | Always first |
| **ZK Proofs** | https://skills.stellar.org/skills/zk-proofs/SKILL.md | ZK/verifier work |
| **Soroban** | https://skills.stellar.org/skills/soroban/SKILL.md | Contract work |
| **dApps & wallets** | https://skills.stellar.org/skills/dapp/SKILL.md | Frontend work |
| **Assets & SAC** | https://skills.stellar.org/skills/assets/SKILL.md | Token/asset work |
| **RPC & APIs** | https://skills.stellar.org/skills/data/SKILL.md | Chain queries |
| **Standards** | https://skills.stellar.org/skills/standards/SKILL.md | SEP/CAP reference |

**Machine-readable Stellar docs:**
- https://developers.stellar.org/llms.txt — index
- https://developers.stellar.org/llms-full.txt — full content

---

## ZK Cryptographic Primitives on Stellar

| Primitive | CAP | Protocol | Status | Use |
|---|---|---|---|---|
| BLS12-381 | CAP-0059 | 22 | ✅ Available | BLS signatures, Groth16 |
| BN254 g1_add, g1_mul, pairing_check | CAP-0074 | 25 "X-Ray" | ✅ Available | Groth16, EIP-196/197 |
| Poseidon / Poseidon2 | CAP-0075 | 25 "X-Ray" | ✅ Available | ZK-optimized hashing |
| BN254 MSM, scalar field ops (9 more) | CAP-0074 ext | 26 "Yardstick" | ✅ Available | Cheaper Groth16 |

**SDK type names in soroban-sdk 25.1.0 (IMPORTANT — these differ from docs):**
- `Fr` — scalar field element (used for public signals and `g1_mul` scalar input)
- `Bn254Fp` — base field element (curve point coordinates)
- `Bn254G1Affine` — G1 affine point (64 bytes: x BE || y BE)
- `Bn254G2Affine` — G2 affine point (128 bytes: x.c1 || x.c0 || y.c1 || y.c0)

**Byte encoding (Ethereum-compatible EIP-196/197):**
- G1: `x BE (32) || y BE (32)` = 64 bytes
- G2: `x.c1 BE (32) || x.c0 BE (32) || y.c1 BE (32) || y.c0 BE (32)` = 128 bytes
- **G2 note:** snarkjs format is `[[x.c0, x.c1], ...]` — must swap c0/c1 when encoding

---

## Circuit (Implemented & Compiled)

**File:** `circuits/age_verifier/age_verifier.circom`

```circom
pragma circom 2.0.0;
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

template AgeVerifier() {
    signal input birthDate;     // private — Unix timestamp
    signal input minAge;        // private — minimum age in years
    signal input currentDate;   // private — current Unix timestamp
    signal input addressHash;   // public — BN254 field element from Stellar address

    signal ageInSeconds;
    signal minAgeInSeconds;
    minAgeInSeconds <== minAge * 31557600;
    ageInSeconds <== currentDate - birthDate;

    component less = LessThan(64);
    less.in[0] <== ageInSeconds;
    less.in[1] <== minAgeInSeconds;

    signal output isOldEnough;
    isOldEnough <== 1 - less.out;

    signal output commitment;
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== birthDate;
    poseidon.inputs[1] <== addressHash;
    commitment <== poseidon.out;
}

// Public signals order: [isOldEnough, commitment, addressHash]
component main {public [addressHash]} = AgeVerifier();
```

**Compiled artifacts** (in `circuits/age_verifier/`):
- `age_verifier_js/age_verifier.wasm` — browser proving
- `circuit_final.zkey` — proving key
- `verification_key.json` — for on-chain verifier

**Stats:** 305 R1CS constraints, BN254/Groth16, ptau from `zk-threshold-proof-saas/`

---

## Contract Interface (Implemented)

**File:** `contracts/age_verifier/src/lib.rs`

```rust
// Initialize once after deploy
pub fn initialize(env: Env, vk: StoredVk, issuer_pub_key: BytesN<32>) -> Result<(), AgeVerifierError>

// Verify ZK proof + Issuer attestation → store credential
// pub_inputs[0] = isOldEnough (Fr value = 1)
// pub_inputs[1] = commitment = Poseidon(birthDate, addressHash)
// pub_inputs[2] = addressHash (Fr from Stellar address)
// issuer_sig = Ed25519 over commitment bytes (64 bytes)
pub fn verify(env: Env, proof: Groth16Proof, pub_inputs: Vec<Fr>,
              nullifier: BytesN<32>, issuer_sig: BytesN<64>) -> Result<bool, AgeVerifierError>

// Third-party integration point — called directly on Stellar, no Identizy API needed
pub fn has_credential(env: Env, address_hash: BytesN<32>) -> bool

pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool
```

**Errors:** `NotInitialized=0, AlreadyInitialized=1, MalformedPublicInputs=2, InvalidProof=3, NullifierUsed=4, AgeConstraintFailed=5, InvalidIssuerSig=6`

**Architecture (Option A):** Issuer Ed25519 signature verified **outside** the ZK circuit by Soroban `ed25519_verify`. The Poseidon commitment ties KYC attestation to ZK proof without adding ~3,000 EdDSA constraints. See README ROADMAP for Option B (in-circuit EdDSA).

---

## Scripts

| Script | Usage |
|---|---|
| `scripts/address_to_field.js` | `node scripts/address_to_field.js <G...addr>` → BN254 field element |
| `scripts/generate_proof.js` | `node scripts/generate_proof.js <birthDate> <minAge> <addressHash> [currentDate]` |
| `scripts/sign_commitment.js` | `keygen` / `ISSUER_PRIVKEY=... sign <commitment>` / `verify` |
| `scripts/convert_vk.js` | `node scripts/convert_vk.js circuits/age_verifier/verification_key.json` |

**Full proof workflow:**
```bash
# 1. Convert Stellar address to field element
node scripts/address_to_field.js GCQSYAFC7AACW4A2RM66V7NFT3P64ND47EK5U57GYBGBEIFHRBH4C6C6

# 2. Generate ZK proof
node scripts/generate_proof.js 946684800 18 <fieldElement>
# → outputs proof {a,b,c}, publicSignals {isOldEnough, commitment, addressHash}

# 3. Issuer signs the commitment
ISSUER_PRIVKEY=<hex> node scripts/sign_commitment.js sign <commitment>
# → outputs issuerSig

# 4. Submit to Soroban contract (frontend does this via stellar-sdk)
```

---

## Dev Environment (Installed)

```bash
# Rust (already installed)
source "$HOME/.cargo/env"
rustc --version  # 1.89.0

# Circom — NOT on crates.io, use prebuilt binary
# Already at ~/.local/bin/circom (version 2.1.9)
# To reinstall: wget https://github.com/iden3/circom/releases/download/v2.1.9/circom-linux-amd64

# Stellar CLI — use prebuilt binary (compiling needs Rust 1.93+)
# Already at ~/.local/bin/stellar (version 27.0.0)
# To reinstall: download from github.com/stellar/stellar-cli/releases

# snarkjs — installed locally in project (NOT global, nvm path issue)
# Already in node_modules/ at project root
node -e "require('snarkjs'); console.log('ok')"

# circomlib — installed at circuits/node_modules/circomlib
ls circuits/node_modules/circomlib
```

### Build & Test Commands

```bash
# Compile circuit (artifacts already generated — only needed after circuit changes)
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
npm install --prefix circuits circomlib --silent
circom circuits/age_verifier/age_verifier.circom \
  --r1cs --wasm --sym --output circuits/age_verifier \
  -l circuits/node_modules   # NOTE: flag is -l, NOT --include

# Groth16 setup
snarkjs groth16 setup circuits/age_verifier/age_verifier.r1cs \
  zk-threshold-proof-saas/packages/circuits/powersOfTau28_hez_final_12.ptau \
  circuits/age_verifier/circuit_0000.zkey
snarkjs zkey contribute circuits/age_verifier/circuit_0000.zkey \
  circuits/age_verifier/circuit_final.zkey --name="contribution" -e="random"
snarkjs zkey export verificationkey circuits/age_verifier/circuit_final.zkey \
  circuits/age_verifier/verification_key.json

# Contract tests (3/3 passing)
source "$HOME/.cargo/env"
cargo test -p age-verifier

# Build WASM for deploy
stellar contract build  # or: cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
stellar keys generate alice
stellar keys address alice  # fund via https://laboratory.stellar.org/ (Friendbot)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/age_verifier.wasm \
  --source alice --network testnet
```

### Important Gotchas

- `soroban-sdk` pinned to `=25.1.0` in Cargo.toml — 25.3.x needs Rust 1.91
- Scalar field type is `Fr`, NOT `Bn254Fr` or `Bn254Fp` (those are base field)
- circom's include flag is `-l circuits/node_modules`, NOT `--include`
- `npm install --prefix circuits circomlib` → puts at `circuits/node_modules/circomlib`
- snarkjs must be required locally: `require('snarkjs')` not from global nvm path
- Cargo package name is `age-verifier` (hyphen), not `age_verifier` (underscore)
- Stellar CLI 27.0 installed as prebuilt binary — `cargo install stellar-cli` needs Rust 1.93

---

## Repository Structure

```
ZK_Stellar/
├── CLAUDE.md                           # This file — read first
├── README.md                           # Full product README (Identizy)
├── Cargo.toml                          # Workspace root
├── rust-toolchain.toml                 # Rust 1.89.0 + wasm32
├── Makefile                            # Build automation
├── .gitignore
│
├── circuits/age_verifier/
│   ├── age_verifier.circom             # ✅ Circuit with addressHash + Poseidon
│   ├── input.json                      # Example inputs
│   ├── verification_key.json           # ✅ Generated — use for on-chain VK
│   ├── circuit_final.zkey              # ✅ Generated — proving key
│   └── age_verifier_js/
│       └── age_verifier.wasm           # ✅ Generated — browser proving
│
├── circuits/node_modules/circomlib/    # circomlib (npm install --prefix circuits)
│
├── contracts/age_verifier/
│   ├── Cargo.toml                      # soroban-sdk =25.1.0 (pinned)
│   └── src/
│       ├── lib.rs                      # ✅ Groth16 verifier + Ed25519 + nullifiers
│       └── test.rs                     # ✅ 3/3 tests passing, real proof values
│
├── scripts/
│   ├── address_to_field.js             # ✅ Stellar G-addr → BN254 field element
│   ├── generate_proof.js               # ✅ CLI proof gen (birthDate, minAge, addressHash)
│   ├── sign_commitment.js              # ✅ Issuer Ed25519 keygen + signing
│   ├── convert_vk.js                   # ✅ VK JSON → Soroban hex format
│   └── setup.sh                        # One-command dev environment setup
│
├── frontend/                           # React/Vite app (from Lovable)
│   └── src/
│       ├── services/zkProof.ts         # ✅ Client-side snarkjs WASM
│       ├── services/stellar.ts         # ✅ Soroban RPC + Stellar Wallets Kit
│       └── ...
│
└── zk-threshold-proof-saas/           # GITIGNORED — local reference only
    └── packages/circuits/
        └── powersOfTau28_hez_final_12.ptau  # Reused for trusted setup
```

---

## On-Chain Verifier Reference Implementations

| Project | URL | Notes |
|---|---|---|
| **Groth16 verifier (canonical)** | https://github.com/stellar/soroban-examples/tree/main/groth16_verifier | BLS12-381; adapt for BN254 |
| **Stellar Private Payments** | https://github.com/NethermindEth/stellar-private-payments | Circom + Groth16 + client-side WASM |
| **P25 preview examples** | https://github.com/jayz22/soroban-examples/tree/p25-preview/p25-preview | Official BN254/Poseidon examples |

**Groth16 verification equation:**
```
1. Validate: pub_inputs.len() == vk.ic.len() - 1
2. Compute:  vk_x = ic[0] + Σ(pub_inputs[i] * ic[i+1])
3. Check:    e(-A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) == 1
```

---

## Security Patterns

**1. Anti-replay (nullifiers)** — implemented
```rust
env.storage().persistent().set(&DataKey::Nullifier(nullifier.clone()), &true);
env.storage().persistent().extend_ttl(&DataKey::Nullifier(nullifier), 17_280, 518_400); // 30 days
```

**2. Address binding** — implemented via Poseidon commitment
```
commitment = Poseidon(birthDate, addressHash)
→ credential is cryptographically tied to the Stellar address used during KYC
```

**3. Issuer attestation (Option A)** — implemented
```rust
// Soroban native ed25519_verify — panics on failure
env.crypto().ed25519_verify(&issuer_pub_key, &commitment_bytes.into(), &issuer_sig);
```

**4. Negative-path tests** — 3/3 passing
- `test_double_initialize_rejected` ✅
- `test_verify_before_initialize_rejected` ✅
- `test_wrong_input_count_rejected` ✅

---

## Before Building — Check Existing Community Work

1. **Stellar Ecosystem DB:** https://github.com/lumenloop/stellar-ecosystem-db
2. **OpenZeppelin on Stellar:** https://www.openzeppelin.com/networks/stellar
3. **soroban-examples:** https://github.com/stellar/soroban-examples
4. **Nethermind implementations:** https://github.com/NethermindEth
5. **Hackathon FAQ:** https://github.com/briwylde08/stellar-hackathon-faq

**Rule:** If a community-approved library does it, use it. Custom crypto code is the last resort.

---

## Core Tools

| Tool | URL |
|---|---|
| Stellar Docs | https://developers.stellar.org/ |
| Stellar CLI | https://developers.stellar.org/docs/tools/cli |
| Lab (testnet explorer) | https://laboratory.stellar.org/ |
| Stellar Wallets Kit | https://stellarwalletskit.dev/ |
| Scaffold Stellar | https://scaffoldstellar.org |
| OpenZeppelin on Stellar | https://www.openzeppelin.com/networks/stellar |
| Hackathon FAQ | https://github.com/briwylde08/stellar-hackathon-faq |
