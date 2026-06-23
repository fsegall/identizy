# Identizy — Anonymous Credentials on Stellar

> **"Prove who you are, once. Be anyone, everywhere."**

A zero-knowledge identity system on Stellar that lets users verify their age with real documents **once** and receive a cryptographically address-bound credential — usable anonymously across any third-party service, forever.

**Hackathon:** [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) · Deadline: June 29, 2026

---

## The Problem

Every time you need to prove you're over 18 — to buy alcohol, access adult content, open a trading account, enter a venue — you hand over your passport, driver's license, or credit card to a company you may never trust again. That data is stored, breached, and sold. You've handed your identity to dozens of strangers.

**KYC is broken by design.** It's invasive, repetitive, and creates honeypots of sensitive data that get breached.

---

## The Solution

**One real KYC. Infinite anonymous proofs.**

Identizy lets users:

1. **Verify once** — upload a real ID document on our platform. We verify it, extract your birthdate, and sign an attestation tied to your Stellar address.
2. **Mint a credential** — your browser generates a ZK proof that you're ≥ 18 *and* that the proof belongs to your specific address. You mint a soulbound, address-bound credential on Stellar — no personal data on-chain. *(Roadmap: the credential becomes a real NFT token visible in any Stellar wallet — your identity, carried as a token.)*
3. **Use it everywhere** — any third-party site checks: "does this address hold a valid Identizy?" Stellar says yes. No document, no birthdate, no identity revealed.

The credential is:
- **Address-bound** — cryptographically tied to your Stellar address via ZK proof; useless if transferred
- **Soulbound** — non-transferable at the contract level (double protection)
- **Privacy-preserving** — the on-chain token contains zero personal information
- **Issuer-anchored** — only our signed attestations generate valid proofs; you can't fake it with a false birthdate

---

## Who Is Who (W3C Verifiable Credentials Model)

Identizy follows the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) trust triangle. Understanding each role is key to understanding why the system is secure.

---

### Issuer — Identizy Platform (us)

> *"We checked the document. We vouch for this address."*

The Issuer is the entity that performs real KYC and issues the attestation. In Identizy, that's us.

**What the Issuer does:**
1. Receives the user's ID document + selfie
2. Verifies authenticity (liveness check, document validity)
3. Extracts the real `birthDate` from the document
4. Receives the user's Stellar address (after the user proves they control it by signing a nonce)
5. Computes `commitment = Poseidon(birthDate, stellarAddress)`
6. Signs the commitment with the Issuer's Ed25519 private key: `issuerSig = sign(commitment)`
7. Returns `issuerSig` to the user — this is the **KYC attestation seal**

**What the Issuer never does:**
- Store the birthDate on-chain
- Reveal the birthDate to third parties
- Know which services the user accesses later

**Analogy:** A government that issues passports. The passport is a signed attestation from the government ("this person is who they say they are"). The government doesn't follow you to every bar you enter.

---

### Holder — The End User (e.g., João, 25 years old)

> *"I have the attestation. I'll prove what I need, nothing more."*

The Holder is the user who went through KYC and now holds a private attestation.

**What the Holder has (stored privately, never shared):**
- Their real `birthDate` (e.g., `1998-03-15`)
- The `issuerSig` received after KYC
- Their Stellar wallet private key

**What the Holder does to mint their credential:**
1. In the browser, runs the ZK circuit with their private data:
   - Inputs: `birthDate`, `minAge=18`, `currentDate`, `addressHash`
   - Outputs: `isOldEnough=1`, `commitment=Poseidon(birthDate, addressHash)`
2. Sends to Soroban contract:
   - The ZK proof (mathematical evidence of the above)
   - The `issuerSig` (the KYC seal from the Issuer)
3. Contract verifies both → mints a soulbound Identizy token to João's address

**What João does to use the credential at a third-party site:**
- Nothing special. The site checks his Stellar address on-chain. Done.

