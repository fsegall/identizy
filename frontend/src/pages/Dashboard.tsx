import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStellarWallet } from "@/contexts/StellarWalletContext";
import { addressToField } from "@/services/zkProof";
import { hasCredential, CONTRACT_ID } from "@/services/stellar";
import { Shield, CheckCircle, ExternalLink, LogOut, RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
const EXPLORER_BASE = `https://stellar.expert/explorer/${NETWORK === "mainnet" ? "public" : "testnet"}`;

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { address, connected, disconnect } = useStellarWallet();

  const [credentialActive, setCredentialActive] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const txHash = searchParams.get("tx");

  useEffect(() => {
    if (!connected) { navigate("/connect"); return; }
    checkCredential();
  }, [connected]);

  const checkCredential = async () => {
    if (!address) return;
    setChecking(true);
    setCheckError(null);
    try {
      const addressHashHex = BigInt(addressToField(address)).toString(16).padStart(64, "0");
      const active = await hasCredential(addressHashHex, address);
      setCredentialActive(active);
    } catch (err: any) {
      setCredentialActive(false);
      setCheckError(err?.message ?? String(err));
    } finally {
      setChecking(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center ${credentialActive ? "bg-green-100 dark:bg-green-900" : "bg-primary/10"}`}>
              {credentialActive
                ? <CheckCircle className="h-8 w-8 text-green-600" />
                : <Shield className="h-8 w-8 text-primary" />}
            </div>
          </div>
          <h1 className="text-2xl font-bold">
            {credentialActive ? "Credential active" : "Identizy Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {credentialActive
              ? "Your on-chain age credential is valid. Any verifier can confirm it directly on Stellar."
              : "No active credential found for this address."}
          </p>
        </div>

        {/* Wallet */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected address</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-mono break-all">{address}</p>
          </CardContent>
        </Card>

        {/* Credential status */}
        <Card className={credentialActive ? "border-green-300 dark:border-green-700" : ""}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Credential status
              <button onClick={checkCredential} disabled={checking} className="text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checking ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner className="h-4 w-4" /> Checking on-chain…
              </div>
            ) : credentialActive === null ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : credentialActive ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium px-2.5 py-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Age ≥ 18 verified
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No credential found.</p>
                {checkError && (
                  <p className="text-xs text-red-500 break-all font-mono">{checkError}</p>
                )}
                <Button size="sm" onClick={() => navigate("/proof")}>Generate credential</Button>
              </div>
            )}

            {/* Contract link */}
            <a
              href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View contract on Stellar Explorer
            </a>
          </CardContent>
        </Card>

        {/* TX hash from proof generation */}
        {txHash && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Last transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={`${EXPLORER_BASE}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-mono text-primary hover:underline break-all"
              >
                {txHash}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </CardContent>
          </Card>
        )}

        {/* Integration snippet */}
        {credentialActive && (
          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle className="text-sm font-medium">For verifiers — 3 lines of code</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">{`import { Contract, rpc } from "@stellar/stellar-sdk";
const contract = new Contract("${CONTRACT_ID}");
const hasIt = await contract.call("has_credential", addressHashBytes);`}</pre>
            </CardContent>
          </Card>
        )}

        <Button variant="outline" className="w-full" onClick={handleDisconnect}>
          <LogOut className="mr-2 h-4 w-4" /> Disconnect
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
