export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  // Estados de Crop Circular (Nativo)
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropConfig, setCropConfig] = useState({ zoom: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

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
      toast.error('CNPJ inválido');
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
      setImageToCrop(reader.result as string);
      setCropConfig({ zoom: 1, x: 0, y: 0 });
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmCrop = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = imageToCrop!;
      
      await new Promise(res => img.onload = res);
      
      canvas.width = 400;
      canvas.height = 400;

      // Desenha fundo preto
      ctx!.fillStyle = '#000';
      ctx!.fillRect(0, 0, 400, 400);

      // Calcula dimensões da imagem com zoom
      const baseSize = Math.min(img.width, img.height);
      const drawWidth = (img.width / baseSize) * 400 * cropConfig.zoom;
      const drawHeight = (img.height / baseSize) * 400 * cropConfig.zoom;
      
      // Centraliza + Deslocamento do usuário
      const drawX = (400 - drawWidth) / 2 + cropConfig.x;
      const drawY = (400 - drawHeight) / 2 + cropConfig.y;

      ctx!.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      
      setMemberForm(prev => ({ ...prev, photoUrl: canvas.toDataURL('image/jpeg', 0.8) }));
      setShowCropper(false);
      setImageToCrop(null);
    } catch (e) {
      toast.error('Erro ao processar recorte');
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.email) return toast.error('Preencha nome e e-mail');
    setSaving(true);
    try {
      let finalClientId = clientForm.id;
      let isNew = !isEditingClient;
      if (isNew) {
        const newDocRef = await clientService.createClient({ ...clientForm, name: clientForm.name.toUpperCase(), email: clientForm.email.toLowerCase().trim(), role: 'cliente' });
        finalClientId = newDocRef.id;
      }
      let currentLogoUrl = clientForm.logoUrl;
      if (logoPreview && logoPreview.startsWith('data:image')) {
        const upResponse = await fetch('/api/upload-logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: logoPreview, clientId: finalClientId }) });
        if (upResponse.ok) { const upResult = await upResponse.json(); currentLogoUrl = upResult.url; }
      }
      await (clientService as any).updateClient(finalClientId, { ...clientForm, id: finalClientId, logoUrl: currentLogoUrl, name: clientForm.name.toUpperCase(), email: clientForm.email.toLowerCase().trim() });
      if (isNew) {
        try {
          const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(clientForm.email.toLowerCase().trim())}`;
          await emailService.sendInvite(clientForm.email.toLowerCase().trim(), clientForm.name.toUpperCase(), inviteLink);
          toast.success('Cliente adicionado!');
        } catch (e) { toast.error('Cliente salvo, mas convite falhou.'); }
      } else { toast.success('Cliente atualizado!'); }
      setIsClientFormOpen(false);
      loadAllData();
    } catch (error) { toast.error('Erro ao salvar cliente'); } finally { setSaving(false); }
  };

  const handleSaveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.firstName || !memberForm.email || !memberForm.role) return toast.error('Campos obrigatórios');
    try {
      setLoading(true);
      const normalizedMember = {
        name: `${memberForm.firstName} ${memberForm.lastName}`.trim().toUpperCase(),
        email: memberForm.email.toLowerCase().trim(),
        phone: memberForm.phone,
        role: memberForm.role,
        jobTitle: memberForm.jobTitle.toUpperCase(),
        accessLevel: memberForm.accessLevel,
        clienteId: selectedClient?.id,
        photoUrl: memberForm.photoUrl,
        status: 'pending'
      };
      await teamService.createTeamMember(normalizedMember as any);
      const inviteLink = `${window.location.origin}/register?email=${encodeURIComponent(normalizedMember.email)}`;
      await emailService.sendInvite(normalizedMember.email, normalizedMember.name, inviteLink).catch(() => {});
      toast.success('Membro adicionado!');
      setMemberForm({ firstName: '', lastName: '', email: '', phone: '', password: '', jobTitle: '', role: 'equipe', accessLevel: 'validador', photoUrl: '' });
      setIsAddingTeamMember(false);
      await loadAllData();
    } catch (error) { toast.error('Erro ao adicionar membro'); } finally { setLoading(false); }
  };

  const handleDeleteClient = async (id: string, email: string) => {
    if (!window.confirm('Excluir cliente?')) return;
    try {
      setLoading(true);
      await clientService.deleteClient(id);
      toast.success('Removido');
      loadAllData();
    } catch (error) { toast.error('Erro'); } finally { setLoading(false); }
  };

  const handleOpenTeamView = (client: Client) => {
    setSelectedClient(client);
    setIsAddingTeamMember(false);
    setIsTeamViewOpen(true);
  };

  const sendEmailInvite = async (name: string, email: string) => {
    try {
      setSendingEmail(email);
      await emailService.sendInvite(email, name, `${window.location.origin}/register?email=${encodeURIComponent(email)}`);
      toast.success('Enviado!');
    } catch (error) { toast.error('Falha'); } finally { setSendingEmail(null); }
  };

  const getClientTeamCount = (clientId: string) => allTeamMembers.filter(m => (m as any).clienteId === clientId).length;

  return (
    <div className="space-y-12 pb-20 text-left">
      {/* MODAL DE CROP FULLSCREEN */}
      {showCropper && (
        <div className="fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="text-center mb-8 space-y-2">
            <h2 className="text-2xl font-black text-white uppercase italic">Ajustar Foto</h2>
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Arraste para mover • Scroll para Zoom</p>
          </div>
          
          <div 
            className="w-full max-w-lg aspect-square relative bg-zinc-900 rounded-[40px] overflow-hidden border border-white/5 cursor-move"
            onMouseDown={(e) => { setIsDragging(true); dragStart.current = { x: e.clientX - cropConfig.x, y: e.clientY - cropConfig.y }; }}
            onMouseMove={(e) => { if (!isDragging) return; setCropConfig(prev => ({ ...prev, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })); }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onWheel={(e) => setCropConfig(prev => ({ ...prev, zoom: Math.max(1, Math.min(3, prev.zoom + (e.deltaY > 0 ? -0.1 : 0.1))) }))}
          >
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
               <div className="w-[300px] h-[300px] rounded-full border-2 border-[#ff5351] shadow-[0_0_0_1000px_rgba(0,0,0,0.7)]" />
            </div>
            <img 
              src={imageToCrop!} 
              draggable={false}
              className="absolute pointer-events-none select-none max-w-none transition-transform duration-75"
              style={{ 
                transform: `translate(calc(-50% + ${cropConfig.x}px), calc(-50% + ${cropConfig.y}px)) scale(${cropConfig.zoom})`,
                left: '50%',
                top: '50%'
              }} 
            />
          </div>

          <div className="w-full max-w-lg mt-10 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase"><span>Zoom</span><span className="text-[#ff5351]">{Math.round(cropConfig.zoom * 100)}%</span></div>
              <input type="range" min="1" max="3" step="0.01" value={cropConfig.zoom} onChange={e => setCropConfig(prev => ({ ...prev, zoom: Number(e.target.value) }))} className="w-full h-1.5 accent-[#ff5351] bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowCropper(false)} className="flex-1 py-5 bg-zinc-900 text-zinc-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:text-white transition-all">Cancelar</button>
              <button onClick={handleConfirmCrop} className="flex-2 py-5 bg-[#ff5351] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/30 px-12">Confirmar Recorte</button>
            </div>
          </div>
        </div>
      )}

      {!isClientFormOpen && !isTeamViewOpen && (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-left"><h1 className="text-5xl font-bold tracking-tight text-white mb-2 uppercase italic font-black text-left">Gestão de Clientes</h1><p className="text-zinc-500 text-lg text-left">Gerencie o cadastro dos seus clientes.</p></div>
          <button onClick={handleOpenAddClient} className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#ff5351] text-white font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg text-xs"><UserPlus className="w-5 h-5" /> Adicionar Cliente</button>
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
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2 text-left"><User className="w-5 h-5 text-[#ff5351]"/> Informações Principais</h3>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block ml-1 text-left">Logo do Cliente</label><button type="button" onClick={() => fileInputRef.current?.click()} className="w-[150px] h-[150px] rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-2 group overflow-hidden relative">{logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : (clientForm.logoUrl ? <img src={clientForm.logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <><Upload className="w-6 h-6 text-zinc-600 group-hover:text-[#ff5351]" /><span className="text-[9px] font-black uppercase text-zinc-500">300x300px</span></>)}</button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoSelect} /></div>
                <div className="flex-1 space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">Nome da Empresa</label><input type="text" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left uppercase" placeholder="NOME COMERCIAL"/></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">E-MAIL PRINCIPAL</label><input type="email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value.toLowerCase().trim()})} disabled={isEditingClient} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm disabled:opacity-50 text-left" placeholder="contato@empresa.com"/></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left"><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">Razão Social / CNPJ</label><div className="relative"><input type="text" value={clientForm.document} onChange={e => setClientForm({...clientForm, document: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pr-12 text-white focus:border-[#ff5351] outline-none text-sm text-left uppercase" placeholder="NOME LEGAL OU CNPJ"/><button type="button" onClick={handleFetchCnpj} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#ff5351] transition-colors">{searchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</button></div></div><div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">Site / Link</label><div className="relative"><input type="text" value={clientForm.website} onChange={e => setClientForm({...clientForm, website: e.target.value.toLowerCase().trim()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm text-left" placeholder="www.empresa.com.br"/><Globe className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2" /></div></div></div></div>
              </div>
            </section>
          </div>
        </div>
      )}

      {isTeamViewOpen && selectedClient && (
        <div className="animate-in slide-in-from-bottom-8 duration-500 text-left">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-zinc-800 pb-6 text-left">
            <div className="text-left"><button onClick={() => setIsTeamViewOpen(false)} className="text-[#ff5351] hover:text-white transition-colors text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-widest leading-none text-left"><ChevronDown className="w-4 h-4 rotate-90" /> Voltar</button><h1 className="text-4xl font-bold tracking-tight text-white mb-2 uppercase italic font-black leading-tight text-left">Equipe: {selectedClient.name}</h1></div>
            <button onClick={() => setIsAddingTeamMember(!isAddingTeamMember)} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20">{isAddingTeamMember ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />} {isAddingTeamMember ? 'Cancelar' : 'Adicionar Membro'}</button>
          </header>

          {isAddingTeamMember && (
            <form autoComplete="off" onSubmit={handleSaveTeamMember} className="space-y-6 mb-12 animate-in fade-in duration-300 text-left">
              <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-8 shadow-xl text-left">
                <div className="flex items-center gap-3 mb-8 text-left"><User className="w-5 h-5 text-[#ff5351]" /><h3 className="text-xl font-bold text-white uppercase italic text-left">Informações Pessoais</h3></div>
                
                <div className="flex flex-col md:flex-row gap-10 items-center text-left">
                  <div className="space-y-3 text-center">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-center">Foto do Membro</label>
                    <button type="button" onClick={() => memberFileInputRef.current?.click()} className="w-[110px] h-[110px] rounded-full border-2 border-dashed border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-[#ff5351]/50 transition-all flex flex-col items-center justify-center gap-1 group overflow-hidden relative shadow-inner">
                      {memberForm.photoUrl ? (
                         <img src={memberForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-zinc-600 group-hover:text-[#ff5351] transition-colors" />
                          <span className="text-[8px] font-black uppercase text-zinc-500 tracking-tighter">JPG/PNG<br/>2MB MÁX</span>
                        </>
                      )}
                    </button>
                    <input type="file" ref={memberFileInputRef} className="hidden" accept="image/*" onChange={handleMemberPhotoSelect} />
                  </div>

                  <div className="flex-1 space-y-6 w-full text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">NOME</label><input type="text" value={memberForm.firstName} onChange={e => setMemberForm({...memberForm, firstName: e.target.value.toUpperCase()})} placeholder="EX: JOÃO" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left uppercase font-bold"/></div>
                      <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">SOBRENOME</label><input type="text" value={memberForm.lastName} onChange={e => setMemberForm({...memberForm, lastName: e.target.value.toUpperCase()})} placeholder="EX: SILVA" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left uppercase font-bold"/></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">E-MAIL</label><div className="relative"><input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value.toLowerCase().trim()})} placeholder="joao.silva@empresa.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold"/><Mail className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
                      <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">TELEFONE</label><div className="relative"><input type="text" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} placeholder="(00) 00000-0000" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 pl-11 text-white focus:border-[#ff5351] outline-none text-sm text-left font-bold"/><Phone className="w-4 h-4 text-zinc-700 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-8 shadow-xl text-left">
                <div className="flex items-center gap-3 mb-8 text-left"><Briefcase className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white uppercase italic text-left leading-none">Informações Profissionais</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 text-left">
                  <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">CARGO</label><input type="text" value={memberForm.jobTitle} onChange={e => setMemberForm({...memberForm, jobTitle: e.target.value.toUpperCase()})} placeholder="EX: DESENVOLVEDOR SENIOR" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm text-left uppercase font-bold"/></div>
                  <div className="space-y-2 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">FUNÇÃO</label><div className="relative"><select value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none text-sm appearance-none cursor-pointer font-bold"><option value="" disabled>Selecione uma função</option><option value="equipe">Equipe Cliente</option></select><ChevronDown className="w-4 h-4 text-zinc-700 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div></div>
                </div>
                <div className="space-y-3 text-left"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 block text-left">NÍVEL DE ACESSO</label><div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                    {[
                      { id: 'aprovador', label: 'Aprovador Principal', desc: 'Aprovação final do conteúdo' },
                      { id: 'validador', label: 'Validador', desc: 'Sugere correções no conteúdo' },
                      { id: 'visualizador', label: 'Visualizador', desc: 'Apenas acompanha o projeto' }
                    ].map(level => (
                      <label key={level.id} className={cn("cursor-pointer border rounded-2xl p-5 flex items-start gap-3 transition-all", memberForm.accessLevel === level.id ? "bg-[#ff5351]/10 border-[#ff5351]" : "bg-zinc-900 border-zinc-800 hover:border-zinc-300")}><div className="pt-0.5"><div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all", memberForm.accessLevel === level.id ? "border-[#ff5351]" : "border-zinc-600")}>{memberForm.accessLevel === level.id && <div className="w-2 h-2 rounded-full bg-[#ff5351]" />}</div></div><div className="text-left"><input type="radio" name="accessLevel" value={level.id} checked={memberForm.accessLevel === level.id} onChange={e => setMemberForm({...memberForm, accessLevel: e.target.value})} className="hidden" /><p className="text-white font-bold text-sm text-left uppercase leading-none">{level.label}</p><p className="text-zinc-500 text-[10px] mt-2 uppercase text-left leading-tight">{level.desc}</p></div></label>
                    ))}
                  </div></div>
              </section>
              <div className="flex justify-end pt-4 text-left"><button type="submit" disabled={loading} className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#ff5351] hover:text-white transition-all shadow-2xl disabled:opacity-50 flex items-center gap-3"><UserPlus className="w-5 h-5" />{loading ? 'Aguarde...' : 'Salvar Novo Membro'}</button></div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