**What the credential does NOT reveal:**
- João's real name, date of birth, document number
- Which document he used
- When he did KYC
- Which other sites he has accessed

**Analogy:** João has a passport (attestation from the Issuer). When he enters a bar, he doesn't hand over the passport — he shows an Identizy token that proves he's been ID-checked, without revealing anything else.

---

### Verifier — Third-Party Sites and Services

> *"I don't need to know who you are. I just need to know you're verified."*

The Verifier is any service that requires age verification: an online alcohol retailer, an adult content platform, a DeFi protocol with age-gated products, a venue ticketing system.

**What the Verifier does:**
1. Asks the user to connect their Stellar wallet
2. Queries the Identizy Soroban contract **directly on the blockchain**:
   ```javascript
   // Via @stellar/stellar-sdk — no Identizy server involved
   const result = await contract.call("has_credential", addressHash);
   // → true or false
   ```
3. Gets `true` → grants access

> **Important:** `has_credential` is a **Soroban smart contract function on Stellar**, not an Identizy API. The Verifier calls the blockchain directly — no Identizy server is in the loop. This means there is no centralized database to breach, no API that can go offline, and no way for Identizy to block or revoke access retroactively. The credential lives on Stellar permanently.

**What the Verifier never sees:**
- The user's real identity
- Their birthdate
- The KYC attestation
- Which other sites the user has accessed

**What the Verifier trusts:**
- Identizy's Issuer public key (one-time trust, hardcoded on contract deployment)
- The Soroban smart contract logic (open source, auditable on Stellar)
- The ZK proof system (Groth16 + BN254, mathematically sound)

**Analogy:** The bar's bouncer. They don't need a copy of João's passport — they just need to know that a trusted authority (the government/Identizy) already verified him. The bouncer sees a stamp, not the person's identity. And the bouncer doesn't call the government every time — the stamp is self-contained proof.

---

### The Trust Triangle

```
                    ┌─────────────────┐
                    │    ISSUER       │
                    │  Identizy       │
                    │                 │
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
            │       João (user)             │
            │                               │
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
                    │                 │
                    │  • Checks       │
                    │    has_cred()   │
                    │  • Grants       │
                    │    access       │
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
│  Platform signs: Issuer.sign(birthDate, stellarAddress)     │
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
│  Soroban contract verifies proof → mints soulbound token    │
│  Nullifier stored → prevents proof replay                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  STEP 3 — Use Anywhere  (unlimited, anonymous)              │
│                                                             │
│  Third-party site: "Is address A age-verified?"             │
│  Stellar: "Yes, credential valid, issued by Identizy"       │
│  User accesses service — no document, no data, no trace     │
│                                                             │
│  The credential is a disposable identity:                   │
│  → Transfer it to another address? Proof fails (wrong addr) │
│  → Replay the proof? Nullifier blocks it                    │
│  → Fake a birthdate? No Issuer signature → proof rejected   │
└─────────────────────────────────────────────────────────────┘
```

### Why Address-Bound Is Novel

Most ZK credentials prove a statement ("I am ≥ 18"). Identizy goes further: the ZK proof **commits to the holder's Stellar address** as a public input. This means:

- The credential is cryptographically non-transferable before the contract even enforces soulbound
- A minor who receives a transferred token cannot pass verification — the proof inside commits to the original address
- Third-party sites get a guarantee: the credential and the address are inseparable

---

## Use Cases

Any service that today asks "are you 18+?" can replace that flow with a single blockchain check. The user never re-submits a document. The service never stores personal data.

---

### 🍺 Alcohol & Cannabis E-Commerce

**Today:** Customer uploads driver's license → store stores it → data breach risk.

**With Identizy:**
```
Customer connects Stellar wallet
Store calls: has_credential(wallet_address) → true
Order approved — no document stored, no identity revealed
```

**Concrete example:** A craft beer subscription service in Brazil. Legal requirement: verify buyer is ≥ 18. With Identizy, the store integrates 3 lines of Stellar SDK and never sees a CPF or RG.

