import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Check, X, Edit3, MessageSquare, 
  ChevronDown, ChevronUp, Loader2, Send, History as HistoryIcon,
  LayoutGrid, User, Clock, AlertCircle, CheckCircle2, RotateCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { contentPlanService, ContentPlan, ContentPost } from '../services/contentPlanService';
import { teamService, TeamMember } from '../services/teamService';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Tab = 'posts' | 'history';

export default function ContentPlanDetails() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  const [expandedRoteiros, setExpandedRoteiros] = useState<Set<string>>(new Set());
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [rejectionComments, setRejectionComments] = useState<Record<string, string>>({});
  const [showRejectionInput, setShowRejectionInput] = useState<Set<string>>(new Set());

  const user = auth.currentUser;
  const currentEmail = user?.email?.toLowerCase();

  useEffect(() => {
    loadData();
  }, [planId]);

  const loadData = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const planData = await contentPlanService.getPlanById(planId);
      if (!planData) {
        toast.error('Planejamento não encontrado');
        navigate('/clients');
        return;
      }
      setPlan(planData);

      // Buscar email do cliente
      const clientSnap = await getDoc(doc(db, 'clients', planData.clientId));
      if (clientSnap.exists()) {
        setClientEmail(clientSnap.data().email?.toLowerCase() || '');
      }

      // Buscar membros da equipe
      const members = await teamService.getClientTeamMembers(planData.clientId);
      setTeamMembers(members);

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentEmail === 'admin@boraselect.com.br' || currentEmail === 'boranovfilms@gmail.com';
  const isClient = clientEmail === currentEmail;
  const isTeamMember = teamMembers.some(m => m.email?.toLowerCase() === currentEmail);
  const hasApprovalPower = isClient || isTeamMember;

  const handleUpdateStatus = async (postId: string, action: 'aprovado' | 'reprovado' | 'editado', comment?: string, newText?: string) => {
    if (!planId || !plan) return;
    setSaving(true);
    try {
      const allApproved = await contentPlanService.updatePostStatus(
        planId, 
        postId, 
        action, 
        user, 
        comment, 
        newText
      );
      
      await loadData();
      
      if (action === 'aprovado') toast.success('Post aprovado!');
      if (action === 'reprovado') {
        toast.success('Feedback enviado!');
        const nextRejection = new Set(showRejectionInput);
        nextRejection.delete(postId);
        setShowRejectionInput(nextRejection);
      }
      if (action === 'editado') {
        toast.success('Edição sugerida com sucesso!');
        setEditingPostId(null);
      }

      if (allApproved) {
        toast.success('Todos os posts aprovados! Planejamento concluído. 🎉', { duration: 5000 });
      }
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  };

  const handleGlobalStatusUpdate = async (status: any) => {
    if (!planId) return;
    setSaving(true);
    try {
      await contentPlanService.updateStatus(planId, status);
      await loadData();
      toast.success('Status do planejamento atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: any = {
      FEED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      REEL: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      STORIES: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      CARROSSEL: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      VIDEO: 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return colors[type] || 'bg-zinc-800 text-zinc-400';
  };

  const getPostStatusBadge = (status: string) => {
    const configs: any = {
      pendente: { label: 'Pendente', class: 'bg-zinc-800 text-zinc-500 border-zinc-700' },
      aprovado: { label: 'Aprovado', class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
      reprovado: { label: 'Reprovado', class: 'bg-red-500/10 text-red-500 border-red-500/20' },
      em_revisao: { label: 'Em Revisão', class: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    };
    const config = configs[status] || configs.pendente;
    return <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", config.class)}>{config.label}</span>;
  };

  if (loading || !plan) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-4 flex-1">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest leading-none">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
               <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">{plan.name}</h1>
               <span className={cn("px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest", 
                 plan.status === 'aprovado' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                 plan.status === 'rascunho' ? "bg-zinc-800 text-zinc-400 border-zinc-700" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
               )}>{plan.status.replace('_', ' ')}</span>
            </div>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">{plan.monthReference}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && plan.status === 'rascunho' && (
            <button onClick={() => handleGlobalStatusUpdate('aguardando_cliente')} className="h-12 px-6 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-[#ff5351]/20">
              <Send className="w-4 h-4" /> Enviar para Cliente
            </button>
          )}
          {isAdmin && plan.status === 'aprovado' && (
            <button onClick={() => toast.success('Em breve! 🚀')} className="h-12 px-6 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-xl">
              <LayoutGrid className="w-4 h-4" /> Criar Mini Tarefas
            </button>
          )}
        </div>
      </header>

      {/* TABS */}
      <div className="flex gap-4 border-b border-zinc-900">
        <button onClick={() => setActiveTab('posts')} className={cn("px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'posts' ? "border-[#ff5351] text-white" : "border-transparent text-zinc-600 hover:text-zinc-400")}>
          Posts ({plan.posts?.length || 0})
        </button>
        <button onClick={() => setActiveTab('history')} className={cn("px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'history' ? "border-[#ff5351] text-white" : "border-transparent text-zinc-600 hover:text-zinc-400")}>
          Histórico de Ações
        </button>
      </div>

      {activeTab === 'posts' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
          {plan.posts?.map(post => (
            <div key={post.id} className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] overflow-hidden flex flex-col shadow-2xl hover:border-zinc-700 transition-all">
              <header className="p-6 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-black text-white">
                    {String(post.number).padStart(2, '0')}
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border", getTypeColor(post.type))}>
                    {post.type}
                  </span>
                </div>
                {getPostStatusBadge(post.status)}
              </header>

              <div className="p-6 space-y-5 flex-1">
                <div>
                   <p className="text-[#ff5351] text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {post.publishDate}</p>
                   <h3 className="text-xl font-black text-white uppercase italic leading-tight">{post.headline}</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Legenda</p>
                    {hasApprovalPower && (plan.status === 'aguardando_cliente' || plan.status === 'aguardando_validacao_equipe') && editingPostId !== post.id && (
                      <button onClick={() => { setEditingPostId(post.id); setEditingText(post.caption); }} className="text-[#ff5351] hover:underline text-[9px] font-black uppercase tracking-widest">Editar</button>
                    )}
                  </div>
                  {editingPostId === post.id ? (
                    <div className="space-y-3 animate-in zoom-in-95 duration-200">
                      <textarea value={editingText} onChange={e => setEditingText(e.target.value)} className="w-full bg-zinc-900 border border-[#ff5351]/50 rounded-2xl p-4 text-xs text-white focus:border-[#ff5351] outline-none min-h-[120px] resize-none font-medium" />
                      <div className="flex gap-2">
                         <button onClick={() => setEditingPostId(null)} className="flex-1 h-10 bg-zinc-800 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest">Cancelar</button>
                         <button onClick={() => handleUpdateStatus(post.id, 'editado', undefined, editingText)} className="flex-1 h-10 bg-white text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#ff5351] hover:text-white transition-all">Confirmar Edição</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-zinc-300 text-xs leading-relaxed font-medium whitespace-pre-wrap">{post.caption}</p>
                  )}
                </div>

                {post.cta && (
                  <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                    <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Chamada para Ação (CTA)</p>
                    <p className="text-white text-[10px] font-bold uppercase">{post.cta}</p>
                  </div>
                )}

                {post.hashtags && <p className="text-zinc-600 text-[10px] italic font-medium">{post.hashtags}</p>}

                {post.roteiro && (
                  <div className="pt-4 border-t border-zinc-800/50">
                    <button onClick={() => { const n = new Set(expandedRoteiros); if(n.has(post.id)) n.delete(post.id); else n.add(post.id); setExpandedRoteiros(n); }} className="flex items-center justify-between w-full text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">Roteiro do Conteúdo {expandedRoteiros.has(post.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>
                    {expandedRoteiros.has(post.id) && <div className="mt-3 p-4 bg-black/30 rounded-2xl text-[10px] text-zinc-400 leading-relaxed font-medium whitespace-pre-wrap border border-zinc-800/30 animate-in slide-in-from-top-2">{post.roteiro}</div>}
                  </div>
                )}

                {/* HISTÓRICO LOCAL DO POST */}
                {post.approvals && post.approvals.length > 0 && (
                  <div className="pt-4 border-t border-zinc-800/50 space-y-2">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Atividade Recente</p>
                    {post.approvals.slice(-2).reverse().map((ap, i) => (
                      <div key={i} className="flex items-start gap-2 text-[9px]">
                        {ap.action === 'aprovado' ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : ap.action === 'reprovado' ? <AlertCircle className="w-3 h-3 text-red-500 shrink-0" /> : <Edit3 className="w-3 h-3 text-amber-500 shrink-0" />}
                        <p className="text-zinc-500 leading-tight"><span className="text-zinc-400 font-bold">{ap.userName}</span> {ap.action} em {format(new Date(ap.date), 'dd/MM HH:mm')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AÇÕES DE APROVAÇÃO */}
              {hasApprovalPower && (plan.status === 'aguardando_cliente' || plan.status === 'aguardando_validacao_equipe') && (
                <footer className="p-4 bg-zinc-900/30 border-t border-zinc-800/50 flex flex-col gap-3">
                  {showRejectionInput.has(post.id) ? (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2">
                      <textarea value={rejectionComments[post.id] || ''} onChange={e => setRejectionComments({...rejectionComments, [post.id]: e.target.value})} placeholder="Por que este post deve ser alterado?" className="w-full bg-zinc-900 border border-red-500/30 rounded-xl p-3 text-[10px] text-white outline-none min-h-[80px]" />
                      <div className="flex gap-2">
                        <button onClick={() => { const n = new Set(showRejectionInput); n.delete(post.id); setShowRejectionInput(n); }} className="flex-1 h-9 bg-zinc-800 text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest">Cancelar</button>
                        <button onClick={() => handleUpdateStatus(post.id, 'reprovado', rejectionComments[post.id])} className="flex-1 h-9 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">Enviar Feedback</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateStatus(post.id, 'aprovado')} className="flex-1 h-12 bg-zinc-800 border border-zinc-700 hover:bg-emerald-500 hover:border-transparent rounded-2xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2"><Check className="w-3.5 h-3.5" /> Aprovar</button>
                      <button onClick={() => { const n = new Set(showRejectionInput); n.add(post.id); setShowRejectionInput(n); }} className="flex-1 h-12 bg-zinc-800 border border-zinc-700 hover:bg-red-500 hover:border-transparent rounded-2xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2"><X className="w-3.5 h-3.5" /> Ajustar</button>
                    </div>
                  )}
                </footer>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl animate-in fade-in duration-500">
           {plan.history?.length === 0 ? (
             <div className="p-12 text-center border-2 border-dashed border-zinc-900 rounded-[32px] text-zinc-600 font-bold uppercase tracking-widest text-xs">Nenhuma atividade registrada ainda</div>
           ) : (
             <div className="space-y-4">
               {[...(plan.history || [])].reverse().map((item, i) => (
                 <div key={i} className="bg-[#1a1a1a] border border-zinc-800/50 rounded-2xl p-6 flex gap-5">
                   <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 shrink-0">
                     {item.action === 'edicao' ? <Edit3 className="w-5 h-5 text-amber-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                   </div>
                   <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-black uppercase text-sm">{item.userName}</p>
                        <span className="text-[10px] font-mono text-zinc-600">{format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                      <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{item.action === 'edicao' ? 'Realizou uma edição no texto' : 'Validou o planejamento'}</p>
                      {item.textBefore && (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <p className="text-[8px] font-black text-red-500/50 uppercase tracking-widest">Antes</p>
                             <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-[10px] text-zinc-500 italic line-through line-clamp-4">{item.textBefore}</div>
                           </div>
                           <div className="space-y-2">
                             <p className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">Depois</p>
                             <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[10px] text-zinc-300 font-medium line-clamp-4">{item.textAfter}</div>
                           </div>
                        </div>
                      )}
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}
    </div>
  );
}
