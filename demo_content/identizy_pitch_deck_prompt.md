# Prompt — Identizy Pitch Deck

Use this prompt with Claude, ChatGPT, or a presentation tool (Gamma, Beautiful.ai, etc.).

---

## Prompt

Create a 10-slide investor pitch deck for a Web3 identity startup. Use the structure and content below exactly. Tone: clear, modern, privacy-first. Audience: seed-stage investors, blockchain ecosystem funds, and enterprise partners looking for identity infrastructure on Stellar.

---

**Slide 1 — Cover**
Product name: Identizy
Tagline: "Prove who you are, once. Be anyone, everywhere."
Subtitle: Anonymous credentials on Stellar — privacy-first identity for the web3 era
Visual: shield motif with cryptographic/blockchain aesthetic

---

**Slide 2 — The Problem**
Title: "Identity Verification Trades Privacy for Trust"

Two sections:

"Every Service Takes Your Documents"
Every service that checks your age, citizenship, or eligibility asks you to hand over a document — passport, driver's license, selfie — and stores it.

"Data Gets Held, Leaked, and Sold"
A 2023 breach at a KYC provider exposed 1.1 million identity documents from financial institutions worldwide.

Every platform that requires compliance runs its own KYC — and stores your documents.

Bottom note: "You prove who you are dozens of times. Each time, you give away more than necessary. The more services you use, the more copies of your identity exist."

---

**Slide 3 — The Solution**
Title: "KYC Once. Verified Everywhere. No Copies."

Transition line (bridge from problem):
Identizy collapses that into one credential. KYC once. Verified everywhere. No copies.

Title below: "Prove It Once. Use It Everywhere."

One paragraph:
Identizy lets users verify their age — or any credential — once with a real document. A cryptographic proof is generated in their browser and verified by a Stellar smart contract. The result is a soulbound credential tied to their wallet address. Any service can check it with a single blockchain query. No document stored. No Identizy server involved. No re-verification.

Key properties (three icons):
- 🔒 Zero-Knowledge: your birthdate never leaves your device after the initial verification
- ⛓️ On-chain: credential lives on Stellar, verifiable by anyone, owned by no one
- ♾️ Reusable: one credential, infinite services, forever

---

**Slide 4 — How It Works**
Title: "Three Steps. One Credential. No Data Stored."

Visual flow (left to right):

Step 1 — KYC Once:
User uploads a government ID to a licensed KYC provider. Provider verifies the document, signs a cryptographic attestation ("this person is over 18"), and discards the raw document.

Step 2 — Generate ZK Proof:
User's browser computes a Groth16 zero-knowledge proof using the attestation. The proof mathematically confirms age eligibility without revealing the birthdate. Takes seconds.

Step 3 — Mint Credential on Stellar:
Proof submitted to a Soroban smart contract. Contract verifies the proof on-chain using BN254 elliptic curve pairing (Protocol 25). Credential minted — soulbound to the user's wallet address.

Result: Any third-party service calls `has_credential(address)` → `true`. Done. No additional KYC. No documents stored anywhere.

---

**Slide 5 — The Technology**
Title: "Battle-Tested Cryptography. Production on Stellar Mainnet."

Three pillars:
1. Circom + Groth16 (BN254) — industry-standard ZK proving system, same stack used by Tornado Cash, Semaphore, and Worldcoin. Proof generated in-browser via WebAssembly.
2. Stellar Soroban (Protocol 25 "X-Ray") — BN254 elliptic curve host functions (CAP-0074) and Poseidon hash (CAP-0075) available natively in the VM. On-chain proof verification costs ~0.001 XLM.
3. W3C Verifiable Credentials model — Issuer (KYC provider) → Holder (user) → Verifier (any service). Decentralized trust triangle, no Identizy in the verification path.

Proof stats: 305 R1CS constraints · Groth16 · BN254 · Poseidon commitment
Verified on Stellar mainnet: tx `0d8687d641401ed1bbc98df2cb6fab67c02abeb6bd5fa4762774afba3ac2b207`

