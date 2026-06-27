/**
 * zkProof.ts — Client-side ZK proof generation + issuer signing.
 *
 * All private data (birthDate, minAge, currentDate) stays in the browser.
 * The issuer signs the Poseidon commitment client-side (TESTNET DEMO ONLY).
 * In production, signing happens server-side after real KYC.
 */

import { groth16 } from "snarkjs";

const CIRCUITS_BASE = "/circuits";

// ── Stellar address → BN254 field element ────────────────────────────────────

// BN254 scalar field prime (for addressToField)
const BN254_PRIME = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

// BN254 base field prime (for G1 point coordinate negation)
const BN254_FP = BigInt(
  "21888242871839275222246405745257275088696311157297823662689037894645226208583"
);

export function addressToField(address: string): string {
  // Decode Stellar StrKey (base32, RFC 4648) — strip version byte + checksum
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const chars = address.toUpperCase().replace(/=+$/, "");
  let bits = 0n;
  let bitLen = 0;
  const bytes: number[] = [];
  for (const ch of chars) {
    const val = BigInt(ALPHABET.indexOf(ch));
    bits = (bits << 5n) | val;
    bitLen += 5;
    if (bitLen >= 8) {
      bitLen -= 8;
      bytes.push(Number((bits >> BigInt(bitLen)) & 0xffn));
    }
  }
  // bytes[0] = version byte (6 for G-addresses), bytes[1..32] = raw Ed25519 pubkey
  const pubkeyBytes = bytes.slice(1, 33);
  let bigint = 0n;
  for (const b of pubkeyBytes) {
    bigint = (bigint << 8n) | BigInt(b);
  }
  return (bigint % BN254_PRIME).toString();
}

// ── Encoding helpers (Ethereum EIP-196/197 compatible) ───────────────────────

function decToHex32(decimal: string): string {
  return BigInt(decimal).toString(16).padStart(64, "0");
}

function g1ToHex(point: string[]): string {
  return decToHex32(point[0]) + decToHex32(point[1]);
}

function g2ToHex(point: string[][]): string {
  // snarkjs: [[x.c0, x.c1], [y.c0, y.c1]] → Ethereum: x.c1 || x.c0 || y.c1 || y.c0
  return (
    decToHex32(point[0][1]) +
    decToHex32(point[0][0]) +
    decToHex32(point[1][1]) +
    decToHex32(point[1][0])
  );
}

// ── G1 affine point negation ─────────────────────────────────────────────────
// Pre-negate pi_a so the contract can call pairing_check(proof.a, ...) directly.
// Avoids soroban-sdk 25.1.0 Bn254G1Affine::neg() bug (Bytes vs BytesN<32> Val mismatch).

function negG1Hex(point: string[]): string {
  const x = BigInt(point[0]);
  const y = BigInt(point[1]);
  const negY = y === 0n ? 0n : BN254_FP - y;
  return decToHex32(x.toString()) + decToHex32(negY.toString());
}

// ── Issuer signing — calls Cloudflare Worker (private key never in browser) ───

async function issuerSign(commitmentHex: string): Promise<string> {
  const signerUrl = import.meta.env.VITE_SIGNER_URL;
  if (!signerUrl) throw new Error("VITE_SIGNER_URL not set");

  const res = await fetch(signerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commitment: commitmentHex }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Signer error ${res.status}: ${err}`);
  }

  const { signature } = (await res.json()) as { signature: string };
  return signature;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgeProofInput {
  birthDate: number;    // Unix timestamp (seconds)
  minAge?: number;      // default 18
  currentDate?: number; // default now
  stellarAddress: string;
}

export interface SorobanProof {
  a: string; // 64-byte hex (G1)
  b: string; // 128-byte hex (G2)
  c: string; // 64-byte hex (G1)
}

export interface AgeProofResult {
  proof: SorobanProof;
  isOldEnough: boolean;
  /** 32-byte hex — isOldEnough public signal */
  sigIsOldEnough: string;
  /** 32-byte hex — Poseidon(birthDate, addressHash) */
  commitment: string;
  /** 32-byte hex — BN254 field element of caller's Stellar address */
  addressHash: string;
  /** 64-byte hex — Issuer Ed25519 signature over commitment */
  issuerSig: string;
  rawProof: unknown;
  rawPublicSignals: string[];
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function generateAgeProof(input: AgeProofInput): Promise<AgeProofResult> {
  const addressHash = addressToField(input.stellarAddress);
  const currentDate = input.currentDate ?? Math.floor(Date.now() / 1000);
  const minAge = input.minAge ?? 18;

  const circuitInput = {
    birthDate: input.birthDate,
    minAge,
    currentDate,
    addressHash,
  };

  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    `${CIRCUITS_BASE}/age_verifier.wasm`,
    `${CIRCUITS_BASE}/circuit_final.zkey`
  );

  // publicSignals order: [isOldEnough, commitment, addressHash]
  const isOldEnough = publicSignals[0] === "1";
  const commitmentDec = publicSignals[1];
  const addressHashDec = publicSignals[2];

  const commitmentHex = decToHex32(commitmentDec);
  const issuerSig = await issuerSign(commitmentHex);

  return {
    proof: {
      a: "0x" + negG1Hex((proof as any).pi_a), // pre-negated: contract uses proof.a directly
      b: "0x" + g2ToHex((proof as any).pi_b),
      c: "0x" + g1ToHex((proof as any).pi_c),
    },
    isOldEnough,
    sigIsOldEnough: decToHex32(publicSignals[0]),
    commitment: commitmentHex,
    addressHash: decToHex32(addressHashDec),
    issuerSig,
    rawProof: proof,
    rawPublicSignals: publicSignals,
  };
}

export async function verifyLocally(rawProof: unknown, rawPublicSignals: string[]): Promise<boolean> {
  const vk = await fetch(`${CIRCUITS_BASE}/verification_key.json`).then((r) => r.json());
  return groth16.verify(vk, rawPublicSignals, rawProof as object);
}
