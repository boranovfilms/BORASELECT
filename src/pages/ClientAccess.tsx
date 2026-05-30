export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Copy, UserPlus, Mail, Trash2, ExternalLink, Edit2, Shield, Users, 
  Camera, User, Briefcase, Lock, Phone, Upload, MapPin, Building, ChevronDown, Search, Globe, Image as ImageIcon, Loader2, Sliders, Move
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
  const memberFileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
  // Controle de Navegação
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isTeamViewOpen, setIsTeamViewOpen] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddingTeamMember, setIsAddingTeamMember] = useState(false);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Estados de Ajuste de Foto (Nativo)
  const [photoConfig, setPhotoConfig] = useState({ zoom: 1, x: 50, y: 50 });

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
      toast.success('Dados importados!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSearchingCnpj(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('image')) return toast.error('Selecione uma imagem válida');
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleMemberPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMemberForm(prev => ({ ...prev, photoUrl: reader.result as string }));
      setPhotoConfig({ zoom: 1, x: 50, y: 50 });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.email) return toast.error('Preencha nome e e-mail');
    setSaving(true);
    try {
      let finalClientId = clientForm.id;
      let isNew = !isEditingClient;
      
      if (isNew) {
        const newDocRef = await clientService.createClient({ 
          ...clientForm, 
          name: clientForm.name.toUpperCase(), 
          email: clientForm.email.toLowerCase().trim(), 
          role: 'cliente' 
        });
        finalClientId = newDocRef.id;
      }

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
        } catch (uploadError) {
          console.error('Erro no upload:', uploadError);
        }
      }

      await (clientService as any).updateClient(finalClientId, { 
        ...clientForm, 
        id: finalClientId, 
        logoUrl: currentLogoUrl, 
        name: clientForm.name.toUpperCase(), 
        email: clientForm.email.toLowerCase().trim() 
      });

      if (isNew) {
        try {
          const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(clientForm.email.toLowerCase().trim())}`;
          await emailService.sendInvite(clientForm.email.toLowerCase().trim(), clientForm.name.toUpperCase(), inviteLink);
          toast.success('Cliente adicionado!');
        } catch (e) { 
          toast.error('Cliente salvo, mas convite falhou.'); 
        }
      } else { 
        toast.success('Cliente atualizado!'); 
      }

      setLogoPreview('');
      setIsClientFormOpen(false);
      loadAllData();
    } catch (error) { 
      toast.error('Erro ao salvar cliente'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleSaveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.firstName || !memberForm.email || !memberForm.role) return toast.error('Preencha os campos obrigatórios');
    try {
      setLoading(true);
      const fullName = `${memberForm.firstName} ${memberForm.lastName}`.trim().toUpperCase();
      
      let currentStatus = 'pending';
      if (isEditingMember && editingMemberId) {
        const existingMember = allTeamMembers.find(m => m.id === editingMemberId);
        if (existingMember) currentStatus = existingMember.status || 'pending';
      }

      const normalizedMember = {
        name: fullName,
        email: memberForm.email.toLowerCase().trim(),
        phone: memberForm.phone,
        role: memberForm.role,
        jobTitle: memberForm.jobTitle.toUpperCase(),
        accessLevel: memberForm.accessLevel,
        clienteId: selectedClient?.id,
        photoUrl: memberForm.photoUrl,
        photoConfig: photoConfig,
        status: currentStatus
      };

      if (isEditingMember && editingMemberId) {
        await teamService.updateTeamMember(editingMemberId, normalizedMember as any);
        toast.success('Membro atualizado!');
      } else {
        await teamService.createTeamMember(normalizedMember as any);
        try {
          const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(normalizedMember.email)}`;
          await emailService.sendInvite(normalizedMember.email, normalizedMember.name, inviteLink);
          toast.success('Membro adicionado!');
        } catch (e) { toast.error('Membro salvo, mas convite falhou.'); }
      }
      
      setMemberForm({ firstName: '', lastName: '', email: '', phone: '', password: '', jobTitle: '', role: 'equipe', accessLevel: 'validador', photoUrl: '' });
      setIsAddingTeamMember(false);
      setIsEditingMember(false);
      setEditingMemberId(null);
      await loadAllData();
    } catch (error) { toast.error('Erro ao salvar membro'); } finally { setLoading(false); }
  };

  const handleOpenEditMember = (member: TeamMember) => {
    const names = member.name.split(' ');
    setMemberForm({
      firstName: names[0] || '',
      lastName: names.slice(1).join(' ') || '',
      email: member.email || '',
      phone: member.phone || '',
      password: '',
      jobTitle: member.jobTitle || '',
      role: member.role || 'equipe',
      accessLevel: member.accessLevel || 'validador',
      photoUrl: member.photoUrl || ''
    });
    if ( (member as any).photoConfig ) setPhotoConfig((member as any).photoConfig);
    setEditingMemberId(member.id!);
    setIsEditingMember(true);
    setIsAddingTeamMember(true);
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
    setLogoPreview('');
    setIsEditingClient(true);
    setIsClientFormOpen(true);
  };

  const handleDeleteClient = async (id: string, email: string) => {
    if (!window.confirm('Excluir este cliente?')) return;
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

  const handleDeleteTeamMember = async (id: string, email: string) => {
    if (!window.confirm('Excluir este membro?')) return;
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
    } catch (error) { toast.error('Erro ao enviar.'); } finally { setSendingEmail(null); }
  };

  const getClientTeamCount = (clientId: string) => allTeamMembers.filter(m => (m as any).clienteId === clientId).length;
  const filteredClients = clients.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.email?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-12 pb-20 text-left">
      {!isClientFormOpen && !isTeamViewOpen && (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-left">
            <h1 className="text-5xl font-bold tracking-tight text-white mb-2 uppercase italic font-black text-left leading-none">Gestão de Clientes</h1>
            <p className="text-zinc-500 text-lg text-left">Gerencie o cadastro dos seus clientes.</p>
          </div>
          <button onClick={() => { setClientForm({ id: '', name: '', email: '', phone: '', document: '', zipCode: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '', commercialName: '', website: '', responsibleContact: '', logoUrl: '', status: 'pending' }); setLogoPreview(''); setIsEditingClient(false); setIsClientFormOpen(true); }} className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#ff5351] text-white font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg text-xs"><UserPlus className="w-5 h-5" /> Adicionar Cliente</button>
        </header>
      )}

      {isClientFormOpen && (
        <div className="animate-in slide-in-from-right-8 duration-500 text-left">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 text-left">
            <div><button type="button" onClick={() => setIsClientFormOpen(false)} className="text-[#ff5351] hover:text-white transition-colors text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest"><ChevronDown className="w-4 h-4 rotate-90" /> Voltar</button><h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-4">{isEditingClient ? <Edit2 className="w-8 h-8 text-[#ff5351]" /> : <Building className="w-8 h-8 text-[#ff5351]" />}{isEditingClient ? 'Editar Cliente' : 'Novo Cliente'}</h1></div>
            <div className="flex gap-4"><button type="button" onClick={() => setIsClientFormOpen(false)} className="px-8 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-bold hover:bg-zinc-800 transition-all text-xs uppercase tracking-widest">Cancelar</button><button type="button" onClick={handleSaveClient} disabled={saving} className="px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Cadastro'}</button></div>
          </header>
          <div className="space-y-6">
            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl text-left">
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2 text-left uppercase italic"><User className="w-5 h-5 text-[#ff5351]"/> Informações Principais</h3>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block ml-1 text-left">Logo do Cliente</label><button type="button" onClick={() => fileInputRef.current?.click()} className="w-[150px] h-[150px] rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-2 group overflow-hidden relative shadow-inner">{logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : (clientForm.logoUrl ? <img src={clientForm.logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <><Upload className="w-6 h-6 text-zinc-600 group-hover:text-[#ff5351]" /><span className="text-[9px] font-black uppercase text-zinc-500">300x300px</span></>)}</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoSelect} /></div>
                <div className="flex-1 space-y-5 text-left"><div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left"><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">Nome da Empresa</label><input type="text" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="NOME COMERCIAL"/></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">E-MAIL PRINCIPAL</label><input type="email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value.toLowerCase().trim()})} disabled={isEditingClient} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm disabled:opacity-50 text-left font-bold" placeholder="contato@empresa.com"/></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left"><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">Razão Social / CNPJ</label><div className="relative"><input type="text" value={clientForm.document} onChange={e => setClientForm({...clientForm, document: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-12 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="NOME LEGAL OU CNPJ"/><button type="button" onClick={handleFetchCnpj} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#ff5351] transition-colors">{searchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</button></div></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">Site / Link</label><div className="relative"><input type="text" value={clientForm.website} onChange={e => setClientForm({...clientForm, website: e.target.value.toLowerCase().trim()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold" placeholder="www.empresa.com.br"/><Globe className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2" /></div></div></div></div>
              </div>
            </section>
            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl text-left"><h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 text-left"><MapPin className="w-5 h-5 text-[#ff5351]"/> Endereço</h3><div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-4 text-left"><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">CEP</label><input type="text" value={clientForm.zipCode} onChange={e => setClientForm({...clientForm, zipCode: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold" placeholder="00000-000"/></div><div className="md:col-span-2 space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">LOGRADOURO</label><input type="text" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="AVENIDA / RUA"/></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">NÚMERO</label><input type="text" value={clientForm.number} onChange={e => setClientForm({...clientForm, number: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="S/N"/></div></div><div className="grid grid-cols-1 md:grid-cols-4 gap-5 text-left"><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">COMPLEMENTO</label><input type="text" value={clientForm.complement} onChange={e => setClientForm({...clientForm, complement: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="SALA / BLOCO"/></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">BAIRRO</label><input type="text" value={clientForm.neighborhood} onChange={e => setClientForm({...clientForm, neighborhood: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="BAIRRO"/></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">CIDADE</label><input type="text" value={clientForm.city} onChange={e => setClientForm({...clientForm, city: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="CIDADE"/></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">ESTADO</label><input type="text" value={clientForm.state} onChange={e => setClientForm({...clientForm, state: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="UF"/></div></div></section>
            <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl text-left"><h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2 text-left"><Phone className="w-5 h-5 text-[#ff5351]"/> Contato Comercial</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left"><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">RESPONSÁVEL PELO CONTATO</label><input type="text" value={clientForm.responsibleContact} onChange={e => setClientForm({...clientForm, responsibleContact: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold uppercase" placeholder="NOME DO RESPONSÁVEL"/></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">WHATSAPP / TELEFONE</label><input type="text" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold" placeholder="(00) 00000-0000"/></div></div></section>
          </div>
        </div>
      )}

      {isTeamViewOpen && selectedClient && (
        <div className="animate-in slide-in-from-right-8 duration-500 text-left">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 text-left">
            <div className="text-left"><button onClick={() => setIsTeamViewOpen(false)} className="text-[#ff5351] hover:text-white transition-colors text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest leading-none text-left"><ChevronDown className="w-4 h-4 rotate-90" /> Voltar</button><h1 className="text-4xl font-bold tracking-tight text-white mb-2 uppercase italic font-black leading-tight text-left">Equipe: {selectedClient.name}</h1></div>
            <button onClick={() => { setMemberForm({ firstName: '', lastName: '', email: '', phone: '', password: '', jobTitle: '', role: 'equipe', accessLevel: 'validador', photoUrl: '' }); setPhotoConfig({ zoom: 1, x: 50, y: 50 }); setIsEditingMember(false); setIsAddingTeamMember(!isAddingTeamMember); }} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20">{isAddingTeamMember ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />} {isAddingTeamMember ? 'Cancelar' : 'Adicionar Membro'}</button>
          </header>

          {isAddingTeamMember && (
            <form autoComplete="off" onSubmit={handleSaveTeamMember} className="space-y-6 mb-12 animate-in fade-in duration-300 text-left">
              <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-8 shadow-xl text-left">
                <div className="flex items-center gap-3 mb-8 text-left italic uppercase font-black tracking-widest text-[#ff5351]"><User className="w-5 h-5" /><h3>Informações Pessoais</h3></div>
                <div className="flex flex-col md:flex-row gap-10 items-start text-left">
                  <div className="space-y-3 text-left">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block ml-1 text-left leading-none">Foto do Membro</label>
                    <button type="button" onClick={() => memberFileInputRef.current?.click()} className="w-[110px] h-[110px] rounded-full border-2 border-dashed border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-1 group overflow-hidden relative shadow-inner">
                      {memberForm.photoUrl ? (
                         <div className="w-full h-full relative overflow-hidden rounded-full bg-black">
                            <img src={memberForm.photoUrl} alt="Preview" className="absolute max-w-none transition-all duration-200" style={{ width: `${photoConfig.zoom * 100}%`, left: `${photoConfig.x}%`, top: `${photoConfig.y}%`, transform: 'translate(-50%, -50%)' }} />
                         </div>
                      ) : (
                        <><Camera className="w-6 h-6 text-zinc-600 group-hover:text-[#ff5351] transition-colors" /><span className="text-[8px] font-black uppercase text-zinc-500">2MB MÁX</span></>
                      )}
                    </button>
                    {memberForm.photoUrl && (
                       <div className="space-y-3 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800 mt-4">
                          <div className="flex flex-col gap-1"><span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Sliders className="w-2.5 h-2.5" /> Zoom</span><input type="range" min="1" max="3" step="0.05" value={photoConfig.zoom} onChange={e => setPhotoConfig({...photoConfig, zoom: Number(e.target.value)})} className="w-full h-1.5 accent-[#ff5351] bg-zinc-800 rounded-lg appearance-none cursor-pointer" /></div>
                          <div className="flex flex-col gap-1"><span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Move className="w-2.5 h-2.5" /> Posição X</span><input type="range" min="0" max="100" value={photoConfig.x} onChange={e => setPhotoConfig({...photoConfig, x: Number(e.target.value)})} className="w-full h-1.5 accent-[#ff5351] bg-zinc-800 rounded-lg appearance-none cursor-pointer" /></div>
                          <div className="flex flex-col gap-1"><span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Move className="w-2.5 h-2.5" /> Posição Y</span><input type="range" min="0" max="100" value={photoConfig.y} onChange={e => setPhotoConfig({...photoConfig, y: Number(e.target.value)})} className="w-full h-1.5 accent-[#ff5351] bg-zinc-800 rounded-lg appearance-none cursor-pointer" /></div>
                       </div>
                    )}
                    <input type="file" ref={memberFileInputRef} className="hidden" accept="image/*" onChange={handleMemberPhotoSelect} />
                  </div>
                  <div className="flex-1 space-y-6 w-full text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                      <div className="space-y-2 text-left uppercase"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">NOME</label><input type="text" value={memberForm.firstName} onChange={e => setMemberForm({...memberForm, firstName: e.target.value.toUpperCase()})} placeholder="JOÃO" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left uppercase font-bold"/></div>
                      <div className="space-y-2 text-left uppercase"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">SOBRENOME</label><input type="text" value={memberForm.lastName} onChange={e => setMemberForm({...memberForm, lastName: e.target.value.toUpperCase()})} placeholder="SILVA" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left uppercase font-bold"/></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left text-left">
                      <div className="space-y-2 text-left text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">E-MAIL</label><div className="relative"><input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value.toLowerCase().trim()})} placeholder="joao.silva@empresa.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold"/><Mail className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2 text-left" /></div></div>
                      <div className="space-y-2 text-left text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">TELEFONE</label><div className="relative"><input type="text" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} placeholder="(00) 00000-0000" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold"/><Phone className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2 text-left" /></div></div>
                    </div>
                  </div>
                </div>
              </section>
              <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-8 shadow-xl text-left">
                <div className="flex items-center gap-3 mb-8 text-left"><Briefcase className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white uppercase italic text-left leading-none">Informações Profissionais</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 text-left">
                  <div className="space-y-2 text-left text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">CARGO</label><input type="text" value={memberForm.jobTitle} onChange={e => setMemberForm({...memberForm, jobTitle: e.target.value.toUpperCase()})} placeholder="Ex: DESENVOLVEDOR SENIOR" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm uppercase font-bold text-left"/></div>
                  <div className="space-y-2 text-left text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">FUNÇÃO</label><div className="relative"><select value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm appearance-none cursor-pointer font-bold"><option value="" disabled>Selecione uma função</option><option value="equipe">Equipe Cliente</option></select><ChevronDown className="w-4 h-4 text-zinc-700 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div></div>
                </div>
                <div className="space-y-3 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">NÍVEL DE ACESSO</label><div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                    {[
                      { id: 'aprovador', label: 'Aprovador Principal', desc: 'Aprovação final do conteúdo' },
                      { id: 'validador', label: 'Validador', desc: 'Sugere correções no conteúdo' },
                      { id: 'visualizador', label: 'Visualizador', desc: 'Apenas acompanha o projeto' }
                    ].map(level => (
                      <label key={level.id} className={cn("cursor-pointer border rounded-2xl p-5 flex items-start gap-3 transition-all", memberForm.accessLevel === level.id ? "bg-[#ff5351]/10 border-[#ff5351]" : "bg-zinc-900 border-zinc-800 hover:border-zinc-300")}><div className="pt-0.5"><div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all", memberForm.accessLevel === level.id ? "border-[#ff5351]" : "border-zinc-600")}>{memberForm.accessLevel === level.id && <div className="w-2 h-2 rounded-full bg-[#ff5351]" />}</div></div><div className="text-left"><input type="radio" name="accessLevel" value={level.id} checked={memberForm.accessLevel === level.id} onChange={e => setMemberForm({...memberForm, accessLevel: e.target.value})} className="hidden" /><p className="text-white font-bold text-sm uppercase leading-none">{level.label}</p><p className="text-zinc-500 text-[10px] mt-2 uppercase text-left leading-tight">{level.desc}</p></div></label>
                    ))}
                  </div></div>
              </section>
              <div className="flex justify-end pt-4 text-left"><button type="submit" disabled={loading} className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#ff5351] hover:text-white transition-all shadow-2xl disabled:opacity-50 flex items-center gap-3"><UserPlus className="w-5 h-5 text-left" />{loading ? 'Aguarde...' : (isEditingMember ? 'Salvar Alterações' : 'Salvar Novo Membro')}</button></div>
            </form>
          )}
          <DataTable data={allTeamMembers.filter(m => (m as any).clienteId === selectedClient.id)} loading={loading} emptyMessage="Nenhum membro vinculado." columns={[{ header: 'Membro', accessor: (member) => <div className="text-left py-1 text-left flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">{member.photoUrl ? <img src={member.photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="text-[10px] font-black text-[#ff5351]">{member.name.split(' ').map((n:any) => n[0]).join('').slice(0,2)}</div>}</div><div className="text-left text-left"><div className="text-white font-bold text-base leading-tight mb-1 uppercase text-left">{member.name}</div><div className="text-zinc-500 text-xs flex items-center gap-2 leading-none uppercase text-left text-left"><Mail className="w-3.5 h-3.5 text-left" />{member.email}</div></div></div> }, { header: 'Status', accessor: (member) => <span className={cn("inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest", member.status === 'confirmed' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10")}><div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#10b981]", member.status === 'confirmed' ? "bg-emerald-500" : "bg-amber-500")} />{member.status === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}</span> }]} actions={(member) => (<><button onClick={(e) => { e.stopPropagation(); handleOpenEditMember(member); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg text-left" title="Editar Membro"><Edit2 className="w-4 h-4 text-left" /></button><button onClick={(e) => { e.stopPropagation(); sendEmailInvite(member.name, member.email); }} disabled={sendingEmail === member.email} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all shadow-lg text-left" title="Reenviar Convite"><Mail className="w-4 h-4 text-left" /></button><button onClick={(e) => { e.stopPropagation(); handleDeleteTeamMember(member.id!, member.email); }} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all shadow-lg text-left" title="Excluir Membro"><Trash2 className="w-4 h-4 text-left" /></button></>)} />
        </div>
      )}

      {!isClientFormOpen && !isTeamViewOpen && (
        <div className="space-y-4 text-left">
          <div className="relative animate-in fade-in duration-300 text-left text-left text-left"><Search className="w-5 h-5 text-zinc-500 absolute left-5 top-1/2 -translate-y-1/2 text-left text-left text-left" /><input type="text" placeholder="Buscar cliente por nome ou e-mail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#1a1a1a] border border-zinc-800 rounded-2xl pl-13 pr-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-600 shadow-xl uppercase font-medium text-left text-left"/></div>
          <DataTable data={filteredClients} loading={loading} onRowClick={(client) => { if (client.id) navigate(`/clients/${client.id}`); }} emptyMessage={searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'} columns={[{ header: 'Cliente', accessor: (client) => (<div onClick={(e) => { e.stopPropagation(); if(client.id) navigate(`/clients/${client.id}`); }} className="text-left py-1 cursor-pointer group/name flex items-center gap-3 text-left text-left text-left text-left text-left"><div className="w-10 h-10 rounded-xl bg-zinc-900 overflow-hidden border border-zinc-800 shrink-0 flex items-center justify-center shadow-lg text-left">{client.logoUrl ? <img src={client.logoUrl} alt="" className="w-full h-full object-contain" /> : <Building className="w-5 h-5 text-zinc-700" />}</div><div className="text-left text-left text-left"><div className="text-white font-black text-base leading-tight mb-1 uppercase italic group-hover/name:text-[#ff5351] transition-colors text-left text-left text-left text-left text-left">{client.name}</div><div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-left text-left text-left text-left text-left"><Mail className="w-3.5 h-3.5 text-left text-left text-left" />{client.email}</div></div></div>) }, { header: 'Status', accessor: (client) => <span className={cn("inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase tracking-widest", client.status === 'confirmed' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10")}><div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#10b981]", client.status === 'confirmed' ? "bg-emerald-500" : "bg-amber-500")} />{client.status === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}</span> }, { header: 'Membros', align: 'center', accessor: (client) => { const count = getClientTeamCount(client.id!); return count > 0 ? <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white text-[10px] font-black shadow-lg italic text-left text-left text-left text-left">{count}</div> : <span className="text-zinc-700 text-xs font-medium text-left text-left text-left text-left text-left">-</span>; } }]} actions={(client) => (<><button onClick={(e) => { e.stopPropagation(); handleOpenTeamView(client); }} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest shadow-lg text-left text-left text-left text-left text-left"><Users className="w-4 h-4 text-[#ff5351] text-left text-left text-left text-left text-left" />Equipe</button><button onClick={(e) => { e.stopPropagation(); handleOpenEditClient(client); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg text-left text-left text-left text-left text-left text-left"><Edit2 className="w-4 h-4 text-left text-left text-left text-left text-left text-left" /></button><button onClick={(e) => { e.stopPropagation(); sendEmailInvite(client.name, email); }} disabled={sendingEmail === client.email} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all disabled:opacity-50 shadow-lg text-left text-left text-left text-left text-left text-left"><Mail className="w-4 h-4 text-left text-left text-left text-left text-left text-left" /></button><button onClick={(e) => { e.stopPropagation(); const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(client.email)}`; navigator.clipboard.writeText(`Seu conteúdo foi selecionado!\nAcesse pelo link abaixo e crie sua senha:\n\n${inviteLink}`); toast.success('Mensagem de convite copiada!'); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#25D366] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all shadow-lg text-left text-left text-left text-left text-left text-left text-left"><ExternalLink className="w-4 h-4 text-left text-left text-left text-left text-left text-left text-left" /></button><button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id!, client.email); }} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all shadow-lg text-left text-left text-left text-left text-left text-left text-left text-left text-left"><Trash2 className="w-4 h-4 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left" /></button></>)} />
        </div>
      )}
    </div>
  );
}
