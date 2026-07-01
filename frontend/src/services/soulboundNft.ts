/**
 * soulboundNft.ts — SoulboundNft contract interaction
 *
 * Contract: CCIDPRSOBCUF5OEHD3C5EAH2WQTY6QIY3SSCCIJJ344DH6HAA7O4QLOC (testnet)
 * Interface: SEP-0041 soulbound NFT with avatar + tier
 */

import { Contract, Networks, TransactionBuilder, BASE_FEE, xdr, Address } from "@stellar/stellar-sdk";
import * as SorobanRpc from "@stellar/stellar-sdk/rpc";

const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
const RPC_URL = import.meta.env.VITE_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const NFT_CONTRACT_ID = import.meta.env.VITE_SOULBOUND_NFT_CONTRACT_ID ?? "";
const NETWORK_PASSPHRASE = NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
const GENERATE_AVATAR_URL = import.meta.env.VITE_GENERATE_AVATAR_URL ?? "";

// ── Read helpers ─────────────────────────────────────────────────────────────

function addrToScVal(stellarAddress: string): xdr.ScVal {
  return Address.fromString(stellarAddress).toScVal();
}

async function simulateRead(contract: Contract, server: SorobanRpc.Server, callerAddress: string, method: string, args: xdr.ScVal[]): Promise<any> {
  const account = await server.getAccount(callerAddress).catch(() => null);
  if (!account) return null;

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim: any = await server.simulateTransaction(tx);
  if (sim.error) return null;
  return sim.result?.retval ?? null;
}

export async function getNftBalance(stellarAddress: string): Promise<number> {
  if (!NFT_CONTRACT_ID) return 0;
  const server = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(NFT_CONTRACT_ID);
  const retval = await simulateRead(contract, server, stellarAddress, "balance", [addrToScVal(stellarAddress)]);
  if (!retval) return 0;
  // balance returns i128 — 0 or 1
  if (retval.switch().name === "scvI128") {
    const parts = retval.i128();
    return Number(parts.lo()) === 1 ? 1 : 0;
  }
  return 0;
}

export async function getNftTokenUri(stellarAddress: string): Promise<string | null> {
  if (!NFT_CONTRACT_ID) return null;
  const server = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(NFT_CONTRACT_ID);
  const retval = await simulateRead(contract, server, stellarAddress, "token_uri", [addrToScVal(stellarAddress)]);
  if (!retval) return null;
  // Option<String> — None = scvVoid, Some = scvString or wrapped
  const name = retval.switch().name;
  if (name === "scvVoid") return null;
  if (name === "scvString") return retval.str().toString();
  // scvOption wrapping
  if (name === "scvOption") {
    const inner = retval.optionVal();
    if (!inner) return null;
    if (inner.switch().name === "scvString") return inner.str().toString();
  }
  return null;
}

export async function getNftTier(stellarAddress: string): Promise<number | null> {
  if (!NFT_CONTRACT_ID) return null;
  const server = new SorobanRpc.Server(RPC_URL);
  const contract = new Contract(NFT_CONTRACT_ID);
  const retval = await simulateRead(contract, server, stellarAddress, "token_tier", [addrToScVal(stellarAddress)]);
  if (!retval) return null;
  const name = retval.switch().name;
  if (name === "scvVoid") return null;
  if (name === "scvU32") return retval.u32();
  if (name === "scvOption") {
    const inner = retval.optionVal();
    if (!inner) return null;
    if (inner.switch().name === "scvU32") return inner.u32();
  }
  return null;
}

// ── Write operations ──────────────────────────────────────────────────────────

async function signAndSubmit(
  callerAddress: string,
  operation: xdr.Operation,
  signTransaction: (xdr: string) => Promise<string>
): Promise<string> {
  const server = new SorobanRpc.Server(RPC_URL);
  const account = await server.getAccount(callerAddress);

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${(sim as any).error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  const signedXdr = await signTransaction(prepared.toXDR());
  const final = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const send = await server.sendTransaction(final);
  if (send.status === "ERROR") {
    throw new Error(`Submit failed: ${JSON.stringify(send.errorResult)}`);
  }

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await server.getTransaction(send.hash);
    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return send.hash;
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
    }
  }
  throw new Error("Transaction confirmation timeout");
}

export async function mintNft(
  callerAddress: string,
  tier: 0 | 1 | 2,
  avatarUri: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<string> {
  if (!NFT_CONTRACT_ID) throw new Error("VITE_SOULBOUND_NFT_CONTRACT_ID not set");
  const contract = new Contract(NFT_CONTRACT_ID);
  const op = contract.call(
    "mint",
    addrToScVal(callerAddress),
    xdr.ScVal.scvU32(tier),
    xdr.ScVal.scvString(avatarUri)
  );
  return signAndSubmit(callerAddress, op, signTransaction);
}

export async function burnNft(
  callerAddress: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<string> {
  if (!NFT_CONTRACT_ID) throw new Error("VITE_SOULBOUND_NFT_CONTRACT_ID not set");
  const contract = new Contract(NFT_CONTRACT_ID);
  const op = contract.call(
    "burn",
    addrToScVal(callerAddress),
    xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0), lo: new xdr.Uint64(1) }))
  );
  return signAndSubmit(callerAddress, op, signTransaction);
}

// ── Avatar generation ─────────────────────────────────────────────────────────

export async function generateAvatarUri(prompt: string): Promise<string> {
  if (!GENERATE_AVATAR_URL) throw new Error("VITE_GENERATE_AVATAR_URL not set");
  const res = await fetch(GENERATE_AVATAR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Avatar generation failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.uri) throw new Error("No URI returned from avatar generator");
  return data.uri;
}

export const TIER_LABELS = ["Basic — $10 USDC", "Premium — $25 USDC", "Rare — $100 USDC"] as const;
export const TIER_COLORS = ["text-blue-500", "text-purple-500", "text-amber-500"] as const;
