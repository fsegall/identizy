# Identizy — Monetization Plan

## Position

Identizy is **pure infrastructure** — we are not a KYC provider and not an API. We do not hold user data, do not process payments on behalf of third parties, and do not intermediate verification calls. Every fee is collected on-chain, trustlessly, at the Soroban contract level.

This changes the monetization model fundamentally: **revenue is protocol revenue**, not SaaS revenue.

---

## Revenue Streams

### 1. Credential Issuance Fee (Live — contract implemented)

Charged in **USDC** at the moment a user calls `verify()` to mint their credential.

| Parameter | Value |
|---|---|
| Token | USDC (Circle, native on Stellar) |
| Launch fee | $0 (free during growth phase) |
| Target fee | $2.00 USDC (20,000,000 units, 7 decimals) |
| Frequency | Once per credential (one-time lifetime fee) |
| Adjustable? | Yes — `set_fee()` by admin, no redeploy needed |

**Why USDC, not XLM:** XLM price volatility would make the fee unpredictable. A $2 USDC fee is always $2 regardless of market conditions.

**Collection mechanism:** `token.transfer(caller → treasury, fee)` inside `verify()`, authorized atomically by the user in the same transaction. No pre-approval step required (Soroban auth model). Fees **never accumulate in the contract** — forwarded instantly to the treasury address, which is an independent account not involved in contract or app logic.

---

### 2. NFT Avatar Mint Fee (Roadmap)

When the credential is upgraded to a SEP-0041 soulbound token with a visual identity (avatar NFT), a separate one-time fee will be charged to associate an avatar with the credential.

| Parameter | Value |
|---|---|
| Token | USDC |
| Target fee | $1.00 USDC |
| Frequency | Once per avatar assignment |
| Transferable? | Avatar NFT can be transferable; credential remains soulbound |

---

### 3. KYC Provider Referral (Roadmap)

Identizy is the Web3 distribution channel for licensed KYC providers (Jumio, Onfido, iDenfy). We send verified users to them; they pay volume-based referral fees.

| Parameter | Notes |
|---|---|
| Model | Revenue share per completed KYC |
| Typical rate | $0.50–$1.50 per verification (varies by provider and volume) |
| Implementation | Off-chain commercial agreement; no contract change needed |

---

### 4. Credential Type Licensing (Roadmap)

Third parties that want to register new credential types on the Identizy protocol (income verification, residency, professional credentials) pay an activation fee and a revenue share on issuance.

| Parameter | Notes |
|---|---|
| Model | Flat activation fee + % of issuance revenue |
| Implementation | Requires a credential registry contract (future upgrade) |

---

### 5. Verifier SDK / Analytics (Roadmap)

`has_credential()` is free on-chain forever — this is a feature, not a limitation. It drives adoption. Revenue comes from the **tooling layer above it**: SDKs, webhooks, batch queries, compliance dashboards.

| Parameter | Notes |
|---|---|
| Model | SaaS subscription (B2B, enterprise verifiers) |
| Implementation | Off-chain service; no contract dependency |

---

### 6. Avatar Secondary Market Royalties (Roadmap)

If avatar NFTs become tradeable on secondary markets (Lobstr, etc.), the SEP-0041 standard allows a royalty on each resale.

| Parameter | Notes |
|---|---|
| Model | % royalty per secondary sale |
| Implementation | Built into the SEP-0041 avatar contract |

---

## Treasury Security Model

The contract is **not a custodian** — fees forward directly from the user to the treasury. Three independent layers protect the system.

### Layer 1 — Direct Fee Forwarding (primary)

```
verify() → token.transfer(user → treasury)
```

Fees never touch the contract balance. There is nothing to steal from the contract. The treasury is an independent Stellar account with no role in contract or app logic.

**Treasury rotation:** `set_treasury(new_address)` — admin auth, no timelock required (no funds move). Previous treasury funds remain at the old address.

### Layer 2 — 48h Timelock on Emergency Withdrawals

