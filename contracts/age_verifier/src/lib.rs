#![no_std]

// ─────────────────────────────────────────────────────────────────────────────
// AgeVerifier — Soroban BN254 Groth16 verifier with Poseidon commitment
//
// Public signals from the circuit (order matters for Groth16 IC vector):
//   pub_inputs[0] = isOldEnough   — 1 if age ≥ minAge, else 0
//   pub_inputs[1] = commitment    — Poseidon(birthDate, addressHash)
//   pub_inputs[2] = addressHash   — BN254 field element of caller's Stellar address
//
// Verification flow:
//   1. Collect USDC issuance fee (skipped if fee == 0)
//   2. Groth16 pairing check (BN254 host functions)
//   3. Assert isOldEnough == 1
//   4. Ed25519 signature check: Issuer.sign(commitment) is valid
//   5. Anti-replay: nullifier not previously used
//   → mint soulbound credential on success
//
// Option A architecture: Issuer signature verified OUTSIDE the ZK circuit,
// using Soroban's native ed25519_verify host function. The Poseidon commitment
// ties the off-chain KYC attestation to the on-chain proof without adding
// EdDSA constraints to the circuit (~3000+ extra constraints avoided).
// ─────────────────────────────────────────────────────────────────────────────

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    crypto::bn254::{Fr, Bn254G1Affine as G1Affine, Bn254G2Affine as G2Affine},
    token, vec, Address, BytesN, Env, Vec,
};

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AgeVerifierError {
    NotInitialized        = 0,
    AlreadyInitialized    = 1,
    MalformedPublicInputs = 2,
    InvalidProof          = 3,
    NullifierUsed         = 4,
    AgeConstraintFailed   = 5,   // isOldEnough != 1
    InvalidIssuerSig      = 6,   // Ed25519 sig from Issuer rejected
    Unauthorized          = 7,   // caller is not the admin
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Vk,
    IssuerPubKey,
    Nullifier(BytesN<32>),
    Credential(BytesN<32>),   // credential record keyed by address hash
    Admin,                    // Address — can call set_fee / withdraw / upgrade
    UsdcToken,                // Address — USDC SAC contract on this network
    Fee,                      // i128 — USDC units (7 decimals). 20_000_000 = 2.00 USDC
}

// ── Types ─────────────────────────────────────────────────────────────────────
//
// Byte encoding (Ethereum-compatible, EIP-196/197):
//   G1 → x BE (32) || y BE (32)                         = 64 bytes
//   G2 → x.c1 BE (32) || x.c0 BE (32) || y.c1 || y.c0  = 128 bytes
//   Fr → big-endian 256-bit scalar                       = 32 bytes
// ─────────────────────────────────────────────────────────────────────────────

/// Groth16 verification key — stored once during initialize().
#[contracttype]
#[derive(Clone)]
pub struct StoredVk {
    pub alpha: BytesN<64>,
    pub beta:  BytesN<128>,
    pub gamma: BytesN<128>,
    pub delta: BytesN<128>,
    /// IC[0..n_public+1] — one entry per public signal + constant term.
    /// For this circuit: IC has 4 entries (3 public signals + 1 constant).
    pub ic:    Vec<BytesN<64>>,
}

/// Groth16 proof submitted by the user.
#[contracttype]
#[derive(Clone)]
pub struct Groth16Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct AgeVerifier;

#[contractimpl]
impl AgeVerifier {
    /// Store the verification key, Issuer public key, admin, USDC token, and fee.
    /// Called once after a fresh deploy.
    ///
    /// `fee_amount` — issuance fee in USDC units (7 decimals).
    ///   0 = free (recommended for launch). 20_000_000 = 2.00 USDC.
    ///   Adjustable post-deploy via set_fee() without redeploying.
    pub fn initialize(
        env: Env,
        vk: StoredVk,
        issuer_pub_key: BytesN<32>,
        admin: Address,
        usdc_token: Address,
        fee_amount: i128,
    ) -> Result<(), AgeVerifierError> {
        if env.storage().instance().has(&DataKey::Vk) {
            return Err(AgeVerifierError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Vk, &vk);
        env.storage().instance().set(&DataKey::IssuerPubKey, &issuer_pub_key);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Fee, &fee_amount);
        Ok(())
    }

