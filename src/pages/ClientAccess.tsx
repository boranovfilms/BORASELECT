export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Wallet, 
  CheckCircle2, 
  ShieldAlert,
  ChevronDown,
  UserPlus,
  Mail,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { clientService, Client } from '../services/clientService';
import { toast } from 'react-hot-toast';

import { emailService } from '../services/emailService';

// Versão 2.1 - Gestão de Clientes
export default function ClientAccess() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await clientService.searchClients('');
      setClients(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.email) {
      toast.error('Preencha nome e e-mail');
      return;
    }

    try {
      setLoading(true);
      // Normalizar e-mail
      const normalizedClient = {
        ...newClient,
        email: newClient.email.toLowerCase().trim()
      };
      await clientService.createClient(normalizedClient);
      toast.success('Cliente adicionado com sucesso!');
      setNewClient({ name: '', email: '', phone: '' });
      setIsAdding(false);
      loadClients();
    } catch (error) {
      toast.error('Erro ao adicionar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string, email: string) => {
    if (window.confirm('Excluir este cliente permanentemente? Isso removerá o acesso dele e excluirá sua senha do sistema.')) {
      try {
        setLoading(true);
        // Primeiro tenta deletar o acesso técnico (Auth)
        try {
          const result = await clientService.deleteClientAuth(email);
          console.log('Auth deletion result:', result);
        } catch (authError: any) {
          console.warn('Auth deletion failed:', authError);
          // Only show error if it's not a "not found" or similar benign issue
          if (!authError.message?.includes('not found')) {
            toast.error('Atenção: Não foi possível remover a senha do sistema, apenas o registro local. O cliente ainda pode conseguir entrar se já tiver a senha.');
          }
        }
        
        // Depois deleta o registro no banco
        await clientService.deleteClient(id);
        
        toast.success('Cliente e acesso removidos com sucesso');
        loadClients();
      } catch (error) {
        console.error(error);
        toast.error('Erro ao remover cliente');
      } finally {
        setLoading(false);
      }
    }
  };

  const getInviteLink = (email: string) => {
    return `${window.location.origin}/register?email=${encodeURIComponent(email.toLowerCase().trim())}`;
  };

  const copyInviteLink = (email: string) => {
    navigator.clipboard.writeText(getInviteLink(email));
    toast.success('Link de convite copiado!');
  };

  const sendEmailInvite = async (clientName: string, email: string) => {
    const inviteLink = getInviteLink(email);
    try {
      setSendingEmail(email);
      await emailService.sendInvite(email, clientName, inviteLink);
    } catch (error) {
      // toast already shown in service
    } finally {
      setSendingEmail(null);
    }
  };

  const shareInvite = (clientName: string, email: string) => {
    const inviteLink = getInviteLink(email);
    const message = `Seu conteúdo foi selecionado! A BoraSelect convida você para participar do nosso programa de seleção, onde você poderá visualizar seu material e escolher os conteúdos para download.\n\nAcesse pelo link abaixo e crie sua senha:\n\n${inviteLink}`;
    
    navigator.clipboard.writeText(message);
    toast.success('Mensagem de convite copiada!');
    
    // Abrir WhatsApp Web com a mensagem pré-definida
    const encodedText = encodeURIComponent(message);
    window.open(`https://web.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">Gestão de Clientes</h1>
          <p className="text-zinc-500 text-lg">Gerencie convites e permissões de acesso para seus clientes.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20"
          >
            {isAdding ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {isAdding ? 'Cancelar' : 'Adicionar Cliente'}
          </button>
        </div>
      </header>

      {isAdding && (
        <section className="bg-[#1f1f1f] border border-[#ff5351]/40 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-2xl font-bold text-white mb-6 border-b border-zinc-800 pb-4">Novo Cadastro</h3>
          <form onSubmit={handleCreateClient} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">NOME DO CLIENTE</label>
              <input 
                type="text" 
                value={newClient.name}
                onChange={e => setNewClient({...newClient, name: e.target.value})}
                placeholder="Ex: Nome da Empresa ou Pessoa"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-700"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">E-MAIL DE ACESSO</label>
              <input 
                type="email" 
                value={newClient.email}
                onChange={e => setNewClient({...newClient, email: e.target.value})}
                placeholder="cliente@email.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-700"
              />
            </div>
            <div className="flex items-end">
              <button 
                type="submit"
                disabled={loading}
                className="w-full h-[60px] bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#ff5351] hover:text-white transition-all shadow-xl disabled:opacity-50"
              >
                {loading ? 'Aguarde...' : 'Salvar Cliente'}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cliente</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status de Convite</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">Último Acesso</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Controle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-8 py-16 text-center text-zinc-500 italic font-medium">
                  {loading ? 'Carregando lista...' : 'Nenhum cliente cadastrado. Clique no botão acima para adicionar.'}
                </td>
              </tr>
            ) : clients.map((client) => (
              <tr key={client.id} className="group hover:bg-zinc-800/30 transition-all">
                <td className="px-8 py-7">
                  <div>
                    <div className="text-white font-bold text-lg leading-tight mb-1">{client.name}</div>
                    <div className="text-zinc-500 text-sm flex items-center gap-2">
                       <Mail className="w-3.5 h-3.5" />
                       {client.email}
                    </div>
                  </div>
                </td>
                <td className="px-8 py-7">
                  <span className={cn(
                    "inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest",
                    client.status === 'confirmed' 
                      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" 
                      : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  )}>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--color),0.5)]",
                      client.status === 'confirmed' ? "bg-emerald-500" : "bg-amber-500"
                    )} />
                    {client.status === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}
                  </span>
                </td>
                <td className="px-8 py-7">
                  {client.lastAccess ? (
                    <div className="flex flex-col">
                      <span className="text-zinc-200 text-xs font-bold">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(client.lastAccess.toDate())}
                      </span>
                      <span className="text-zinc-500 text-[10px]">
                        {new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(client.lastAccess.toDate())}
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[10px] font-medium italic">Nunca acessou</span>
                  )}
                </td>
                <td className="px-8 py-7 text-right">
                  <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200">
                    <button 
                      onClick={() => sendEmailInvite(client.name, client.email)}
                      disabled={sendingEmail === client.email}
                      className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      title="Enviar Convite por E-mail"
                    >
                      <Mail className="w-4 h-4" />
                      {sendingEmail === client.email ? 'Enviando...' : 'Via E-mail'}
                    </button>
                    <button 
                      onClick={() => shareInvite(client.name, client.email)}
                      className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 hover:bg-[#25D366] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                      title="Enviar Convite via WhatsApp"
                    >
                      <ExternalLink className="w-4 h-4" />
                      WhatsApp
                    </button>
                    <button 
                      onClick={() => copyInviteLink(client.email)}
                      className="p-3 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
                      title="Apenas Copiar Link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClient(client.id!, client.email)}
                      className="p-3 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all"
                      title="Excluir Cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

