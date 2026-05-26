import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Send, CheckCircle2, XCircle, Clock, 
  User, MessageSquare, Loader2, AlertCircle, History, Edit3
} from 'lucide-react';
import { contentPlanService, ContentPlan, ContentPlanStatus } from '../services/contentPlanService';
import { teamService, TeamMember } from '../services/teamService';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function ContentPlanDetails() {
  const { id: planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  useEffect(() => {
    if (planId) loadData();
  }, [planId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await contentPlanService.getPlanById(planId!);
      if (data) {
        setPlan(data);
        setText(data.currentText);
        
        // Busca equipe do cliente para calcular validações pendentes
        const team = await teamService.getClientTeamMembers(data.clientId);
        setTeamMembers(team);
      }
    } catch (error) {
      toast.error('Erro ao carregar planejamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveText = async () => {
    if (!planId || !auth.currentUser) return;
    setSaving(true);
    try {
      await contentPlanService.updatePlanText(planId, text, auth.currentUser);
      toast.success('Alterações salvas no histórico!');
      loadData();
    } catch (error) {
      toast.error('Erro ao salvar texto.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus: ContentPlanStatus, reason?: string) => {
    setSaving(true);
    try {
      await contentPlanService.updateStatus(planId!, newStatus, reason);
      toast.success('Status atualizado!');
      setShowRejectionForm(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!auth.currentUser?.email) return;
    setSaving(true);
    try {
      await contentPlanService.validateByMember(planId!, auth.currentUser.email);
      
      // Verifica se todos os membros da equipe já validaram
      const updatedPlan = await contentPlanService.getPlanById(planId!);
      const validatedCount = updatedPlan?.validations.length || 0;
      const totalTeamCount = teamMembers.length;

      if (validatedCount >= totalTeamCount && totalTeamCount > 0) {
        await contentPlanService.updateStatus(planId!, 'aprovado');
        toast.success('Texto aprovado por toda a equipe!');
      } else {
        toast.success('Sua validação foi registrada!');
      }
      loadData();
    } catch (error) {
      toast.error('Erro ao validar.');
    } finally {
      setSaving(false);
    }
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;
  if (!plan) return <div className="p-8 text-center text-white">Planejamento não encontrado.</div>;

  const isAdmin = auth.currentUser?.email === 'boranovfilms@gmail.com';
  const isClientOwner = auth.currentUser?.email === plan.clientId; // Simplificação para o dono
  const isTeamMember = teamMembers.some(m => m.email === auth.currentUser?.email);

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" /> Voltar para o Cliente
          </button>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-2">Planejamento de Conteúdo</p>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">{plan.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{plan.monthReference}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {plan.status === 'rascunho' && isAdmin && (
            <button onClick={() => handleUpdateStatus('aguardando_cliente')} className="h-12 px-6 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 flex items-center gap-2 shadow-xl shadow-[#ff5351]/20">
              <Send className="w-4 h-4" /> Enviar para o Cliente
            </button>
          )}

          {plan.status === 'aguardando_cliente' && (
            <>
              <button onClick={() => handleUpdateStatus('aguardando_validacao_equipe')} className="h-12 px-6 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 flex items-center gap-2 shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" /> Aprovar e Enviar p/ Equipe
              </button>
              <button onClick={() => setShowRejectionForm(true)} className="h-12 px-6 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 flex items-center gap-2 shadow-xl shadow-red-500/20">
                <XCircle className="w-4 h-4" /> Não Aprovar
              </button>
            </>
          )}

          {plan.status === 'aguardando_validacao_equipe' && isTeamMember && !plan.validations.includes(auth.currentUser?.email || '') && (
            <button onClick={handleValidate} className="h-12 px-6 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 flex items-center gap-2 shadow-xl shadow-blue-500/20">
              <BadgeCheck className="w-4 h-4" /> Validar Texto
            </button>
          )}
        </div>
      </header>

      {/* ÁREA DE EDIÇÃO DO TEXTO */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] p-8 shadow-2xl relative">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-xl font-black text-white uppercase flex items-center gap-2 italic">
                 <Edit3 className="w-5 h-5 text-[#ff5351]" /> Conteúdo do Planejamento
               </h3>
               <button onClick={handleSaveText} disabled={saving} className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-[#ff5351] text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                 {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 text-[#ff5351]" />} Salvar Versão
               </button>
            </div>
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)}
              className="w-full min-h-[600px] bg-transparent text-zinc-300 text-base leading-relaxed outline-none resize-none scrollbar-thin"
              placeholder="Digite ou cole aqui o seu texto..."
            />
          </div>
        </div>

        {/* BARRA LATERAL: STATUS E HISTÓRICO */}
        <div className="space-y-6">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" /> Informações de Fluxo</h4>
            <div className="space-y-4">
              <div className="p-4 bg-black/20 rounded-2xl border border-zinc-800">
                <p className="text-[9px] uppercase font-black text-zinc-600 mb-1">Status Atual</p>
                <p className="text-white font-black uppercase text-sm tracking-tight italic">{plan.status.replace(/_/g, ' ')}</p>
              </div>
              
              {plan.status === 'aguardando_validacao_equipe' && (
                <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                  <p className="text-[9px] uppercase font-black text-blue-400 mb-2">Progresso da Validação</p>
                  <div className="flex items-center justify-between text-white font-black text-lg">
                    <span>{plan.validations.length} de {teamMembers.length}</span>
                    <span className="text-xs text-blue-400 uppercase tracking-widest">Validaram</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(plan.validations.length / teamMembers.length) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2"><History className="w-3.5 h-3.5" /> Histórico de Alterações</h4>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {plan.history.length === 0 ? (
                <p className="text-zinc-600 text-[10px] uppercase font-bold italic text-center py-4">Nenhuma alteração registrada.</p>
              ) : (
                [...plan.history].reverse().map((item, idx) => (
                  <div key={idx} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-[#ff5351] uppercase tracking-widest">{item.userName}</span>
                      <span className="text-[9px] font-mono text-zinc-600 uppercase font-black">{formatFullDate(item.date)}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-3 italic">Versão salva por este autor.</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MODAL DE REJEIÇÃO */}
      {showRejectionForm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRejectionForm(false)} />
          <div className="relative w-full max-w-lg bg-[#151515] rounded-[32px] border border-zinc-800 shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white uppercase italic mb-2">Motivo da Rejeição</h3>
            <p className="text-zinc-500 text-sm mb-6">Explique o que precisa ser ajustado no texto para a redatora.</p>
            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={5} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white focus:border-red-500 outline-none resize-none mb-6" placeholder="Ex: O tom de voz não está alinhado com a marca..." />
            <div className="flex gap-4">
              <button onClick={() => setShowRejectionForm(false)} className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-900 rounded-xl border border-zinc-800">Cancelar</button>
              <button onClick={() => handleUpdateStatus('devolvido', rejectionReason)} className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest text-white bg-red-500 rounded-xl hover:bg-red-600 shadow-xl shadow-red-500/20">Enviar Devolução</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { BadgeCheck } from 'lucide-react';
