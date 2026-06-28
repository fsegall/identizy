# Identizy — Security Audit

Internal audit of `contracts/age_verifier/src/lib.rs`.  
Date: June 2026. Auditor: development team (self-audit).

---

## Vulnerabilities Found and Fixed

### [FIXED] 1. Instance storage TTL never extended

**Severity:** Critical  
**File:** `lib.rs` — all functions  

Soroban charges rent on storage. If no transaction touches the contract for ~30 days, `instance()` storage (VK, admin, treasury, fee) expires silently. The contract becomes permanently inoperable — all reads return `None`, all writes fail.

**Fix:** Added `env.storage().instance().extend_ttl(TTL_MIN, TTL_MAX)` to every state-modifying function. `TTL_MIN = 17_280` (~1 day), `TTL_MAX = 518_400` (~30 days).

**Residual risk:** If the contract goes completely dormant for 30+ days, TTL still expires. Mitigation: set up an off-chain monitoring script that bumps TTL monthly via a read-only ping.

---

### [FIXED] 2. PendingWithdrawal stored in instance storage

**Severity:** High  
**File:** `lib.rs` — `request_withdraw`, `execute_withdraw`, `cancel_withdraw`  

The 48h timelock for emergency withdrawals was stored in `instance()` storage, which can expire before the timelock completes. If instance storage expired between `request_withdraw()` and `execute_withdraw()`, the pending withdrawal data would be lost — the funds would remain in the contract with no way to request again without a new admin call.

**Fix:** Moved `PendingWithdrawal` to `persistent()` storage with a dedicated TTL of `WITHDRAW_DELAY_LEDGERS + 17_280` (~3.5 days), ensuring it outlives the timelock window.

---

### [FIXED] 3. `set_fee()` accepted negative and unbounded values

**Severity:** Medium  
**File:** `lib.rs` — `initialize`, `configure_fees`, `set_fee`  

`set_fee(-1)` was accepted. The `if fee > 0` guard in `verify()` prevented an inverse transfer (treasury → user), but a negative fee is semantically invalid and could indicate a bug or a compromised admin testing boundaries. Additionally, no upper bound existed — an admin could set `fee = i128::MAX`, making `verify()` effectively uncallable (DoS on new credentials).

**Fix:** Added `InvalidFeeAmount = 11` error. Validation: `fee_amount < 0 || fee_amount > MAX_FEE` returns the error. `MAX_FEE = 100_000_000` (10.00 USDC).

---

## Known Remaining Vulnerabilities

### [OPEN] 4. `configure_fees()` has no authentication — front-runnable

**Severity:** High  
**File:** `lib.rs` — `configure_fees`  

`configure_fees()` is callable by anyone, guarded only by the check that `Admin` is not yet set. After a WASM upgrade (which clears `Admin` from the old contract state), there is a window of one or more ledgers before the team can call `configure_fees()`. A bot monitoring the blockchain could call it first with a malicious admin/treasury address.

**Scope clarification:** `upgrade()` changes the WASM but preserves all storage. After an upgrade, `Admin` is still set in instance storage. `configure_fees()` checks `if env.storage().instance().has(&DataKey::Admin)` and returns `AlreadyInitialized` if Admin is already set — so it cannot be called after the first `initialize()`.

`configure_fees()` is therefore only vulnerable on the **first deploy**, before `initialize()` is called. After that, Admin is set and `configure_fees()` is permanently locked.

**Mitigation:** Deploy and `initialize()` must be called in the same transaction (Stellar supports multiple operations per transaction). Do not deploy without immediately initializing.

---

### [OPEN] 5. `upgrade()` has no timelock

**Severity:** Medium (mitigated by multisig)  
**File:** `lib.rs` — `upgrade`  

A compromised admin quorum (2-of-3 malicious signers) could upgrade the contract to arbitrary WASM — code that redirects fees, invalidates credentials, or introduces backdoors. There is no delay between `upgrade()` call and effect.

**Mitigation:** The 2-of-3 multisig threshold on `upgrade()` means a single compromised key cannot perform this attack. A timelock on upgrades would add another layer but significantly increase operational complexity.

**Accepted risk:** For a hackathon-stage project, the multisig is sufficient. A production audit would recommend a timelock on upgrades.

---

## Liveness Risks (Money Gets Stuck, Not Stolen)

Liveness risks are scenarios where funds or admin access become permanently inaccessible without any malicious action.

### L1. Loss of 2-of-3 multisig keys — HIGH

**Impact:** `execute_withdraw()` and `upgrade()` become permanently inaccessible. Any USDC residual in the contract is locked forever. The contract code cannot be updated.

**Why this is the biggest liveness risk:** It requires no attacker — just accidents (lost hardware wallets, team unavailability, hardware failure without backup).

**Mitigations:**
- Require the backup key (Key C) to be stored in a physically separate location (e.g., safe deposit box at a different institution than Key A and B)
- Document key locations and access procedures in a succession plan accessible to all signers
- Test key recovery annually
- Consider a 2-of-5 setup as the team grows, reducing the impact of any single loss

**Why residual contract balance should be near zero:** Fees are forwarded directly from user to treasury in `verify()` — the contract never accumulates revenue. The only USDC that could be in the contract is from accidental direct transfers. Keep this in mind: if no one accidentally sends USDC to the contract, there is nothing to lose from `execute_withdraw()` being inaccessible.

---

### L2. Loss of treasury account keys — MEDIUM

