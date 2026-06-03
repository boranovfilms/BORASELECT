import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Check, X, Edit3, Loader2, Send, 
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Target, Hash, Zap, RotateCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
  const [userRole, setUserRole] = useState('cliente');
  
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCaption, setEditingCaption] = useState('');
  const [editingCta, setEditingCta] = useState('');
  const [editingHashtags, setEditingHashtags] = useState('');
  const [editingSlides, setEditingSlides] = useState<{title:string;description:string}[]>([]);
  const [editorComment, setEditorComment] = useState('');
  const [reprovalComment, setReprovalComment] = useState('');
  const [showReprovalInput, setShowReprovalInput] = useState(false);
  const [showApprovedInSidebar, setShowApprovedInSidebar] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showReprovalModal, setShowReprovalModal] = useState(false);
  const [reprovalType, setReprovalType] = useState<'correcao' | 'descartar' | null>(null);
  const [completionMode, setCompletionMode] = useState<'cliente' | 'equipe'>('cliente');

  const user = auth.currentUser;
  const currentEmail = user?.email?.toLowerCase();

  const isAdmin = currentEmail === 'admin@boraselect.com.br' || currentEmail === 'boranovfilms@gmail.com';
  const isClient = clientEmail === currentEmail;
  const isTeamMember = teamMembers.some(m => m.email?.toLowerCase() === currentEmail);
  const isEquipe = userRole === 'equipe';
  const internalRoles = ['master', 'admin', 'redator', 'editor'];
  const isInternal = internalRoles.includes(userRole);
  const hasApprovalPower = isClient || isTeamMember;

  useEffect(() => {
    loadData();
    loadUserRole();
  }, [planId]);

  const loadUserRole = async () => {
    if (!currentEmail) return;
    try {
      const q = query(collection(db, 'clients'), where('email', '==', currentEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const role = snap.docs[0].data().role || 'cliente';
        setUserRole(role);
      }
    } catch (e) {
      console.warn('Erro ao carregar role:', e);
    }
  };

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

      if (!selectedPostId) {
        if (isEquipe) {
          const firstApproved = planData.posts.find(p => p.status === 'aprovado');
          if (firstApproved) setSelectedPostId(firstApproved.id);
        } else if (isInternal && planData.status === 'devolvido') {
          const firstReprovado = planData.posts.find(p => p.status === 'reprovado' || p.status === 'em_revisao');
          if (firstReprovado) setSelectedPostId(firstReprovado.id);
        } else {
          const firstPending = planData.posts.find(p => 
            p.status !== 'aprovado' && p.status !== 'reprovado' && p.status !== 'descartado'
          );
          if (firstPending) {
            setSelectedPostId(firstPending.id);
          } else if (planData.posts.length > 0) {
            setSelectedPostId(planData.posts[0].id);
          }
        }
      }

    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const selectedPost = plan?.posts.find(p => p.id === selectedPostId);
  const approvedCount = plan?.posts.filter(p => p.status === 'aprovado').length || 0;
  const reprovedCount = plan?.posts.filter(p => p.status === 'reprovado').length || 0;
  const discardedCount = plan?.posts.filter(p => p.status === 'descartado').length || 0;
  const validatedCount = plan?.posts.filter(p => p.status === 'validado_equipe').length || 0;
  const totalPosts = plan?.posts.length || 0;

  const notifyTeam = async () => {
    if (!plan) return;
    try {
      const currentUserEmail = auth.currentUser?.email?.toLowerCase();
      const teamQuery = query(
        collection(db, 'clients'),
        where('clienteId', '==', plan.clientId),
        where('role', '==', 'equipe')
      );
      const teamSnap = await getDocs(teamQuery);
      const teamMembers = teamSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      const notifPromises = teamMembers
        .filter(m => m.email?.toLowerCase() !== currentUserEmail)
        .map(member => 
          addDoc(collection(db, 'tasks'), {
            nome: `VALIDAR PLANEJAMENTO: ${plan.name}`,
            prioridade: 'alta',
            status: 'pendente',
            dataCriacao: serverTimestamp(),
            responsavelCriacao: auth.currentUser?.displayName || 'Cliente',
            responsavelCriacaoEmail: currentUserEmail || '',
            responsavelTarefa: member.name || member.email,
            tipoAcesso: 'particular',
            delegadoPara: member.email?.toLowerCase(),
            delegadoNome: member.name || member.email,
            vistoPeloDelegado: false,
            descricao: `O planejamento "${plan.name}" foi aprovado e aguarda sua validação.`,
            planId: plan.id,
            tipo: 'validacao_planejamento'
          })
        );
      
      await Promise.all(notifPromises);
    } catch (e) {
      console.warn('Erro ao notificar equipe:', e);
    }
  };

  const notifyAdmin = async () => {
    if (!plan) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        nome: `PLANEJAMENTO VALIDADO: ${plan.name}`,
        prioridade: 'alta',
        status: 'pendente',
        dataCriacao: serverTimestamp(),
        responsavelCriacao: auth.currentUser?.displayName || 'Equipe',
        responsavelCriacaoEmail: auth.currentUser?.email || '',
        responsavelTarefa: 'Admin BORA',
        tipoAcesso: 'particular',
        delegadoPara: 'boranovfilms@gmail.com',
        delegadoNome: 'Admin BORA',
        vistoPeloDelegado: false,
        descricao: `O planejamento "${plan.name}" foi validado pela equipe e está pronto para delegação.`,
        planId: plan.id,
        tipo: 'planejamento_validado_equipe'
      });
    } catch (e) {
      console.warn('Erro ao notificar admin:', e);
    }
  };

  const handleUpdateStatus = async (postId: string, action: 'aprovado' | 'reprovado' | 'editado', comment?: string, newText?: string) => {
    if (!planId || !plan) return;
    setSaving(true);
    try {
      await contentPlanService.updatePostStatus(planId, postId, action, user, comment, newText);
      
      const updatedPlan = await contentPlanService.getPlanById(planId);
      if (updatedPlan) {
        setPlan(updatedPlan);
        const allEvaluated = updatedPlan.posts.every(p => 
          p.status === 'aprovado' || p.status === 'reprovado' || p.status === 'descartado'
        );
        const hasReprovados = updatedPlan.posts.filter(p => p.status === 'reprovado').length;
        const allApprovedOrDiscarded = updatedPlan.posts.every(p => 
          p.status === 'aprovado' || p.status === 'descartado'
        );
        
        if (allEvaluated) {
          setShowCompletionModal(true);
          setCompletionMode('cliente');
          if (allApprovedOrDiscarded) {
            await contentPlanService.updateStatus(planId, 'aprovado');
            await notifyTeam();
          } else {
            await contentPlanService.updateStatus(planId, 'devolvido');
          }
        }
      }
      
      if (action === 'aprovado') {
        toast.success("Post aprovado!");
        const currentIndex = plan.posts.findIndex(p => p.id === postId);
        const nextPending = plan.posts.slice(currentIndex + 1).find(p => 
          p.status !== 'aprovado' && p.status !== 'reprovado' && p.status !== 'descartado'
        );
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
    } catch (error) {
      toast.error("Erro ao atualizar status");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReproval = async () => {
    if (!reprovalType || !selectedPostId || !planId || !plan) return;
    setSaving(true);
    try {
      const action = reprovalType === 'descartar' ? 'descartado' : 'reprovado';
      await contentPlanService.updatePostStatus(
        planId, 
        selectedPostId, 
        action as any,
        auth.currentUser,
        reprovalComment
      );
      
      setShowReprovalModal(false);
      setReprovalType(null);
      setReprovalComment('');
      
      await loadData();
      
      const updatedPlan = await contentPlanService.getPlanById(planId);
      if (updatedPlan) {
        setPlan(updatedPlan);
        
        const nextPending = updatedPlan.posts.find(p => 
          p.status === 'pendente' || p.status === 'em_revisao'
        );
        if (nextPending) {
          setSelectedPostId(nextPending.id);
        }
        
        const allEvaluated = updatedPlan.posts.every(p => 
          p.status === 'aprovado' || p.status === 'reprovado' || p.status === 'descartado'
        );
        const allApprovedOrDiscarded = updatedPlan.posts.every(p => 
          p.status === 'aprovado' || p.status === 'descartado'
        );
        
        if (allEvaluated) {
          setShowCompletionModal(true);
          setCompletionMode('cliente');
          if (allApprovedOrDiscarded) {
            await contentPlanService.updateStatus(planId, 'aprovado');
            await notifyTeam();
          } else {
            await contentPlanService.updateStatus(planId, 'devolvido');
          }
        }
      }
    } catch (error) {
      toast.error('Erro ao reprovar post');
    } finally {
      setSaving(false);
    }
  };

  const handleValidatePost = async () => {
    if (!planId || !selectedPostId) return;
    setSaving(true);
    try {
      await contentPlanService.validatePostByEquipe(planId, selectedPostId, auth.currentUser);
      toast.success('Post validado!');
      
      const updatedPlan = await contentPlanService.getPlanById(planId);
      if (updatedPlan) {
        setPlan(updatedPlan);
        
        const approvedPosts = updatedPlan.posts.filter(p => p.status === 'aprovado');
        const allValidated = approvedPosts.length === 0;
        
        if (allValidated) {
          setShowCompletionModal(true);
          setCompletionMode('equipe');
          await contentPlanService.updateStatus(planId, 'aprovado_equipe');
          await notifyAdmin();
        } else {
          const nextApproved = updatedPlan.posts.find(p => p.status === 'aprovado');
          if (nextApproved) {
            setTimeout(() => setSelectedPostId(nextApproved.id), 300);
          }
        }
      }
    } catch (error) {
      toast.error('Erro ao validar post');
    } finally {
      setSaving(false);
    }
  };

  const handleEditByEquipe = async () => {
    if (!planId || !selectedPostId || !editingCaption) return;
    setSaving(true);
    try {
      await contentPlanService.updatePostByEquipe(planId, selectedPostId, editingCaption, auth.currentUser);
      toast.success('Alteração salva e post validado!');
      setIsEditing(false);
      
      const updatedPlan = await contentPlanService.getPlanById(planId);
      if (updatedPlan) {
        setPlan(updatedPlan);
        
        const approvedPosts = updatedPlan.posts.filter(p => p.status === 'aprovado');
        const allValidated = approvedPosts.length === 0;
        
        if (allValidated) {
          setShowCompletionModal(true);
          setCompletionMode('equipe');
          await contentPlanService.updateStatus(planId, 'aprovado_equipe');
          await notifyAdmin();
        } else {
          const nextApproved = updatedPlan.posts.find(p => p.status === 'aprovado');
          if (nextApproved) {
            setTimeout(() => setSelectedPostId(nextApproved.id), 300);
          }
        }
      }
    } catch (error) {
      toast.error('Erro ao salvar alteração');
    } finally {
      setSaving(false);
    }
  };

  const handleEditByRedator = async () => {
    if (!planId || !selectedPostId) return;
    setSaving(true);
    try {
      const planRef = doc(db, 'content_plans', planId);
      const planSnap = await getDoc(planRef);
      if (!planSnap.exists()) throw new Error('Planejamento não encontrado');

      const planData = planSnap.data() as ContentPlan;
      const posts = planData.posts || [];
      const post = posts.find(p => p.id === selectedPostId);
      if (!post) throw new Error('Post não encontrado');

      const textBefore = JSON.stringify({
        caption: post.caption,
        cta: post.cta,
        hashtags: post.hashtags,
        slides: post.slides
      });
      const textAfter = JSON.stringify({
        caption: editingCaption,
        cta: editingCta,
        hashtags: editingHashtags,
        slides: editingSlides
      });

      const updatedPosts = posts.map(p => {
        if (p.id !== selectedPostId) return p;
        const approval = {
          userId: auth.currentUser!.uid,
          userName: auth.currentUser?.displayName || auth.currentUser?.email,
          userEmail: auth.currentUser?.email,
          action: 'editado_redator' as const,
          comment: editorComment || 'Texto revisado pelo redator',
          textBefore,
          textAfter,
          date: new Date().toISOString()
        };
        return {
          ...p,
          caption: editingCaption,
          cta: editingCta,
          hashtags: editingHashtags,
          slides: editingSlides.length > 0 ? editingSlides : p.slides,
          status: p.status === 'reprovado' ? 'em_revisao' as const : p.status,
          approvals: [...(p.approvals || []), approval]
        };
      });

      await updateDoc(planRef, {
        posts: updatedPosts,
        updatedAt: serverTimestamp()
      });

      toast.success('Edição salva!');
      setIsEditing(false);
      
      const updatedPlan = await contentPlanService.getPlanById(planId);
      if (updatedPlan) {
        setPlan(updatedPlan);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar edição');
    } finally {
      setSaving(false);
    }
  };

  const handleReenviarParaCliente = async () => {
    if (!plan || !planId) return;
    setSaving(true);
    try {
      const clientSnap = await getDoc(doc(db, 'clients', plan.clientId));
      const clientData = clientSnap.exists() ? clientSnap.data() : null;
      const targetEmail = clientData?.email?.toLowerCase() || clientEmail;
      const targetName = clientData?.name || targetEmail;

      if (!targetEmail) throw new Error('Email do cliente não encontrado');

      const planRef = doc(db, 'content_plans', planId);
      const planSnap = await getDoc(planRef);
      const planData = planSnap.data();
      const updatedPosts = (planData?.posts || []).map((p: any) => 
        p.status === 'em_revisao' ? { ...p, status: 'pendente' } : p
      );

      await updateDoc(planRef, {
        posts: updatedPosts,
        status: 'aguardando_cliente',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'tasks'), {
        nome: `PLANEJAMENTO REVISADO: ${plan.name}`,
        prioridade: 'alta',
        status: 'pendente',
        dataCriacao: serverTimestamp(),
        responsavelCriacao: auth.currentUser?.displayName || 'Redator',
        responsavelCriacaoEmail: auth.currentUser?.email || '',
        responsavelTarefa: targetName,
        tipoAcesso: 'particular',
        delegadoPara: targetEmail,
        delegadoNome: targetName,
        vistoPeloDelegado: false,
        descricao: `O planejamento "${plan.name}" foi revisado pelo redator e está pronto para sua avaliação.`,
        planId: planId,
        tipo: 'planejamento_revisado'
      });

      await loadData();
      toast.success('Planejamento reenviado para o cliente!');
      navigate('/projetos');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao reenviar para o cliente.');
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

  const startEditing = () => {
    if (!selectedPost) return;
    setEditingCaption(selectedPost.caption || '');
    setEditingCta(selectedPost.cta || '');
    setEditingHashtags(selectedPost.hashtags || '');
    setEditingSlides(selectedPost.slides || []);
    setEditorComment('');
    setIsEditing(true);
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

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'reprovado': return 'bg-red-500';
      case 'descartado': return 'bg-red-600';
      case 'validado_equipe': return 'bg-emerald-500';
      case 'em_revisao': return 'bg-amber-500';
      default: return 'bg-zinc-600';
    }
  };

  if (loading || !plan) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  const sidebarPosts = isEquipe 
    ? plan.posts.filter(p => p.status === 'aprovado' || p.status === 'validado_equipe')
    : isInternal && plan.status === 'devolvido'
      ? plan.posts.filter(p => p.status === 'reprovado' || p.status === 'em_revisao')
      : plan.posts;

  const pendingPosts = sidebarPosts.filter(p => 
    p.status !== 'aprovado' && p.status !== 'reprovado' && p.status !== 'descartado' && p.status !== 'validado_equipe' && p.status !== 'em_revisao'
  );
  const approvedPosts = sidebarPosts.filter(p => p.status === 'aprovado');
  const validatedPosts = sidebarPosts.filter(p => p.status === 'validado_equipe');
  const emRevisaoPosts = isInternal && plan.status === 'devolvido' 
    ? plan.posts.filter(p => p.status === 'em_revisao')
    : [];
  const reprovedPosts = isInternal && plan.status === 'devolvido'
    ? plan.posts.filter(p => p.status === 'reprovado')
    : [];
  const reprovedOrDiscardedPosts = !isEquipe && !isInternal
    ? plan.posts.filter(p => p.status === 'reprovado' || p.status === 'descartado')
    : [];

  const aprovados = plan?.posts?.filter(p => p.status === 'aprovado').length || 0;
  const reprovados = plan?.posts?.filter(p => 
    p.status === 'reprovado' || p.status === 'descartado'
  ).length || 0;

  const postsReprovados = plan.posts.filter(p => 
    p.status === 'reprovado' || p.status === 'em_revisao'
  );
  const todosEditados = postsReprovados.length > 0 && postsReprovados.every(p => p.status === 'em_revisao');

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
        
        <div className="flex items-center gap-3">
          {isAdmin && plan.status === 'rascunho' && (
            <button onClick={handleSendToClient} disabled={saving} className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar para Cliente
            </button>
          )}

          {isInternal && plan.status === 'devolvido' && todosEditados && (
            <button onClick={handleReenviarParaCliente} disabled={saving} className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Reenviar para Cliente
            </button>
          )}
        </div>
      </header>

      <div className="flex h-[calc(100vh-12rem)] bg-[#121212] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <aside className="w-[280px] bg-[#0e0e0e] border-r border-zinc-800 flex flex-col shrink-0">
          <div className="p-5 border-b border-zinc-800 bg-black/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{isEquipe ? 'Validação da Equipe' : isInternal ? 'Revisão Redator' : 'Aprovação do Lote'}</span>
              <span className="text-[10px] font-black text-white">{isEquipe ? validatedCount : isInternal ? emRevisaoPosts.length : approvedCount} / {totalPosts}</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#ff5351] transition-all duration-500" style={{ width: `${((isEquipe ? validatedCount : isInternal ? emRevisaoPosts.length : approvedCount) / totalPosts) * 100}%` }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {pendingPosts.map((post) => (
              <button 
                key={post.id}
                onClick={() => { setSelectedPostId(post.id); setIsEditing(false); setShowReprovalInput(false); }}
                className={cn(
                  "w-full p-5 text-left border-b border-zinc-800/50 transition-all flex items-start gap-4 relative group",
                  selectedPostId === post.id ? "bg-[#1f1f1f] border-l-4 border-l-[#ff5351]" : "hover:bg-zinc-900/50"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", getStatusDot(post.status))} />
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

            {isInternal && plan.status === 'devolvido' && reprovedPosts.length > 0 && (
              <div className="mt-2">
                <div className="w-full p-3 flex items-center justify-between text-red-500">
                  <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <X className="w-3 h-3" /> Reprovados ({reprovedPosts.length})
                  </span>
                </div>
                {reprovedPosts.map((post) => (
                  <button 
                    key={post.id}
                    onClick={() => { setSelectedPostId(post.id); setIsEditing(false); setShowReprovalInput(false); }}
                    className={cn(
                      "w-full p-5 text-left border-b border-zinc-800/50 transition-all flex items-start gap-4 relative group",
                      selectedPostId === post.id ? "bg-[#1f1f1f] border-l-4 border-l-[#ff5351]" : "hover:bg-zinc-900/50"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-red-500" />
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

            {isInternal && plan.status === 'devolvido' && emRevisaoPosts.length > 0 && (
              <div className="mt-2">
                <div className="w-full p-3 flex items-center justify-between text-amber-500">
                  <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Edit3 className="w-3 h-3" /> Em Correção ({emRevisaoPosts.length})
                  </span>
                </div>
                {emRevisaoPosts.map((post) => (
                  <button 
                    key={post.id}
                    onClick={() => { setSelectedPostId(post.id); setIsEditing(false); setShowReprovalInput(false); }}
                    className={cn(
                      "w-full p-5 text-left border-b border-zinc-800/50 transition-all flex items-start gap-4 relative group",
                      selectedPostId === post.id ? "bg-[#1f1f1f] border-l-4 border-l-[#ff5351]" : "hover:bg-zinc-900/50"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-amber-500" />
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

            {isEquipe && validatedPosts.length > 0 && (
              <div className="mt-2">
                <button 
                  onClick={() => setShowApprovedInSidebar(!showApprovedInSidebar)}
                  className="w-full p-3 flex items-center justify-between text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Check className="w-3 h-3" /> Validados ({validatedPosts.length})
                  </span>
                  {showApprovedInSidebar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showApprovedInSidebar && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    {validatedPosts.map((post) => (
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

            {!isEquipe && !isInternal && approvedPosts.length > 0 && (
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

            {!isEquipe && !isInternal && reprovedOrDiscardedPosts.length > 0 && (
              <div className="mt-2">
                <button 
                  onClick={() => setShowApprovedInSidebar(!showApprovedInSidebar)}
                  className="w-full p-3 flex items-center justify-between text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                    <X className="w-3 h-3" /> Reprovados/Descartados ({reprovedOrDiscardedPosts.length})
                  </span>
                  {showApprovedInSidebar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showApprovedInSidebar && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    {reprovedOrDiscardedPosts.map((post) => (
                      <button 
                        key={post.id}
                        onClick={() => { setSelectedPostId(post.id); setIsEditing(false); setShowReprovalInput(false); }}
                        className={cn(
                          "w-full p-5 text-left border-b border-zinc-800/50 transition-all flex items-start gap-4 relative group opacity-40",
                          selectedPostId === post.id ? "bg-[#1f1f1f] border-l-4 border-l-[#ff5351] opacity-100" : "hover:bg-zinc-900/50"
                        )}
                      >
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-red-600" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                             <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border", getTypeStyles(post.type))}>{post.type}</span>
                             <span className="text-[9px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                             {post.status === 'descartado' && (
                               <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter bg-red-500/20 text-red-400 border border-red-500/20">✕ DESCARTADO</span>
                             )}
                          </div>
                          <p className={cn("text-[11px] font-black uppercase leading-tight line-clamp-2 line-through", selectedPostId === post.id ? "text-white" : "text-zinc-500 group-hover:text-zinc-300")}>
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
                     selectedPost.status === 'descartado' ? "bg-red-600/10 text-red-400 border-red-600/20" :
                     selectedPost.status === 'em_revisao' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : 
                     selectedPost.status === 'validado_equipe' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                     "bg-zinc-800 text-zinc-500 border-zinc-700"
                   )}>{selectedPost.status === 'validado_equipe' ? 'VALIDADO' : selectedPost.status}</span>
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
                  {isEditing ? (
                    <textarea
                      value={editingCaption}
                      onChange={e => setEditingCaption(e.target.value)}
                      rows={6}
                      className="w-full bg-[#1a1a1a] border border-[#ff5351] ring-4 ring-[#ff5351]/10 rounded-xl p-6 text-xs text-white leading-relaxed font-medium outline-none resize-none"
                      style={{ whiteSpace: 'pre-wrap' }}
                    />
                  ) : (
                    <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-6 text-xs text-white leading-relaxed font-medium">
                      {selectedPost.caption}
                    </div>
                  )}
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                  <section className="space-y-3">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase flex items-center gap-2 block"><Target className="w-3 h-3" /> Chamada para Ação</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingCta}
                        onChange={e => setEditingCta(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#ff5351] ring-4 ring-[#ff5351]/10 rounded-xl p-4 text-sm text-white font-black uppercase outline-none"
                      />
                    ) : (
                      <p className="text-white font-black uppercase text-sm">{selectedPost.cta || "-"}</p>
                    )}
                  </section>
                  <section className="space-y-3">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase flex items-center gap-2 block"><Hash className="w-3 h-3" /> Hashtags</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingHashtags}
                        onChange={e => setEditingHashtags(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#ff5351] ring-4 ring-[#ff5351]/10 rounded-xl p-4 text-sm text-white font-black uppercase outline-none"
                      />
                    ) : (
                      <p className="text-white font-black uppercase text-xs">{selectedPost.hashtags || "-"}</p>
                    )}
                  </section>
                </div>

                {selectedPost.type === 'CARROSSEL' && (selectedPost.slides || editingSlides.length > 0) && (
                  <section className="space-y-3 text-left">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">
                      Slides ({isEditing ? editingSlides.length : (selectedPost.slides?.length || 0)})
                    </label>
                    <div className="space-y-2">
                      {(isEditing ? editingSlides : (selectedPost.slides || [])).map((slide, idx) => (
                        <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={slide.title}
                                onChange={e => {
                                  const updated = [...editingSlides];
                                  updated[idx] = { ...updated[idx], title: e.target.value };
                                  setEditingSlides(updated);
                                }}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-[10px] text-white font-black uppercase outline-none focus:border-[#ff5351]"
                                placeholder={`Título do Slide ${idx + 1}`}
                              />
                              <textarea
                                value={slide.description}
                                onChange={e => {
                                  const updated = [...editingSlides];
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  setEditingSlides(updated);
                                }}
                                rows={2}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-[11px] text-zinc-400 outline-none focus:border-[#ff5351] resize-none"
                                placeholder="Descrição do slide..."
                              />
                            </div>
                          ) : (
                            <>
                              <div className="text-[10px] font-black uppercase text-white mb-1">
                                Slide {idx + 1} — {slide.title}
                              </div>
                              {slide.description && (
                                <div className="text-[11px] text-zinc-400 leading-relaxed">
                                  {slide.description}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedPost.roteiro && (
                  <section className="space-y-3 text-left">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase flex items-center gap-2 block"><Zap className="w-3 h-3" /> Roteiro</label>
                    <div className="bg-black/30 border border-zinc-800 rounded-xl p-6 text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap italic font-medium">
                       {selectedPost.roteiro}
                    </div>
                  </section>
                )}

                {isEditing && isInternal && (
                  <section className="space-y-3 text-left">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Comentário para o cliente (opcional)</label>
                    <textarea
                      value={editorComment}
                      onChange={e => setEditorComment(e.target.value)}
                      rows={3}
                      placeholder="Ex: Ajustei o tom da legenda conforme solicitado..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-[#ff5351] outline-none resize-none"
                    />
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

                {selectedPost.approvals && selectedPost.approvals.length > 0 && (
                  <section className="space-y-3 text-left">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Histórico de Ações</label>
                    <div className="space-y-2">
                      {selectedPost.approvals.map((approval, idx) => (
                        <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            {approval.action === 'aprovado' && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">✓ Aprovado</span>
                            )}
                            {approval.action === 'reprovado' && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-red-500/10 text-red-500 border border-red-500/20">✕ Reprovado</span>
                            )}
                            {approval.action === 'editado' && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-amber-500/10 text-amber-400 border border-amber-500/20">✎ Editado pelo Cliente</span>
                            )}
                            {approval.action === 'editado_equipe' && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-blue-500/10 text-blue-400 border border-blue-500/20">✎ Editado pela Equipe</span>
                            )}
                            {approval.action === 'validado_equipe' && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">✓ Validado pela Equipe</span>
                            )}
                            {approval.action === 'editado_redator' && (
                              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-purple-500/10 text-purple-400 border border-purple-500/20">✎ Editado pelo Redator</span>
                            )}
                            <span className="text-[9px] text-zinc-500">{new Date(approval.date).toLocaleDateString('pt-BR')}</span>
                          </div>
                          {approval.comment && (
                            <p className="text-[11px] text-zinc-400 leading-relaxed">{approval.comment}</p>
                          )}
                          {approval.textBefore && approval.textAfter && (
                            <div className="mt-1 text-[10px] text-zinc-500">
                              <span className="text-zinc-600">Texto alterado</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <footer className="p-6 bg-black border-t border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {isEquipe && selectedPost.status === 'aprovado' && (
                    <>
                      <button 
                        onClick={handleValidatePost}
                        disabled={saving}
                        className="h-12 px-8 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Validar Post
                      </button>
                      <button 
                        onClick={startEditing}
                        className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700"
                      >
                        <Edit3 className="w-4 h-4" /> Alterar Texto
                      </button>
                    </>
                  )}
                  
                  {isEquipe && selectedPost.status === 'validado_equipe' && (
                    <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Check className="w-4 h-4" /> Post Validado
                    </span>
                  )}

                  {isInternal && (
                    <>
                      {isEditing ? (
                        <>
                          <button onClick={() => setIsEditing(false)} className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700">
                            <X className="w-4 h-4" /> Cancelar
                          </button>
                          <button onClick={handleEditByRedator} disabled={saving} className="h-12 px-6 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[#ff5351] hover:text-white transition-all flex items-center gap-2">
                            {saving ? 'Salvando...' : 'Salvar Edição'}
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={startEditing}
                          className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700"
                        >
                          <Edit3 className="w-4 h-4" /> Editar Texto
                        </button>
                      )}
                    </>
                  )}

                  {!isEquipe && !isInternal && hasApprovalPower && (plan.status === 'aguardando_cliente' || plan.status === 'aguardando_validacao_equipe') && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus(selectedPost.id, 'aprovado')}
                        disabled={saving}
                        className="h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Aprovar Post
                      </button>
                      <button 
                        onClick={() => { setShowReprovalModal(true); setIsEditing(false); }}
                        className="h-12 px-6 bg-zinc-800 border border-red-500/20 text-red-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" /> Reprovar
                      </button>
                      <button 
                        onClick={startEditing}
                        className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700"
                      >
                        <Edit3 className="w-4 h-4" /> Sugerir Edição
                      </button>
                    </>
                  )}
                </div>
                <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                   Post {selectedPost.status === 'validado_equipe' ? 'VALIDADO' : selectedPost.status}
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

      {showCompletionModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCompletionModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-[20px] p-8 w-full max-w-sm animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{plan.name}</span>
              <span className="w-px h-3 bg-zinc-700" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{plan.monthReference}</span>
            </div>

            {completionMode === 'equipe' ? (
              <>
                <h2 className="text-2xl font-black uppercase italic text-white text-center mb-1">Validação Concluída</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center mb-6">Todos os posts foram validados</p>

                <div className="mb-6 text-center">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[9px] font-black uppercase tracking-widest mb-3">
                    ✓ Validação completa!
                  </span>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Validação concluída! O administrador foi notificado para iniciar a produção.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black uppercase italic text-white text-center mb-1">Revisão Concluída</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center mb-6">Planejamento avaliado com sucesso</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#121212] border border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black italic text-emerald-500 mb-1">
                      {aprovados}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Aprovados</div>
                  </div>
                  <div className="bg-[#121212] border border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black italic text-red-400 mb-1">
                      {reprovados}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-red-800">Reprovados</div>
                  </div>
                </div>

                <div className="w-full h-1 bg-zinc-800 rounded-full mb-6 overflow-hidden">
                  <div 
                    className="h-full bg-[#ff5351] rounded-full transition-all duration-1000"
                    style={{ width: `${(aprovados / totalPosts) * 100}%` }}
                  />
                </div>

                {reprovados > 0 ? (
                  <div className="mb-6 text-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[9px] font-black uppercase tracking-widest mb-3">
                      ⚠ {reprovados} posts aguardando correção
                    </span>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      Os posts reprovados foram enviados para o redator corrigir. 
                      Você será notificado quando estiverem prontos para uma nova avaliação. 
                      Os posts aprovados aguardam a validação da equipe.
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
              </>
            )}

            <button
              onClick={() => {
                setShowCompletionModal(false);
                navigate('/projetos');
              }}
              className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}

      {showReprovalModal && selectedPost && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowReprovalModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-[20px] p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
            
            <h3 className="text-lg font-black uppercase italic text-white mb-1">
              O que deseja fazer?
            </h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">
              Post {selectedPost.number} — {selectedPost.headline}
            </p>

            <div className="space-y-3 mb-6">
              
              <button
                onClick={() => setReprovalType('correcao')}
                className={cn(
                  "w-full p-4 rounded-2xl border text-left transition-all",
                  reprovalType === 'correcao' 
                    ? "bg-amber-500/10 border-amber-500/30" 
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm">✎</div>
                  <div>
                    <p className="text-white font-black uppercase text-xs">Solicitar Correção</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">
                      A redatora ajusta o texto conforme sua orientação
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setReprovalType('descartar')}
                className={cn(
                  "w-full p-4 rounded-2xl border text-left transition-all",
                  reprovalType === 'descartar' 
                    ? "bg-red-500/10 border-red-500/30" 
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-sm">✕</div>
                  <div>
                    <p className="text-white font-black uppercase text-xs">Não Usar Este Post</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">
                      A redatora cria um novo post para substituir este
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {reprovalType && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  {reprovalType === 'correcao' ? 'O que precisa ser corrigido?' : 'Motivo do descarte (opcional)'}
                </label>
                <textarea
                  value={reprovalComment}
                  onChange={e => setReprovalComment(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white text-sm focus:border-[#ff5351] outline-none resize-none"
                  placeholder={reprovalType === 'correcao' 
                    ? "Ex: O tom está muito formal, precisa ser mais direto..." 
                    : "Ex: Tema já foi abordado recentemente..."}
                />
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowReprovalModal(false); setReprovalType(null); setReprovalComment(''); }}
                className="flex-1 h-11 bg-zinc-900 border border-zinc-800 text-zinc-500 font-black uppercase tracking-widest text-[9px] rounded-xl hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmReproval()}
                disabled={!reprovalType}
                className="flex-1 h-11 bg-[#ff5351] text-white font-black uppercase tracking-widest text-[9px] rounded-xl hover:brightness-110 transition-all disabled:opacity-30"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