---

### 🔞 Adult Content Platforms

**Today:** "Upload selfie + ID" — platforms store sensitive data, face regulatory risk, become targets for leaks.

**With Identizy:**
```
Creator/viewer connects Stellar wallet
Platform checks: has_credential(address) → true
Access granted — platform knows only that Identizy verified the user
```

**Concrete example:** An 18+ content platform operating under GDPR. They are legally required to verify age but also legally required not to store unnecessary personal data. Identizy solves both simultaneously.

---

### 🏦 DeFi / Financial Protocols

**Today:** Exchanges do full KYC on every platform — passport scanned 5× across Binance, Coinbase, Kraken, etc.

**With Identizy:**
```
User holds Identizy credential (one KYC event)
DeFi protocol checks: has_credential(address) → true
Protocol knows: "this address was verified by a trusted issuer"
→ User can access age-gated derivatives, comply with jurisdiction rules
```

**Concrete example:** A Stellar-based DEX that needs to block minors from leverage trading under MiCA (EU regulation). They add a 10-line integration and comply — without becoming a KYC custodian themselves.

---

### 🎫 Events & Venues

**Today:** Line at the door, ID check per person, slow queue.

**With Identizy:**
```
Ticket purchase: has_credential(address) → confirm buyer is 18+
Venue entry: show Stellar address QR code → instant verification
```

**Concrete example:** A festival with 18+ age requirement. Ticket platform verifies at purchase time. No queue at the door — the wristband IS the wallet.

---

### 🎮 Gaming & Gambling

**Today:** Online gambling sites require full KYC per platform, storing documents they shouldn't need.

**With Identizy:**
```
Player registers with Stellar wallet
Casino checks: has_credential(address) → true
Plays — casino never touched a passport
```

**Concrete example:** A Stellar-based prediction market that is legal only for adults in certain jurisdictions. Compliance achieved with one contract call.

---

### 🏥 Healthcare & Telemedicine

**Today:** Age-gated prescription refills require patient identification, creating healthcare data risk.

**With Identizy:**
```
Patient authenticates with Stellar wallet
Pharmacy checks: has_credential(address) → confirm patient is 18+
Prescription processed — no personal health data cross-contaminated with KYC data
```

---

### The Common Pattern

In every case, the integration is the same three steps for the Verifier:

```javascript
import { Contract, SorobanRpc } from "@stellar/stellar-sdk";

const IDENTIZY_CONTRACT = "C..."; // Identizy contract ID on Stellar
const rpc = new SorobanRpc.Server("https://soroban-testnet.stellar.org");

async function isVerified(stellarAddress: string): Promise<boolean> {
  const contract = new Contract(IDENTIZY_CONTRACT);
  const addressHash = stellarAddressToField(stellarAddress); // utility function
  const result = await rpc.simulateTransaction(
    contract.call("has_credential", addressHash)
  );
  return result === true;
}
```

No Identizy account. No Identizy API key. No Identizy server. Just Stellar.

---

## Technical Architecture

```
Off-chain                           On-chain (Stellar)
─────────────────────               ──────────────────────────
Issuer Backend (Node.js)            Soroban Smart Contract
  • Document verification             • verify() — Groth16 BN254
  • EdDSA signing service             • mint_credential()
  • sign(birthDate, address)          • Soulbound token logic
        │                             • Nullifier registry
        │ attestation                       ▲
        ▼                                   │
Browser (React + snarkjs)                   │
  • AgeVerifier circuit (WASM)              │
  • Proof generation (offline-safe)         │
  • Stellar Wallets Kit (Freighter)  ───────┘
  • Submit tx to Soroban RPC
```

### ZK Stack