If residual USDC ends up in the contract (e.g., direct transfer by mistake), withdrawal requires a 48h timelock:

```
admin → request_withdraw(to, amount)
        ↓ 34,560 ledgers (~48h) pass
admin → execute_withdraw()         ← funds leave the contract
```

| Function | Auth | Effect |
|---|---|---|
| `request_withdraw(to, amount)` | Admin | Locks withdrawal for 48h |
| `execute_withdraw()` | Admin | Executes after timelock expires |
| `cancel_withdraw()` | Admin | Cancels in-flight request |
| `get_pending_withdrawal()` | Anyone | Read-only visibility |

**Key property:** `execute_withdraw()` also requires the current admin key. If the key is rotated after a compromised `request_withdraw()`, the attacker cannot execute.

### Layer 3 — Stellar Multisig (account-level, no contract change needed)

The `admin` address stored in the contract is a Stellar account. Stellar natively supports M-of-N multi-signature thresholds. The contract only calls `admin.require_auth()` — the auth system handles the rest transparently.

**Recommended setup:**

```
Admin Stellar account
  Signers:
    Key A — Felipe (hardware wallet)
    Key B — Paulo  (hardware wallet)
    Key C — Backup (offline, hardware wallet)
  Thresholds:
    Low  (set_fee, set_treasury, request_withdraw, cancel_withdraw): 1 of 3
    High (execute_withdraw, upgrade): 2 of 3
```

With this setup, a single compromised key cannot move funds or upgrade the contract unilaterally.

**Admin key rotation:** done via Stellar account management (add/remove signers, update thresholds). The contract address never changes. No contract upgrade needed.

**Treasury key rotation:** `set_treasury(new_address)` — single admin call, instant, no migration.

---

## Contract Interface — Admin Functions

```rust
// Fee management
fn get_fee(env: Env) -> i128
fn set_fee(env: Env, fee_amount: i128) -> Result<(), Error>       // admin

// Treasury management
fn get_treasury(env: Env) -> Option<Address>
fn set_treasury(env: Env, new_treasury: Address) -> Result<(), Error>  // admin

// Emergency withdrawal (48h timelock — for residual contract balance only)
fn request_withdraw(env: Env, to: Address, amount: i128) -> Result<(), Error>  // admin
fn execute_withdraw(env: Env) -> Result<(), Error>                              // admin, after delay
fn cancel_withdraw(env: Env) -> Result<(), Error>                               // admin

// Contract upgrade (WASM only, same Contract ID, storage preserved)
fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error>           // admin

// Migration (existing deployed contracts, one-shot)
fn configure_fees(env: Env, admin, usdc_token, fee_amount) -> Result<(), Error>
```

---

## Fee Schedule

| Milestone | Action | Fee |
|---|---|---|
| Hackathon / launch | Deploy with fee = 0 | Free |
| First 1,000 credentials | Keep free, measure adoption | Free |
| Growth phase | Enable fee | $2.00 USDC |
| Avatar NFT launch | Enable avatar fee | $1.00 USDC |

Fee changes: single `set_fee()` call by admin — no redeploy, no migration, instant effect.

---

## Attack Scenarios and Mitigations

| Scenario | Mitigation |
|---|---|
| Admin key stolen, attacker requests withdraw | 48h timelock — cancel or rotate key before execution |
| Admin key stolen, attacker tries to execute immediately | Timelock blocks — `execute_withdraw` fails with `WithdrawTimelockActive` |
| Admin key stolen, attacker rotates key via Stellar | Requires 2-of-3 multisig threshold — single key insufficient |
| Admin key stolen, attacker upgrades contract WASM | Requires 2-of-3 multisig threshold |
| Attacker replays a proof | Nullifier stored on-chain — `NullifierUsed` error |
| User transfers credential to another address | `addressHash` in ZK proof doesn't match new address — `has_credential` returns false |
| User generates fake KYC data | No Issuer Ed25519 signature → proof rejected (`InvalidIssuerSig`) |
