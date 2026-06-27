
import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    'nav.login': 'Login',
    'nav.getStarted': 'Get Started',
    'nav.logout': 'Logout',
    'nav.backToHome': 'Back to Home',
    'nav.createAttestation': 'Create Attestation',
    'nav.connectWallet': 'Connect Wallet',
    
    // Hero Section
    'hero.badge': 'Powered by Zero-Knowledge Technology',
    'hero.title1': 'Prove What Matters',
    'hero.title2': 'Without Revealing Who You Are',
    'hero.subtitle': 'Identizy issues cryptographic credentials on Stellar — verify any attribute about yourself once, and use it everywhere, forever. Your data never leaves your device.',
    'hero.startNow': 'Get Started',
    'hero.viewDemo': 'View Demo',
    'hero.private': '100% Private',
    'hero.instant': 'Instant Verification',
    'hero.web3Ready': 'On Stellar',

    // Features
    'features.title': 'Why Identizy?',
    'features.subtitle': 'One credential. Any attribute. Infinite verifications — with zero personal data shared.',
    'features.zkProofs.title': 'Zero-Knowledge Proofs',
    'features.zkProofs.desc': 'Mathematical proof that a claim is true without revealing the underlying data. Computed in your browser — nothing leaves your device.',
    'features.web3.title': 'Stellar Blockchain',
    'features.web3.desc': 'Credentials live on Stellar. Any service verifies them with a single on-chain call — no Identizy server involved.',
    'features.privacy.title': 'Privacy by Design',
    'features.privacy.desc': 'Your document is verified once, then discarded. Only a cryptographic proof remains, bound to your wallet.',
    'features.age.title': 'Any Credential',
    'features.age.desc': 'Age, identity, income, residency — any verifiable attribute can become a reusable ZK credential.',

    // How it works
    'howItWorks.title': 'How It Works',
    'howItWorks.subtitle': 'Verify once. Use forever.',
    'howItWorks.step1.title': 'Connect Wallet',
    'howItWorks.step1.desc': 'Connect your Stellar wallet — no account or sign-up required.',
    'howItWorks.step2.title': 'Verify Once',
    'howItWorks.step2.desc': 'A licensed provider verifies your document. Your data never reaches Identizy.',
    'howItWorks.step3.title': 'Generate ZK Proof',
    'howItWorks.step3.desc': 'Your browser computes a zero-knowledge proof. Your personal data never leaves your device.',
    'howItWorks.step4.title': 'Use Anywhere',
    'howItWorks.step4.desc': 'Your credential lives on Stellar. Any service checks it with one blockchain call — forever.',

    // Demo Section
    'demo.title': 'See It In Action',
    'demo.subtitle': 'Watch the live demo and explore the full pitch deck.',
    'demo.videoLabel': 'Demo Video',
    'demo.videoComingSoon': 'Demo video coming soon',
    'demo.deckLabel': 'Pitch Deck',
    'demo.deckTagline1': 'Prove who you are, once.',
    'demo.deckTagline2': 'Be anyone, everywhere.',
    'demo.deckSubtitle': 'Identizy — Anonymous Credentials on Stellar',
    'demo.viewDeck': 'View Pitch Deck',

    // CTA
    'cta.title': 'Ready to Own Your Identity?',
    'cta.subtitle': 'One credential. Complete privacy. No re-verification, ever.',
    'cta.button': 'Create Your Credential',

    // Footer
    'footer.copyright': '© 2026 Identizy. Privacy-first identity infrastructure. By Livre Solutions',
    
    // Create Attestation
    'createAttestation.title': 'Create Attestation',
    'createAttestation.subtitle': 'Choose the type of verification you need',
    'createAttestation.coming': 'Coming Soon',
    'createAttestation.availableNow': 'Available Now',
    'createAttestation.zkPrivacy': 'Zero-Knowledge Privacy',
    'createAttestation.zkPrivacyDesc': 'All attestations use advanced zero-knowledge cryptography to verify information without exposing your personal data. Your privacy is guaranteed while maintaining full verification integrity.',
    
    // Attestation Types
    'attestation.age.title': 'Age Verification',
    'attestation.age.desc': 'Prove you are over 18 without revealing your birth date',
    'attestation.identity.title': 'Identity Verification',
    'attestation.identity.desc': 'Verify your legal identity with government-issued documents',
    'attestation.address.title': 'Address Verification',
    'attestation.address.desc': 'Prove your residential address with utility bills or bank statements',
    'attestation.income.title': 'Income Verification',
    'attestation.income.desc': 'Verify your income level without disclosing exact amounts',
    'attestation.education.title': 'Education Verification',
    'attestation.education.desc': 'Prove your educational qualifications and degrees',
    'attestation.employment.title': 'Employment Verification',
    'attestation.employment.desc': 'Verify your employment status and professional background',
    'attestation.property.title': 'Property Ownership',
    'attestation.property.desc': 'Prove ownership of real estate or other valuable assets',
    'attestation.financial.title': 'Financial Standing',
    'attestation.financial.desc': 'Verify creditworthiness without exposing detailed financial data',
    
    // Wallet Connect
    'wallet.title': 'Connect Your Wallet',
    'wallet.subtitle': 'Choose your preferred wallet to get started with Identizy',
    'wallet.connected': 'Wallet Connected Successfully!',
    'wallet.connectedDesc': 'Your wallet is now connected and ready to use',
    'wallet.account': 'Account',
    'wallet.network': 'Connected to Ethereum Mainnet',
    'wallet.continue': 'Continue to Onboarding',
    'wallet.metamask': 'MetaMask',
    'wallet.metamaskDesc': 'Connect using MetaMask browser extension',
    'wallet.walletconnect': 'WalletConnect',
    'wallet.walletconnectDesc': 'Connect using mobile wallet via QR code',
    'wallet.installRequired': 'Install Required',
    'wallet.security': 'Your Security Matters',
    'wallet.securityDesc': 'We never store your private keys. Your wallet connection is secure and encrypted.',
    'wallet.troubleshooting': 'Having trouble connecting?',
    'wallet.troubleStep1': '• Make sure your wallet is unlocked',
    'wallet.troubleStep2': '• Check that you\'re on the correct network',
    'wallet.troubleStep3': '• Try refreshing the page and connecting again',
    'wallet.troubleStep4': '• Ensure your wallet extension is up to date'
  },
  pt: {
    // Navigation
    'nav.login': 'Entrar',
    'nav.getStarted': 'Começar',
    'nav.logout': 'Sair',
    'nav.backToHome': 'Voltar ao Início',
    'nav.createAttestation': 'Criar Atestado',
    'nav.connectWallet': 'Conectar Carteira',
    
    // Hero Section
    'hero.badge': 'Tecnologia Zero-Knowledge',
    'hero.title1': 'Prove o Que Importa',
    'hero.title2': 'Sem Revelar Quem Você É',
    'hero.subtitle': 'O Identizy emite credenciais criptográficas na Stellar — verifique qualquer atributo sobre você uma vez e use em qualquer lugar, para sempre. Seus dados nunca saem do seu dispositivo.',
    'hero.startNow': 'Começar',
    'hero.viewDemo': 'Ver Demo',
    'hero.private': '100% Privado',
    'hero.instant': 'Verificação Instantânea',
    'hero.web3Ready': 'Na Stellar',

    // Features
    'features.title': 'Por que Identizy?',
    'features.subtitle': 'Uma credencial. Qualquer atributo. Verificações infinitas — sem compartilhar dados pessoais.',
    'features.zkProofs.title': 'Provas Zero-Knowledge',
    'features.zkProofs.desc': 'Prova matemática de que uma afirmação é verdadeira sem revelar os dados subjacentes. Calculada no seu navegador — nada sai do seu dispositivo.',
    'features.web3.title': 'Blockchain Stellar',
    'features.web3.desc': 'Credenciais vivem na Stellar. Qualquer serviço as verifica com uma única chamada on-chain — sem servidor Identizy envolvido.',
    'features.privacy.title': 'Privacidade por Design',
    'features.privacy.desc': 'Seu documento é verificado uma vez e descartado. Apenas uma prova criptográfica permanece, vinculada à sua carteira.',
    'features.age.title': 'Qualquer Credencial',
    'features.age.desc': 'Idade, identidade, renda, residência — qualquer atributo verificável pode se tornar uma credencial ZK reutilizável.',

    // How it works
    'howItWorks.title': 'Como Funciona',
    'howItWorks.subtitle': 'Verifique uma vez. Use para sempre.',
    'howItWorks.step1.title': 'Conectar Carteira',
    'howItWorks.step1.desc': 'Conecte sua carteira Stellar — sem cadastro ou conta necessários.',
    'howItWorks.step2.title': 'Verificar Uma Vez',
    'howItWorks.step2.desc': 'Um provedor licenciado verifica seu documento. Seus dados nunca chegam ao Identizy.',
    'howItWorks.step3.title': 'Gerar Prova ZK',
    'howItWorks.step3.desc': 'Seu navegador calcula uma prova zero-knowledge. Seus dados pessoais nunca saem do seu dispositivo.',
    'howItWorks.step4.title': 'Usar em Qualquer Lugar',
    'howItWorks.step4.desc': 'Sua credencial vive na Stellar. Qualquer serviço a consulta com uma chamada blockchain — para sempre.',

    // Demo Section
    'demo.title': 'Veja em Ação',
    'demo.subtitle': 'Assista à demo ao vivo e explore o pitch deck completo.',
    'demo.videoLabel': 'Vídeo Demo',
    'demo.videoComingSoon': 'Vídeo demo em breve',
    'demo.deckLabel': 'Pitch Deck',
    'demo.deckTagline1': 'Prove quem você é, uma vez.',
    'demo.deckTagline2': 'Seja qualquer pessoa, em qualquer lugar.',
    'demo.deckSubtitle': 'Identizy — Credenciais Anônimas na Stellar',
    'demo.viewDeck': 'Ver Pitch Deck',

    // CTA
    'cta.title': 'Pronto para Ter Sua Identidade?',
    'cta.subtitle': 'Uma credencial. Privacidade total. Sem re-verificação, nunca.',
    'cta.button': 'Criar Minha Credencial',

    // Footer
    'footer.copyright': '© 2026 Identizy. Infraestrutura de identidade com privacidade em primeiro lugar. By Livre Solutions',
    
    // Create Attestation
    'createAttestation.title': 'Criar Atestado',
    'createAttestation.subtitle': 'Escolha o tipo de verificação que você precisa',
    'createAttestation.coming': 'Em Breve',
    'createAttestation.availableNow': 'Disponível Agora',
    'createAttestation.zkPrivacy': 'Privacidade Zero-Knowledge',
    'createAttestation.zkPrivacyDesc': 'Todos os atestados usam criptografia zero-knowledge avançada para verificar informações sem expor seus dados pessoais. Sua privacidade é garantida enquanto mantém total integridade na verificação.',
    
    // Attestation Types
    'attestation.age.title': 'Verificação de Idade',
    'attestation.age.desc': 'Prove que você tem mais de 18 anos sem revelar sua data de nascimento',
    'attestation.identity.title': 'Verificação de Identidade',
    'attestation.identity.desc': 'Verifique sua identidade legal com documentos emitidos pelo governo',
    'attestation.address.title': 'Verificação de Endereço',
    'attestation.address.desc': 'Prove seu endereço residencial com contas de utilidades ou extratos bancários',
    'attestation.income.title': 'Verificação de Renda',
    'attestation.income.desc': 'Verifique seu nível de renda sem divulgar valores exatos',
    'attestation.education.title': 'Verificação de Educação',
    'attestation.education.desc': 'Prove suas qualificações educacionais e diplomas',
    'attestation.employment.title': 'Verificação de Emprego',
    'attestation.employment.desc': 'Verifique seu status de emprego e histórico profissional',
    'attestation.property.title': 'Propriedade Imobiliária',
    'attestation.property.desc': 'Prove a propriedade de imóveis ou outros ativos valiosos',
    'attestation.financial.title': 'Situação Financeira',
    'attestation.financial.desc': 'Verifique a credibilidade sem expor dados financeiros detalhados',
    
    // Wallet Connect
    'wallet.title': 'Conectar Sua Carteira',
    'wallet.subtitle': 'Escolha sua carteira preferida para começar com o Identizy',
    'wallet.connected': 'Carteira Conectada com Sucesso!',
    'wallet.connectedDesc': 'Sua carteira está agora conectada e pronta para usar',
    'wallet.account': 'Conta',
    'wallet.network': 'Conectado à Rede Ethereum',
    'wallet.continue': 'Continuar para Onboarding',
    'wallet.metamask': 'MetaMask',
    'wallet.metamaskDesc': 'Conectar usando a extensão MetaMask do navegador',
    'wallet.walletconnect': 'WalletConnect',
    'wallet.walletconnectDesc': 'Conectar usando carteira móvel via código QR',
    'wallet.installRequired': 'Instalação Necessária',
    'wallet.security': 'Sua Segurança Importa',
    'wallet.securityDesc': 'Nunca armazenamos suas chaves privadas. Sua conexão de carteira é segura e criptografada.',
    'wallet.troubleshooting': 'Tendo problemas para conectar?',
    'wallet.troubleStep1': '• Certifique-se de que sua carteira está desbloqueada',
    'wallet.troubleStep2': '• Verifique se você está na rede correta',
    'wallet.troubleStep3': '• Tente atualizar a página e conectar novamente',
    'wallet.troubleStep4': '• Certifique-se de que sua extensão de carteira está atualizada'
  }
};

export const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && (saved === 'en' || saved === 'pt')) {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
