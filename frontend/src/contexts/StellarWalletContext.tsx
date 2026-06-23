import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { StellarWalletsKit, WalletNetwork, FreighterModule, xBullModule } from "@creit.tech/stellar-wallets-kit";

const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet";

const kit = new StellarWalletsKit({
  network: NETWORK === "mainnet" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
  selectedWalletId: "freighter",
  modules: [new FreighterModule(), new xBullModule()],
});

interface StellarWalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const StellarWalletContext = createContext<StellarWalletState | null>(null);

export function StellarWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await new Promise<void>((resolve) => {
        kit.openModal({
          onWalletSelected: async (option) => {
            kit.setWallet(option.id);
            const { address: addr } = await kit.getAddress();
            setAddress(addr);
            resolve();
          },
          onClosed: () => resolve(),
        });
      });
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const signTransaction = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error("Wallet not connected");
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        address,
        networkPassphrase:
          NETWORK === "mainnet"
            ? WalletNetwork.PUBLIC
            : WalletNetwork.TESTNET,
      });
      return signedTxXdr;
    },
    [address]
  );

  return (
    <StellarWalletContext.Provider
      value={{ address, connected: !!address, connecting, connect, disconnect, signTransaction }}
    >
      {children}
    </StellarWalletContext.Provider>
  );
}

export function useStellarWallet() {
  const ctx = useContext(StellarWalletContext);
  if (!ctx) throw new Error("useStellarWallet must be inside StellarWalletProvider");
  return ctx;
}