    /// Set admin, USDC token, and fee on an already-initialized contract.
    /// Used after a WASM upgrade when the old contract had no fee config.
    /// Fails if Admin is already set (one-shot migration only).
    pub fn configure_fees(
        env: Env,
        admin: Address,
        usdc_token: Address,
        fee_amount: i128,
    ) -> Result<(), AgeVerifierError> {
        if !env.storage().instance().has(&DataKey::Vk) {
            return Err(AgeVerifierError::NotInitialized);
        }
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(AgeVerifierError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Fee, &fee_amount);
        Ok(())
    }

    /// Verify a Groth16 proof, collect the USDC issuance fee, and mint a soulbound credential.
    ///
    /// `caller`      — address paying the fee and receiving the credential.
    ///                 Must match the Stellar address used to derive pub_inputs[2].
    /// `pub_inputs`  — [isOldEnough: Fr(1), commitment: Fr, addressHash: Fr]
    /// `nullifier`   — unique 32-byte anti-replay token (random, client-side).
    /// `issuer_sig`  — Ed25519 signature (64 bytes) from the trusted Issuer over commitment bytes.
    pub fn verify(
        env: Env,
        caller: Address,
        proof: Groth16Proof,
        pub_inputs: Vec<Fr>,
        nullifier: BytesN<32>,
        issuer_sig: BytesN<64>,
    ) -> Result<bool, AgeVerifierError> {
        caller.require_auth();

        // ── Load state ───────────────────────────────────────────────────────
        let stored_vk: StoredVk = env
            .storage().instance().get(&DataKey::Vk)
            .ok_or(AgeVerifierError::NotInitialized)?;

        let issuer_pub_key: BytesN<32> = env
            .storage().instance().get(&DataKey::IssuerPubKey)
            .ok_or(AgeVerifierError::NotInitialized)?;

        // ── Collect USDC issuance fee ────────────────────────────────────────
        // Fee is 0 during launch / if not configured — skipped entirely.
        // The token.transfer() call requires caller to authorize the sub-call;
        // the Soroban auth framework bundles this into the same transaction.
        let fee: i128 = env.storage().instance().get(&DataKey::Fee).unwrap_or(0);
        if fee > 0 {
            let usdc_token: Address = env.storage().instance()
                .get(&DataKey::UsdcToken)
                .ok_or(AgeVerifierError::NotInitialized)?;
            token::Client::new(&env, &usdc_token)
                .transfer(&caller, &env.current_contract_address(), &fee);
        }

        // ── Anti-replay ──────────────────────────────────────────────────────
        if env.storage().persistent().has(&DataKey::Nullifier(nullifier.clone())) {
            return Err(AgeVerifierError::NullifierUsed);
        }

        // ── Validate public inputs count ─────────────────────────────────────
        // Circuit exposes 3 public signals: [isOldEnough, commitment, addressHash]
        if pub_inputs.len() != 3 {
            return Err(AgeVerifierError::MalformedPublicInputs);
        }

        let is_old_enough = pub_inputs.get(0).ok_or(AgeVerifierError::MalformedPublicInputs)?;
        let commitment    = pub_inputs.get(1).ok_or(AgeVerifierError::MalformedPublicInputs)?;

        // ── Groth16 verification (BN254) ─────────────────────────────────────
        let mut ic_points: Vec<G1Affine> = Vec::new(&env);
        for bytes in stored_vk.ic.iter() {
            ic_points.push_back(G1Affine::from_bytes(bytes));
        }

        // IC vector must have n_public + 1 = 4 entries
        if ic_points.len() != pub_inputs.len() + 1 {
            return Err(AgeVerifierError::MalformedPublicInputs);
        }

        let vk_alpha = G1Affine::from_bytes(stored_vk.alpha);
        let vk_beta  = G2Affine::from_bytes(stored_vk.beta);
        let vk_gamma = G2Affine::from_bytes(stored_vk.gamma);
        let vk_delta = G2Affine::from_bytes(stored_vk.delta);

        // vk_x = ic[0] + Σ (pub_inputs[i] * ic[i+1])
        let bn = env.crypto().bn254();
        let mut vk_x = ic_points.get(0).ok_or(AgeVerifierError::MalformedPublicInputs)?;
        for i in 0..pub_inputs.len() {
            let s = pub_inputs.get(i).ok_or(AgeVerifierError::MalformedPublicInputs)?;
            let v = ic_points.get(i + 1).ok_or(AgeVerifierError::MalformedPublicInputs)?;
            vk_x = bn.g1_add(&vk_x, &bn.g1_mul(&v, &s));
        }

        // e(-A, B) · e(α, β) · e(vk_x, γ) · e(C, δ) == 1
        // Note: caller pre-negates pi_a in the frontend (pi_a.y → p - pi_a.y).
        // This avoids the soroban-sdk 25.1.0 Bn254G1Affine::neg() bug.
        let valid = bn.pairing_check(
            vec![&env, proof.a, vk_alpha, vk_x, proof.c],
            vec![&env, proof.b, vk_beta, vk_gamma, vk_delta],
        );

        if !valid {
            return Err(AgeVerifierError::InvalidProof);
        }

        // ── Assert age constraint ────────────────────────────────────────────
        // isOldEnough must equal field element 1
        let one = Fr::from_bytes(BytesN::from_array(
            &env,
            &{ let mut b = [0u8; 32]; b[31] = 1; b },
        ));
        if is_old_enough != one {
            return Err(AgeVerifierError::AgeConstraintFailed);
        }

        // ── Issuer Ed25519 signature check (Option A) ────────────────────────
        let commitment_bytes: BytesN<32> = commitment.to_bytes();
        env.crypto().ed25519_verify(&issuer_pub_key, &commitment_bytes.into(), &issuer_sig);
        // ed25519_verify panics on failure — if we reach here, signature is valid

        // ── Mark nullifier used ──────────────────────────────────────────────
        env.storage().persistent().set(&DataKey::Nullifier(nullifier.clone()), &true);
        env.storage().persistent().extend_ttl(&DataKey::Nullifier(nullifier), 17_280, 518_400);

        // ── Mint soulbound credential ─────────────────────────────────────────
        let address_hash_bytes: BytesN<32> = pub_inputs
            .get(2)
            .ok_or(AgeVerifierError::MalformedPublicInputs)?
            .to_bytes();
        env.storage().persistent().set(&DataKey::Credential(address_hash_bytes.clone()), &true);
        env.storage().persistent().extend_ttl(&DataKey::Credential(address_hash_bytes), 17_280, 518_400);

        env.events().publish(("identizy", "credential_verified"), true);

        Ok(true)
    }

