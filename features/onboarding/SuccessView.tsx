import React from 'react';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../../components/ui';
import { CheckCircle2 } from 'lucide-react';

interface SuccessViewProps {
  onLogin: () => void;
  onNewRegister: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ onLogin, onNewRegister }) => {
  return (
    <Card className="text-center shadow-lg border-t-4 border-t-green-500 animate-in fade-in zoom-in duration-500">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <CardTitle className="text-2xl text-green-700">Cadastro realizado!</CardTitle>
        <CardDescription>
          Bem-vindo à Suporte Offshore. Sua conta foi criada com sucesso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-slate-600">
          Agora você pode acessar o portal de investimentos ou realizar um novo cadastro.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row justify-center">
        <Button onClick={onLogin} className="w-full sm:w-auto bg-primary px-8">
          Fazer Login
        </Button>
        <Button onClick={onNewRegister} variant="outline" className="w-full sm:w-auto">
          Criar novo cadastro
        </Button>
      </CardFooter>
    </Card>
  );
};