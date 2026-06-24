import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useStellarWallet } from "@/contexts/StellarWalletContext";
import { generateAgeProof, verifyLocally } from "@/services/zkProof";
import { verifyAgeOnChain } from "@/services/stellar";
import { Shield, ArrowLeft, CheckCircle, Cpu, Lock, Hash, AlertCircle } from "lucide-react";

type Step = "idle" | "generating" | "signing" | "submitting" | "done" | "error";

const STEPS = [
  { id: "generating", label: "Generating ZK proof", icon: Cpu, desc: "Computing Groth16 proof in your browser — your birthdate never leaves this device." },
  { id: "signing",    label: "Issuer attestation",  icon: Hash, desc: "Signing the Poseidon commitment with the Issuer key." },
  { id: "submitting", label: "Submitting on-chain", icon: Lock, desc: "Freighter signs and broadcasts the Soroban transaction." },
];

const ProofGeneration = () => {
  const navigate = useNavigate();
  const { address, signTransaction, connected } = useStellarWallet();

  const [birthDateStr, setBirthDateStr] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  if (!connected) {
    navigate("/connect");
    return null;
  }

  const handleGenerate = async () => {
    if (!birthDateStr) return;
    setError("");
    setStep("generating");
    setCurrentStepIdx(0);

    try {
      const birthDate = Math.floor(new Date(birthDateStr).getTime() / 1000);

      // Step 1 — generate proof + issuer sign
      const result = await generateAgeProof({ birthDate, stellarAddress: address! });

      if (!result.isOldEnough) {
        setError("The proof shows you are under 18. Credential not issued.");
        setStep("error");
        return;
      }

      // Local verification before submitting
      const localOk = await verifyLocally(result.rawProof, result.rawPublicSignals);
      if (!localOk) {
        setError("Local proof verification failed. Please try again.");
        setStep("error");
        return;
      }

      setStep("signing");
      setCurrentStepIdx(1);

      // Step 2 — submit to Soroban (wallet signs)
      setStep("submitting");
      setCurrentStepIdx(2);

      const { txHash: hash } = await verifyAgeOnChain(address!, result, signTransaction);

      setTxHash(hash);
      setStep("done");
      setCurrentStepIdx(3);

      setTimeout(() => navigate(`/dashboard?tx=${hash}`), 1500);
    } catch (err: any) {
      setError(err?.message ?? "Unknown error");
      setStep("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">

        <button onClick={() => navigate("/connect")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center space-y-1">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Generate your ZK credential</h1>
          <p className="text-muted-foreground text-sm">
            Enter your date of birth. The proof is computed locally — nothing is sent to any server.
          </p>
        </div>

        {/* Wallet badge */}
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground truncate">
          {address}
        </div>

        {/* Date input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date of birth</CardTitle>
            <CardDescription>Used only to compute the ZK proof locally — never sent to any server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Demo notice */}
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Hackathon demo:</span> In production this step is replaced by a full KYC document flow — the user uploads a government-issued ID and a selfie, and the Issuer verifies the document and signs the attestation. For this demo, you enter your date of birth directly.
            </div>
            <input
              type="date"
              value={birthDateStr}
              onChange={(e) => setBirthDateStr(e.target.value)}
              max={new Date(Date.now() - 18 * 365.25 * 86400 * 1000).toISOString().split("T")[0]}
              disabled={step !== "idle" && step !== "error"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={!birthDateStr || (step !== "idle" && step !== "error")}
            >
              {step === "idle" || step === "error" ? (
                <><Shield className="mr-2 h-4 w-4" /> Generate &amp; Mint Credential</>
              ) : (
                <><LoadingSpinner className="mr-2 h-4 w-4" /> Processing…</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Progress steps */}
        {step !== "idle" && (
          <div className="space-y-3">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const done = idx < currentStepIdx || step === "done";
              const active = idx === currentStepIdx && step !== "done" && step !== "error";
              return (
                <div key={s.id} className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${active ? "border-primary bg-primary/5" : done ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950" : "opacity-40"}`}>
                  <div className={`mt-0.5 h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-full ${done ? "bg-green-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {done ? <CheckCircle className="h-4 w-4" /> : active ? <LoadingSpinner className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="rounded-lg border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4 text-center space-y-1">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
            <p className="font-semibold text-green-800 dark:text-green-200">Credential issued!</p>
            <p className="text-xs font-mono text-green-700 dark:text-green-300 break-all">{txHash}</p>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Error</p>
              <p className="text-xs text-destructive/80 mt-1 break-all">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProofGeneration;