| Layer | Technology | Notes |
|---|---|---|
| Circuit DSL | Circom 2.0 | LessThan + EdDSA verifier |
| Proof system | Groth16 | Most efficient for on-chain verification |
| Curve | BN254 (bn128) | Ethereum-compatible, supported since Protocol 25 |
| Hash | Poseidon | ZK-optimized, native Stellar host function (Protocol 25) |
| On-chain verifier | Soroban (Rust) | BN254 `g1_mul`, `g1_add`, `pairing_check` host functions |
| Proof generation | snarkjs + WASM | Client-side in browser — secrets never leave device |
| Wallets | Stellar Wallets Kit | Freighter + multi-wallet support |
| Token standard | Soroban soulbound | Custom non-transferable credential token |

### Contract Interface

```rust
// Deploy → initialize once with the verification key
fn initialize(env: Env, vk: StoredVk) -> Result<(), Error>

// User submits proof → receives soulbound credential
fn verify_and_mint(
    env: Env,
    proof: Groth16Proof,
    pub_inputs: Vec<Bn254Fr>,   // [isOldEnough, addressCommitment]
    nullifier: BytesN<32>,
    recipient: Address,
) -> Result<(), Error>

// Third parties query credential status
fn has_credential(env: Env, address: Address) -> bool
fn credential_expires_at(env: Env, address: Address) -> Option<u64>
```

### Circuit (Circom 2.0)

**MVP — `age_verifier.circom`** (currently implemented):
```
Private inputs: birthDate, minAge, currentDate
Public output:  isOldEnough (1 or 0)
```

**Current — `age_verifier.circom`** (Option A, implemented):
```
Private inputs:  birthDate, minAge, currentDate
Public input:    addressHash
Public outputs:  isOldEnough, commitment = Poseidon(birthDate, addressHash)
Issuer sig:      verified by Soroban contract via Ed25519 host function (outside ZK)
```

**Roadmap — `age_verifier_with_attestation.circom`** (Option B, EdDSA in-circuit):
```
Private inputs:  birthDate, minAge, currentDate, issuerSigR[256], issuerSigS[256]
Public inputs:   addressHash, issuerPubKey[256]
Public outputs:  isOldEnough, commitment
Trade-off:       +~3000 constraints, needs powersOfTau17 (~1.2 GB), slower proof
```

> **Why Option A is sufficient:** The Poseidon commitment cryptographically binds
> `birthDate` to `addressHash`. The contract then verifies the Issuer's Ed25519
> signature over that commitment. If both pass, it is mathematically impossible to
> decouple the KYC event from the ZK proof — the same security guarantee as
> Option B, achieved without the circuit complexity. Option B is primarily useful
> in trustless settings where you cannot trust the verifying contract.

---

## Repository Structure

```
Identizy/
├── contracts/age_verifier/        # Soroban Rust smart contract
│   └── src/
│       ├── lib.rs                 # Groth16 BN254 verifier + nullifier
│       └── test.rs                # Tests with real proof values
├── circuits/age_verifier/         # Circom 2.0 circuit
│   ├── age_verifier.circom        # MVP circuit
│   └── input.json                 # Example: born 2000-01-01, minAge 18
├── scripts/
│   ├── setup.sh                   # Install Rust, stellar-cli, circom, snarkjs
│   ├── convert_vk.js              # verification_key.json → Soroban hex format
│   └── generate_proof.js          # Generate + format proof for contract call
├── frontend/src/services/
│   ├── zkProof.ts                 # Client-side proof generation (snarkjs)
│   └── stellar.ts                 # Soroban contract interaction
└── Makefile                       # setup / circuits / build / test / deploy
```

---

## Running Locally

### Prerequisites

```bash
bash scripts/setup.sh
# Installs: Rust 1.89, wasm32 target, stellar-cli, circom, snarkjs
```

### Build & Test the Contract

```bash
make build   # compile Soroban WASM
make test    # run unit tests (5 tests with real proof values)
```

### Compile Circuit & Generate Keys

