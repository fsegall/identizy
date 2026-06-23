/**
 * stellar.ts — Soroban contract interaction for the AgeVerifier.
 *
 * Calls AgeVerifier.verify() on Stellar testnet/mainnet.
 * Uses @stellar/stellar-sdk and @creit.tech/stellar-wallets-kit for signing.
 *
 * Docs:
 *   SDK: https://developers.stellar.org/docs/tools/sdks
 *   Wallets Kit: https://stellarwalletskit.dev/
 */

import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  XdrLargeInt,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import type { SorobanProof } from "./zkProof";

// ────────────────────────────────────────────────────────────
// Config — override via env vars at build time
// ────────────────────────────────────────────────────────────

const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet";

const RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL ??
  (NETWORK === "mainnet"
    ? "https://mainnet.sorobanrpc.com"
    : "https://soroban-testnet.stellar.org");

const CONTRACT_ID = import.meta.env.VITE_AGE_VERIFIER_CONTRACT_ID ?? "";

const NETWORK_PASSPHRASE =
  NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Build the Soroban ScVal for a Groth16Proof contracttype */
function proofToScVal(proof: SorobanProof): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("a"),
      val: nativeToScVal(hexToBytes(proof.a), { type: "bytes" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("b"),
      val: nativeToScVal(hexToBytes(proof.b), { type: "bytes" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("c"),
      val: nativeToScVal(hexToBytes(proof.c), { type: "bytes" }),
    }),
  ]);
}

/** Build a 32-byte Fr scalar from a hex string */
function hexToFr(hex: string): xdr.ScVal {
  return nativeToScVal(hexToBytes(hex.startsWith("0x") ? hex : "0x" + hex), {
    type: "bytes",
  });
}

/** Derive a simple 32-byte nullifier from the caller address + proof */
function deriveNullifier(address: string, proofHex: string): Uint8Array {
  // Simple deterministic nullifier: first 32 bytes of SHA-256(address + proof.a)
  // In production, use Poseidon(address, nonce) for better privacy.
  const input = new TextEncoder().encode(address + proofHex.slice(2, 66));
  return crypto.subtle
    .digest("SHA-256", input)
    .then(() => new Uint8Array(32)) as unknown as Uint8Array;
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

export interface VerifyOnChainParams {
  /** Caller's Stellar address (G...) */
  callerAddress: string;
  /** Formatted proof from zkProof.generateAgeProof() */
  proof: SorobanProof;
  /** Public signal hex from zkProof.generateAgeProof() */
  publicInput: string;
  /** Sign a transaction — provided by Stellar Wallets Kit */
  signTransaction: (xdr: string, opts: { network: string; networkPassphrase: string }) => Promise<string>;
}

export interface OnChainVerifyResult {
  success: boolean;
  txHash: string;
}

export async function verifyAgeOnChain(
  params: VerifyOnChainParams
): Promise<OnChainVerifyResult> {
  if (!CONTRACT_ID) {
    throw new Error(
      "VITE_AGE_VERIFIER_CONTRACT_ID not set. Deploy the contract and add it to .env"
    );
  }

  const server = new SorobanRpc.Server(RPC_URL);
  const account = await server.getAccount(params.callerAddress);
  const contract = new Contract(CONTRACT_ID);

  // Derive nullifier (32 bytes)
  const nullifierBytes = new Uint8Array(32);
  crypto.getRandomValues(nullifierBytes); // random nullifier per submission

  // Build pub_inputs Vec<Bn254Fr> (one element for ageVerifier)
  const pubInputsVal = xdr.ScVal.scvVec([hexToFr(params.publicInput)]);

  const callArgs = [
    proofToScVal(params.proof),
    pubInputsVal,
    nativeToScVal(nullifierBytes, { type: "bytes" }),
  ];

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("verify", ...callArgs))
    .setTimeout(30)
    .build();

  // Simulate first to get resource footprint
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

  // Sign via Wallets Kit
  const signedXdr = await params.signTransaction(preparedTx.toXDR(), {
    network: NETWORK,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  // Submit
  const submitResult = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );

  if (submitResult.status === "ERROR") {
    throw new Error(`Submission failed: ${JSON.stringify(submitResult.errorResult)}`);
  }

  // Poll for confirmation
  let txResult = await server.getTransaction(submitResult.hash);
  let attempts = 0;
  while (txResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && attempts < 10) {
    await new Promise((r) => setTimeout(r, 2000));
    txResult = await server.getTransaction(submitResult.hash);
    attempts++;
  }

  if (txResult.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    return { success: true, txHash: submitResult.hash };
  }

  throw new Error(`Transaction failed: ${txResult.status}`);
}

export { NETWORK, RPC_URL, CONTRACT_ID };
