import { supabase } from './supabase';

const WEBHOOK_URL = 'https://n8n-webhook.2yhtoy.easypanel.host/webhook/robo';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachment?: {
    name: string;
    type: string;
    previewUrl?: string; // Local blob for optimistic UI
    url?: string;        // Remote Storage URL
  };
}

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export interface WebhookResponse {
  reply: string;
  [key: string]: any;
}

// --- Utils ---

export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove prefix "data:image/png;base64,"
      const base64Clean = result.split(',')[1];
      resolve(base64Clean);
    };
    reader.onerror = error => reject(error);
  });
};

export const uploadChatAttachment = async (file: File): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Usuário não autenticado");

    const fileName = `${session.user.id}/${Date.now()}_${file.name}`;
    
    // Upload to 'chat-attachments' bucket
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, file);

    if (uploadError) {
      console.error("Erro no upload:", uploadError);
      throw uploadError;
    }

    // Get Public URL
    const { data } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error("Erro ao fazer upload do anexo:", error);
    return null;
  }
};

// --- Webhook ---

export const sendMessageToWebhook = async (
  message: string, 
  conversationId: string,
  file?: File
): Promise<string> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || 'anonymous';

    let fileContentBase64 = null;
    let fileType = null;
    let fileName = null;

    if (file) {
      fileContentBase64 = await convertFileToBase64(file);
      fileType = file.type;
      fileName = file.name;
    }

    const payload = {
      user_id: userId,
      message: message,
      conversation_id: conversationId, // Required now
      file_content_base64: fileContentBase64,
      file_type: fileType,
      file_name: fileName
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erro na comunicação com o servidor: ${response.statusText}`);
    }

    const data: WebhookResponse = await response.json();
    return data.reply || data.output || (typeof data === 'string' ? data : "Recebido, mas sem resposta de texto.");

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
};

// --- Conversations CRUD ---

export const createConversation = async (title: string): Promise<Conversation | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  // Trim title to 30 chars
  const cleanTitle = title.substring(0, 30) || "Nova Conversa";

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: session.user.id,
      title: cleanTitle
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar conversa:", error);
    return null;
  }

  return data as Conversation;
};

export const getConversations = async (): Promise<Conversation[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error("Erro ao buscar conversas:", error);
    return [];
  }

  return data as Conversation[];
};

export const deleteConversation = async (conversationId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error("Erro ao deletar conversa:", error);
    return false;
  }
  return true;
};

// --- Messages Persistence ---

export const loadChatHistory = async (conversationId: string): Promise<ChatMessage[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId) // Filter by Conversation ID
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Erro ao carregar histórico:", error);
    return [];
  }

  return data.map((msg: any) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: new Date(msg.created_at),
    attachment: msg.attachment_info ? {
      name: msg.attachment_info.name,
      type: msg.attachment_info.type,
      url: msg.attachment_info.url,
      previewUrl: msg.attachment_info.previewUrl 
    } : undefined
  }));
};

export const saveMessageToDb = async (
  conversationId: string, // Required
  role: 'user' | 'assistant', 
  content: string, 
  attachmentInfo?: any
) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  if (!conversationId) {
    console.error("Tentativa de salvar mensagem sem ID de conversa.");
    return;
  }

  const { error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      user_id: session.user.id,
      role: role,
      content: content,
      attachment_info: attachmentInfo,
    });

  if (error) {
    console.error("Erro ao salvar mensagem no banco:", error);
  } else {
    // Optionally update the 'updated_at' of the conversation
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }
};