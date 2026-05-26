import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, X, Loader2, AlertCircle, Calendar, ChevronDown, User, Tag, Check
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { contentPlanService } from '../services/contentPlanService';
import { teamService, TeamMember } from '../services/teamService';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function NewContentPlan() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clientName, setClientName] = useState('');

  // Estados para os Dropdowns Customizados
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const monthOptions = months.map(m => `${m} ${currentYear}`);

  const [form, setForm] = useState({ 
    name: '', 
    monthReference: `${months[new Date().getMonth()]} ${currentYear}`,
    text: '',
    status: 'rascunho',
    assignee: '',
    priority: 'media',
    tags: ''
  });

  useEffect(() => {
    if (clientId) loadInitialData();
  }, [clientId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const clientRef = doc(db, 'clients', clientId!);
      const [clientSnap, teamData] = await Promise.all([
        getDoc(clientRef),
        teamService.getTeamMembers().catch(() => [])
      ]);
      
      if (clientSnap.exists()) {
        setClientName(clientSnap.data().name);
      }
      
      setTeamMembers(teamData);
      if (teamData.length > 0) {
        setForm(prev => ({ ...prev, assignee: teamData[0].name }));
      }
    } catch (error) {
      toast.error('Erro ao carregar dados iniciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('O nome da campanha é obrigatório.');
    
    setSaving(true);
    try {
      await contentPlanService.createPlan({
        clientId: clientId!,
        name: form.name,
        monthReference: form.monthReference,
        currentText: form.text,
        status: form.status as any,
        assignee: form.assignee,
        priority: form.priority,
        tags: form.tags
      } as any);
      
      toast.success('Planejamento salvo com sucesso!');
      navigate(`/clients/${clientId}`);
    } catch (error) {
      toast.error('Erro ao salvar planejamento.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <header className="mb-4 shrink-0">
        <button 
          onClick={() => navigate(`/clients/${clientId}`)} 
          className="mb-3 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3" /> Voltar para o Cliente
        </button>
        <div className="flex flex-col gap-0.5">
          <p className="text-[8px] uppercase tracking-[0.4em] text-[#ff5351] font-black">
            Criação de Conteúdo • {clientName}
          </p>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">
            Novo Planejamento
          </h1>
        </div>
      </header>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-10 gap-6 flex-1 min-h-0">
        
        {/* COLUNA ESQUERDA: CONTEÚDO (65%) */}
        <div className="lg:col-span-6 flex flex-col gap-6 min-h-0">
          <section className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] p-6 shadow-2xl space-y-4 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="space-y-1.5 shrink-0">
              <label className="text-[8px] font-black uppercase tracking-[0.2em] text-[#ff5351] ml-1">
                Nome da Campanha / Planejamento
              </label>
              <input 
                required 
                type="text" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="Ex: Campanha de Lançamento" 
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-5 text-base font-black text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-800 shadow-inner" 
              />
            </div>

            <div className="space-y-1.5 relative shrink-0">
              <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Mês de Referência
              </label>
              <button 
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'month' ? null : 'month')}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 flex items-center justify-between group hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-3.5 h-3.5 text-[#ff5351]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{form.monthReference}</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-transform", openDropdown === 'month' && "rotate-180")} />
              </button>
              {openDropdown === 'month' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1f1f1f] border border-zinc-800 rounded-xl shadow-2xl z-[100] p-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
                  {monthOptions.map(opt => (
                    <button key={opt} type="button" onClick={() => { setForm({...form, monthReference: opt}); setOpenDropdown(null); }} className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#ff5351]/10 rounded-lg group transition-colors">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">{opt}</span>
                      {form.monthReference === opt && <Check className="w-3 h-3 text-[#ff5351]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
              <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1 shrink-0">
                Texto do Planejamento
              </label>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-inner flex-1">
                <textarea 
                  required 
                  value={form.text} 
                  onChange={e => setForm({...form, text: e.target.value})} 
                  className="w-full h-full bg-transparent p-5 text-sm text-zinc-300 focus:outline-none resize-none scrollbar-thin leading-relaxed" 
                  placeholder="Cole aqui o texto completo criado pela redatora..." 
                />
              </div>
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA: DETALHES (35%) - FIXA NO TOPO */}
        <div className="lg:col-span-4 min-h-0">
          <section className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] p-5 shadow-2xl flex flex-col h-fit sticky top-0">
            <h3 className="text-[9px] font-black text-white uppercase tracking-[0.2em] border-b border-zinc-800 pb-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-[#ff5351]" /> Detalhes
            </h3>

            <div className="space-y-3.5">
              {/* STATUS */}
              <div className="space-y-1 relative">
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1">Status Atual</label>
                <button 
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-lg px-4 flex items-center justify-between group hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", form.status === 'rascunho' ? "bg-zinc-500" : "bg-[#ff5351]")} />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{form.status === 'rascunho' ? 'Rascunho' : 'Aguardando Cliente'}</span>
                  </div>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-transform", openDropdown === 'status' && "rotate-180")} />
                </button>
                {openDropdown === 'status' && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1f1f1f] border border-zinc-800 rounded-xl shadow-2xl z-[100] p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {[
                      { id: 'rascunho', label: 'Rascunho', color: 'bg-zinc-500' },
                      { id: 'aguardando_cliente', label: 'Aguardando Cliente', color: 'bg-[#ff5351]' }
                    ].map(opt => (
                      <button key={opt.id} type="button" onClick={() => { setForm({...form, status: opt.id}); setOpenDropdown(null); }} className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#ff5351]/10 rounded-lg group transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-1 h-1 rounded-full", opt.color)} />
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">{opt.label}</span>
                        </div>
                        {form.status === opt.id && <Check className="w-3 h-3 text-[#ff5351]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* RESPONSÁVEL */}
              <div className="space-y-1 relative">
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1">Responsável</label>
                <button 
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-lg px-4 flex items-center justify-between group hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#ff5351]" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest truncate">{form.assignee || 'Selecionar...'}</span>
                  </div>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-transform", openDropdown === 'assignee' && "rotate-180")} />
                </button>
                {openDropdown === 'assignee' && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1f1f1f] border border-zinc-800 rounded-xl shadow-2xl z-[100] p-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
                    {teamMembers.map(m => (
                      <button key={m.id} type="button" onClick={() => { setForm({...form, assignee: m.name}); setOpenDropdown(null); }} className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#ff5351]/10 rounded-lg group transition-colors text-left text-[8px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">
                        <span className="truncate">{m.name}</span>
                        {form.assignee === m.name && <Check className="w-3 h-3 text-[#ff5351]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PRIORIDADE */}
              <div className="space-y-1 relative">
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1">Prioridade</label>
                <button 
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-lg px-4 flex items-center justify-between group hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", form.priority === 'alta' ? 'bg-[#ff5351]' : form.priority === 'media' ? 'bg-amber-500' : 'bg-emerald-500')} />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{form.priority}</span>
                  </div>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-transform", openDropdown === 'priority' && "rotate-180")} />
                </button>
                {openDropdown === 'priority' && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1f1f1f] border border-zinc-800 rounded-xl shadow-2xl z-[100] p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {['baixa', 'media', 'alta'].map(p => (
                      <button key={p} type="button" onClick={() => { setForm({...form, priority: p}); setOpenDropdown(null); }} className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#ff5351]/10 rounded-lg group transition-colors">
                        <span className={cn("text-[8px] font-black uppercase tracking-widest", p === 'alta' ? 'text-red-500' : 'text-zinc-400')}>
                          {p}
                        </span>
                        {form.priority === p && <Check className="w-3 h-3 text-[#ff5351]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ETIQUETAS */}
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-2"><Tag className="w-3 h-3" /> Etiquetas (Tags)</label>
                <input 
                  type="text" 
                  value={form.tags} 
                  onChange={e => setForm({...form, tags: e.target.value})} 
                  placeholder="Marketing, Reels..." 
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-[9px] font-bold text-white focus:border-[#ff5351] outline-none placeholder:text-zinc-800" 
                />
              </div>
            </div>

            <div className="pt-6 space-y-2.5 border-t border-zinc-800 mt-2">
              <button 
                type="submit" 
                disabled={saving} 
                className="w-full h-12 bg-[#ff5351] text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:brightness-110 flex items-center justify-center gap-3 shadow-2xl shadow-[#ff5351]/30 transition-all active:scale-95 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Planejamento
              </button>
              
              <button 
                type="button" 
                onClick={() => navigate(`/clients/${clientId}`)}
                className="w-full h-9 text-[8px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <X className="w-3 h-3" /> Cancelar Operação
              </button>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
