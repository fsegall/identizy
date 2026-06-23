#!/usr/bin/env node
/**
 * convert_vk.js
 *
 * Reads a snarkjs verification_key.json and prints the hex-encoded byte arrays
 * needed to call `AgeVerifier.initialize(vk)` on Stellar.
 *
 * Usage:
 *   node scripts/convert_vk.js circuits/age_verifier/verification_key.json
 *
 * Output format (all big-endian, Ethereum-compatible):
 *   alpha  : 64 bytes  (G1: x || y)
 *   beta   : 128 bytes (G2: x.c1 || x.c0 || y.c1 || y.c0)
 *   gamma  : 128 bytes (G2)
 *   delta  : 128 bytes (G2)
 *   ic[0]  : 64 bytes  (G1)
 *   ic[1]  : 64 bytes  (G1)
 */

const fs = require("fs");

const vkPath = process.argv[2];
if (!vkPath) {
  console.error("Usage: node scripts/convert_vk.js <verification_key.json>");
  process.exit(1);
}

const vk = JSON.parse(fs.readFileSync(vkPath, "utf8"));

// Convert a decimal string to a 32-byte big-endian hex string
function decToHex32(decimal) {
  const n = BigInt(decimal);
  return n.toString(16).padStart(64, "0");
}

// G1 affine point: [x, y, "1"] → 64-byte hex (x BE || y BE)
function g1ToHex(point) {
  return decToHex32(point[0]) + decToHex32(point[1]);
}

// G2 affine point: [[x.c0, x.c1], [y.c0, y.c1], ...] → 128-byte hex
// Ethereum encoding: x.c1 || x.c0 || y.c1 || y.c0
function g2ToHex(point) {
  const xc0 = decToHex32(point[0][0]);
  const xc1 = decToHex32(point[0][1]);
  const yc0 = decToHex32(point[1][0]);
  const yc1 = decToHex32(point[1][1]);
  return xc1 + xc0 + yc1 + yc0;
}

const alpha = g1ToHex(vk.vk_alpha_1);
const beta  = g2ToHex(vk.vk_beta_2);
const gamma = g2ToHex(vk.vk_gamma_2);
const delta = g2ToHex(vk.vk_delta_2);
const ic    = vk.IC.map(g1ToHex);

console.log(JSON.stringify({
  alpha: "0x" + alpha,
  beta:  "0x" + beta,
  gamma: "0x" + gamma,
  delta: "0x" + delta,
  ic:    ic.map((h) => "0x" + h),
}, null, 2));
