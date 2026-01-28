import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label, FormItem, FormMessage, Card, CardContent, CardHeader, CardTitle } from '../../components/ui';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from '../../components/ui/Toaster';

const updatePasswordSchema = z.object({
  password: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

interface UpdatePasswordViewProps {
  onSuccess: () => void;
}

export const UpdatePasswordView: React.FC<UpdatePasswordViewProps> = ({ onSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema)
  });

  const onSubmit = async (data: UpdatePasswordFormData) => {
    setIsLoading(true);
    try {
      // Atualiza a senha do usuário autenticado (que veio pelo link de recuperação)
      const { error } = await supabase.auth.updateUser({ 
        password: data.password 
      });

      if (error) {
        throw error;
      }

      toast("Senha atualizada com sucesso!", "success");
      onSuccess(); // Redireciona para o login
    } catch (error: any) {
      console.error("Update password error:", error);
      toast(error.message || "Erro ao atualizar senha.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg animate-in fade-in zoom-in duration-500 bg-white border-slate-200">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-slate-100 p-3">
            <Lock className="h-8 w-8 text-slate-900" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-slate-900 mb-2">Nova Senha</CardTitle>
        <p className="text-sm text-slate-500">
          Crie uma nova senha segura para sua conta.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormItem>
            <Label htmlFor="password">Nova Senha</Label>
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

          <FormItem>
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input 
              id="confirmPassword" 
              type="password" 
              placeholder="••••••" 
              {...register("confirmPassword")} 
            />
            <FormMessage message={errors.confirmPassword?.message} />
          </FormItem>

          <Button 
            type="submit" 
            className="w-full mt-4 h-11 text-base"
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : "Salvar Nova Senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};