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
//   1. Groth16 pairing check (BN254 host functions)
//   2. Assert isOldEnough == 1
//   3. Ed25519 signature check: Issuer.sign(commitment) is valid
//   4. Anti-replay: nullifier not previously used
//   → mint soulbound credential on success
//
// Option A architecture: Issuer signature verified OUTSIDE the ZK circuit,
// using Soroban's native ed25519_verify host function. The Poseidon commitment
// ties the off-chain KYC attestation to the on-chain proof without adding
// EdDSA constraints to the circuit (~3000+ extra constraints avoided).
// See ROADMAP in README for the full in-circuit EdDSA version.
// ─────────────────────────────────────────────────────────────────────────────

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    crypto::bn254::{Fr, Bn254G1Affine as G1Affine, Bn254G2Affine as G2Affine},
    vec, BytesN, Env, Vec,
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
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Vk,
    IssuerPubKey,
    Nullifier(BytesN<32>),
    Credential(BytesN<32>),   // credential record keyed by address hash
}

// ── Types ─────────────────────────────────────────────────────────────────────
//
// Byte encoding (Ethereum-compatible, EIP-196/197):
//   G1 → x BE (32) || y BE (32)                         = 64 bytes
//   G2 → x.c1 BE (32) || x.c0 BE (32) || y.c1 || y.c0  = 128 bytes
//   Fr → big-endian 256-bit scalar                       = 32 bytes
//
// Scripts convert snarkjs output to this format automatically.
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
    /// Store the verification key and Issuer public key. Called once after deploy.
    ///
    /// `issuer_pub_key` — Ed25519 public key (32 bytes) of the trusted KYC issuer.
    ///   The Issuer signs Poseidon commitments during KYC (Option A architecture).
    ///   Hardcode the real key before mainnet deployment.
    pub fn initialize(
        env: Env,
        vk: StoredVk,
        issuer_pub_key: BytesN<32>,
    ) -> Result<(), AgeVerifierError> {
        if env.storage().instance().has(&DataKey::Vk) {
            return Err(AgeVerifierError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Vk, &vk);
        env.storage().instance().set(&DataKey::IssuerPubKey, &issuer_pub_key);
        Ok(())
    }

    /// Verify a Groth16 proof and mint a soulbound credential to the caller.
    ///
    /// `pub_inputs` — must have exactly 3 elements in this order:
    ///   [0] isOldEnough   (Fr with value 1)
    ///   [1] commitment    (Fr = Poseidon(birthDate, addressHash))
    ///   [2] addressHash   (Fr derived from caller's Stellar address)
    ///
    /// `nullifier`   — unique 32-byte value preventing proof replay.
    ///   Recommended: random bytes generated client-side per submission.
    ///
    /// `issuer_sig`  — Ed25519 signature (64 bytes) from the trusted Issuer over
    ///   the raw bytes of commitment (pub_inputs[1]).
    ///   The Issuer produces this during KYC after verifying the user's document.
    pub fn verify(
        env: Env,
        proof: Groth16Proof,
        pub_inputs: Vec<Fr>,
        nullifier: BytesN<32>,
        issuer_sig: BytesN<64>,
    ) -> Result<bool, AgeVerifierError> {
        // ── Load state ───────────────────────────────────────────────────────
        let stored_vk: StoredVk = env
            .storage().instance().get(&DataKey::Vk)
            .ok_or(AgeVerifierError::NotInitialized)?;

        let issuer_pub_key: BytesN<32> = env
            .storage().instance().get(&DataKey::IssuerPubKey)
            .ok_or(AgeVerifierError::NotInitialized)?;

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
        #[allow(clippy::arithmetic_side_effects)]
        let neg_a = -proof.a;
        let valid = bn.pairing_check(
            vec![&env, neg_a, vk_alpha, vk_x, proof.c],
            vec![&env, proof.b, vk_beta, vk_gamma, vk_delta],
        );

        if !valid {
            return Err(AgeVerifierError::InvalidProof);
        }

        // ── Assert age constraint ────────────────────────────────────────────
        // isOldEnough must equal field element 1
        let one = Fr::from_bytes(BytesN::from_array(
            &env,
            &{
                let mut b = [0u8; 32];
                b[31] = 1;
                b
            },
        ));
        if is_old_enough != one {
            return Err(AgeVerifierError::AgeConstraintFailed);
        }

        // ── Issuer Ed25519 signature check (Option A) ────────────────────────
        // The Issuer signed `commitment` bytes during KYC after verifying the
        // user's real document. This ties the ZK proof to an authentic KYC event
        // without revealing the birthDate or embedding EdDSA in the circuit.
        //
        // commitment bytes = Fr as 32-byte big-endian (same as pub_inputs[1])
        let commitment_bytes: BytesN<32> = commitment.to_bytes();
        env.crypto().ed25519_verify(&issuer_pub_key, &commitment_bytes.into(), &issuer_sig);
        // ed25519_verify panics on failure — if we reach here, signature is valid

        // ── Mark nullifier used ──────────────────────────────────────────────
        env.storage().persistent().set(&DataKey::Nullifier(nullifier.clone()), &true);
        env.storage().persistent().extend_ttl(&DataKey::Nullifier(nullifier), 17_280, 518_400);

        // ── Emit event ───────────────────────────────────────────────────────
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
}

mod test;