```bash
make circuits
# → compiles circom, runs trusted setup, exports verification_key.json
# → copies WASM + zkey to frontend/public/circuits/
```

### Deploy to Testnet

```bash
make deploy NETWORK=testnet ACCOUNT=alice
# Initialize with VK:
node scripts/convert_vk.js circuits/age_verifier/verification_key.json
# → paste output into: stellar contract invoke -- initialize --vk '<output>'
```

### Run Frontend

```bash
cd frontend && npm install && npm run dev
```

---

## Demo

> 📹 **[Demo video — coming June 28]**

Demo flow:
1. Connect Freighter wallet to the app
2. Enter a birthdate (private — never leaves the browser)
3. Proof generates client-side via WASM (watch the snarkjs output)
4. Submit transaction — Soroban verifies the Groth16 proof on testnet
5. Soulbound credential token appears in wallet
6. Third-party site checks credential — access granted, zero data shared

---

## Implementation Checklist

### ✅ Implemented & Verified

- [x] **Dev environment** — Rust 1.89, Circom 2.1.9, Stellar CLI 27.0, snarkjs 0.7.6, Node 24
- [x] **Circom circuit compiled** (`circuits/age_verifier/age_verifier.circom`)
  - 305 constraints (Groth16 / BN254)
  - Private inputs: `birthDate`, `minAge`, `currentDate`
  - Public input: `addressHash` (Stellar address as BN254 field element)
  - Public outputs: `isOldEnough`, `commitment = Poseidon(birthDate, addressHash)`
  - Artifacts: `.r1cs`, `.wasm`, `circuit_final.zkey`, `verification_key.json`
- [x] **Real ZK proof generated and verified** ✅
  - Input: `birthDate=2000-01-01`, `minAge=18`, `currentDate=2026-06-23`
  - Output: `isOldEnough=true`, `commitment=0x1d130c12...`
  - Local snarkjs verification: passed
- [x] **Soroban BN254 Groth16 verifier contract** (`contracts/age_verifier/src/lib.rs`)
  - 3 public signals: `[isOldEnough, commitment, addressHash]`
  - Ed25519 Issuer signature check (Option A — outside ZK circuit)
  - Anti-replay nullifier system (30-day persistent storage TTL)
  - Typed error codes: `NotInitialized`, `InvalidProof`, `NullifierUsed`, etc.
- [x] **Contract tests: 3/3 passing** ✅ (`cargo test -p age-verifier`)
  - `test_double_initialize_rejected` — ok
  - `test_verify_before_initialize_rejected` — ok
  - `test_wrong_input_count_rejected` — ok
  - Real VK and proof coordinates hardcoded from actual circuit run
- [x] `scripts/convert_vk.js` — snarkjs VK → Soroban BN254 hex
- [x] `scripts/generate_proof.js` — CLI proof with `addressHash` param
- [x] `scripts/sign_commitment.js` — Issuer Ed25519 keygen + signing
- [x] `scripts/address_to_field.js` — Stellar address → BN254 field element
- [x] `frontend/src/services/zkProof.ts` — client-side snarkjs WASM proof generation
- [x] `frontend/src/services/stellar.ts` — Soroban RPC + Stellar Wallets Kit integration
- [x] `CLAUDE.md` — agent context aligned with Stellar Skills

### 🚧 In Progress (next)

- [ ] Deploy contract to Stellar testnet → get Contract ID
- [ ] `stellar keys generate alice && friendbot` → fund testnet account
- [ ] `stellar contract deploy` → initialize with real VK + Issuer pubkey
- [ ] Frontend: Freighter wallet connection via Stellar Wallets Kit
- [ ] Frontend: client-side proof generation → submit to testnet
- [ ] End-to-end demo: browser proof → on-chain verification → credential

### 📋 Roadmap — Complete Version

