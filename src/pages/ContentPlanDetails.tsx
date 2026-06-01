import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Check, X, Edit3, Loader2, Send, 
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Target, Hash, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { contentPlanService, ContentPlan, ContentPost } from '../services/contentPlanService';
import { teamService, TeamMember } from '../services/teamService';
import { cn } from '../lib/utils';

export default function ContentPlanDetails() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clientEmail, setClientEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [reprovalComment, setReprovalComment] = useState('');
  const [showReprovalInput, setShowReprovalInput] = useState(false);
  const [showApprovedInSidebar, setShowApprovedInSidebar] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

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
        toast.error("Planejamento não encontrado");
        navigate('/clients');
        return;
      }
      setPlan(planData);
      
      const clientSnap = await getDoc(doc(db, 'clients', planData.clientId));
      if (clientSnap.exists()) {
        setClientEmail(clientSnap.data().email?.toLowerCase() || '');
      }

      const members = await teamService.getClientTeamMembers(planData.clientId);
      setTeamMembers(members);

      // Seleciona o primeiro post não aprovado por padrão
      if (!selectedPostId) {
        const firstPending = planData.posts.find(p => p.status !== 'aprovado');
        if (firstPending) {
          setSelectedPostId(firstPending.id);
        } else if (planData.posts.length > 0) {
          setSelectedPostId(planData.posts[0].id);
        }
      }

    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentEmail === 'admin@boraselect.com.br' || currentEmail === 'boranovfilms@gmail.com';
  const isClient = clientEmail === currentEmail;
  const isTeamMember = teamMembers.some(m => m.email?.toLowerCase() === currentEmail);
  const hasApprovalPower = isClient || isTeamMember;

  const selectedPost = plan?.posts.find(p => p.id === selectedPostId);
  const approvedCount = plan?.posts.filter(p => p.status === 'aprovado').length || 0;
  const reprovedCount = plan?.posts.filter(p => p.status === 'reprovado').length || 0;
  const totalPosts = plan?.posts.length || 0;
  const allApproved = totalPosts > 0 && approvedCount === totalPosts;

  const handleUpdateStatus = async (postId: string, action: 'aprovado' | 'reprovado' | 'editado', comment?: string, newText?: string) => {
    if (!planId || !plan) return;
    setSaving(true);
    try {
      const isFinished = await contentPlanService.updatePostStatus(planId, postId, action, user, comment, newText);
      await loadData();
      
      if (action === 'aprovado') {
        toast.success("Post aprovado!");
        const currentIndex = plan.posts.findIndex(p => p.id === postId);
        const nextPending = plan.posts.slice(currentIndex + 1).find(p => p.status !== 'aprovado');
        if (nextPending) {
          setTimeout(() => setSelectedPostId(nextPending.id), 300);
        }
      } else if (action === 'reprovado') {
        toast.success("Feedback enviado!");
        setShowReprovalInput(false);
        setReprovalComment('');
      } else if (action === 'editado') {
        toast.success("Edição salva!");
        setIsEditing(false);
      }

      if (isFinished) {
        setShowCompletionModal(true);
      }
    } catch (error) {
      toast.error("Erro ao atualizar status");
    } finally {
      setSaving(false);
    }
  };

  const handleSendToClient = async () => {
    if (!planId) return;
    setSaving(true);
    try {
      await contentPlanService.updateStatus(planId, 'aguardando_cliente');
      await loadData();
      toast.success("Enviado para o cliente!");
    } catch (error) {
      toast.error("Erro ao enviar");
    } finally {
      setSaving(false);
    }
  };

  const getTypeStyles = (type: string) => {
    const styles: any = {
      FEED: 'bg-blue-900/40 text-blue-400 border-blue-500/20',
      REEL: 'bg-purple-900/40 text-purple-400 border-purple-500/20',
      STORIES: 'bg-emerald-900/40 text-emerald-400 border-emerald-500/20',
      CARROSSEL: 'bg-orange-900/40 text-orange-400 border-orange-500/20',
      VIDEO: 'bg-red-900/40 text-red-400 border-red-500/20'
    };
    return styles[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
  };

  if (loading || !plan) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  const pendingPosts = plan.posts.filter(p => p.status !== 'aprovado');
  const approvedPosts = plan.posts.filter(p => p.status === 'aprovado');

  return (
    <div className="max-w-7xl mx-auto text-left relative">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-xl transition-all text-zinc-500 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">{plan.name}</h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">{plan.monthReference}</p>
          </div>
        </div>
        
        {isAdmin && plan.status === 'rascunho' && (
          <button onClick={handleSendToClient} disabled={saving} className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar para Cliente
          </button>
        )}
      </header>

      <div className="flex h-[calc(100vh-12rem)] bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <aside className="w-[280px] bg-[#0e0e0e] border-r border-zinc-800 flex flex-col shrink-0">
          <div className="p-5 border-b border-zinc-800 bg-black/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Aprovação do Lote</span>
              <span className="text-[10px] font-black text-white">{approvedCount} / {totalPosts}</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#ff5351] transition-all duration-500" style={{ width: `${(approvedCount / totalPosts) * 100}%` }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* GRUPO 1: PENDENTES E REPROVADOS */}
            {pendingPosts.map((post) => (
              <button 
                key={post.id}
                onClick={() => { setSelectedPostId(post.id); setIsEditing(false); setShowReprovalInput(false); }}
                className={cn(
                  "w-full p-5 text-left border-b border-zinc-800/50 transition-all flex items-start gap-4 relative group",
                  selectedPostId === post.id ? "bg-[#1f1f1f] border-l-4 border-l-[#ff5351]" : "hover:bg-zinc-900/50"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", 
                  post.status === 'reprovado' ? "bg-red-500" : "bg-zinc-600"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                     <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border", getTypeStyles(post.type))}>{post.type}</span>
                     <span className="text-[9px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                  </div>
                  <p className={cn("text-[11px] font-black uppercase leading-tight line-clamp-2", selectedPostId === post.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-200")}>
                    {post.headline || "Sem título"}
                  </p>
                </div>
              </button>
            ))}

            {/* SEPARADOR E GRUPO 2: APROVADOS */}
            {approvedPosts.length > 0 && (
              <div className="mt-2">
                <button 
                  onClick={() => setShowApprovedInSidebar(!showApprovedInSidebar)}
                  className="w-full p-3 flex items-center justify-between text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Check className="w-3 h-3" /> Aprovados ({approvedPosts.length})
                  </span>
                  {showApprovedInSidebar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showApprovedInSidebar && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    {approvedPosts.map((post) => (
                      <button 
                        key={post.id}
                        onClick={() => { setSelectedPostId(post.id); setIsEditing(false); setShowReprovalInput(false); }}
                        className={cn(
                          "w-full p-5 text-left border-b border-zinc-800/50 transition-all flex items-start gap-4 relative group opacity-50",
                          selectedPostId === post.id ? "bg-[#1f1f1f] border-l-4 border-l-[#ff5351] opacity-100" : "hover:bg-zinc-900/50"
                        )}
                      >
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                             <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border", getTypeStyles(post.type))}>{post.type}</span>
                             <span className="text-[9px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                          </div>
                          <p className={cn("text-[11px] font-black uppercase leading-tight line-clamp-2", selectedPostId === post.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-200")}>
                            {post.headline || "Sem título"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-[#121212] overflow-hidden">
          {selectedPost ? (
            <>
              <header className="p-6 border-b border-zinc-800 bg-black/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                   <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border", getTypeStyles(selectedPost.type))}>
                     {selectedPost.type}
                   </span>
                   <h2 className="text-white font-black uppercase tracking-widest text-sm">Post {String(selectedPost.number).padStart(2, '0')}</h2>
                   <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ml-2", 
                     selectedPost.status === 'aprovado' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                     selectedPost.status === 'reprovado' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                     selectedPost.status === 'em_revisao' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700"
                   )}>{selectedPost.status}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase">
                  <Calendar className="w-3.5 h-3.5" />
                  Data: {selectedPost.publishDate}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                <section className="space-y-3 text-left">
                  <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Headline</label>
                  <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-tight">
                    {selectedPost.headline}
                  </h3>
                </section>

                <section className="space-y-3 text-left">
                  <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Legenda</label>
                  <div 
                    contentEditable={isEditing}
                    onInput={(e) => setEditingText(e.currentTarget.innerText)}
                    className={cn(
                      "bg-[#1a1a1a] border rounded-xl p-6 text-xs text-white leading-relaxed font-medium transition-all outline-none",
                      isEditing ? "border-[#ff5351] ring-4 ring-[#ff5351]/10" : "border-zinc-800"
                    )}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {selectedPost.caption}
                  </div>
                  {isEditing && (
                    <div className="flex justify-end gap-3 mt-4">
                       <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase rounded-lg">Cancelar</button>
                       <button onClick={() => handleUpdateStatus(selectedPost.id, 'editado', undefined, editingText)} className="px-6 py-2 bg-white text-black text-[10px] font-black uppercase rounded-lg hover:bg-[#ff5351] hover:text-white transition-all">Confirmar Edição</button>
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                  <section className="space-y-3">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase flex items-center gap-2 block"><Target className="w-3 h-3" /> Chamada para Ação</label>
                    <p className="text-white font-black uppercase text-sm">{selectedPost.cta || "-"}</p>
                  </section>
                  <section className="space-y-3">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase flex items-center gap-2 block"><Hash className="w-3 h-3" /> Hashtags</label>
                    <p className="text-white font-black uppercase text-xs">{selectedPost.hashtags || "-"}</p>
                  </section>
                </div>

                {selectedPost.roteiro && (
                  <section className="space-y-3 text-left">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase flex items-center gap-2 block"><Zap className="w-3 h-3" /> Roteiro</label>
                    <div className="bg-black/30 border border-zinc-800 rounded-xl p-6 text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap italic font-medium">
                       {selectedPost.roteiro}
                    </div>
                  </section>
                )}

                {showReprovalInput && (
                  <section className="space-y-3 p-6 border-2 border-red-500/20 bg-red-500/5 rounded-2xl animate-in slide-in-from-bottom-4 text-left">
                    <label className="text-[10px] font-black text-red-500 tracking-[0.3em] uppercase block">Motivo do Ajuste</label>
                    <textarea 
                      value={reprovalComment}
                      onChange={(e) => setReprovalComment(e.target.value)}
                      placeholder="O que deve ser alterado neste post?"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-white focus:border-red-500 outline-none resize-none min-h-[100px]"
                    />
                    <div className="flex justify-end gap-3">
                       <button onClick={() => setShowReprovalInput(false)} className="px-4 py-2 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase rounded-lg">Cancelar</button>
                       <button onClick={() => handleUpdateStatus(selectedPost.id, 'reprovado', reprovalComment)} className="px-6 py-2 bg-red-500 text-white text-[10px] font-black uppercase rounded-lg">Confirmar Reprovação</button>
                    </div>
                  </section>
                )}
              </div>

              <footer className="p-6 bg-black border-t border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {hasApprovalPower && (plan.status === 'aguardando_cliente' || plan.status === 'aguardando_validacao_equipe') && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus(selectedPost.id, 'aprovado')}
                        disabled={saving}
                        className="h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Aprovar Post
                      </button>
                      <button 
                        onClick={() => { setShowReprovalInput(true); setIsEditing(false); }}
                        className="h-12 px-6 bg-zinc-800 border border-red-500/20 text-red-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" /> Reprovar
                      </button>
                      <button 
                        onClick={() => { setIsEditing(true); setEditingText(selectedPost.caption); setShowReprovalInput(false); }}
                        className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700"
                      >
                        <Edit3 className="w-4 h-4" /> Sugerir Edição
                      </button>
                    </>
                  )}
                </div>
                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                   Post {selectedPost.status}
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
            </div>
          )}
        </main>
      </div>

      {/* MODAL DE CONCLUSÃO */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCompletionModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-[20px] p-8 w-full max-w-sm animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{plan.name}</span>
              <span className="w-px h-3 bg-zinc-700" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{plan.monthReference}</span>
            </div>

            <h2 className="text-2xl font-black uppercase italic text-white text-center mb-1">Revisão Concluída</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center mb-6">Planejamento avaliado com sucesso</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#121212] border border-zinc-800 rounded-xl p-4 text-center">
                <div className="text-3xl font-black italic text-emerald-500 mb-1">
                  {plan.posts.filter(p => p.status === 'aprovado').length}
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Aprovados</div>
              </div>
              <div className="bg-[#121212] border border-zinc-800 rounded-xl p-4 text-center">
                <div className="text-3xl font-black italic text-red-400 mb-1">
                  {plan.posts.filter(p => p.status === 'reprovado').length}
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest text-red-800">Reprovados</div>
              </div>
            </div>

            <div className="w-full h-1 bg-zinc-800 rounded-full mb-6 overflow-hidden">
              <div 
                className="h-full bg-[#ff5351] rounded-full transition-all duration-1000"
                style={{ width: `${(plan.posts.filter(p => p.status === 'aprovado').length / plan.posts.length) * 100}%` }}
              />
            </div>

            {plan.posts.filter(p => p.status === 'reprovado').length > 0 ? (
              <div className="mb-6 text-center">
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[9px] font-black uppercase tracking-widest mb-3">
                  ⚠ {plan.posts.filter(p => p.status === 'reprovado').length} posts precisam de revisão
                </span>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  O redator foi notificado sobre os posts reprovados e irá realizar os ajustes. 
                  Você será notificado quando estiverem prontos.
                </p>
              </div>
            ) : (
              <div className="mb-6 text-center">
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[9px] font-black uppercase tracking-widest mb-3">
                  ✓ Aprovação total!
                </span>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Todos os posts foram aprovados! O administrador foi notificado 
                  e a produção já pode começar.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowCompletionModal(false)}
              className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
