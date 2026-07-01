import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStellarWallet } from "@/contexts/StellarWalletContext";
import { addressToField } from "@/services/zkProof";
import { hasCredential, CONTRACT_ID } from "@/services/stellar";
import {
  getNftBalance, getNftTokenUri, getNftTier,
  mintNft, burnNft, generateAvatarUri,
  NFT_CONTRACT_ID, TIER_LABELS,
} from "@/services/soulboundNft";
import {
  Shield, CheckCircle, ExternalLink, LogOut, RefreshCw,
  Sparkles, Flame, ImageIcon, Loader2,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
const EXPLORER_BASE = `https://stellar.expert/explorer/${NETWORK === "mainnet" ? "public" : "testnet"}`;

// ipfs:// → resolvable gateway URL for <img>
function resolveUri(uri: string): string {
  if (uri.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  return uri;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { address, connected, disconnect, signTransaction } = useStellarWallet();

  // ── Credential state ─────────────────────────────────────────────────────
  const [credentialActive, setCredentialActive] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const txHash = searchParams.get("tx");

  // ── NFT state ─────────────────────────────────────────────────────────────
  const [nftBalance, setNftBalance] = useState<number | null>(null);
  const [nftUri, setNftUri] = useState<string | null>(null);
  const [nftTier, setNftTier] = useState<number | null>(null);
  const [nftChecking, setNftChecking] = useState(false);

  // ── Mint flow state ───────────────────────────────────────────────────────
  const [showMintPanel, setShowMintPanel] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewGateway, setPreviewGateway] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [minting, setMinting] = useState(false);
  const [burning, setBurning] = useState(false);
  const [nftTxHash, setNftTxHash] = useState<string | null>(null);
  const [nftError, setNftError] = useState<string | null>(null);

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
      if (active) checkNft();
    } catch (err: any) {
      setCredentialActive(false);
      setCheckError(err?.message ?? String(err));
    } finally {
      setChecking(false);
    }
  };

  const checkNft = async () => {
    if (!address || !NFT_CONTRACT_ID) return;
    setNftChecking(true);
    try {
      const [bal, uri, tier] = await Promise.all([
        getNftBalance(address),
        getNftTokenUri(address),
        getNftTier(address),
      ]);
      setNftBalance(bal);
      setNftUri(uri);
      setNftTier(tier);
    } finally {
      setNftChecking(false);
    }
  };

  const handleGenerate = async () => {
    if (!avatarPrompt.trim()) return;
    setGenerating(true);
    setNftError(null);
    setPreviewUri(null);
    setPreviewGateway(null);
    try {
      const result = await generateAvatarUri(avatarPrompt);
      // generateAvatarUri returns ipfs:// URI; service also returns gateway via a second call
      // Here we resolve for preview display
      setPreviewUri(result);
      setPreviewGateway(resolveUri(result));
    } catch (err: any) {
      setNftError(err?.message ?? String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleMint = async () => {
    if (!address || !previewUri || !signTransaction) return;
    setMinting(true);
    setNftError(null);
    try {
      const hash = await mintNft(address, 0, previewUri, signTransaction);
      setNftTxHash(hash);
      setShowMintPanel(false);
      setPreviewUri(null);
      setPreviewGateway(null);
      setAvatarPrompt("");
      await checkNft();
    } catch (err: any) {
      setNftError(err?.message ?? String(err));
    } finally {
      setMinting(false);
    }
  };

  const handleBurn = async () => {
    if (!address || !signTransaction) return;
    if (!confirm("Discard your current Identity NFT? You can mint a new one anytime.")) return;
    setBurning(true);
    setNftError(null);
    try {
      await burnNft(address, signTransaction);
      setNftBalance(0);
      setNftUri(null);
      setNftTier(null);
      setNftTxHash(null);
    } catch (err: any) {
      setNftError(err?.message ?? String(err));
    } finally {
      setBurning(false);
    }
  };

  const handleDisconnect = () => { disconnect(); navigate("/"); };

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
                {checkError && <p className="text-xs text-red-500 break-all font-mono">{checkError}</p>}
                <Button size="sm" onClick={() => navigate("/proof")}>Generate credential</Button>
              </div>
            )}
            <a
              href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> View contract on Stellar Explorer
            </a>
          </CardContent>
        </Card>

        {/* ── Identity NFT section (only shown when credential is active) ── */}
        {credentialActive && NFT_CONTRACT_ID && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Identity NFT
                <button onClick={checkNft} disabled={nftChecking} className="text-muted-foreground hover:text-foreground">
                  <RefreshCw className={`h-3.5 w-3.5 ${nftChecking ? "animate-spin" : ""}`} />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {nftChecking && nftBalance === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner className="h-4 w-4" /> Checking on-chain…
                </div>
              ) : nftBalance === 1 ? (
                /* ── Has NFT ── */
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {nftUri ? (
                      <img
                        src={resolveUri(nftUri)}
                        alt="Identity NFT"
                        className="h-16 w-16 rounded-full object-cover border-2 border-primary/30"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Identizy Identity</p>
                      {nftTier !== null && (
                        <span className="text-xs text-muted-foreground">{TIER_LABELS[nftTier]}</span>
                      )}
                    </div>
                  </div>

                  {nftTxHash && (
                    <a
                      href={`${EXPLORER_BASE}/tx/${nftTxHash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" /> Mint transaction
                    </a>
                  )}

                  <a
                    href={`${EXPLORER_BASE}/contract/${NFT_CONTRACT_ID}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" /> View NFT contract
                  </a>

                  <Button
                    variant="outline" size="sm"
                    className="w-full text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                    onClick={handleBurn} disabled={burning}
                  >
                    {burning ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Discarding…</> : <><Flame className="h-3.5 w-3.5 mr-1.5" /> Discard Identity (Disposable ID)</>}
                  </Button>
                </div>
              ) : (
                /* ── No NFT yet ── */
                !showMintPanel ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Give your anonymous identity a face. Mint a soulbound NFT with an AI-generated avatar stored permanently on IPFS.
                    </p>
                    <Button size="sm" className="w-full" onClick={() => setShowMintPanel(true)}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Mint Identity NFT
                    </Button>
                  </div>
                ) : (
                  /* ── Mint panel ── */
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">Describe your avatar</p>
                    <textarea
                      value={avatarPrompt}
                      onChange={(e) => setAvatarPrompt(e.target.value)}
                      placeholder="e.g. mysterious hacker with glowing blue eyes, cyberpunk style, dark background"
                      className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      rows={3}
                    />

                    <Button
                      size="sm" variant="outline" className="w-full"
                      onClick={handleGenerate}
                      disabled={generating || !avatarPrompt.trim()}
                    >
                      {generating
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating…</>
                        : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate Preview</>}
                    </Button>

                    {previewGateway && (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={previewGateway}
                          alt="Avatar preview"
                          className="h-32 w-32 rounded-full object-cover border-2 border-primary/30"
                        />
                        <p className="text-xs text-muted-foreground">Stored on IPFS · permanent</p>
                      </div>
                    )}

                    {nftError && <p className="text-xs text-red-500 break-all">{nftError}</p>}

                    <div className="flex gap-2">
                      <Button
                        size="sm" variant="outline" className="flex-1"
                        onClick={() => { setShowMintPanel(false); setPreviewUri(null); setPreviewGateway(null); setNftError(null); }}
                        disabled={minting}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm" className="flex-1"
                        onClick={handleMint}
                        disabled={minting || !previewUri}
                      >
                        {minting
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Minting…</>
                          : "Mint — Basic ($10 USDC)"}
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Fee forwarded directly to treasury · contract never holds USDC
                    </p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}

        {/* TX hash from proof generation */}
        {txHash && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Last transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={`${EXPLORER_BASE}/tx/${txHash}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-mono text-primary hover:underline break-all"
              >
                {txHash} <ExternalLink className="h-3 w-3 shrink-0" />
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
