#!/usr/bin/env node
/**
 * initialize_contract.js — Initialize the AgeVerifier Soroban contract.
 *
 * Calls AgeVerifier.initialize(vk, issuer_pub_key) once after deploy.
 * Reads VK from circuits/age_verifier/verification_key.json.
 * Reads contract config from .env (CONTRACT_ID, STELLAR_SECRET_KEY).
 *
 * Usage:
 *   node scripts/initialize_contract.js
 *
 * Env vars (from .env or shell):
 *   CONTRACT_ID          — Soroban contract address (C...)
 *   STELLAR_SECRET_KEY   — deployer secret key (S...)
 *   ISSUER_PUBKEY        — Ed25519 pubkey hex (32 bytes, no 0x)
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Load .env manually (no dotenv dependency)
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
}

const {
  Keypair,
  Networks,
  rpc: SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  nativeToScVal,
  scValToNative,
  Contract,
  Address,
} = require("@stellar/stellar-sdk");

const CONTRACT_ID = process.env.CONTRACT_ID;
const SECRET_KEY = process.env.STELLAR_SECRET_KEY;
const NETWORK = process.env.STELLAR_NETWORK ?? "testnet";
const RPC_URL =
  process.env.STELLAR_TESTNET_RPC ?? "https://soroban-testnet.stellar.org";

// Test issuer pubkey (from scripts/sign_commitment.js keygen)
// Replace with production key before mainnet
const ISSUER_PUBKEY =
  process.env.ISSUER_PUBKEY ??
  "c06840fcf54853ed731c04eb3b4eb8f21bf4d5b23773f8c64b544a98a58d0571";

if (!CONTRACT_ID || !SECRET_KEY) {
  console.error(
    "Missing CONTRACT_ID or STELLAR_SECRET_KEY in .env\n" +
      "Expected in .env:\n" +
      "  CONTRACT_ID=CA7ZALWIDPVDBYSZXMO4WOM4INCWD7UUAZ3XJEQICWGY6H2JDLGGDKEO\n" +
      "  STELLAR_SECRET_KEY=S..."
  );
  process.exit(1);
}

// ── VK encoding helpers ────────────────────────────────────────────────────

function decToBE32(decimal) {
  const result = new Uint8Array(32);
  for (const ch of decimal.trim()) {
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

function g1Bytes(x, y) {
  const out = new Uint8Array(64);
  out.set(decToBE32(x), 0);
  out.set(decToBE32(y), 32);
  return out;
}

// G2 encoding: x.c1 || x.c0 || y.c1 || y.c0 (Ethereum EIP-197)
// snarkjs format: [[x.c0, x.c1], [y.c0, y.c1]]
function g2Bytes(x, y) {
  const out = new Uint8Array(128);
  out.set(decToBE32(x[1]), 0);   // x.c1
  out.set(decToBE32(x[0]), 32);  // x.c0
  out.set(decToBE32(y[1]), 64);  // y.c1
  out.set(decToBE32(y[0]), 96);  // y.c0
  return out;
}

function bytesNVal(bytes) {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, "");
  return Buffer.from(clean, "hex");
}

// ── Build StoredVk ScVal ───────────────────────────────────────────────────

function buildStoredVk(vkJson) {
  const alpha = g1Bytes(vkJson.vk_alpha_1[0], vkJson.vk_alpha_1[1]);
  const beta = g2Bytes(vkJson.vk_beta_2[0], vkJson.vk_beta_2[1]);
  const gamma = g2Bytes(vkJson.vk_gamma_2[0], vkJson.vk_gamma_2[1]);
  const delta = g2Bytes(vkJson.vk_delta_2[0], vkJson.vk_delta_2[1]);

  const icVals = vkJson.IC.map((pt) => bytesNVal(g1Bytes(pt[0], pt[1])));
  const icVec = xdr.ScVal.scvVec(icVals);

  // StoredVk is a contracttype struct — encode as ScMap with field names
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("alpha"),
      val: bytesNVal(alpha),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("beta"),
      val: bytesNVal(beta),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("delta"),
      val: bytesNVal(delta),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("gamma"),
      val: bytesNVal(gamma),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("ic"),
      val: icVec,
    }),
  ]);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const vkPath = path.join(__dirname, "../circuits/age_verifier/verification_key.json");
  const vkJson = JSON.parse(fs.readFileSync(vkPath, "utf8"));

  const keypair = Keypair.fromSecret(SECRET_KEY);
  const server = new SorobanRpc.Server(RPC_URL);
  const networkPassphrase =
    NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

  console.log("Contract ID:", CONTRACT_ID);
  console.log("Deployer:   ", keypair.publicKey());
  console.log("Network:    ", NETWORK);
  console.log("Building StoredVk...");

  const vkScVal = buildStoredVk(vkJson);
  const issuerScVal = xdr.ScVal.scvBytes(hexToBytes(ISSUER_PUBKEY));

  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call("initialize", vkScVal, issuerScVal))
    .setTimeout(30)
    .build();

  console.log("Simulating...");
  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    console.error("Simulation failed:", simResult.error);
    process.exit(1);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(keypair);

  console.log("Submitting...");
  const sendResult = await server.sendTransaction(preparedTx);
  console.log("TX hash:", sendResult.hash);

  // Poll for confirmation
  let getResult;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    getResult = await server.getTransaction(sendResult.hash);
    if (getResult.status !== "NOT_FOUND") break;
  }

  if (getResult.status === "SUCCESS") {
    console.log("\n✅ Contract initialized successfully!");
    console.log("🔗 https://stellar.expert/explorer/testnet/tx/" + sendResult.hash);
  } else {
    console.error("❌ Transaction failed:", getResult.status, getResult);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
