#!/usr/bin/env node
/**
 * add_usdc_trustline.js — Add USDC trustline to treasury account.
 *
 * The soulbound_nft mint() transfers USDC directly to treasury.
 * Treasury must have a USDC trustline before it can receive funds.
 *
 * Usage:
 *   TREASURY_SECRET=S... node scripts/add_usdc_trustline.js
 */

"use strict";

const path = require("path");
const fs = require("fs");

// Load .env
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const {
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Horizon,
} = require("../frontend/node_modules/@stellar/stellar-sdk");

const SECRET = process.env.TREASURY_SECRET;
if (!SECRET) {
  console.error("Missing TREASURY_SECRET env var");
  process.exit(1);
}

// USDC on Stellar mainnet (Circle issuer)
const USDC = new Asset("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
const HORIZON_URL = "https://horizon.stellar.org";

async function main() {
  const keypair = Keypair.fromSecret(SECRET);
  console.log("Account :", keypair.publicKey());

  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(keypair.publicKey());

  // Check if trustline already exists
  const existing = account.balances.find(
    (b) => b.asset_code === "USDC" && b.asset_issuer === "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  );
  if (existing) {
    console.log("✅ USDC trustline already exists. Balance:", existing.balance);
    return;
  }

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(300)
    .build();

  tx.sign(keypair);

  console.log("Submitting changeTrust...");
  const result = await server.submitTransaction(tx);
  console.log("✅ Trustline added! Hash:", result.hash);
  console.log("   Explorer: https://stellar.expert/explorer/public/tx/" + result.hash);
}

main().catch((err) => {
  const detail = err?.response?.data?.extras?.result_codes ?? err.message ?? err;
  console.error("Fatal:", detail);
  process.exit(1);
});
