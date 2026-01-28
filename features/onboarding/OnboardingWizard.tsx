import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabase';
import { validateCPF } from '../../lib/utils';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui';
import { Step1Personal } from './Step1Personal';
import { Step2Address } from './Step2Address';
import { toast } from '../../components/ui/Toaster';

// --- Validation Schemas ---

const step1Schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  firstName: z.string().min(2, "Nome é obrigatório"),
  lastName: z.string().min(2, "Sobrenome é obrigatório"),
  dob: z.string()
    .refine((val) => val !== '', "Data de nascimento é obrigatória")
    .refine((val) => {
      // Ensure the year part has exactly 4 digits
      const year = val.split('-')[0];
      return year.length === 4;
    }, "Data inválida (O ano deve ter 4 dígitos)"),
  phone: z.string().min(14, "Telefone inválido"), // (XX) XXXXX-XXXX
  cpf: z.string().min(11, "CPF incompleto").refine(validateCPF, "CPF inválido"),
  rg: z.string().min(1, "RG é obrigatório"),
  issuingAuthority: z.string().min(1, "Órgão emissor obrigatório"),
});

const step2Schema = z.object({
  cep: z.string().min(9, "CEP inválido"), // 00000-000
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "UF é obrigatória"),
});

// Merged schema for type inference
const fullSchema = step1Schema.merge(step2Schema);
export type OnboardingFormData = z.infer<typeof fullSchema>;

interface OnboardingWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(fullSchema),
    mode: "onBlur", // Validate on blur for better UX
    defaultValues: {
        issuingAuthority: "",
        state: "",
    }
  });

  const { handleSubmit, trigger } = methods;

  const handleNext = async () => {
    // Validate Step 1 fields specifically before moving to Step 2
    const isStepValid = await trigger([
      "email", "password", "firstName", "lastName", "dob", "phone", "cpf", "rg", "issuingAuthority"
    ]);
    
    if (isStepValid) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      console.log("Iniciando processo de cadastro...");
      
      const cpfLimpo = data.cpf.replace(/\D/g, '');

      // --- VERIFICAÇÃO PRÉVIA DE DUPLICIDADE ---
      // Chama a RPC check_duplicate_documents ANTES de criar o Auth
      console.log("Verificando duplicidade para CPF:", cpfLimpo);
      
      const { data: cpfExists, error: rpcError } = await supabase
        .rpc('check_duplicate_documents', { cpf_input: cpfLimpo });

      if (rpcError) {
        // Se houver erro na RPC, lançamos para ser capturado pelo catch
        throw new Error(`Erro na verificação de documentos: ${rpcError.message}`);
      }

      if (cpfExists) {
        // Se o CPF já existe, paramos TUDO aqui.
        toast("Este CPF já possui cadastro em nosso sistema.", "error");
        setIsSubmitting(false); // Reseta o estado de loading
        return; // Interrompe a função
      }

      // --- FIM DA VERIFICAÇÃO PRÉVIA ---

      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                first_name: data.firstName,
                last_name: data.lastName
            }
        }
      });

      if (authError) {
        // Tratamento específico para usuário já existente ou erros de validação da API
        if (authError.message.includes("already registered")) {
            throw new Error("Este e-mail já está cadastrado.");
        }
        throw authError;
      }

      if (!authData.user || !authData.user.id) {
          throw new Error("Erro crítico: ID do usuário não retornado pelo Auth.");
      }

      // 2. Preparar payload para a tabela 'profiles'
      // Regra 1: Data de nascimento ISO ou null (evitar string vazia)
      // Regra 2: Remover máscaras de campos numéricos
      const profilePayload = {
          id: authData.user.id, // Vínculo com a tabela auth.users
          nome: data.firstName,
          sobrenome: data.lastName,
          data_nascimento: data.dob ? data.dob : null, 
          telefone: data.phone.replace(/\D/g, ''),
          cpf: cpfLimpo,
          rg: data.rg.replace(/\D/g, ''),
          orgao_emissor: data.issuingAuthority,
          cep: data.cep.replace(/\D/g, ''),
          rua: data.street,
          numero: data.number,
          complemento: data.complement || null,
          bairro: data.neighborhood,
          municipio: data.city,
          uf: data.state,
      };

      // Regra 3: Log para debug
      console.log("PAYLOAD PARA O SUPABASE (Dados Limpos):", profilePayload);

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profilePayload);

      if (profileError) {
          // LOG DETALHADO DO ERRO NO CONSOLE
          console.error("ERRO COMPLETO DO SUPABASE (Profile Insert):", profileError);
          
          // Captura detalhes específicos do erro para o Toast
          const errorMsg = profileError.message || "Erro desconhecido";
          const errorDetails = profileError.details ? ` (${profileError.details})` : "";
          
          // Lança o erro com a mensagem real do banco
          throw new Error(`Erro ao salvar dados: ${errorMsg}${errorDetails}`);
      }

      toast("Cadastro realizado com sucesso!", "success");
      
      // Chama a função passada pelo componente pai para trocar a tela
      onSuccess();
      
    } catch (error: any) {
      console.error("Erro capturado no submit:", error);
      // Exibe a mensagem real do erro no Toast
      toast(error.message || "Ocorreu um erro inesperado.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate Progress
  const progress = step === 1 ? 50 : 100;

  return (
    <Card className="shadow-lg border-t-4 border-t-primary">
      <div className="w-full bg-slate-100 h-2 rounded-t-lg overflow-hidden">
         <div className="bg-primary h-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
      </div>
      
      <CardHeader>
        <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Passo {step} de 2
            </span>
            <span className="text-xs text-muted-foreground">
                {step === 1 ? "Dados Pessoais" : "Endereço"}
            </span>
        </div>
        <CardTitle>{step === 1 ? "Crie sua conta" : "Onde você mora?"}</CardTitle>
        <CardDescription>
          {step === 1 
            ? "Precisamos de alguns dados para identificar você." 
            : "Para envio de correspondências e validação regulatória."}
        </CardDescription>
      </CardHeader>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent>
            {step === 1 && <Step1Personal />}
            {step === 2 && <Step2Address />}
          </CardContent>

          <CardFooter className="flex justify-between mt-4">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                Voltar
              </Button>
            ) : (
                <Button type="button" onClick={onCancel} disabled={isSubmitting}>
                  Voltar ao Login
                </Button>
            )}

            {step < 2 ? (
              <Button type="button" onClick={handleNext}>
                Próximo
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Cadastrando..." : "Finalizar Cadastro"}
              </Button>
            )}
          </CardFooter>
        </form>
      </FormProvider>
    </Card>
  );
};