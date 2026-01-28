import React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui';
import { PartyPopper } from 'lucide-react';

interface HomeViewProps {
  onLogout: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onLogout }) => {
  return (
    <Card className="text-center shadow-lg border-t-4 border-t-green-500 animate-in fade-in zoom-in duration-500">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-100 p-3">
            <PartyPopper className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <CardTitle className="text-2xl text-green-700">Bem-vindo(a)!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <h2 className="text-xl font-medium text-slate-800">
          Parabéns, você realizou login!
        </h2>
        <p className="text-slate-600">
          Você agora tem acesso ao painel do Suporte Offshore.
        </p>
        
        <div className="pt-4">
          <Button onClick={onLogout} variant="outline" className="w-full sm:w-auto">
            Sair (Logout)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};