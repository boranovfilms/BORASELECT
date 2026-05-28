export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Copy, UserPlus, Mail, Trash2, ExternalLink, Edit2, Shield, Users, 
  Camera, User, Briefcase, Lock, Phone, Upload, MapPin, Building, ChevronDown, Search, Globe, Image as ImageIcon, Loader2
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
  const [saving, setSaving] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
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
    commercialName: '', website: '', responsibleContact: '', logoUrl: '', status: 'pending'
  });

  // Estado do Formulário de Membro da Equipe
  const [memberForm, setMemberForm] = useState({ 
    firstName: '', lastName: '', email: '', phone: '', 
    password: '', jobTitle: '', role: 'equipe', accessLevel: 'validador', photoUrl: '' 
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const allData = await clientService.searchClients('');
      const loadedClients = allData.filter(c => c.role === 'cliente' || !c.role).map(c => ({
        ...c,
        id: c.id || (c as any).uid || (c as any).docId
      }));
      setClients(loadedClients);
      const team = allData.filter(m => (m.role === 'equipe' || (m as any).clienteId) && (m as any).clienteId !== undefined) as any;
      setAllTeamMembers(team);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchCnpj = async () => {
    const cnpj = clientForm.document.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      toast.error('CNPJ inválido para busca');
      return;
    }

    try {
      setSearchingCnpj(true);
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error('CNPJ não encontrado');
      
      const data = await response.json();
      
      setClientForm(prev => ({
        ...prev,
        name: (data.nome_fantasia || data.razao_social || '').toUpperCase(),
        commercialName: (data.nome_fantasia || data.razao_social || '').toUpperCase(),
        document: data.razao_social.toUpperCase(),
        zipCode: data.cep || '',
        address: data.logradouro?.toUpperCase() || '',
        number: data.numero?.toUpperCase() || '',
        neighborhood: data.bairro?.toUpperCase() || '',
        city: data.municipio?.toUpperCase() || '',
        state: data.uf?.toUpperCase() || '',
        phone: data.ddd_telefone_1 || prev.phone
      }));
      
      toast.success('Dados importados com sucesso!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSearchingCnpj(false);
    }
  };

  const handleOpenAddClient = () => {
    setClientForm({
      id: '', name: '', email: '', phone: '', document: '', 
      zipCode: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '',
      commercialName: '', website: '', responsibleContact: '', logoUrl: '', status: 'pending'
    });
    setLogoFile(null);
    setLogoPreview('');
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
      website: (client as any).website || '',
      responsibleContact: (client as any).responsibleContact || '',
      logoUrl: (client as any).logoUrl || '',
      status: client.status || 'pending'
    });
    setLogoFile(null);
    setLogoPreview((client as any).logoUrl || '');
    setIsEditingClient(true);
    setIsClientFormOpen(true);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('image')) return toast.error('Selecione uma imagem válida');
    
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.email) return toast.error('Preencha nome e e-mail');
    
    setSaving(true);
    try {
      let finalClientId = clientForm.id;
      let isNew = !isEditingClient;
      
      // 1. Criar ou Obter ID do Cliente
      if (isNew) {
        const newDocRef = await clientService.createClient({
          ...clientForm,
          name: clientForm.name.toUpperCase(),
          email: clientForm.email.toLowerCase().trim(),
          role: 'cliente'
        });
        finalClientId = newDocRef.id;
      }

      // 2. Upload da Logo via API Proxy (se houver novo arquivo)
      let currentLogoUrl = clientForm.logoUrl;
      if (logoPreview && logoPreview.startsWith('data:image')) {
        try {
          const upResponse = await fetch('/api/upload-logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: logoPreview, clientId: finalClientId })
          });
          if (upResponse.ok) {
            const upResult = await upResponse.json();
            currentLogoUrl = upResult.url;
          }
        } catch (uploadErr) {
          console.warn('Logo upload failed, continuing without logo:', uploadErr);
        }
      }

      // 3. Atualizar com a URL da Logo final e demais dados
      const finalData = {
        ...clientForm,
        id: finalClientId,
        logoUrl: currentLogoUrl,
        name: clientForm.name.toUpperCase(),
        email: clientForm.email.toLowerCase().trim()
      };

      await (clientService as any).updateClient(finalClientId, finalData);
      
      // 4. Envio de e-mail automático apenas para NOVOS clientes
      if (isNew) {
        try {
          const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(finalData.email)}`;
          await emailService.sendInvite(finalData.email, finalData.name, inviteLink);
          toast.success('Cliente adicionado e convite enviado!');
        } catch (mailErr) {
          console.error('Failed to send invite email:', mailErr);
          toast.error('Cliente salvo, mas o convite por e-mail falhou.');
        }
      } else {
        toast.success('Cliente atualizado com sucesso!');
      }

      setIsClientFormOpen(false);
      loadAllData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (id: string, email: string) => {
    if (!window.confirm('Excluir este cliente permanentemente?')) return;
    try {
      setLoading(true);
      try { await clientService.deleteClientAuth(email); } catch (e) {}
      await clientService.deleteClient(id);
      toast.success('Cliente removido');
      loadAllData();
    } catch (error) { toast.error('Erro ao remover'); } finally { setLoading(false); }
  };

  const handleOpenTeamView = (client: Client) => {
    setSelectedClient(client);
    setIsAddingTeamMember(false);
    setIsTeamViewOpen(true);
  };

  const handleSaveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.firstName || !memberForm.email || !memberForm.role) return toast.error('Preencha os campos obrigatórios');
    try {
      setLoading(true);
      const fullName = `${memberForm.firstName} ${memberForm.lastName}`.trim().toUpperCase();
      const normalizedMember = {
        name: fullName,
        email: memberForm.email.toLowerCase().trim(),
        phone: memberForm.phone,
        role: memberForm.role,
        jobTitle: memberForm.jobTitle.toUpperCase(),
        accessLevel: memberForm.accessLevel,
        clienteId: selectedClient?.id,
        status: 'pending'
      };
      await teamService.createTeamMember(normalizedMember as any);
      
      try {
        const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(normalizedMember.email)}`;
        await emailService.sendInvite(normalizedMember.email, normalizedMember.name, inviteLink);
        toast.success('Membro adicionado e convite enviado!');
      } catch (mailErr) {
        toast.error('Membro adicionado, mas o e-mail de convite falhou.');
      }
      
      setMemberForm({ firstName: '', lastName: '', email: '', phone: '', password: '', jobTitle: '', role: 'equipe', accessLevel: 'validador', photoUrl: '' });
      setIsAddingTeamMember(false);
      await loadAllData();
    } catch (error) { toast.error('Erro ao adicionar membro'); } finally { setLoading(false); }
  };

  const handleDeleteTeamMember = async (id: string, email: string) => {
    if (!window.confirm('Excluir este membro permanentemente?')) return;
    try {
      setLoading(true);
      try { await teamService.deleteTeamMemberAuth(email); } catch (e) {}
      await teamService.deleteTeamMember(id);
      toast.success('Membro removido');
      loadAllData();
    } catch (error) { toast.error('Erro ao remover'); } finally { setLoading(false); }
  };

  const sendEmailInvite = async (name: string, email: string) => {
    try {
      setSendingEmail(email);
      await emailService.sendInvite(email, name, `${window.location.origin}/register?email=${encodeURIComponent(email)}`);
      toast.success('Convite enviado!');
    } catch (error) {
      toast.error('Falha ao reenviar convite.');
    } finally { setSendingEmail(null); }
  };

  const getClientTeamCount = (clientId: string) => allTeamMembers.filter(m => (m as any).clienteId === clientId).length;
  const filteredClients = clients.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.email?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-12 pb-20 text-left">
      {!isClientFormOpen && !isTeamViewOpen && (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-left">
            <h1 className="text-5xl font-bold tracking-tight text-white mb-2 uppercase italic font-black">Gestão de Clientes</h1>
            <p className="text-zinc-500 text-lg">Gerencie o cadastro e os planejamentos dos seus clientes.</p>
          </div>
          <button onClick={handleOpenAddClient} className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#ff5351] text-white font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg text-xs">
            <UserPlus className="w-5 h-5" /> Adicionar Cliente
          </button>
        </header>
      )}

      {isClientFormOpen && (
        <form autoComplete="off" onSubmit={handleSaveClient} className="animate-in slide-in-from-right-8 duration-500 text-left">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="text-left">
              <button type="button" onClick={() => setIsClientFormOpen(false)} className="text-[#ff5351] hover:text-white transition-colors text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest"><ChevronDown className="w-4 h-4 rotate-90" /> Voltar</button>
              <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-4">{isEditingClient ? <Edit2 className="w-8 h-8 text-[#ff5351]" /> : <Building className="w-8 h-8 text-[#ff5351]" />}{isEditingClient ? 'Editar Cliente' : 'Novo Cliente'}</h1>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsClientFormOpen(false)} className="px-8 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-bold hover:bg-zinc-800 transition-all text-xs uppercase tracking-widest">Cancelar</button>
              <button type="submit" disabled={saving} className="px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Cadastro'}</button>
            </div>
          </header>

          <div className="space-y-6">
            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2"><User className="w-5 h-5 text-[#ff5351]"/> Informações Principais</h3>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block ml-1">Logo do Cliente</label>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-[150px] h-[150px] rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-2 group overflow-hidden relative">
                    {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <><Upload className="w-6 h-6 text-zinc-600 group-hover:text-[#ff5351]" /><span className="text-[9px] font-black uppercase text-zinc-500">300x300px</span></>}
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoSelect} />
                </div>

                <div className="flex-1 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Nome da Empresa</label><input type="text" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="NOME COMERCIAL"/></div>
                    <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">E-MAIL PRINCIPAL</label><input type="email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value.toLowerCase().trim()})} disabled={isEditingClient} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm disabled:opacity-50" placeholder="contato@empresa.com"/></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Razão Social / CNPJ</label>
                      <div className="relative">
                        <input type="text" value={clientForm.document} onChange={e => setClientForm({...clientForm, document: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-12 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="NOME LEGAL OU CNPJ"/>
                        <button type="button" onClick={handleFetchCnpj} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#ff5351] transition-colors">{searchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</button>
                      </div>
                    </div>
                    <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Site / Link</label><div className="relative"><input type="text" value={clientForm.website} onChange={e => setClientForm({...clientForm, website: e.target.value.toLowerCase().trim()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="www.empresa.com.br"/><Globe className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl text-left">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2"><MapPin className="w-5 h-5 text-[#ff5351]"/> Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-4">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">CEP</label><input type="text" value={clientForm.zipCode} onChange={e => setClientForm({...clientForm, zipCode: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="00000-000"/></div>
                <div className="space-y-2 md:col-span-3"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Rua / Logradouro</label><input type="text" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="AV. PRINCIPAL"/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Número</label><input type="text" value={clientForm.number} onChange={e => setClientForm({...clientForm, number: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="123"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Bairro</label><input type="text" value={clientForm.neighborhood} onChange={e => setClientForm({...clientForm, neighborhood: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="CENTRO"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Cidade</label><input type="text" value={clientForm.city} onChange={e => setClientForm({...clientForm, city: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="SÃO PAULO"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Estado</label><input type="text" value={clientForm.state} onChange={e => setClientForm({...clientForm, state: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="SP"/></div>
              </div>
            </section>

            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl mb-10 text-left">
              <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2"><Briefcase className="w-5 h-5 text-[#ff5351]"/> Dados Comerciais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Telefone / WhatsApp</label><div className="relative"><input type="text" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white text-sm" placeholder="(00) 00000-0000"/><Phone className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Responsável de Contato</label><div className="relative"><input type="text" value={clientForm.responsibleContact} onChange={e => setClientForm({...clientForm, responsibleContact: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm" placeholder="NOME DO RESPONSÁVEL LEGAL"/><User className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
              </div>
            </section>
          </div>
        </form>\n      )}\n\n      {isTeamViewOpen && selectedClient && (\n        <div className=\"animate-in slide-in-from-bottom-8 duration-500 text-left\">\n          <header className=\"flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-zinc-800 pb-6\">\n            <div className=\"text-left\">\n              <button onClick={() => setIsTeamViewOpen(false)} className=\"text-[#ff5351] hover:text-white transition-colors text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest\"><ChevronDown className=\"w-4 h-4 rotate-90\" /> Voltar</button>\n              <h1 className=\"text-4xl font-bold tracking-tight text-white mb-2 uppercase italic font-black\">Equipe: {selectedClient.name}</h1>\n            </div>\n            <button onClick={() => setIsAddingTeamMember(!isAddingTeamMember)} className=\"flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20\">{isAddingTeamMember ? <X className=\"w-5 h-5\" /> : <UserPlus className=\"w-5 h-5\" />} {isAddingTeamMember ? 'Cancelar' : 'Adicionar Membro'}</button>\n          </header>\n\n          <DataTable \n            data={allTeamMembers.filter(m => (m as any).clienteId === selectedClient.id)}\n            loading={loading}\n            emptyMessage=\"Nenhum membro vinculado.\"\n            columns={[\n              { header: 'Membro', accessor: (member) => <div className=\"text-left py-1\"><div className=\"text-white font-bold text-base leading-tight mb-1\">{member.name}</div><div className=\"text-zinc-500 text-xs flex items-center gap-2\"><Mail className=\"w-3.5 h-3.5\" />{member.email}</div></div> },\n              { header: 'Status', accessor: (member) => <span className={cn(\"inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest\", member.status === 'confirmed' ? \"text-emerald-400 border-emerald-500/30 bg-emerald-500/10\" : \"text-amber-400 border-amber-500/30 bg-amber-500/10\")}><div className={cn(\"w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--color),0.5)]\", member.status === 'confirmed' ? \"bg-emerald-500\" : \"bg-amber-500\")} />{member.status === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}</span> }\n            ]}\n            actions={(member) => (\n              <>\n                <button onClick={(e) => { e.stopPropagation(); sendEmailInvite(member.name, member.email); }} disabled={sendingEmail === member.email} className=\"p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all\" title=\"Reenviar Convite\"><Mail className=\"w-4 h-4\" /></button>\n                <button onClick={(e) => { e.stopPropagation(); handleDeleteTeamMember(member.id!, member.email); }} className=\"p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all\" title=\"Excluir Membro\"><Trash2 className=\"w-4 h-4\" /></button>\n              </>\n            )}\n          />\n        </div>\n      )}\n\n      {!isClientFormOpen && !isTeamViewOpen && (\n        <div className=\"space-y-4 text-left\">\n          <div className=\"relative animate-in fade-in duration-300\">\n            <Search className=\"w-5 h-5 text-zinc-500 absolute left-5 top-1/2 -translate-y-1/2\" />\n            <input type=\"text\" placeholder=\"Buscar cliente por nome ou e-mail...\" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className=\"w-full bg-[#1a1a1a] border border-zinc-800 rounded-2xl pl-13 pr-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-600 shadow-xl\"/>\n          </div>\n\n          <DataTable \n            data={filteredClients}\n            loading={loading}\n            onRowClick={(client) => { if (client.id) navigate(`/clients/${client.id}`); }}\n            emptyMessage={searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}\n            columns={[\n              {\n                header: 'Cliente',\n                accessor: (client) => (\n                  <div onClick={(e) => { e.stopPropagation(); if(client.id) navigate(`/clients/${client.id}`); }} className=\"text-left py-1 cursor-pointer group/name flex items-center gap-3\">\n                    <div className=\"w-8 h-8 rounded-lg bg-zinc-900 overflow-hidden border border-zinc-700 shrink-0 flex items-center justify-center\">\n                      {client.logoUrl ? <img src={client.logoUrl} alt=\"\" className=\"w-full h-full object-cover\" /> : <Building className=\"w-4 h-4 text-zinc-600\" />}\n                    </div>\n                    <div>\n                      <div className=\"text-white font-bold text-base leading-tight mb-1 uppercase italic group-hover/name:text-[#ff5351] transition-colors\">{client.name}</div>\n                      <div className=\"text-zinc-500 text-xs flex items-center gap-2 font-medium tracking-tight\"><Mail className=\"w-3.5 h-3.5\" />{client.email}</div>\n                    </div>\n                  </div>\n                )\n              },\n              { header: 'Status', accessor: (client) => <span className={cn(\"inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest\", client.status === 'confirmed' ? \"text-emerald-400 border-emerald-500/30 bg-emerald-500/10\" : \"text-amber-400 border-amber-500/30 bg-amber-500/10\")}><div className={cn(\"w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--color),0.5)]\", client.status === 'confirmed' ? \"bg-emerald-500\" : \"bg-amber-500\")} />{member.status === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}</span> },\n              { header: 'Membros', align: 'center', accessor: (client) => { const count = getClientTeamCount(client.id!); return count > 0 ? <div className=\"w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white text-[10px] font-bold shadow-lg\">{count}</div> : <span className=\"text-zinc-700 text-xs font-medium\">-</span>; } }\n            ]}\n            actions={(client) => (\n              <>\n                <button onClick={(e) => { e.stopPropagation(); handleOpenTeamView(client); }} className=\"flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest\"><Users className=\"w-4 h-4 text-[#ff5351]\" />Equipe</button>\n                <button onClick={(e) => { e.stopPropagation(); handleOpenEditClient(client); }} className=\"p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all\"><Edit2 className=\"w-4 h-4\" /></button>\n                <button onClick={(e) => { e.stopPropagation(); sendEmailInvite(client.name, client.email); }} disabled={sendingEmail === client.email} className=\"p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all disabled:opacity-50\"><Mail className=\"w-4 h-4\" /></button>\n                <button onClick={(e) => { e.stopPropagation(); const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(client.email)}`; navigator.clipboard.writeText(`Seu conteúdo foi selecionado!\n\nAcesse pelo link abaixo e crie sua senha:\n\n${inviteLink}`); toast.success('Mensagem de convite copiada!'); }} className=\"p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#25D366] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all\"><ExternalLink className=\"w-4 h-4\" /></button>\n                <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id!, client.email); }} className=\"p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all\"><Trash2 className=\"w-4 h-4\" /></button>\n              </>\n            )}\n          />\n        </div>\n      )}\n    </div>\n  );\n}\n",path: