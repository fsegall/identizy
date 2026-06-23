/**
 * zkProof.ts — Client-side ZK proof generation using snarkjs + WASM.
 *
 * Secrets (birthDate, minAge, currentDate) never leave the browser.
 * The WASM and zkey are served from /circuits/ (copied there by `make circuits`).
 *
 * Usage:
 *   const result = await generateAgeProof({ birthDate, minAge });
 *   // result.proof → formatted for Soroban contract
 *   // result.isOldEnough → public signal
 */

import { groth16 } from "snarkjs";

const CIRCUITS_BASE = "/circuits";

export interface AgeProofInput {
  birthDate: number;   // Unix timestamp (seconds)
  minAge: number;      // e.g. 18
  currentDate?: number; // defaults to now
}

export interface SorobanProof {
  /** G1: 64-byte hex, x BE || y BE */
  a: string;
  /** G2: 128-byte hex, x.c1 || x.c0 || y.c1 || y.c0 */
  b: string;
  /** G1: 64-byte hex */
  c: string;
}

export interface AgeProofResult {
  proof: SorobanProof;
  /** Fr scalar, 32-byte hex — public output of the circuit */
  publicInput: string;
  /** true if circuit returned isOldEnough = 1 */
  isOldEnough: boolean;
  /** Raw snarkjs proof for local verification */
  rawProof: object;
  rawPublicSignals: string[];
}

// ────────────────────────────────────────────────────────────
// Encoding helpers (Ethereum-compatible format for Soroban BN254)
// ────────────────────────────────────────────────────────────

function decToHex32(decimal: string): string {
  return BigInt(decimal).toString(16).padStart(64, "0");
}

function g1ToHex(point: string[]): string {
  return decToHex32(point[0]) + decToHex32(point[1]);
}

function g2ToHex(point: string[][]): string {
  // snarkjs: [[x.c0, x.c1], [y.c0, y.c1], ...]
  // Ethereum/Soroban: x.c1 || x.c0 || y.c1 || y.c0
  const xc0 = decToHex32(point[0][0]);
  const xc1 = decToHex32(point[0][1]);
  const yc0 = decToHex32(point[1][0]);
  const yc1 = decToHex32(point[1][1]);
  return xc1 + xc0 + yc1 + yc0;
}

function frToHex32(decimal: string): string {
  return decToHex32(decimal);
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

export async function generateAgeProof(
  input: AgeProofInput
): Promise<AgeProofResult> {
  const circuitInput = {
    birthDate: input.birthDate,
    minAge: input.minAge,
    currentDate: input.currentDate ?? Math.floor(Date.now() / 1000),
  };

  const wasmUrl = `${CIRCUITS_BASE}/age_verifier.wasm`;
  const zkeyUrl = `${CIRCUITS_BASE}/circuit_final.zkey`;

  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    wasmUrl,
    zkeyUrl
  );

  const isOldEnough = publicSignals[0] === "1";

  return {
    proof: {
      a: "0x" + g1ToHex((proof as any).pi_a),
      b: "0x" + g2ToHex((proof as any).pi_b),
      c: "0x" + g1ToHex((proof as any).pi_c),
    },
    publicInput: "0x" + frToHex32(publicSignals[0]),
    isOldEnough,
    rawProof: proof,
    rawPublicSignals: publicSignals,
  };
}

/** Verify a proof locally (before submitting on-chain) */
export async function verifyAgeProofLocally(
  rawProof: object,
  rawPublicSignals: string[]
): Promise<boolean> {
  const vkResponse = await fetch(`${CIRCUITS_BASE}/verification_key.json`);
  const vk = await vkResponse.json();
  return groth16.verify(vk, rawPublicSignals, rawProof);
}
