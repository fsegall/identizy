#!/usr/bin/env node
/**
 * initialize_contract.js — Initialize the AgeVerifier Soroban contract.
 *
 * Calls AgeVerifier.initialize(vk, issuer_pub_key, admin, treasury, usdc_token, fee_amount)
 * once after a fresh deploy. Reads VK from circuits/age_verifier/verification_key.json.
 *
 * Usage:
 *   CONTRACT_ID=C... STELLAR_SECRET_KEY=S... ISSUER_PUBKEY=hex node scripts/initialize_contract.js
 *
 * Required env vars:
 *   CONTRACT_ID          — Soroban contract address (C...) from `stellar contract deploy`
 *   STELLAR_SECRET_KEY   — deployer / initial admin secret key (S...)
 *   ISSUER_PUBKEY        — 32-byte Ed25519 pubkey hex of the Issuer (from Supabase edge function)
 *
 * Optional env vars:
 *   ADMIN_ADDRESS        — G... address for admin role (defaults to deployer's pubkey)
 *   TREASURY_ADDRESS     — G... address for fee treasury (defaults to treasury-mainnet)
 *   USDC_TOKEN           — Soroban contract ID for USDC SAC (placeholder at fee=0)
 *   STELLAR_NETWORK      — "mainnet" or "testnet" (default: mainnet)
 *   STELLAR_RPC_URL      — Soroban RPC endpoint
 *
 * To get ISSUER_PUBKEY from the Supabase edge function private key:
 *   ISSUER_PRIVKEY=<raw_hex> node scripts/sign_commitment.js verify
 *   (the first line of output shows the public key)
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

const CONTRACT_ID      = process.env.CONTRACT_ID;
const SECRET_KEY       = process.env.STELLAR_SECRET_KEY;
const ISSUER_PUBKEY    = process.env.ISSUER_PUBKEY;
const ADMIN_ADDRESS    = process.env.ADMIN_ADDRESS;   // defaults to deployer pubkey
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "GAT6U5MBLUBZG7OBM7G4E7M4VNAYR5IFKRFH4RFDGTK7AHBHDD535NLQ";
const USDC_TOKEN       = process.env.USDC_TOKEN;      // placeholder at fee=0
const NETWORK          = process.env.STELLAR_NETWORK  ?? "mainnet";
const RPC_URL          = process.env.STELLAR_RPC_URL  ?? "https://soroban-rpc.creit.tech";

if (!CONTRACT_ID || !SECRET_KEY || !ISSUER_PUBKEY) {
  console.error(
    "Missing required env vars.\n" +
    "Required:\n" +
    "  CONTRACT_ID=C...          (from stellar contract deploy output)\n" +
    "  STELLAR_SECRET_KEY=S...   (deployer / admin secret key)\n" +
    "  ISSUER_PUBKEY=<hex>       (32-byte Ed25519 pubkey of the Issuer)\n" +
    "\nExample:\n" +
    "  CONTRACT_ID=C... STELLAR_SECRET_KEY=S... ISSUER_PUBKEY=abc123... node scripts/initialize_contract.js"
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

// ── ScVal helpers for new initialize params ───────────────────────────────

function scAddress(addr) {
  return new Address(addr).toScVal();
}

function scI128(value) {
  const big = BigInt(value);
  return xdr.ScVal.scvI128(new xdr.Int128Parts({
    hi: BigInt.asIntN(64, big >> 64n),
    lo: BigInt.asUintN(64, big),
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const vkPath = path.join(__dirname, "../circuits/age_verifier/verification_key.json");
  const vkJson = JSON.parse(fs.readFileSync(vkPath, "utf8"));

  const keypair = Keypair.fromSecret(SECRET_KEY);
  const admin   = ADMIN_ADDRESS || keypair.publicKey();
  const usdcTok = USDC_TOKEN   || keypair.publicKey(); // safe placeholder at fee=0

  const networkPassphrase = NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  const explorerBase = NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx/"
    : "https://stellar.expert/explorer/testnet/tx/";

  console.log("Contract ID :", CONTRACT_ID);
  console.log("Network     :", NETWORK);
  console.log("Admin       :", admin);
  console.log("Treasury    :", TREASURY_ADDRESS);
  console.log("USDC token  :", usdcTok, USDC_TOKEN ? "" : "(placeholder — update before activating fees)");
  console.log("Fee amount  : 0 (free at launch)");
  console.log("");

  const server   = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const account  = await server.getAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(contract.call(
      "initialize",
      buildStoredVk(vkJson),
      xdr.ScVal.scvBytes(hexToBytes(ISSUER_PUBKEY)),
      scAddress(admin),
      scAddress(TREASURY_ADDRESS),
      scAddress(usdcTok),
      scI128(0),
    ))
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

  process.stdout.write("Waiting for confirmation");
  let getResult;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    process.stdout.write(".");
    getResult = await server.getTransaction(sendResult.hash);
    if (getResult.status !== "NOT_FOUND") break;
  }

  if (getResult.status === "SUCCESS") {
    console.log("\n✅ initialize() successful!");
    console.log("   tx :", explorerBase + sendResult.hash);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Update VITE_AGE_VERIFIER_CONTRACT_ID in Lovable env vars to:", CONTRACT_ID);
    console.log("  2. Update CLAUDE.md and README.md with the new contract ID");
    console.log("  3. When ready to activate fees: configure USDC_TOKEN and call set_fee()");
  } else {
    console.error("\n❌ Transaction failed:", getResult.status, getResult);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
