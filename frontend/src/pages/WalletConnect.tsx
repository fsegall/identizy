import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useStellarWallet } from "@/contexts/StellarWalletContext";
import { Shield, Wallet, ArrowRight, Lock } from "lucide-react";

const WalletConnect = () => {
  const navigate = useNavigate();
  const { connected, connecting, connect, address } = useStellarWallet();

  useEffect(() => {
    if (connected) {
      setTimeout(() => navigate("/proof"), 800);
    }
  }, [connected, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Connect your Stellar wallet</h1>
          <p className="text-muted-foreground text-sm">
            Your wallet address binds your ZK credential. It never leaves your device.
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Stellar Wallet
            </CardTitle>
            <CardDescription>
              Supports Freighter, xBull, Lobstr, and other Stellar wallets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connected ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
                  <p className="text-xs font-mono text-green-800 dark:text-green-200 break-all">
                    {address}
                  </p>
                </div>
                <p className="text-center text-sm text-muted-foreground">Connected — redirecting…</p>
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={connect} disabled={connecting}>
                {connecting ? (
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                ) : (
                  <Wallet className="mr-2 h-4 w-4" />
                )}
                {connecting ? "Connecting…" : "Connect wallet"}
                {!connecting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Your public address generates a ZK commitment. No private key is accessed beyond
            signing the final transaction.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletConnect;
