import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/providers/ThemeProvider";
import { LanguageProvider } from "./contexts/LanguageContext";
import { StellarWalletProvider } from "./contexts/StellarWalletContext";
import Landing from "./pages/Landing";
import WalletConnect from "./pages/WalletConnect";
import ProofGeneration from "./pages/ProofGeneration";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <ThemeProvider>
      <LanguageProvider>
        <StellarWalletProvider>
          <div className="min-h-screen bg-background">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/connect" element={<WalletConnect />} />
                <Route path="/proof" element={<ProofGeneration />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </div>
        </StellarWalletProvider>
      </LanguageProvider>
    </ThemeProvider>
  </TooltipProvider>
);

export default App;
