#!/usr/bin/env node
/**
 * generate_proof.js
 *
 * Generates a Groth16 proof for the AgeVerifier circuit (with Poseidon commitment)
 * and outputs the proof formatted for the Soroban contract.
 *
 * Usage:
 *   node scripts/generate_proof.js <birthDate> <minAge> <addressHash> [currentDate]
 *
 *   birthDate   — Unix timestamp (seconds), e.g. 946684800 (2000-01-01)
 *   minAge      — minimum age threshold, e.g. 18
 *   addressHash — BN254 field element (decimal) derived from Stellar address
 *                 Compute with: node scripts/address_to_field.js <GADDR...>
 *   currentDate — optional, defaults to now
 *
 * Example:
 *   node scripts/generate_proof.js 946684800 18 12345678901234567890 1719878400
 *
 * Output (JSON):
 *   proof        — {a, b, c} as hex strings, Soroban-compatible
 *   publicSignals — [isOldEnough, commitment, addressHash] as hex strings
 *   isOldEnough  — boolean
 *   commitment   — hex string (pass to sign_commitment.js for Issuer signature)
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

const CIRCUITS_DIR = path.join(__dirname, "../circuits/age_verifier");

function decToHex32(decimal) {
  return BigInt(decimal).toString(16).padStart(64, "0");
}

// G1: x BE || y BE → 64-byte hex
function g1ToHex(point) {
  return decToHex32(point[0]) + decToHex32(point[1]);
}

// G2: x.c1 || x.c0 || y.c1 || y.c0 → 128-byte hex (Ethereum encoding)
function g2ToHex(point) {
  return (
    decToHex32(point[0][1]) +   // x.c1
    decToHex32(point[0][0]) +   // x.c0
    decToHex32(point[1][1]) +   // y.c1
    decToHex32(point[1][0])     // y.c0
  );
}

async function main() {
  const [,, birthDateStr, minAgeStr, addressHashStr, currentDateStr] = process.argv;

  if (!birthDateStr || !minAgeStr || !addressHashStr) {
    console.error(
      "Usage: node generate_proof.js <birthDate> <minAge> <addressHash> [currentDate]"
    );
    console.error("  addressHash — decimal BN254 field element from your Stellar address");
    console.error("  Run: node scripts/address_to_field.js <G...addr> to compute it");
    process.exit(1);
  }

  const input = {
    birthDate:   parseInt(birthDateStr, 10),
    minAge:      parseInt(minAgeStr, 10),
    addressHash: addressHashStr,                           // field element as decimal string
    currentDate: currentDateStr
      ? parseInt(currentDateStr, 10)
      : Math.floor(Date.now() / 1000),
  };

  console.error("Generating proof for input:", {
    ...input,
    birthDate: new Date(input.birthDate * 1000).toISOString(),
    currentDate: new Date(input.currentDate * 1000).toISOString(),
  });

  const wasmPath = path.join(CIRCUITS_DIR, "age_verifier_js/age_verifier.wasm");
  const zkeyPath = path.join(CIRCUITS_DIR, "circuit_final.zkey");

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    console.error("Circuit artifacts not found. Run 'make circuits' first.");
    process.exit(1);
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  // Local verification sanity check
  const vk = JSON.parse(
    fs.readFileSync(path.join(CIRCUITS_DIR, "verification_key.json"), "utf8")
  );
  const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);
  if (!valid) {
    console.error("Local verification failed — check inputs");
    process.exit(1);
  }

  // publicSignals order from circuit: [isOldEnough, commitment, addressHash]
  const [isOldEnoughSig, commitmentSig, addressHashSig] = publicSignals;

  console.log(JSON.stringify({
    proof: {
      a: "0x" + g1ToHex(proof.pi_a),
      b: "0x" + g2ToHex(proof.pi_b),
      c: "0x" + g1ToHex(proof.pi_c),
    },
    publicSignals: {
      isOldEnough:  "0x" + decToHex32(isOldEnoughSig),
      commitment:   "0x" + decToHex32(commitmentSig),
      addressHash:  "0x" + decToHex32(addressHashSig),
    },
    isOldEnough: isOldEnoughSig === "1",
    nextStep: "Sign the commitment with: ISSUER_PRIVKEY=<key> node scripts/sign_commitment.js sign " + "0x" + decToHex32(commitmentSig),
  }, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
