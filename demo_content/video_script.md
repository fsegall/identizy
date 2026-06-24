# Identizy — Demo Video Script (2–3 min)

**Hackathon:** Stellar Hacks: Real-World ZK
**Target length:** 2:30

---

## [0:00 – 0:20] The Problem

> **Narration:**
> "Every time you sign up for a service that requires age verification, you hand over your full identity — passport, date of birth, sometimes a selfie. That data gets stored, leaked, and sold. There has to be a better way."

*Show: a simple slide or the Identizy landing page hero section.*

---

## [0:20 – 0:40] The Solution

> **Narration:**
> "Identizy lets you prove you're over 18 — once — using a zero-knowledge proof on the Stellar blockchain. The service gets a yes or no answer. Nothing else. Your birthdate never leaves your device."

*Show: scroll the landing page, highlight the four feature cards.*

---

## [0:40 – 1:00] Connect Your Wallet

> **Narration:**
> "The flow starts by connecting a Stellar wallet. We use Freighter — no account creation, no email."

*Show:*
- Click **Connect Wallet** on the landing page
- Freighter popup opens
- Approve the connection
- Wallet address appears on the Connect page

---

## [1:00 – 1:30] Generate the ZK Proof (in the browser)

> **Narration:**
> "Enter your date of birth. The Groth16 proof is computed right here in the browser using our compiled Circom circuit. The birthdate never touches a server."

*Show:*
- Navigate to the Proof Generation page
- Type a date of birth (≥ 18 years ago)
- Click **Generate & Mint Credential**
- Watch the three progress steps animate:
  - **Generating ZK proof** — Groth16 computed via snarkjs WASM
  - **Issuer attestation** — Poseidon commitment signed with Ed25519
  - **Submitting on-chain** — Freighter popup appears

---

## [1:30 – 2:00] Sign with Freighter & Submit On-Chain

> **Narration:**
> "Freighter signs the Soroban transaction. The contract verifies the proof using the BN254 pairing check introduced in Stellar Protocol 25 — no trusted third party, no oracle."

*Show:*
- Freighter signing popup
- Approve the transaction
- "Credential issued!" confirmation with the transaction hash

---

## [2:00 – 2:20] Dashboard — Credential Active

> **Narration:**
> "The credential is now live on-chain. Any third-party service can call `has_credential(address)` directly on Stellar — no Identizy API needed."

*Show:*
- Dashboard page: **"Your on-chain age credential is valid"**
- Green badge, transaction hash visible

---

## [2:20 – 2:30] On-Chain Proof in the Explorer

> **Narration:**
> "Here's the transaction on Stellar Expert. You can see the Groth16 proof parameters — a, b, c — and the public signals: isOldEnough = 1, Poseidon commitment, and the address hash. Verified on Stellar mainnet."

*Show:*
- Open stellar.expert with the transaction
- Point to the `a`, `b`, `c` curve points and the public signals array

---

## Key Talking Points

- **Privacy:** birthdate is a private input — only the proof goes on-chain
- **No server:** verifier calls the contract directly, Identizy is not in the loop
- **Mainnet:** contract `CBPG3KIS6NEGWANQFEKWKFYFENECUWG4KLJZ7KN25SCPKODHFO33MMTY` proven on Stellar Public Network
- **Tech stack:** Circom 2 + Groth16 + BN254 (CAP-0074) + Poseidon (CAP-0075) + Soroban + Freighter

---

## Contract Links

| Network | Contract | Proof TX |
|---|---|---|
| Mainnet | `CBPG3KIS6NEGWANQFEKWKFYFENECUWG4KLJZ7KN25SCPKODHFO33MMTY` | `0d8687d641401ed1bbc98df2cb6fab67c02abeb6bd5fa4762774afba3ac2b207` |
| Testnet | `CBY4RHLTT6CWB5K7M6IEMCI2BUVWAYAHOUS2XUG5HH2PDMDM77FIWFER` | `c4db0d131a3d4a416087c6e0571f7cd0724be32e49f70feae8e295969e9bce76` |
