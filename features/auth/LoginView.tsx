import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label, FormItem, FormMessage, Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from '../../components/ui/Toaster';
import { registerAccessLog } from '../../lib/loggingService';

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginViewProps {
  onRegisterClick: () => void;
  onLoginSuccess: () => void;
  onForgotPasswordClick: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onRegisterClick, onLoginSuccess, onForgotPasswordClick }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw error;
      }

      toast("Login realizado com sucesso!", "success");

      // Registrar log de acesso (Fire and forget, ou await se crítico)
      if (authData.user) {
        registerAccessLog(authData.user.id);
      }

      onLoginSuccess();
    } catch (error: any) {
      console.error("Login error:", error);
      toast(error.message || "Erro ao fazer login. Verifique suas credenciais.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg animate-in fade-in zoom-in duration-500 bg-white border-slate-200">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold text-slate-900 mb-2">Faça seu Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormItem>
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="seu@email.com" 
              {...register("email")} 
            />
            <FormMessage message={errors.email?.message} />
          </FormItem>

          <FormItem>
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••" 
                className="pr-10"
                {...register("password")} 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <FormMessage message={errors.password?.message} />
          </FormItem>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onForgotPasswordClick}
              className="text-sm text-slate-500 hover:text-slate-900 hover:underline transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>

          <Button 
            type="submit" 
            className="w-full mt-4 h-11 text-base"
            disabled={isLoading}
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center pb-8 pt-2">
        <p className="text-sm text-slate-500">
          Não tem uma conta?{" "}
          <button 
            onClick={onRegisterClick} 
            className="text-slate-900 font-semibold hover:underline underline-offset-4 transition-colors"
          >
            Cadastre-se
          </button>
        </p>
      </CardFooter>
    </Card>
  );
};