#!/usr/bin/env node
/**
 * debug_verify.js — Diagnostic script to isolate the UnreachableCodeReached panic.
 *
 * Tests different proof inputs to find which host function panics.
 *
 * Usage: node scripts/debug_verify.js [test]
 *   zero-proof   — send all-zero proof (expects InvalidProof or panic)
 *   test-proof   — send hardcoded proof from test.rs + signed commitment
 *   browser-data — paste browser proof from console
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");

// Load .env
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) process.env[m[1]] = m[2].trim();
    });
}

const {
  Contract, Networks, TransactionBuilder, BASE_FEE, xdr,
  rpc: SorobanRpc, Keypair,
} = require("@stellar/stellar-sdk");

const CONTRACT_ID = process.env.CONTRACT_ID;
const SECRET_KEY  = process.env.STELLAR_SECRET_KEY;
const RPC_URL     = process.env.STELLAR_TESTNET_RPC ?? "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

// ── Encoding helpers ──────────────────────────────────────────────────────────

function decToBE32(decimal) {
  const result = new Uint8Array(32);
  for (const ch of String(decimal).trim()) {
    const d = ch.charCodeAt(0) - 48;
    let carry = d;
    for (let i = 31; i >= 0; i--) {
      const val = result[i] * 10 + carry;
      result[i] = val & 0xff;
      carry = val >> 8;
    }
  }
  return result;
}

function hexToBytes(hex) {
  const h = hex.replace(/^0x/, "");
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.slice(i*2, i*2+2), 16);
  return b;
}

function g1Bytes(x, y) {
  const out = new Uint8Array(64);
  out.set(decToBE32(x), 0);
  out.set(decToBE32(y), 32);
  return out;
}

// BN254 base field prime — for G1 y-coordinate negation
const BN254_FP = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;

function negG1(x_dec, y_dec) {
  const y = BigInt(y_dec);
  const negY = y === 0n ? 0n : BN254_FP - y;
  return g1Bytes(x_dec, negY.toString());
}

function g2Bytes(x_c0, x_c1, y_c0, y_c1) {
  const out = new Uint8Array(128);
  out.set(decToBE32(x_c1), 0);
  out.set(decToBE32(x_c0), 32);
  out.set(decToBE32(y_c1), 64);
  out.set(decToBE32(y_c0), 96);
  return out;
}

function scBytes(bytes) {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

// Fr elements must be scvU256, NOT scvBytes.
// Fr::try_from_val calls U256::try_from_val which expects U256Val (scvU256), not BytesVal.
// Passing scvBytes causes unwrap_optimized() → wasm32::unreachable → UnreachableCodeReached.
function hexToU256ScVal(hex) {
  const h = hex.replace(/^0x/, "").padStart(64, "0");
  const b = Buffer.from(h, "hex");
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const hiHi = view.getBigUint64(0, false);
  const hiLo = view.getBigUint64(8, false);
  const loHi = view.getBigUint64(16, false);
  const loLo = view.getBigUint64(24, false);
  return xdr.ScVal.scvU256(new xdr.UInt256Parts({ hiHi, hiLo, loHi, loLo }));
}

function frFromHex(hex) {
  return hexToU256ScVal(hex);
}

function frFromDec(decimal) {
  return hexToU256ScVal(BigInt(decimal).toString(16));
}

// ── Issuer signing ────────────────────────────────────────────────────────────

async function issuerSign(commitmentHex) {
  const pkcs8Hex = process.env.ISSUER_PRIVKEY_PKCS8;
  if (!pkcs8Hex) throw new Error("ISSUER_PRIVKEY_PKCS8 not in .env");
  const pkcs8 = hexToBytes(pkcs8Hex);
  const privKey = await webcrypto.subtle.importKey(
    "pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]
  );
  const commitmentBytes = hexToBytes(commitmentHex);
  const sig = await webcrypto.subtle.sign("Ed25519", privKey, commitmentBytes);
  return Buffer.from(sig).toString("hex");
}

// ── Build contract call ───────────────────────────────────────────────────────

async function callVerify(proofScVal, pubInputsScVal, nullifier32, issuerSigHex) {
  const server = new SorobanRpc.Server(RPC_URL);
  const keypair = Keypair.fromSecret(SECRET_KEY);
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call(
      "verify",
      proofScVal,
      pubInputsScVal,
      scBytes(nullifier32),
      scBytes(hexToBytes(issuerSigHex)),
    ))
    .setTimeout(30)
    .build();

  console.log("\nSimulating...");
  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    console.error("❌ Simulation error:", sim.error);
    return null;
  }

  console.log("✅ Simulation success! Result:", sim.result?.retval?.switch().name);
  return sim;
}

// ── Test cases ────────────────────────────────────────────────────────────────

async function testZeroProof() {
  console.log("\n=== TEST: Zero proof (should get InvalidProof if pairing_check is stable) ===");

  const zeroG1 = new Uint8Array(64);
  const zeroG2 = new Uint8Array(128);

  const proofScVal = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("a"), val: scBytes(zeroG1) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("b"), val: scBytes(zeroG2) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("c"), val: scBytes(zeroG1) }),
  ]);

  const nullifier = new Uint8Array(32).fill(0xab);
  // Commitment of isOldEnough=1, commitment=1, addressHash=1 (dummy)
  const pubInputs = xdr.ScVal.scvVec([
    frFromHex("0000000000000000000000000000000000000000000000000000000000000001"),
    frFromHex("0000000000000000000000000000000000000000000000000000000000000001"),
    frFromHex("0000000000000000000000000000000000000000000000000000000000000001"),
  ]);

  const commitment = "0000000000000000000000000000000000000000000000000000000000000001";
  const sig = await issuerSign(commitment);
  console.log("Commitment sig:", sig.slice(0, 16) + "...");

  await callVerify(proofScVal, pubInputs, nullifier, sig);
}

async function testHardcodedProof() {
  console.log("\n=== TEST: Hardcoded proof from test.rs (birthDate=946684800, GCQSYAFC7...) ===");

  // From test.rs test_proof() — pi_a pre-negated (contract no longer calls neg internally)
  const a = negG1(
    "9968157170029525761245643167925000498211886364934073555937536743905165461178",
    "4704466322600006685391530061158712278250684932367019217358165903780133865657"
  );
  const b = g2Bytes(
    "20953022430292064317089072676021598417527985325082880926433897423210637743400",
    "12865257763690403874784740407699031188193292042052823371847829621768125738699",
    "9189858025137492896999133819051785506820228390897649889253106781995940231842",
    "14373060122668685670137340006107103380803481020705507683497755146571604463179"
  );
  const c = g1Bytes(
    "12666829211921098530370139545799020613236545868456546828116104744718300858886",
    "2530215812214542249134761896509348820303697605204351640022582167252957868346"
  );

  const proofScVal = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("a"), val: scBytes(a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("b"), val: scBytes(b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("c"), val: scBytes(c) }),
  ]);

  // isOldEnough=1, commitment=0x1d130c..., addressHash=0x0fff...
  const commitmentHex = "1d130c124dcd8f309b892bfb0c46387cc3de5cbe84cf5aa0e1a5644d617ccde7";
  const addressHashHex = "0fff154a546b4af2f19a6cc7792195c87598c41fa8ae2632f4a63164d7884fbe";

  const pubInputs = xdr.ScVal.scvVec([
    frFromHex("0000000000000000000000000000000000000000000000000000000000000001"),
    frFromHex(commitmentHex),
    frFromHex(addressHashHex),
  ]);

  const nullifier = new Uint8Array(32).fill(0xcc);
  const sig = await issuerSign(commitmentHex);
  console.log("Issuer sig (over testnet key):", sig.slice(0, 32) + "...");

  await callVerify(proofScVal, pubInputs, nullifier, sig);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const test = process.argv[2] ?? "both";
  console.log("Contract:", CONTRACT_ID);
  console.log("Deployer:", Keypair.fromSecret(SECRET_KEY).publicKey());

  if (test === "zero" || test === "both") {
    await testZeroProof();
  }
  if (test === "hardcoded" || test === "both") {
    await testHardcodedProof();
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