**Impact:** All fees forwarded to treasury become inaccessible. The contract continues to function normally — credentials are issued, the fee is forwarded — but revenue cannot be spent.

**Mitigation:** Treat treasury keys with the same discipline as signing keys. Use a hardware wallet for the treasury account. Keep a recovery phrase stored offline.

**Recovery path:** If treasury keys are lost but Admin keys are intact, call `set_treasury(new_address)` to redirect future fees to a new treasury. Past fees at the old address are not recoverable without the original key.

---

### L3. Contract instance storage expiry (dormant contract) — MEDIUM

**Impact:** If no transaction touches the contract for ~30 days, instance storage expires. The contract becomes inoperable (all state reads return `NotInitialized`).

**Mitigation:** Run a monthly off-chain script that calls `get_fee()` (or any read function) — this does NOT extend TTL on its own. To extend TTL, call any write function (e.g., `set_fee` with the current value). Or implement a dedicated `bump_ttl()` no-op function that just extends TTL.

**Current state:** TTL is extended on every state-modifying call. As long as users mint credentials regularly, the TTL is maintained automatically.

---

### L4. PendingWithdrawal TTL expiry — LOW

**Impact:** If admin requests a withdrawal but does not execute it within ~1 day after the 48h timelock expires, the persistent storage entry expires. The pending withdrawal data is lost. No funds are lost — they remain in the contract — but the admin must call `request_withdraw()` again to initiate a new request.

**Mitigation:** After requesting a withdrawal, execute it as soon as the timelock expires. The window is approximately 1 day after the 48h delay.

---

### L5. Incorrect amount in `request_withdraw()` — LOW

**Impact:** If admin requests a withdrawal for more USDC than the contract holds, `execute_withdraw()` will attempt a transfer that the token contract rejects. The transaction reverts atomically (Soroban semantics), so `PendingWithdrawal` is NOT removed. Admin must call `cancel_withdraw()` and request again with the correct amount.

**Mitigation:** Query the contract's USDC balance via the USDC token contract before calling `request_withdraw()`.

---

## Conflict Analysis: Can the Security Layers Block Each Other?

| Scenario | Blocked? | Resolution |
|---|---|---|
| Admin keys lost (1-of-3) | No — 2 remaining keys still meet threshold | Replace lost key via Set Options with 2 remaining signers |
| Admin keys lost (2-of-3) | Yes — `execute_withdraw` and `upgrade` permanently inaccessible | No recovery path. Keep backup key secure. |
| Treasury keys lost | No — contract still works, fees still forward | `set_treasury(new_address)` with admin keys |
| Instance storage expires | Yes — contract inoperable | Must re-deploy. Keep contract active with monthly TTL bumps. |
| PendingWithdrawal expires | No — just inconvenient | `request_withdraw()` again |
| Wrong amount in request | No — tx reverts atomically | `cancel_withdraw()` then `request_withdraw()` with correct amount |
| configure_fees() front-run | Yes on first deploy — permanent admin loss | Deploy + initialize in same transaction |

---

## Operational Recommendations

### Deploy procedure (prevents configure_fees front-run)
```
Single transaction:
  1. stellar contract deploy --wasm ...
  2. contract.initialize(vk, issuer_key, admin, treasury, usdc, fee=0)
```
Never split deploy and initialize into separate transactions.

### Multisig setup (prevents single-key compromise)
See [monetization_plan.md — Layer 3](monetization_plan.md) for full setup instructions.

**Key storage rule:**
- Key A (Felipe): hardware wallet, office
- Key B (Paulo): hardware wallet, home
- Key C (Backup): hardware wallet OR paper, safe deposit box at a bank

**Never store two keys in the same physical location.**

### Monthly TTL maintenance
```bash
# Call any admin function to extend instance storage TTL
# (use current fee value to make it a no-op)
CURRENT_FEE=$(stellar contract invoke --id $CONTRACT_ID -- get_fee)
stellar contract invoke --id $CONTRACT_ID --source admin -- set_fee --fee_amount $CURRENT_FEE
```

### Treasury balance monitoring
The treasury account should be monitored weekly. If the balance unexpectedly stops growing after fee activation, investigate whether `set_treasury` was called with an unintended address.

### Key rotation procedure (signer compromise)
```
1. Convene remaining 2 signers
2. stellar tx set-options --source ADMIN_ACCOUNT
     --signer-key COMPROMISED_KEY --signer-weight 0   # remove
     --signer-key NEW_KEY         --signer-weight 1   # add
3. Verify with: stellar account info ADMIN_ACCOUNT
4. Old key can no longer sign — even pending execute_withdraw() calls fail
```

---

## Summary

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | Instance storage TTL not extended | Critical | Fixed |
| 2 | PendingWithdrawal in instance storage | High | Fixed |
| 3 | Negative/unbounded fee | Medium | Fixed |
| 4 | configure_fees() front-runnable | High | Mitigated (operational) |
| 5 | upgrade() has no timelock | Medium | Accepted (multisig) |
| L1 | Multisig key loss (2-of-3) | High liveness | Mitigated (key discipline) |
| L2 | Treasury key loss | Medium liveness | Mitigated (set_treasury) |
| L3 | Instance storage expiry | Medium liveness | Mitigated (monthly TTL bump) |
| L4 | PendingWithdrawal TTL expiry | Low liveness | Documented |
| L5 | Wrong withdrawal amount | Low liveness | Documented |
