
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Shield,
  Wallet,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  Play,
  Zap,
  Globe,
  Plus,
} from 'lucide-react';

const DEMO_RECORDING_URL = "https://www.awesomescreenshot.com/video/54131454?key=33976bfcf04fbfb8f11e0ce1253e5dca";
const TEASER_VIDEO_EMBED_URL = "https://www.youtube.com/embed/anN2X7D3MSs";
const GAMMA_DECK_URL = "https://gamma.app/docs/Prove-who-you-are-once-Be-anyone-everywhere-ywt409gzkanp3a8";
const CREDENTIAL_TX = "402d7eab70c17d6839db3a9b42a07de939b956db328080feb817fd45629bac6d";
const NFT_TX = "0e69eb22298822d9a60f2ac59a8a8e9a48b8245af8a49d2ee5c53c820bdf10a3";
const EXPLORER_BASE = "https://stellar.expert/explorer/public/tx/";

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleViewDemo = () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      icon: Shield,
      title: t('features.zkProofs.title'),
      description: t('features.zkProofs.desc'),
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Wallet,
      title: t('features.web3.title'),
      description: t('features.web3.desc'),
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Lock,
      title: t('features.privacy.title'),
      description: t('features.privacy.desc'),
      color: "from-orange-500 to-red-500"
    },
    {
      icon: User,
      title: t('features.age.title'),
      description: t('features.age.desc'),
      color: "from-green-500 to-emerald-500"
    }
  ];

  const steps = [
    {
      number: 1,
      title: t('howItWorks.step1.title'),
      description: t('howItWorks.step1.desc')
    },
    {
      number: 2,
      title: t('howItWorks.step2.title'),
      description: t('howItWorks.step2.desc')
    },
    {
      number: 3,
      title: t('howItWorks.step3.title'),
      description: t('howItWorks.step3.desc')
    },
    {
      number: 4,
      title: t('howItWorks.step4.title'),
      description: t('howItWorks.step4.desc')
    },
    {
      number: 5,
      title: t('howItWorks.step5.title'),
      description: t('howItWorks.step5.desc'),
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 backdrop-blur-sm bg-background/80 border-b">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">Identizy</span>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <LanguageToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/create-attestation')}
            className="hidden sm:flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('nav.createAttestation')}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/auth')} className="hidden sm:inline-flex">
            {t('nav.login')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate('/connect')}
            className="flex items-center gap-2"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">{t('nav.connectWallet')}</span>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-primary/10 rounded-full border border-primary/20 text-primary">
            <Sparkles className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">{t('hero.badge')}</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent leading-tight">
            {t('hero.title1')}
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('hero.title2')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button
              size="lg"
              className="btn-gradient text-lg px-8 py-6 h-auto group"
              onClick={() => navigate('/connect')}
            >
              {t('hero.startNow')}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 h-auto border-2 group"
              onClick={handleViewDemo}
            >
              <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              {t('hero.viewDemo')}
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-8 pt-12 opacity-60">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm">{t('hero.private')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <span className="text-sm">{t('hero.instant')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <span className="text-sm">{t('hero.web3Ready')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Section */}
      <section id="demo" className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('demo.title')}</h2>
            <p className="text-lg text-muted-foreground">
              {t('demo.subtitle')}
            </p>
          </div>

          {/* Main: product screen recording */}
          <div className="flex flex-col gap-4 mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t('demo.videoLabel')}</h3>
            <a
              href={DEMO_RECORDING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-5 rounded-xl border bg-slate-950 hover:border-primary/40 transition-colors px-6 py-5"
            >
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Play className="h-5 w-5 text-primary ml-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold">{t('demo.watchRecording')}</p>
                <p className="text-slate-400 text-sm truncate">{t('demo.recordingSubtitle')}</p>
              </div>
              <ArrowRight className="shrink-0 h-4 w-4 text-slate-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </a>

            {/* Stellar Explorer links */}
            <div className="flex flex-wrap gap-3">
              <a
                href={EXPLORER_BASE + CREDENTIAL_TX}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors font-mono"
              >
                <Shield className="h-3 w-3 shrink-0" />
                {t('demo.credentialTx')} ↗
              </a>
              <a
                href={EXPLORER_BASE + NFT_TX}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors font-mono"
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                {t('demo.nftTx')} ↗
              </a>
            </div>
          </div>

          {/* Secondary: Teaser + Pitch Deck */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Teaser */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t('demo.teaserLabel')}</h3>
              <div className="relative w-full rounded-xl overflow-hidden border shadow-lg" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={TEASER_VIDEO_EMBED_URL}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Identizy Teaser"
                />
              </div>
            </div>

            {/* Pitch Deck */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t('demo.deckLabel')}</h3>
              <a
                href={GAMMA_DECK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div
                  className="relative w-full rounded-xl overflow-hidden border shadow-lg transition-transform duration-200 group-hover:scale-[1.02]"
                  style={{ paddingTop: '56.25%' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-white text-xl md:text-2xl font-bold leading-tight">
                      {t('demo.deckTagline1')}<br />
                      <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        {t('demo.deckTagline2')}
                      </span>
                    </h3>
                    <p className="text-slate-400 text-sm">{t('demo.deckSubtitle')}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-300 border border-slate-600 rounded-full px-3 py-1 group-hover:border-slate-400 transition-colors">
                      {t('demo.viewDeck')} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('features.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary/20 transition-all duration-200 group">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('howItWorks.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl bg-gradient-to-r from-primary to-accent">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t('cta.subtitle')}
          </p>
          <Button
            size="lg"
            className="btn-gradient text-lg px-8 py-6 h-auto"
            onClick={() => navigate('/connect')}
          >
            {t('cta.button')}
            <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t p-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-gradient-to-r from-primary to-accent rounded flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">Identizy</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
