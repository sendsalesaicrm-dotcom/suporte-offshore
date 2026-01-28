import { supabase } from './supabase';

interface IpWhoIsResponse {
  success: boolean;
  message?: string;
  ip: string;
  city: string;
  region_code: string;
  country_code: string;
}

export const registerAccessLog = async (userId: string) => {
  try {
    // 1. Detectar Dispositivo e Navegador (Básico)
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    let browserName = "Desconhecido";
    if (userAgent.indexOf("Firefox") > -1) {
      browserName = "Mozilla Firefox";
    } else if (userAgent.indexOf("SamsungBrowser") > -1) {
      browserName = "Samsung Internet";
    } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
      browserName = "Opera";
    } else if (userAgent.indexOf("Trident") > -1) {
      browserName = "Microsoft Internet Explorer";
    } else if (userAgent.indexOf("Edge") > -1) {
      browserName = "Microsoft Edge";
    } else if (userAgent.indexOf("Chrome") > -1) {
      browserName = "Google Chrome";
    } else if (userAgent.indexOf("Safari") > -1) {
      browserName = "Apple Safari";
    }

    // 2. Obter IP e Localização (Usando ipwho.is)
    let ipAddress = "0.0.0.0";
    let location = "Desconhecido";

    try {
      const response = await fetch('https://ipwho.is/');
      if (response.ok) {
        const data: IpWhoIsResponse = await response.json();
        
        if (data.success) {
          ipAddress = data.ip;
          // Formato: "São Paulo, SP - BR"
          location = `${data.city}, ${data.region_code} - ${data.country_code}`;
        } else {
          console.warn("API de IP retornou sucesso falso:", data.message);
        }
      }
    } catch (ipError) {
      console.warn("Falha ao obter localização (provável AdBlock ou erro de rede):", ipError);
      // Mantém os valores padrão ("0.0.0.0", "Desconhecido") para não travar o fluxo
    }

    // 3. Salvar no Supabase
    const { error } = await supabase.from('access_logs').insert({
      user_id: userId,
      device_type: isMobile ? 'Mobile' : 'Desktop',
      browser: browserName,
      ip_address: ipAddress,
      location: location,
      // created_at é geralmente gerado automaticamente pelo banco, mas se precisar enviar:
      // created_at: new Date().toISOString()
    });

    if (error) {
      console.error("Erro ao salvar log de acesso:", error);
    } else {
      console.log("Acesso registrado com sucesso:", { ip: ipAddress, loc: location });
    }

  } catch (error) {
    console.error("Erro geral no serviço de log:", error);
    // Não lançamos o erro para não bloquear o login do usuário
  }
};