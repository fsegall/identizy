#!/usr/bin/env node
/**
 * address_to_field.js
 *
 * Converts a Stellar address (G...) to a BN254 field element (decimal string)
 * suitable as the `addressHash` input to the AgeVerifier circuit.
 *
 * Method: decode the StrKey, take the 32-byte raw public key, interpret as
 * big-endian integer, reduce mod BN254 prime field order p.
 *
 * This deterministic mapping ensures:
 *   - Same address always produces the same field element
 *   - Two different addresses (statistically) produce different field elements
 *   - The result fits safely within the BN254 scalar field
 *
 * Usage:
 *   node scripts/address_to_field.js GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3VRSEOGXS
 *
 * Output:
 *   { address, fieldElement }
 *   → use fieldElement as <addressHash> in generate_proof.js
 */

// BN254 / bn128 scalar field prime
const BN254_P = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

function base32Decode(str) {
  // Stellar StrKey uses base32 (RFC 4648) without padding
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const lookup = {};
  for (let i = 0; i < ALPHABET.length; i++) lookup[ALPHABET[i]] = i;

  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of str.toUpperCase()) {
    if (!(char in lookup)) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | lookup[char];
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(output);
}

function stellarAddressToField(address) {
  if (!address.startsWith("G")) {
    throw new Error("Expected a Stellar account address starting with G");
  }

  // StrKey decode: strip version byte (0x06 << 3 = 0x30) and checksum (last 2 bytes)
  // Total decoded = 35 bytes: 1 version + 32 pubkey + 2 checksum
  const decoded = base32Decode(address);
  if (decoded.length !== 35) {
    throw new Error(`Unexpected decoded length: ${decoded.length}, expected 35`);
  }

  // Extract 32-byte raw Ed25519 public key (bytes 1..32)
  const pubKeyBytes = decoded.slice(1, 33);

  // Interpret as big-endian unsigned integer
  let value = BigInt(0);
  for (const byte of pubKeyBytes) {
    value = (value << BigInt(8)) | BigInt(byte);
  }

  // Reduce mod BN254 prime to get a valid field element
  const fieldElement = value % BN254_P;

  return fieldElement.toString();
}

const address = process.argv[2];
if (!address) {
  console.error("Usage: node scripts/address_to_field.js <STELLAR_ADDRESS>");
  process.exit(1);
}

try {
  const fieldElement = stellarAddressToField(address);
  console.log(JSON.stringify({ address, fieldElement }, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