    /// Check whether an address hash already has a verified credential.
    pub fn has_credential(env: Env, address_hash: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Credential(address_hash))
    }

    /// Check whether a nullifier has been consumed.
    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier))
    }

    /// Return the current issuance fee in USDC units (7 decimals). 0 = free.
    pub fn get_fee(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Fee).unwrap_or(0)
    }

    /// Admin — update the issuance fee without redeploying.
    /// fee_amount in USDC units (7 decimals): 20_000_000 = 2.00 USDC. 0 = free.
    pub fn set_fee(env: Env, fee_amount: i128) -> Result<(), AgeVerifierError> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(AgeVerifierError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Fee, &fee_amount);
        Ok(())
    }

    /// Admin — withdraw accumulated USDC to any address.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), AgeVerifierError> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(AgeVerifierError::NotInitialized)?;
        admin.require_auth();
        let usdc_token: Address = env.storage().instance()
            .get(&DataKey::UsdcToken)
            .ok_or(AgeVerifierError::NotInitialized)?;
        token::Client::new(&env, &usdc_token)
            .transfer(&env.current_contract_address(), &to, &amount);
        Ok(())
    }

    /// Admin — upgrade the contract WASM. Contract ID stays the same; all storage is preserved.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), AgeVerifierError> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(AgeVerifierError::NotInitialized)?;
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}

mod test;
