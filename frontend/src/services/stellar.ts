/**
 * stellar.ts — Soroban contract interaction for AgeVerifier.
 *
 * Calls AgeVerifier.verify() on Stellar testnet.
 * Uses @stellar/stellar-sdk v13 (SorobanRpc namespace).
 */

import { Contract, Networks, TransactionBuilder, BASE_FEE, xdr, Address } from "@stellar/stellar-sdk";
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

// Fr elements must be encoded as scvU256, not scvBytes.
// Fr::try_from_val → U256::try_from_val expects U256Val, not BytesVal.
// Passing scvBytes causes unwrap_optimized() → wasm32::unreachable → UnreachableCodeReached.
function hexToScFr(hex: string): xdr.ScVal {
  const h = (hex.startsWith("0x") ? hex.slice(2) : hex).padStart(64, "0");
  const b = Buffer.from(h, "hex");
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // UInt256Parts expects UnsignedHyper (from stellar-base) but BigInt works at runtime.
  // The TypeScript definition is a version mismatch — runtime behavior is correct.
  return xdr.ScVal.scvU256(new xdr.UInt256Parts({
    hiHi: view.getBigUint64(0, false),
    hiLo: view.getBigUint64(8, false),
    loHi: view.getBigUint64(16, false),
    loLo: view.getBigUint64(24, false),
  } as any));
}

function buildProofScVal(result: AgeProofResult): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("a"), val: hexToScBytes(result.proof.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("b"), val: hexToScBytes(result.proof.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("c"), val: hexToScBytes(result.proof.c) }),
  ]);
}

function buildPubInputsScVal(result: AgeProofResult): xdr.ScVal {
  // Vec<Fr> — each element must be scvU256 (Fr wraps U256)
  return xdr.ScVal.scvVec([
    hexToScFr(result.sigIsOldEnough),
    hexToScFr(result.commitment),
    hexToScFr(result.addressHash),
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
        Address.fromString(callerAddress).toScVal(),
        buildProofScVal(proofResult),
        buildPubInputsScVal(proofResult),
        xdr.ScVal.scvBytes(Buffer.from(nullifierBytes)),
        hexToScBytes(proofResult.issuerSig)
      )
    )
    .setTimeout(300)
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

export async function hasCredential(addressHashHex: string, callerAddress: string): Promise<boolean> {
  const server = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(callerAddress).catch(() => null);
  if (!account) return false;

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call("has_credential", hexToScBytes(addressHashHex)))
    .setTimeout(30)
    .build();

  // Use any-typed sim to avoid depending on SorobanRpc.Api namespace, which can be
  // undefined in Vite's CJS interop — the namespace ref throws before isSimulationError()
  // is even called, silently returning false via the outer catch.
  const sim: any = await server.simulateTransaction(tx);
  if (sim.error) return false;
  const retval = sim.result?.retval;
  if (!retval) return false;
  return retval.switch().name === "scvBool" && retval.b();
}

export { NETWORK, RPC_URL, CONTRACT_ID };
