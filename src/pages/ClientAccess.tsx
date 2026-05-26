export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { 
  X, Copy, UserPlus, Mail, Trash2, ExternalLink, Edit2, Shield, Users, 
  Camera, User, Briefcase, Lock, Phone, Upload, MapPin, Building, ChevronDown, Search
} from 'lucide-react';
import { cn } from '../lib/utils';
import { clientService, Client } from '../services/clientService';
import { teamService, TeamMember } from '../services/teamService';
import { emailService } from '../services/emailService';
import { toast } from 'react-hot-toast';
import { DataTable } from '../components/ui/DataTable';
import { useNavigate } from 'react-router-dom';

export default function ClientAccess() {
  const [clients, setClients] = useState<Client[]>([]);
  const [allTeamMembers, setAllTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  // Controle de Navegação
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isTeamViewOpen, setIsTeamViewOpen] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddingTeamMember, setIsAddingTeamMember] = useState(false);

  // Estado do Formulário de Cliente
  const [clientForm, setClientForm] = useState({
    id: '', name: '', email: '', phone: '', document: '', 
    zipCode: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '',
    commercialName: '', plan: 'Básico', status: 'pending'
  });

  // Estado do Formulário de Membro da Equipe
  const [memberForm, setMemberForm] = useState({ 
    firstName: '', lastName: '', email: '', phone: '', 
    password: '', jobTitle: '', role: '', accessLevel: 'validador', photoUrl: '' 
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const allData = await clientService.searchClients('');
      setClients(allData.filter(c => c.role === 'cliente' || !c.role));
      setAllTeamMembers(allData.filter(m => m.role === 'equipe' && (m as any).clienteId) as any);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddClient = () => {
    setClientForm({
      id: '', name: '', email: '', phone: '', document: '', 
      zipCode: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '',
      commercialName: '', plan: 'Básico', status: 'pending'
    });
    setIsEditingClient(false);
    setIsClientFormOpen(true);
  };

  const handleOpenEditClient = (client: Client) => {
    setClientForm({
      id: client.id || '',
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      document: (client as any).document || '',
      zipCode: (client as any).zipCode || '',
      address: (client as any).address || '',
      number: (client as any).number || '',
      complement: (client as any).complement || '',
      neighborhood: (client as any).neighborhood || '',
      city: (client as any).city || '',
      state: (client as any).state || '',
      commercialName: (client as any).commercialName || '',
      plan: (client as any).plan || 'Básico',
      status: client.status || 'pending'
    });
    setIsEditingClient(true);
    setIsClientFormOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.email) {
      toast.error('Preencha nome e e-mail');
      return;
    }
    try {
      setLoading(true);
      const normalizedClient = {
        ...clientForm,
        email: clientForm.email.toLowerCase().trim(),
        role: 'cliente'
      };

      if (isEditingClient && clientForm.id) {
        await (clientService as any).updateClient(clientForm.id, normalizedClient);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await clientService.createClient(normalizedClient);
        toast.success('Cliente adicionado com sucesso!');
      }
      setIsClientFormOpen(false);
      loadAllData();
    } catch (error) {
      toast.error('Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string, email: string) => {
    if (window.confirm('Excluir este cliente permanentemente? Isso removerá o acesso dele.')) {
      try {
        setLoading(true);
        try {
          await clientService.deleteClientAuth(email);
        } catch (e: any) {
          if (!e.message?.includes('not found')) toast.error('Apenas o registro local foi removido.');
        }
        await clientService.deleteClient(id);
        toast.success('Cliente removido com sucesso');
        loadAllData();
      } catch (error) {
        toast.error('Erro ao remover cliente');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenTeamView = (client: Client) => {
    setSelectedClient(client);
    setIsAddingTeamMember(false);
    setIsTeamViewOpen(true);
  };

  const handleSaveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.firstName || !memberForm.email || !memberForm.role) {
      toast.error('Preencha os campos obrigatórios (Nome, E-mail e Função)');
      return;
    }

    try {
      setLoading(true);
      const fullName = `${memberForm.firstName} ${memberForm.lastName}`.trim();
      const normalizedMember = {
        name: fullName,
        email: memberForm.email.toLowerCase().trim(),
        phone: memberForm.phone,
        role: memberForm.role,
        jobTitle: memberForm.jobTitle,
        accessLevel: memberForm.accessLevel,
        clienteId: selectedClient?.id
      };
      
      await teamService.createTeamMember(normalizedMember as any);
      await emailService.sendInvite(normalizedMember.email, normalizedMember.name, `${window.location.origin}/register?email=${encodeURIComponent(normalizedMember.email)}`);

      toast.success('Membro adicionado e convite enviado!');
      setMemberForm({ 
        firstName: '', lastName: '', email: '', phone: '', 
        password: '', jobTitle: '', role: '', accessLevel: 'validador', photoUrl: '' 
      });
      setIsAddingTeamMember(false);
      loadAllData();
    } catch (error) {
      toast.error('Erro ao adicionar membro');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeamMember = async (id: string, email: string) => {
    if (window.confirm('Excluir este membro da equipe permanentemente?')) {
      try {
        setLoading(true);
        try {
          await teamService.deleteTeamMemberAuth(email);
        } catch (e: any) {
          if (!e.message?.includes('not found')) toast.error('Apenas registro local removido.');
        }
        await teamService.deleteTeamMember(id);
        toast.success('Membro removido com sucesso');
        loadAllData();
      } catch (error) {
        toast.error('Erro ao remover membro');
      } finally {
        setLoading(false);
      }
    }
  };

  const sendEmailInvite = async (name: string, email: string) => {
    try {
      setSendingEmail(email);
      await emailService.sendInvite(email, name, `${window.location.origin}/register?email=${encodeURIComponent(email)}`);
      toast.success('Convite enviado!');
    } catch (error) {} finally {
      setSendingEmail(null);
    }
  };

  const getClientTeamCount = (clientId: string) => {
    return allTeamMembers.filter(m => m.clienteId === clientId).length;
  };
  
  const clientTeamMembers = selectedClient 
    ? allTeamMembers.filter(m => m.clienteId === selectedClient.id) 
    : [];

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12 pb-20">
      {!isClientFormOpen && !isTeamViewOpen && (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-white mb-2 uppercase italic font-black">Gestão de Clientes</h1>
            <p className="text-zinc-500 text-lg">Gerencie o cadastro e os planejamentos dos seus clientes.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={handleOpenAddClient} className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#ff5351] text-white font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg text-xs">
              <UserPlus className="w-5 h-5" /> Adicionar Cliente
            </button>
          </div>
        </header>
      )}

      {isClientFormOpen && (
        <form autoComplete="off" onSubmit={handleSaveClient} className="animate-in slide-in-from-right-8 duration-500">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <button type="button" onClick={() => setIsClientFormOpen(false)} className="text-[#ff5351] hover:text-white transition-colors text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest">
                <ChevronDown className="w-4 h-4 rotate-90" /> Voltar para Clientes
              </button>
              <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-4">
                {isEditingClient ? <Edit2 className="w-8 h-8 text-[#ff5351]" /> : <Building className="w-8 h-8 text-[#ff5351]" />}
                {isEditingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h1>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsClientFormOpen(false)} className="px-8 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-bold hover:bg-zinc-800 transition-all text-xs uppercase tracking-widest">Cancelar</button>
              <button type="submit" disabled={loading} className="px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20 disabled:opacity-50">
                {loading ? 'Salvando...' : 'Salvar Cadastro'}
              </button>
            </div>
          </header>

          <div className="space-y-6">
            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2"><User className="w-5 h-5 text-[#ff5351]"/> Informações Principais</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Nome/Razão Social</label><input type="text" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="Nome Completo ou Empresa"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">E-MAIL PRINCIPAL</label><input type="email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} disabled={isEditingClient} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm disabled:opacity-50" placeholder="contato@empresa.com"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">CPF / CNPJ</label><input type="text" value={clientForm.document} onChange={e => setClientForm({...clientForm, document: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="000.000.000-00"/></div>
              </div>
            </section>
            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2"><MapPin className="w-5 h-5 text-[#ff5351]"/> Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-4">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">CEP</label><input type="text" value={clientForm.zipCode} onChange={e => setClientForm({...clientForm, zipCode: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="00000-000"/></div>
                <div className="space-y-2 md:col-span-3"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Rua / Logradouro</label><input type="text" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="Av. Principal"/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Número</label><input type="text" value={clientForm.number} onChange={e => setClientForm({...clientForm, number: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="123"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Bairro</label><input type="text" value={clientForm.neighborhood} onChange={e => setClientForm({...clientForm, neighborhood: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="Centro"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Cidade</label><input type="text" value={clientForm.city} onChange={e => setClientForm({...clientForm, city: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="São Paulo"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Estado</label><input type="text" value={clientForm.state} onChange={e => setClientForm({...clientForm, state: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="SP"/></div>
              </div>
            </section>
            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl mb-10">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#ff5351]"/> Dados Comerciais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Telefone / WhatsApp</label><input type="text" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm" placeholder="(00) 00000-0000"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Plano Atual</label><div className="relative"><select value={clientForm.plan} onChange={e => setClientForm({...clientForm, plan: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm appearance-none"><option value="Básico">Básico</option><option value="Pro">Pro</option><option value="Premium">Premium</option></select><ChevronDown className="w-4 h-4 text-zinc-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div></div>
              </div>
            </section>
          </div>
        </form>
      )}

      {isTeamViewOpen && selectedClient && (
        <div className="animate-in slide-in-from-bottom-8 duration-500">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-zinc-800 pb-6">
            <div>
              <button onClick={() => setIsTeamViewOpen(false)} className="text-[#ff5351] hover:text-white transition-colors text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest">
                <ChevronDown className="w-4 h-4 rotate-90" /> Voltar
              </button>
              <h1 className="text-4xl font-bold tracking-tight text-white mb-2 uppercase italic font-black">Equipe: {selectedClient.name}</h1>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setIsAddingTeamMember(!isAddingTeamMember)} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20">
                {isAddingTeamMember ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />} {isAddingTeamMember ? 'Cancelar' : 'Adicionar Membro'}
              </button>
            </div>
          </header>

          {isAddingTeamMember && (
            <form autoComplete="off" onSubmit={handleSaveTeamMember} className="space-y-6 mb-12 animate-in fade-in duration-300">
              <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6"><Camera className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white">Foto de Perfil</h3></div>
                <div className="flex items-center gap-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl">
                  <div className="w-24 h-24 rounded-2xl bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center text-zinc-500 relative group overflow-hidden"><User className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" /><div className="absolute bottom-2 right-2 w-6 h-6 bg-[#ff5351] rounded-full flex items-center justify-center shadow-lg"><Upload className="w-3 h-3 text-white" /></div></div>
                  <div><p className="text-sm font-bold text-white mb-1">Carregar uma foto</p><p className="text-xs text-zinc-500 mb-4">Recomendado: JPG, PNG ou WebP (Máx. 2MB)</p><button type="button" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all border border-zinc-700">Selecionar Arquivo</button></div>
                </div>
              </section>
              <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6"><User className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white">Informações Pessoais</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">NOME</label><input type="text" value={memberForm.firstName} onChange={e => setMemberForm({...memberForm, firstName: e.target.value})} placeholder="Ex: João" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm"/></div>
                  <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">SOBRENOME</label><input type="text" value={memberForm.lastName} onChange={e => setMemberForm({...memberForm, lastName: e.target.value})} placeholder="Ex: Silva" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm"/></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">E-MAIL</label><div className="relative"><input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} placeholder="joao.silva@empresa.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-white focus:border-[#ff5351] outline-none text-sm"/><Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
                  <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">TELEFONE</label><div className="relative"><input type="text" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} placeholder="(00) 00000-0000" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-white focus:border-[#ff5351] outline-none text-sm"/><Phone className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 hidden"><div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">SENHA DE ACESSO</label><div className="relative"><input type="password" value={memberForm.password} onChange={e => setMemberForm({...memberForm, password: e.target.value})} placeholder="Defina uma senha" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-white focus:border-[#ff5351] outline-none text-sm"/><Lock className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" /></div></div></div>
              </section>
              <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6"><Briefcase className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white">Informações Profissionais</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">CARGO</label><input type="text" value={memberForm.jobTitle} onChange={e => setMemberForm({...memberForm, jobTitle: e.target.value})} placeholder="Ex: Desenvolvedor Senior" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm"/></div>
                  <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">FUNÇÃO</label><div className="relative"><select value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm appearance-none cursor-pointer"><option value="" disabled>Selecione uma função</option><option value="equipe">Equipe Cliente</option></select><ChevronDown className="w-4 h-4 text-zinc-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div></div>
                </div>
                <div className="space-y-3"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">NÍVEL DE ACESSO</label><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'aprovador', label: 'Aprovador Principal', desc: 'Aprovação final do conteúdo' },
                      { id: 'validador', label: 'Validador', desc: 'Sugere correções no conteúdo' },
                      { id: 'visualizador', label: 'Visualizador', desc: 'Apenas acompanha o projeto' }
                    ].map(level => (
                      <label key={level.id} className={cn("cursor-pointer border rounded-2xl p-4 flex items-start gap-3 transition-all", memberForm.accessLevel === level.id ? "bg-[#ff5351]/10 border-[#ff5351]" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600")}><div className="pt-0.5"><div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all", memberForm.accessLevel === level.id ? "border-[#ff5351]" : "border-zinc-600")}>{memberForm.accessLevel === level.id && <div className="w-2 h-2 rounded-full bg-[#ff5351]" />}</div></div><div><input type="radio" name="accessLevel" value={level.id} checked={memberForm.accessLevel === level.id} onChange={e => setMemberForm({...memberForm, accessLevel: e.target.value})} className="hidden" /><p className="text-white font-bold text-sm">{level.label}</p><p className="text-zinc-500 text-xs mt-0.5">{level.desc}</p></div></label>
                    ))}
                  </div></div>
              </section>
              <div className="flex justify-end pt-2"><button type="submit" disabled={loading} className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#ff5351] hover:text-white transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"><UserPlus className="w-4 h-4" />{loading ? 'Aguarde...' : 'Salvar Novo Membro'}</button></div>
            </form>
          )}

          <DataTable 
            data={clientTeamMembers}
            loading={loading}
            emptyMessage="Nenhum membro vinculado a este cliente."
            columns={[
              { 
                header: 'Membro', 
                accessor: (member) => (
                  <div>
                    <div className="text-white font-bold text-base leading-tight mb-1">{member.name}</div>
                    <div className="text-zinc-500 text-xs flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{member.email}</div>
                  </div>
                )
              },
              {
                header: 'Status',
                accessor: (member) => (
                  <span className={cn("inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest", member.status === 'confirmed' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10")}>
                    <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--color),0.5)]", member.status === 'confirmed' ? "bg-emerald-500" : "bg-amber-500")} />
                    {member.status === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}
                  </span>
                )
              }
            ]}
            actions={(member) => (
              <>
                <button onClick={() => sendEmailInvite(member.name, member.email)} disabled={sendingEmail === member.email} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all" title="Reenviar Convite"><Mail className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteTeamMember(member.id!, member.email)} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all" title="Excluir Membro"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          />
        </div>
      )}

      {!isClientFormOpen && !isTeamViewOpen && (
        <div className="space-y-4">
          <div className="relative animate-in fade-in duration-300">
            <Search className="w-5 h-5 text-zinc-500 absolute left-5 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar cliente por nome ou e-mail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#1a1a1a] border border-zinc-800 rounded-2xl pl-13 pr-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-600 shadow-xl"/>
          </div>

          <DataTable 
            data={filteredClients}
            loading={loading}
            onRowClick={(client) => navigate(`/clients/${client.id}`)}
            emptyMessage={searchTerm ? 'Nenhum cliente encontrado na busca.' : 'Nenhum cliente cadastrado.'}
            columns={[
              {
                header: 'Cliente',
                accessor: (client) => (
                  <div>
                    <div className="text-white font-bold text-base leading-tight mb-1 uppercase italic">{client.name}</div>
                    <div className="text-zinc-500 text-xs flex items-center gap-2 font-medium tracking-tight"><Mail className="w-3.5 h-3.5" />{client.email}</div>
                  </div>
                )
              },
              {
                header: 'Status',
                accessor: (client) => (
                  <span className={cn("inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest", client.status === 'confirmed' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10")}>
                    <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--color),0.5)]", client.status === 'confirmed' ? "bg-emerald-500" : "bg-amber-500")} />
                    {client.status === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}
                  </span>
                )
              },
              {
                header: 'Membros',
                align: 'center',
                accessor: (client) => {
                  const count = getClientTeamCount(client.id!);
                  return count > 0 ? (
                    <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white text-[10px] font-bold shadow-lg">{count}</div>
                  ) : <span className="text-zinc-700 text-xs font-medium">-</span>;
                }
              }
            ]}
            actions={(client) => (
              <>
                <button onClick={(e) => { e.stopPropagation(); handleOpenTeamView(client); }} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest" title="Gerenciar Equipe do Cliente"><Users className="w-4 h-4 text-[#ff5351]" />Equipe</button>
                <button onClick={(e) => { e.stopPropagation(); handleOpenEditClient(client); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all" title="Editar Cadastro"><Edit2 className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); sendEmailInvite(client.name, client.email); }} disabled={sendingEmail === client.email} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all disabled:opacity-50"><Mail className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); 
                  const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(client.email)}`;
                  navigator.clipboard.writeText(`Seu conteúdo foi selecionado!\nAcesse pelo link abaixo e crie sua senha:\n\n${inviteLink}`);
                  toast.success('Mensagem de convite copiada!');
                }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#25D366] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all"><ExternalLink className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id!, client.email); }} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          />
        </div>
      )}
    </div>
  );
}