**Issuer attestation layer (Option B — in-circuit EdDSA):**
- [ ] Add `issuerSigR[]`, `issuerSigS[]` as private inputs to circuit
- [ ] Add EdDSA signature verifier sub-circuit (circomlib `EdDSAVerifier`)
- [ ] KYC onboarding UI: document upload → Issuer signs → user receives attestation
- [ ] ~3,000 extra R1CS constraints; needs powersOfTau17 (~1.2 GB)
- [ ] Trade-off: eliminates Soroban Ed25519 check but increases proving time

**NFT as Identity (the differentiator):**

Today, Identizy stores the credential as a boolean flag in Soroban persistent storage. The next evolution is turning that credential into a **real Soroban Token (SEP-0041 NFT)** — not just a receipt, but the identity itself.

When the credential *is* an NFT:
- It appears in the user's wallet automatically (Freighter, Lobstr, any Stellar wallet)
- It shows up in Stellar explorers (Stellar.Expert, StellarChain) — publicly auditable, no personal data
- Other Soroban contracts can check `balance(address) > 0` using the standard token interface — composable with any DeFi protocol, DAO, or dApp on Stellar
- It inherits Stellar's payment rail: fast settlement, low fees, global reach
- The soulbound constraint (non-transferable) is enforced at the token level: `transfer()` always panics

This is the vision: **your identity is a token you carry in your wallet, composable with the entire Stellar ecosystem, without ever revealing who you are.**

Implementation steps:
- [ ] Implement SEP-0041 token interface in contract (`mint`, `balance`, `transfer` blocked)
- [ ] `mint_credential(address)` called internally after `verify()` succeeds
- [ ] Token metadata: `name="Identizy Credential"`, `symbol="IDZC"`, `decimals=0`
- [ ] `transfer()` returns `ContractError::SoulboundNonTransferable` always
- [ ] Show token in frontend dashboard with "Your Identity" UI

**Credential management features:**
- [ ] Expiry: credential valid for N days, then re-verify (configurable per Issuer)
- [ ] Revocation: Issuer can invalidate credentials (e.g., fraudulent document found)
- [ ] Domain binding: per-service nullifiers for session unlinkability
- [ ] Third-party SDK: JS library so any site can verify Identizy in 3 lines

**Production:**
- [ ] Mainnet deployment
- [ ] Integration with real KYC provider (Jumio / Onfido / Persona)
- [ ] Audit of ZK circuit and Soroban contract

---

## Why Stellar

Stellar's Protocol 25 "X-Ray" and Protocol 26 "Yardstick" added the BN254 elliptic curve host functions (`g1_add`, `g1_mul`, `pairing_check`) and Poseidon hash natively to Soroban. This means Groth16 proof verification — the most common ZK proof system, used by Circom — runs efficiently on-chain for the first time on Stellar.

BN254 on Stellar mirrors Ethereum's EIP-196/197 precompiles. Existing Circom circuits **port without modification**. Identizy brings battle-tested ZK infrastructure (Circom + snarkjs) to Stellar's payment rails and institutional settlement network — the natural home for compliant, privacy-preserving identity.

---

## References

Built on the shoulders of:
- [Nethermind Stellar Private Payments](https://github.com/NethermindEth/stellar-private-payments) — BN254 Groth16 verifier pattern
- [soroban-examples / groth16_verifier](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier) — reference Soroban verifier
- [Stellar Skills — ZK Proofs](https://skills.stellar.org/skills/zk-proofs/SKILL.md) — official ZK dev guidance
- [Stellar Skills — Soroban](https://skills.stellar.org/skills/soroban/SKILL.md) — contract patterns
- [circomlib](https://github.com/iden3/circomlib) — circuit primitives (LessThan, EdDSA)
- [snarkjs](https://github.com/iden3/snarkjs) — browser-side Groth16 proving
- Privacy Pools whitepaper (Buterin et al.) — conceptual basis for compliant privacy

---

## Team

> Felipe Segall — [@fsegall](https://github.com/fsegall)

Built for **Stellar Hacks: Real-World ZK** · June 2026
