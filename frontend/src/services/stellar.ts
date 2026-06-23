/**
 * stellar.ts — Soroban contract interaction for AgeVerifier.
 *
 * Calls AgeVerifier.verify() on Stellar testnet.
 * Uses @stellar/stellar-sdk v13 (SorobanRpc namespace).
 */

import { Contract, Networks, TransactionBuilder, BASE_FEE, xdr } from "@stellar/stellar-sdk";
import * as SorobanRpc from "@stellar/stellar-sdk/rpc";
import type { AgeProofResult } from "./zkProof";

const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
const RPC_URL = import.meta.env.VITE_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = import.meta.env.VITE_AGE_VERIFIER_CONTRACT_ID ?? "";
const NETWORK_PASSPHRASE = NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

// ── XDR encoding ─────────────────────────────────────────────────────────────

function hexToScBytes(hex: string): xdr.ScVal {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return xdr.ScVal.scvBytes(Buffer.from(h, "hex"));
}

function buildProofScVal(result: AgeProofResult): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("a"), val: hexToScBytes(result.proof.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("b"), val: hexToScBytes(result.proof.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("c"), val: hexToScBytes(result.proof.c) }),
  ]);
}

function buildPubInputsScVal(result: AgeProofResult): xdr.ScVal {
  // Vec<Fr> — 3 elements: [isOldEnough, commitment, addressHash]
  return xdr.ScVal.scvVec([
    hexToScBytes(result.sigIsOldEnough),
    hexToScBytes(result.commitment),
    hexToScBytes(result.addressHash),
  ]);
}

// ── Main ─────────────────────────────────────────────────────────────────────

export interface VerifyResult {
  success: boolean;
  txHash: string;
}

export async function verifyAgeOnChain(
  callerAddress: string,
  proofResult: AgeProofResult,
  signTransaction: (xdr: string) => Promise<string>
): Promise<VerifyResult> {
  if (!CONTRACT_ID) throw new Error("VITE_AGE_VERIFIER_CONTRACT_ID not set");

  const server = new SorobanRpc.Server(RPC_URL);
  const account = await server.getAccount(callerAddress);
  const contract = new Contract(CONTRACT_ID);

  // Random 32-byte nullifier (prevents replay)
  const nullifierBytes = crypto.getRandomValues(new Uint8Array(32));

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      contract.call(
        "verify",
        buildProofScVal(proofResult),
        buildPubInputsScVal(proofResult),
        xdr.ScVal.scvBytes(Buffer.from(nullifierBytes)),
        hexToScBytes(proofResult.issuerSig)
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  const signedXdr = await signTransaction(prepared.toXDR());
  const final = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const send = await server.sendTransaction(final);
  if (send.status === "ERROR") {
    throw new Error(`Submit failed: ${JSON.stringify(send.errorResult)}`);
  }

  // Poll for confirmation
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await server.getTransaction(send.hash);
    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return { success: true, txHash: send.hash };
    }
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
    }
  }

  throw new Error("Transaction confirmation timeout");
}

export async function hasCredential(addressHashHex: string): Promise<boolean> {
  const server = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN" // read-only fee source
  ).catch(() => null);
  if (!account) return false;

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call("has_credential", hexToScBytes(addressHashHex)))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return false;
  const result = (sim as SorobanRpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result) return false;
  return result.retval.switch() === xdr.ScValType.scvBool() && result.retval.b();
}

export { NETWORK, RPC_URL, CONTRACT_ID };
