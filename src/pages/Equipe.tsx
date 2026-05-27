export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { 
  X, Copy, UserPlus, Mail, Trash2, ExternalLink, Edit2, 
  Camera, User, Briefcase, Lock, Phone, Upload, ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { teamService, TeamMember } from '../services/teamService';
import { toast } from 'react-hot-toast';
import { emailService } from '../services/emailService';
import { DataTable } from '../components/ui/DataTable';

// MAPEAMENTO CRÍTICO: Converte o texto do select para o ID usado na Matriz
const ROLE_ID_MAP: Record<string, string> = {
  "Diretor": "master",
  "Produtor": "editor",
  "Editor de Vídeo": "editor",
  "Designer": "designer",
  "Fotógrafo": "editor",
  "Redator": "redator",
  "Mídia Social": "midia_social",
  "Administrativo": "master",
  "Financeiro": "master",
  "Comercial": "master"
};

export default function EquipeAccess() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  
  const [memberForm, setMemberForm] = useState({ 
    firstName: '', lastName: '', email: '', phone: '', 
    password: '', jobTitle: '', role: '', accessLevel: 'editor', photoUrl: '' 
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await teamService.getTeamMembers();
      setMembers(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setMemberForm({ 
      firstName: '', lastName: '', email: '', phone: '', 
      password: '', jobTitle: '', role: '', accessLevel: 'editor', photoUrl: '' 
    });
    setIsEditing(false);
    setSelectedMemberId(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (member: TeamMember) => {
    const names = (member.name || '').split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ');

    setMemberForm({
      firstName,
      lastName,
      email: member.email,
      phone: member.phone || '',
      password: '',
      jobTitle: member.jobTitle || '',
      role: member.role || '',
      accessLevel: (member as any).accessLevel || 'editor',
      photoUrl: (member as any).photoUrl || ''
    });
    setIsEditing(true);
    setSelectedMemberId(member.id!);
    setIsAdding(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.firstName || !memberForm.email || !memberForm.role) {
      toast.error('Preencha os campos obrigatórios (Nome, E-mail e Função)');
      return;
    }

    try {
      setLoading(true);
      const fullName = `${memberForm.firstName} ${memberForm.lastName}`.trim();
      
      // Converte o nome selecionado para o ID que o App.tsx e a Matriz entendem
      const internalRole = ROLE_ID_MAP[memberForm.role] || 'cliente';

      const normalizedMember = {
        name: fullName,
        email: memberForm.email.toLowerCase().trim(),
        phone: memberForm.phone,
        role: internalRole, // SALVA O ID (ex: 'editor') EM VEZ DO TEXTO (ex: 'Editor de Vídeo')
        jobTitle: memberForm.jobTitle,
        accessLevel: memberForm.accessLevel,
        status: 'pending'
      };
      
      if (isEditing && selectedMemberId) {
        await teamService.updateTeamMember(selectedMemberId, normalizedMember);
        toast.success('Membro atualizado!');
      } else {
        await teamService.createTeamMember(normalizedMember as any);
        await emailService.sendInvite(normalizedMember.email, normalizedMember.name, `${window.location.origin}/register?email=${encodeURIComponent(normalizedMember.email)}`);
        toast.success('Membro cadastrado!');
      }

      setIsAdding(false);
      loadMembers();
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (id: string, email: string) => {
    if (window.confirm('Excluir membro permanentemente?')) {
      try {
        setLoading(true);
        try { await teamService.deleteTeamMemberAuth(email); } catch (e) {}
        await teamService.deleteTeamMember(id);
        toast.success('Removido!');
        await loadMembers();
      } catch (error) { toast.error('Erro ao remover'); } finally { setLoading(false); }
    }
  };

  const sendEmailInvite = async (name: string, email: string) => {
    try {
      setSendingEmail(email);
      await emailService.sendInvite(email, name, `${window.location.origin}/register?email=${encodeURIComponent(email)}`);
      toast.success('Convite reenviado!');
    } catch (error) {} finally { setSendingEmail(null); }
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">Gestão de Equipe</h1>
          <p className="text-zinc-500 text-lg">Gerencie convites, papéis e níveis de acesso da sua equipe.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={isAdding ? () => setIsAdding(false) : handleOpenAdd} className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all text-xs uppercase tracking-widest shadow-xl shadow-[#ff5351]/20">
            {isAdding ? <X className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {isAdding ? 'Cancelar' : 'Adicionar Membro'}
          </button>
        </div>
      </header>

      {isAdding && (
        <form autoComplete="off" onSubmit={handleSaveMember} className="space-y-6 animate-in slide-in-from-top-4 duration-300">
          <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl text-left">
            <div className="flex items-center gap-3 mb-6"><Camera className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white">Foto de Perfil</h3></div>
            <div className="flex items-center gap-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl">
              <div className="w-24 h-24 rounded-2xl bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center text-zinc-500 relative group overflow-hidden"><User className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" /><div className="absolute bottom-2 right-2 w-6 h-6 bg-[#ff5351] rounded-full flex items-center justify-center shadow-lg"><Upload className="w-3 h-3 text-white" /></div></div>
              <div><p className="text-sm font-bold text-white mb-1">Carregar uma foto</p><p className="text-xs text-zinc-500 mb-4">Máx. 2MB</p><button type="button" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase rounded-lg border border-zinc-700">Selecionar Arquivo</button></div>
            </div>
          </section>

          <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl text-left">
            <div className="flex items-center gap-3 mb-6"><User className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white">Informações Pessoais</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">NOME</label><input type="text" value={memberForm.firstName} onChange={e => setMemberForm({...memberForm, firstName: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm"/></div>
              <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">SOBRENOME</label><input type="text" value={memberForm.lastName} onChange={e => setMemberForm({...memberForm, lastName: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm"/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">E-MAIL</label><div className="relative"><input type="email" value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} disabled={isEditing} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-white focus:border-[#ff5351] outline-none text-sm disabled:opacity-50"/><Mail className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
              <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">TELEFONE</label><div className="relative"><input type="text" value={memberForm.phone} onChange={e => setMemberForm({...memberForm, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-white focus:border-[#ff5351] outline-none text-sm"/><Phone className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" /></div></div>
            </div>
          </section>

          <section className="bg-[#1f1f1f] border border-zinc-800/80 rounded-3xl p-6 shadow-xl mb-6 text-left">
            <div className="flex items-center gap-3 mb-6"><Briefcase className="w-5 h-5 text-[#ff5351]" /><h3 className="text-lg font-bold text-white">Informações Profissionais</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">CARGO</label><input type="text" value={memberForm.jobTitle} onChange={e => setMemberForm({...memberForm, jobTitle: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm"/></div>
              <div className="space-y-2">
                {/* TESTE: LABEL EM VERMELHO CONFORME SOLICITADO */}
                <label className="text-[10px] uppercase font-black tracking-widest text-[#ff5351] ml-1 italic">Função do Usuário</label>
                <div className="relative">
                  <select value={memberForm.role} onChange={e => setMemberForm({...memberForm, role: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white focus:border-[#ff5351] outline-none text-sm appearance-none">
                    <option value="" disabled>Selecione uma função</option>
                    {Object.keys(ROLE_ID_MAP).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading} className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#ff5351] hover:text-white transition-all shadow-xl disabled:opacity-50">
              {loading ? 'Salvando...' : isEditing ? 'Atualizar Membro' : 'Salvar Novo Membro'}
            </button>
          </div>
        </form>
      )}

      {!isAdding && (
        <DataTable 
          data={members} loading={loading} emptyMessage="Nenhum membro cadastrado."
          columns={[
            { header: 'Membro', accessor: (m) => <div className="text-left"><div className="text-white font-bold text-base">{m.name}</div><div className="text-zinc-500 text-xs">{m.email}</div></div> },
            { header: 'Função', accessor: (m) => <span className="inline-flex px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-black uppercase">{m.role}</span> },
            { header: 'Status', accessor: (m) => <span className={cn("inline-flex items-center gap-2 px-3 py-1 border rounded-full text-[10px] font-black uppercase", m.status === 'confirmed' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10")}><div className={cn("w-1.5 h-1.5 rounded-full", m.status === 'confirmed' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]")} />{m.status === 'confirmed' ? '✓ ATIVO' : '⏳ CONVIDADO'}</span> }
          ]}
          actions={(m) => (
            <>
              <button onClick={() => handleOpenEdit(m)} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => sendEmailInvite(m.name, m.email)} disabled={sendingEmail === m.email} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-[#ff5351] hover:border-transparent rounded-xl text-zinc-300 hover:text-white transition-all"><Mail className="w-4 h-4" /></button>
              <button onClick={() => handleDeleteMember(m.id!, m.email)} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        />
      )}
    </div>
  );
}
