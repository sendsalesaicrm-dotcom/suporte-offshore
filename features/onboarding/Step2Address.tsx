import React, { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input, Label, Select, FormItem, FormMessage } from '../../components/ui';
import { maskCEP } from '../../lib/utils';
import { OnboardingFormData } from './OnboardingWizard';

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", 
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const Step2Address: React.FC = () => {
  const { register, formState: { errors }, setValue, watch, trigger } = useFormContext<OnboardingFormData>();
  const [loadingCep, setLoadingCep] = useState(false);
  
  const cepValue = watch("cep");

  useEffect(() => {
    if (cepValue) setValue("cep", maskCEP(cepValue));
  }, [cepValue, setValue]);

  const handleCepBlur = async () => {
    const rawCep = cepValue?.replace(/\D/g, '');
    
    if (rawCep && rawCep.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setValue('street', data.logradouro, { shouldValidate: true });
          setValue('neighborhood', data.bairro, { shouldValidate: true });
          setValue('city', data.localidade, { shouldValidate: true });
          setValue('state', data.uf, { shouldValidate: true });
          // Optional: clear errors if they existed
          trigger(['street', 'neighborhood', 'city', 'state']); 
        } else {
             // Handle CEP not found if needed
        }
      } catch (error) {
        console.error("Error fetching CEP", error);
      } finally {
        setLoadingCep(false);
      }
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CEP */}
        <FormItem>
          <Label htmlFor="cep">CEP {loadingCep && <span className="text-xs text-muted-foreground animate-pulse">(Buscando...)</span>}</Label>
          <Input 
            id="cep" 
            placeholder="00000-000" 
            {...register("cep")} 
            onBlur={(e) => {
                register("cep").onBlur(e);
                handleCepBlur();
            }}
          />
          <FormMessage message={errors.cep?.message} />
        </FormItem>

        <div className="hidden md:block"></div>

        {/* Street */}
        <FormItem className="md:col-span-2">
          <Label htmlFor="street">Rua</Label>
          <Input id="street" placeholder="Nome da rua" {...register("street")} />
          <FormMessage message={errors.street?.message} />
        </FormItem>

        {/* Number */}
        <FormItem>
          <Label htmlFor="number">Número</Label>
          <Input id="number" placeholder="123" {...register("number")} />
          <FormMessage message={errors.number?.message} />
        </FormItem>

        {/* Complement */}
        <FormItem>
          <Label htmlFor="complement">Complemento <span className="text-slate-400 font-normal">(Opcional)</span></Label>
          <Input id="complement" placeholder="Apto 101" {...register("complement")} />
          <FormMessage message={errors.complement?.message} />
        </FormItem>

        {/* Neighborhood */}
        <FormItem>
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" placeholder="Bairro" {...register("neighborhood")} />
          <FormMessage message={errors.neighborhood?.message} />
        </FormItem>

        {/* City */}
        <FormItem>
          <Label htmlFor="city">Município</Label>
          <Input id="city" placeholder="Cidade" {...register("city")} />
          <FormMessage message={errors.city?.message} />
        </FormItem>

        {/* State */}
        <FormItem>
          <Label htmlFor="state">UF</Label>
          <Select id="state" {...register("state")}>
            <option value="">Selecione</option>
            {STATES.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
            ))}
          </Select>
          <FormMessage message={errors.state?.message} />
        </FormItem>
      </div>
    </div>
  );
};