#!/usr/bin/env node
/**
 * sign_commitment.js — Issuer Ed25519 signing tool
 *
 * Simulates the Issuer backend: given a Poseidon commitment (output from the
 * ZK circuit), signs it with the Issuer's Ed25519 private key.
 *
 * In production this runs server-side after real KYC document verification.
 * For the hackathon, run it locally to produce test signatures.
 *
 * Usage:
 *   # Generate a new Issuer keypair (do once, store securely)
 *   node scripts/sign_commitment.js keygen
 *
 *   # Sign a commitment produced by generate_proof.js
 *   ISSUER_PRIVKEY=<hex> node scripts/sign_commitment.js sign <commitment_hex>
 *
 * Output of 'sign': JSON with { issuerPubKey, commitment, signature }
 * → Pass signature to: stellar contract invoke -- verify --issuer_sig <sig>
 *
 * Security note:
 *   The ISSUER_PRIVKEY signs real KYC attestations. Keep it secret.
 *   The corresponding ISSUER_PUBKEY is hardcoded in the Soroban contract.
 */

const { webcrypto } = require("crypto");
const crypto = webcrypto;

// ── Ed25519 helpers via Web Crypto API (Node 16+) ──────────────────────────

async function generateKeypair() {
  const keypair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true, // extractable
    ["sign", "verify"]
  );
  const privRaw = await crypto.subtle.exportKey("pkcs8", keypair.privateKey);
  const pubRaw  = await crypto.subtle.exportKey("raw",   keypair.publicKey);
  return {
    privateKey: keypair.privateKey,
    publicKey:  keypair.publicKey,
    privHex: Buffer.from(privRaw).toString("hex"),
    pubHex:  Buffer.from(pubRaw).toString("hex"),
  };
}

async function signCommitment(commitmentHex, privKeyHex) {
  // Import the private key from PKCS8 hex
  const privKeyBytes = Buffer.from(privKeyHex, "hex");
  const privKey = await crypto.subtle.importKey(
    "pkcs8",
    privKeyBytes,
    { name: "Ed25519" },
    false,
    ["sign"]
  );

  // commitment is 32 bytes (BN254 Fr field element, big-endian)
  const commitmentBytes = Buffer.from(
    commitmentHex.startsWith("0x") ? commitmentHex.slice(2) : commitmentHex,
    "hex"
  );

  const signature = await crypto.subtle.sign("Ed25519", privKey, commitmentBytes);
  return Buffer.from(signature).toString("hex");
}

async function verifySignature(commitmentHex, signatureHex, pubKeyHex) {
  const pubKeyBytes = Buffer.from(pubKeyHex, "hex");
  const pubKey = await crypto.subtle.importKey(
    "raw",
    pubKeyBytes,
    { name: "Ed25519" },
    false,
    ["verify"]
  );

  const commitmentBytes = Buffer.from(
    commitmentHex.startsWith("0x") ? commitmentHex.slice(2) : commitmentHex,
    "hex"
  );
  const sigBytes = Buffer.from(signatureHex, "hex");

  return crypto.subtle.verify("Ed25519", pubKey, sigBytes, commitmentBytes);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const [,, command, ...args] = process.argv;

  if (command === "keygen") {
    const kp = await generateKeypair();
    console.log(JSON.stringify({
      issuerPubKeyHex:  kp.pubHex,
      issuerPrivKeyHex: kp.privHex,
      note: "Store privKey securely. Hardcode pubKey in contracts/age_verifier/src/lib.rs as ISSUER_PUBKEY.",
    }, null, 2));
    return;
  }

  if (command === "sign") {
    const commitmentHex = args[0];
    const privKeyHex = process.env.ISSUER_PRIVKEY;

    if (!commitmentHex) {
      console.error("Usage: ISSUER_PRIVKEY=<hex> node sign_commitment.js sign <commitment_hex>");
      process.exit(1);
    }
    if (!privKeyHex) {
      console.error("Set ISSUER_PRIVKEY environment variable");
      process.exit(1);
    }

    const sig = await signCommitment(commitmentHex, privKeyHex);
    console.log(JSON.stringify({ commitment: commitmentHex, signature: "0x" + sig }, null, 2));
    return;
  }

  if (command === "verify") {
    const [commitmentHex, sigHex, pubKeyHex] = args;
    const valid = await verifySignature(commitmentHex, sigHex, pubKeyHex);
    console.log(JSON.stringify({ valid }));
    return;
  }

  console.error("Commands: keygen | sign <commitment> | verify <commitment> <sig> <pubkey>");
  process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
