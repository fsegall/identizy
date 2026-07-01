# Identizy — Verification Flow

This document describes the full end-to-end flow of an Identizy credential issuance, from document verification to on-chain credential, and how each component interacts.

---

## Principals

| Principal | Who | Role |
|---|---|---|
| **User** | End user with a Stellar wallet | Proves an attribute (e.g. age ≥ 18) without revealing it |
| **KYC Provider** | Jumio / Onfido | Verifies real identity documents; Identizy never receives the documents |
| **Identizy Issuer** | Identizy backend (Supabase edge function) | Receives only the verified attribute; signs the cryptographic commitment |
| **Stellar Contract** | `age_verifier` on Stellar mainnet | Verifies the ZK proof + Issuer signature; mints the on-chain credential |
| **Verifier** | Any third-party service | Calls `has_credential(addressHash)` — never contacts Identizy |

---

## Step-by-Step Flow

### Phase 1 — KYC (document never reaches Identizy)

```
User browser                  Identizy Issuer               KYC Provider (Jumio/Onfido)
     │                               │                               │
     │  1. "I want to verify"        │                               │
     │──────────────────────────────▶│                               │
     │                               │  2. Create verification       │
     │                               │     session via API           │
     │                               │──────────────────────────────▶│
     │                               │                               │
     │                               │  3. Session token + URL       │
     │                               │◀──────────────────────────────│
     │                               │                               │
     │  4. Redirect to hosted        │                               │
     │     KYC flow (Jumio/Onfido    │                               │
     │     page or SDK iframe)       │                               │
     │◀──────────────────────────────│                               │
     │                               │                               │
     │  5. User uploads document     │                               │
     │     + selfie DIRECTLY to      │                               │
     │     KYC Provider              │                               │
     │──────────────────────────────────────────────────────────────▶│
     │                               │                               │
     │                               │  6. Webhook: verified result  │
     │                               │  { birthDate: "2000-01-01",   │
     │                               │    verified: true }           │
     │                               │◀──────────────────────────────│
```

**What Identizy receives:** only the structured verified attribute (`birthDate`).  
**What Identizy never receives:** the identity document, selfie, or document number.  
**What the KYC Provider stores:** documents per their own retention policy (not Identizy's concern).

---

### Phase 2 — Commitment signing (Identizy Issuer)

```
Identizy Issuer
     │
     │  7. Compute commitment = Poseidon(birthDate, addressHash)
     │     where addressHash = BN254 field element of user's Stellar address
     │
     │  8. Sign commitment with Ed25519 issuer private key
     │     issuerSig = Ed25519.sign(commitment, ISSUER_PRIVKEY)
     │
     │  9. Return { birthDate, issuerSig } to user's browser
     │     (private key never leaves the edge function)
```

The `addressHash` is derived client-side from the user's Stellar address and sent to the Issuer. This binds the commitment to the user's specific wallet — a credential generated for one address is cryptographically useless for any other.

---

### Phase 3 — ZK proof generation (browser, client-side)

```
User browser (snarkjs WASM)
     │
     │  Private inputs (never leave the browser):
     │    birthDate    — received from Issuer (step 9)
     │    minAge       — 18
     │    currentDate  — current Unix timestamp
     │    addressHash  — derived from user's Stellar address
     │
     │  Public input:
     │    addressHash  — same value, exposed to verifier
     │
     │  Circuit proves:
     │    (a) currentDate - birthDate ≥ minAge × 31,557,600   → isOldEnough = 1
     │    (b) commitment = Poseidon(birthDate, addressHash)    → matches Issuer's sig
     │
     │  Output: { proof, publicSignals: [isOldEnough, commitment, addressHash] }
```

`birthDate` is never sent to the blockchain. The ZK proof proves knowledge of a `birthDate` that satisfies the age constraint, without revealing the value.

---

### Phase 4 — On-chain verification (Stellar contract)

```
User browser                        Stellar (age_verifier contract)
     │                                           │
     │  10. Submit transaction:                  │
     │      verify(caller, proof,                │
     │             pubInputs, nullifier,         │
     │             issuerSig)                    │
     │──────────────────────────────────────────▶│
     │                                           │
     │                                           │  11. Check: isOldEnough == 1
     │                                           │  12. Verify Groth16 proof (BN254)
     │                                           │  13. Verify Ed25519 issuerSig
     │                                           │       over commitment bytes
     │                                           │  14. Check nullifier not used
     │                                           │  15. Mint credential:
     │                                           │       Credential(addressHash) = true
     │                                           │       CredentialAddr(caller)  = true
     │                                           │
     │  ✅ Credential minted on-chain            │
     │◀──────────────────────────────────────────│
```

The contract stores only two booleans — `Credential(addressHash)` and `CredentialAddr(caller)`. No name, no birthdate, no document reference, no issuer session ID reaches the chain.

---

### Phase 5 — Verification by third parties (no Identizy involvement)

```
Third-party service                 Stellar (age_verifier contract)
     │                                           │
     │  has_credential_by_address(userAddress)   │
     │──────────────────────────────────────────▶│
     │                                           │
     │  true / false                             │
     │◀──────────────────────────────────────────│
```

Three lines of code. No Identizy API key. No Identizy server. No document. The verifier reads directly from the blockchain.

---

## Privacy Guarantees

| What | Who knows it | Who doesn't |
|---|---|---|
| Identity document | KYC Provider only | Identizy, Stellar, Verifier |
| Birth date | User + KYC Provider + Issuer (ephemeral) | Stellar, Verifier |
| Stellar address | User + Verifier + Stellar | KYC Provider |
| That a credential exists | Verifier + Stellar | KYC Provider |
| Which service was accessed | User + Verifier | Identizy, KYC Provider, Stellar |

The issuer receives `birthDate` transiently to compute the commitment and immediately discards it — it is not stored.

---

## Why the Issuer signature matters

The ZK circuit takes `birthDate` as a private input. Without the Issuer's signature, nothing prevents a user from feeding a false birthdate (e.g. `1900-01-01`) into the circuit and generating a valid proof. The Ed25519 signature binds the commitment — and therefore the proof — to a `birthDate` that was actually extracted from a real document by a licensed provider. The document is the trust anchor; the ZK proof is the privacy layer on top of it.

---

## Data Flow Summary

```
Document → KYC Provider → birthDate → Identizy Issuer → commitment + sig
                                                                │
                                                                ▼
                                              User browser → ZK proof
                                                                │
                                                                ▼
                                                    Stellar contract → credential
                                                                │
                                                                ▼
                                               Third-party → has_credential() → true
```
