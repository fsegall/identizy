pragma circom 2.0.0;

// circomlib — installed via: npm install --prefix circuits/node_modules circomlib
// Compiled with: circom --include circuits/node_modules
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

// ─────────────────────────────────────────────────────────────────────────────
// AgeVerifier
//
// Proves that a person is at least `minAge` years old WITHOUT revealing their
// birthdate. Also produces a Poseidon commitment that cryptographically binds
// the birthDate to the prover's Stellar address — enabling address-bound,
// non-transferable credentials.
//
// PRIVATE inputs (never leave the browser):
//   birthDate   — Unix timestamp (seconds) of date of birth
//   minAge      — minimum age threshold in full years (e.g. 18)
//   currentDate — Unix timestamp at proof generation time
//
// PUBLIC input (known to the verifier):
//   addressHash — BN254 field element derived from the prover's Stellar address
//                 Frontend computes: BigInt(stellarPubKeyBytes) % BN254_PRIME
//                 Issuer signs: commitment = Poseidon(birthDate, addressHash)
//
// PUBLIC outputs (appear in publicSignals[]):
//   isOldEnough — 1 if age satisfies the constraint, 0 otherwise
//   commitment  — Poseidon(birthDate, addressHash)
//                 The Soroban contract verifies the Issuer signed this value.
//                 Anyone with birthDate + addressHash can recompute it, but
//                 neither value is revealed by the proof alone.
//
// Public signals order (snarkjs): [isOldEnough, commitment, addressHash]
// ─────────────────────────────────────────────────────────────────────────────

template AgeVerifier() {
    // ── Private inputs ────────────────────────────────────────────────────────
    signal input birthDate;
    signal input minAge;
    signal input currentDate;

    // ── Public input ──────────────────────────────────────────────────────────
    // Declared public via: component main {public [addressHash]} = AgeVerifier()
    signal input addressHash;

    // ── Age constraint ────────────────────────────────────────────────────────
    signal ageInSeconds;
    signal minAgeInSeconds;

    // 31_557_600 = seconds in a Julian year (365.25 × 24 × 3600)
    minAgeInSeconds <== minAge * 31557600;
    ageInSeconds    <== currentDate - birthDate;

    // LessThan(64): returns 1 if ageInSeconds < minAgeInSeconds
    component less = LessThan(64);
    less.in[0] <== ageInSeconds;
    less.in[1] <== minAgeInSeconds;

    // ── Public output: isOldEnough ────────────────────────────────────────────
    signal output isOldEnough;
    isOldEnough <== 1 - less.out;   // 1 if age ≥ minAge, 0 otherwise

    // ── Public output: commitment ─────────────────────────────────────────────
    // Poseidon(birthDate, addressHash) — binds the private birthDate to the
    // public addressHash in a single ZK-friendly digest.
    //
    // Properties:
    //   • Hiding  — given commitment alone, birthDate is computationally hidden
    //   • Binding — impossible to find (birthDate', addressHash') ≠ (birthDate, addressHash)
    //               that produce the same commitment
    //   • Cheap   — ~6 R1CS constraints (vs ~25 000 for SHA-256)
    //
    // The Issuer signs this commitment during KYC. The Soroban contract verifies
    // both the ZK proof AND the Issuer Ed25519 signature over commitment — tying
    // the off-chain KYC attestation to the on-chain proof in a single check.
    signal output commitment;
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== birthDate;
    poseidon.inputs[1] <== addressHash;
    commitment <== poseidon.out;
}

// addressHash is declared public so the Soroban contract can read it directly
// from publicSignals and verify it matches the caller's address.
component main {public [addressHash]} = AgeVerifier();
