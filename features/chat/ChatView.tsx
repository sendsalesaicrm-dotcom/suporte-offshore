import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, LogOut, Menu, X, FileText, Settings, Plus, Trash2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button, Input } from '../../components/ui';
import { toast } from '../../components/ui/Toaster';
import { 
  sendMessageToWebhook, 
  ChatMessage, 
  loadChatHistory, 
  saveMessageToDb, 
  uploadChatAttachment,
  Conversation,
  getConversations,
  createConversation,
  deleteConversation
} from '../../lib/chatService';
import { supabase } from '../../lib/supabase';

interface ChatViewProps {
  onLogout: () => void;
}

interface UserProfile {
  nome: string;
  sobrenome: string;
  email: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ onLogout }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Multi-thread states
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Load User Profile
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('nome, sobrenome')
          .eq('id', session.user.id)
          .single();

        if (data && !error) {
          setUserProfile({
            nome: data.nome,
            sobrenome: data.sobrenome,
            email: session.user.email || ''
          });
        }
      }
    };
    fetchProfile();
  }, []);

  // 2. Load Conversations List
  useEffect(() => {
    const fetchConversations = async () => {
      const list = await getConversations();
      setConversations(list);
    };
    fetchConversations();
  }, []);

  // 3. Load Chat History when Active Conversation Changes
  useEffect(() => {
    const loadMessages = async () => {
      if (activeConversationId) {
        // Load existing conversation messages
        const history = await loadChatHistory(activeConversationId);
        setMessages(history);
      } else {
        // New conversation state (empty or welcome message)
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: 'Olá! Sou seu assistente virtual da Suporte Offshore. Como posso ajudar você hoje com seus investimentos?',
          timestamp: new Date()
        }]);
      }
    };
    loadMessages();
  }, [activeConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setSidebarOpen(false); // On mobile, close sidebar
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const success = await deleteConversation(id);
    if (success) {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
      toast("Conversa excluída.", "info");
    } else {
      toast("Erro ao excluir conversa.", "error");
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if ((!inputValue.trim() && !selectedFile) || isTyping) return;

    const contentToSend = inputValue;
    const fileToSend = selectedFile; // Capture ref

    // 0. Optimistic UI Update (Show message immediately)
    const tempUserMsgId = Date.now().toString();
    const localPreviewUrl = fileToSend && fileToSend.type.startsWith('image/') 
        ? URL.createObjectURL(fileToSend) 
        : undefined;

    const optimisticMessage: ChatMessage = {
      id: tempUserMsgId,
      role: 'user',
      content: contentToSend,
      timestamp: new Date(),
      attachment: fileToSend ? {
        name: fileToSend.name,
        type: fileToSend.type,
        previewUrl: localPreviewUrl
      } : undefined
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setInputValue('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsTyping(true);

    try {
      // --- STEP 1: Ensure Conversation Exists ---
      let currentId = activeConversationId;

      if (!currentId) {
        // Create new conversation on the server
        console.log("Criando nova conversa...");
        const newConversation = await createConversation(contentToSend);
        
        if (newConversation) {
            currentId = newConversation.id;
            setActiveConversationId(currentId);
            // Add to sidebar list immediately
            setConversations(prev => [newConversation, ...prev]);
        } else {
            throw new Error("Falha ao criar nova conversa no banco.");
        }
      }

      // Safeguard: TypeScript check
      if (!currentId) throw new Error("ID da conversa é nulo.");

      // --- STEP 2: Upload File (if any) ---
      let publicAttachmentUrl = undefined;
      if (fileToSend) {
        const url = await uploadChatAttachment(fileToSend);
        if (url) {
            publicAttachmentUrl = url;
        }
      }

      // --- STEP 3: Save User Message to DB ---
      const dbAttachmentInfo = fileToSend ? {
          name: fileToSend.name,
          type: fileToSend.type,
          url: publicAttachmentUrl 
      } : undefined;

      await saveMessageToDb(currentId, 'user', contentToSend, dbAttachmentInfo);

      // --- STEP 4: Send to n8n Webhook (WITH ID) ---
      const responseText = await sendMessageToWebhook(contentToSend, currentId, fileToSend || undefined);

      // --- STEP 5: Update UI with AI Response ---
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

      // --- STEP 6: Save AI Response to DB ---
      await saveMessageToDb(currentId, 'assistant', responseText);

    } catch (error: any) {
      console.error(error);
      toast("Erro ao processar mensagem: " + error.message, "error");
      // Optional: Remove optimistic message on error?
    } finally {
      setIsTyping(false);
    }
  };

  const getInitials = (nome: string, sobrenome: string) => {
    return `${nome.charAt(0)}${sobrenome.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="flex h-[calc(100vh-140px)] w-full max-w-6xl bg-white rounded-lg shadow-xl overflow-hidden border border-slate-200">
      {/* Sidebar */}
      <div className={`
        absolute inset-0 z-20 bg-slate-50 transition-transform transform md:relative md:translate-x-0 md:w-72 md:border-r md:border-slate-200 flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Close */}
        <div className="md:hidden p-4 border-b border-slate-200 flex justify-end">
          <button onClick={() => setSidebarOpen(false)} className="text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Profile */}
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
              {userProfile ? getInitials(userProfile.nome, userProfile.sobrenome) : <User size={24} />}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-bold text-slate-900 truncate">
                {userProfile ? `${userProfile.nome} ${userProfile.sobrenome}` : 'Carregando...'}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {userProfile?.email || 'usuario@email.com'}
              </p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
            <Button onClick={handleNewConversation} className="w-full flex gap-2 justify-center shadow-sm">
                <Plus size={18} /> Nova Conversa
            </Button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Histórico</p>
          
          {conversations.length === 0 && (
             <p className="px-3 text-xs text-slate-400 italic">Nenhuma conversa recente.</p>
          )}

          {conversations.map(conv => (
            <div 
                key={conv.id}
                onClick={() => { setActiveConversationId(conv.id); setSidebarOpen(false); }}
                className={`
                    group flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors
                    ${activeConversationId === conv.id ? 'bg-slate-200 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-100'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className={activeConversationId === conv.id ? 'text-slate-900' : 'text-slate-400'} />
                    <span className="truncate">{conv.title}</span>
                </div>
                <button 
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1"
                    title="Excluir"
                >
                    <Trash2 size={14} />
                </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700 rounded-md hover:bg-white hover:shadow-sm transition-all group">
                <Settings size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                Configurações
            </button>
            <Button variant="outline" onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100 bg-white">
                <LogOut size={16} />
                Encerrar Sessão
            </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/50 relative">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center px-4 justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-600">
              <Menu size={24} />
            </button>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Assistente IA</h3>
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] md:max-w-[70%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`
                  h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1
                  ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-primary text-white'}
                `}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className={`
                  p-3 rounded-2xl shadow-sm text-sm leading-relaxed relative overflow-hidden flex flex-col
                  ${msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}
                `}>
                  {msg.attachment && (
                    <div className="mb-2">
                        {(msg.attachment.url || msg.attachment.previewUrl) && msg.attachment.type.startsWith('image/') ? (
                             <div className="mb-2 rounded-lg overflow-hidden border border-black/10 bg-black/5">
                                <img 
                                    src={msg.attachment.url || msg.attachment.previewUrl} 
                                    alt="Anexo" 
                                    className="max-w-full h-auto max-h-[300px] object-contain rounded-lg mb-2"
                                />
                             </div>
                        ) : (
                            <div className="p-2 bg-black/10 rounded flex items-center gap-2 text-xs">
                                <FileText size={14} />
                                <span className="truncate max-w-[150px]">{msg.attachment.name}</span>
                            </div>
                        )}
                    </div>
                  )}
                  
                  <div className="prose prose-sm max-w-none w-full break-words prose-p:my-1 prose-pre:bg-slate-800 prose-pre:text-white prose-code:text-primary">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  
                  <span className={`text-[10px] block mt-1 opacity-70 ${msg.role === 'user' ? 'text-slate-200' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start w-full">
              <div className="flex gap-2 max-w-[80%]">
                 <div className="h-8 w-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-white mt-1">
                  <Bot size={16} />
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-200">
            {selectedFile && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-slate-100 rounded-md w-fit">
                    <FileText size={16} className="text-slate-500"/>
                    <span className="text-sm text-slate-700 max-w-xs truncate">{selectedFile.name}</span>
                    <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                </div>
            )}
          <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                onChange={handleFileSelect}
            />
            <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="text-slate-400 hover:text-slate-600 mb-0.5"
                onClick={() => fileInputRef.current?.click()}
                title="Anexar arquivo"
            >
              <Paperclip size={20} />
            </Button>
            
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 py-3 h-auto max-h-32 min-h-[44px] !text-slate-900 !placeholder-slate-500"
            />
            
            <Button 
                type="submit" 
                size="icon" 
                disabled={(!inputValue.trim() && !selectedFile) || isTyping}
                className={`transition-all duration-200 mb-0.5 ${!inputValue.trim() && !selectedFile ? 'opacity-50' : 'opacity-100'}`}
            >
              <Send size={18} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};