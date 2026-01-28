import React, { useState, useEffect } from 'react';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { SuccessView } from './features/onboarding/SuccessView';
import { LoginView } from './features/auth/LoginView';
import { ForgotPasswordView } from './features/auth/ForgotPasswordView';
import { UpdatePasswordView } from './features/auth/UpdatePasswordView';
import { HomeView } from './features/home/HomeView';
import { ChatView } from './features/chat/ChatView'; // Importar ChatView
import { Toaster, toast } from './components/ui/Toaster';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';

// Adicionar 'chat' ao tipo ViewState
type ViewState = 'login' | 'onboarding' | 'success' | 'home' | 'forgot-password' | 'update-password' | 'chat';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('login');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('update-password') || hash.includes('type=recovery'))) {
      setCurrentView('update-password');
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCurrentView('update-password');
        toast("Recuperação detectada. Por favor, defina sua nova senha.", "info");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSuccess = () => {
    setCurrentView('success');
  };

  const handleLoginSuccess = () => {
    // REDIRECIONAMENTO DIRETO PARA O CHAT
    setCurrentView('chat'); 
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast("Você saiu do sistema.", "info");
    setCurrentView('login');
  };

  const handleGoToLogin = () => {
    setCurrentView('login');
  };

  const handleGoToRegister = () => {
    setCurrentView('onboarding');
  };

  const handleGoToForgotPassword = () => {
    setCurrentView('forgot-password');
  };

  // Função auxiliar para voltar do chat para a home (opcional, se necessário futuramente)
  const handleGoToHome = () => {
      setCurrentView('home');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 transition-colors duration-500 bg-slate-50">
      <header className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Suporte Offshore</h1>
        <p className="text-muted-foreground mt-2">Comece sua jornada de investimentos hoje.</p>
      </header>
      
      {/* Ajuste de largura para o Chat que precisa de mais espaço */}
      <main className={cn(
          "w-full transition-all duration-500", 
          currentView === 'chat' ? "max-w-6xl" : "max-w-2xl"
      )}>
        {currentView === 'login' && (
          <LoginView 
            onRegisterClick={handleGoToRegister} 
            onLoginSuccess={handleLoginSuccess}
            onForgotPasswordClick={handleGoToForgotPassword}
          />
        )}
        
        {currentView === 'forgot-password' && (
          <ForgotPasswordView onBack={handleGoToLogin} />
        )}

        {currentView === 'update-password' && (
          <UpdatePasswordView onSuccess={handleGoToLogin} />
        )}

        {currentView === 'onboarding' && (
          <OnboardingWizard onSuccess={handleSuccess} onCancel={handleGoToLogin} />
        )}

        {currentView === 'success' && (
          <SuccessView 
            onLogin={handleGoToLogin} 
            onNewRegister={handleGoToRegister} 
          />
        )}

        {currentView === 'home' && (
          <HomeView onLogout={handleLogout} />
        )}

        {/* Renderização do ChatView */}
        {currentView === 'chat' && (
          <ChatView onLogout={handleLogout} />
        )}
      </main>

      <footer className="mt-8 text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Suporte Offshore. Todos os direitos reservados.
      </footer>
      
      <Toaster />
    </div>
  );
};

export default App;