---

**Slide 6 — Use Cases**
Title: "Any Service That Asks 'Are You 18+?' Is a Customer"

Table:
| Sector | Today | With Identizy |
|--------|-------|---------------|
| Alcohol & cannabis e-commerce | Upload ID → retailer stores it | `has_credential(address)` → ship |
| Adult content platforms | Selfie + passport → breach risk | Wallet connect → credential check |
| DeFi / regulated protocols | Full KYC per platform × N platforms | One credential, all platforms |
| Online gambling | Platform holds passport copies | One contract call, zero docs stored |
| Clinical research | Identified records cross perimeter | ZK consent credential + pseudonymous data |
| Events & ticketing | ID check per person in line | Purchase gated at `has_credential` |

Bottom: "The same credential works across every service, on any chain that can query Stellar."

---

**Slide 7 — Business Model**
Title: "Infrastructure Fees + Issuer Network"

Three revenue streams:

1. Credential Issuance Fee — small fee per credential minted (paid by user or sponsoring service). Scales with adoption.

2. Verifier API — services that want a REST abstraction over `has_credential` pay a monthly subscription. Direct on-chain call always remains free.

3. Issuer Network — Identizy operates as the default KYC issuer for consumer flows. Enterprise clients can plug in their own licensed KYC provider and pay a white-label fee.

Long-term moat: network effect. Every new service that accepts the credential increases the value of having one — driving more users to get credentialed.

---

**Slide 8 — Market**
Title: "Identity Verification Is a $20B+ Market Being Rebuilt"

Key numbers:
- Global identity verification market: $12B in 2023, projected $33B by 2030 (CAGR ~16%)
- KYC compliance cost for a mid-size fintech: $500K–$2M/year
- Web3 wallets with verified users: <5% today — regulatory pressure will force this to change
- Stellar ecosystem: 8M+ accounts, institutional settlement network, growing DeFi/RWA layer

Positioning: "Identizy is the identity layer Stellar needs to serve regulated industries — and the privacy layer Web3 users deserve."

---

**Slide 9 — Traction**
Title: "From Zero to Mainnet in 6 Weeks"

Timeline:
- May 2026: Circuit compiled (305 constraints), contract deployed to testnet
- June 2026: End-to-end flow live — browser ZK proof → Freighter → on-chain verification → credential issued
- June 24, 2026: **First ZK credential minted on Stellar mainnet** (contract `CBPG3K…MMTY`)
- June 2026: Submitted to Stellar Hacks Real-World ZK hackathon ($10,000 XLM prize pool)
- Next: KYC provider integration, SEP-0041 soulbound token, ecosystem partnerships

Signals:
- ✅ Open-source repo on GitHub
- ✅ Mainnet contract live and callable
- ✅ Healthcare service layer use case identified and in development (separate product)

---

**Slide 10 — Team & Ask**
Title: "Who We Are and What We Need"

Team:
- Felipe Segall — product, blockchain infrastructure, ZK systems (Livre Solutions)
[Add photo, LinkedIn, relevant background — previous companies, roles]
[Add co-founders / advisors as applicable]

The Ask:
- Raising: [amount] pre-seed / seed
- Use of funds: KYC provider integration, SEP-0041 credential token, security audit, go-to-market
- Looking for: web3 ecosystem investors, Stellar ecosystem fund, identity/privacy-focused angels

Closing line:
"The proof is on-chain. The market is moving. We are the privacy layer that regulated Web3 needs."

---

## Additional instructions for the AI

- Keep each slide to one key idea — no walls of text
- Slide 5 can be slightly more technical — the audience will include technical evaluators
- Use the mainnet deployment as a credibility anchor throughout — it differentiates from most hackathon projects
- Tone: confident but not overpromising. "Production-grade primitive" not "we will disrupt KYC"
- Visual style: dark background, gradient accents (blue → purple), minimal, modern
