import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Check, X, Edit3, Loader2, Send,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Target, Hash, Zap, RotateCcw, FileText, Users, Upload
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { contentPlanService, ContentPlan, ContentPost } from '../services/contentPlanService';
import { teamService, TeamMember } from '../services/teamService';
import { notificacaoService } from '../services/notificacaoService';
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
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
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
  const [activeTab, setActiveTab] = useState<'posts' | 'historico'>('posts');
  const [showMyDemandsFilter, setShowMyDemandsFilter] = useState(false);

  const user = auth.currentUser;
  const currentEmail = user?.email?.toLowerCase();

  const isAdmin = currentEmail === 'admin@boraselect.com.br' || currentEmail === 'boranovfilms@gmail.com';
  const isClient = clientEmail === currentEmail;
  const isTeamMember = teamMembers.some(m => m.email?.toLowerCase() === currentEmail);
  const isEquipe = userRole === 'equipe';
  const internalRoles = ['master', 'admin', 'redator', 'editor'];
  const isInternal = internalRoles.includes(userRole);
  const isEditor = ['editor', 'designer', 'redator'].includes(userRole);
  const hasApprovalPower = isClient || isTeamMember;

  useEffect(() => {
    loadData();
    loadUserRole();
  }, [planId]);

  useEffect(() => {
    if (!plan || selectedPostId || !roleLoaded) return;
    
    if (userRole === 'equipe') {
      const primeiroAprovado = plan.posts.find(p => p.status === 'aprovado');
      if (primeiroAprovado) { setSelectedPostId(primeiroAprovado.id); return; }
    }
    
    if (internalRoles.includes(userRole) && plan.status === 'devolvido') {
      const firstRep = plan.posts.find(p => p.status === 'reprovado' || p.status === 'em_revisao');
      if (firstRep) { setSelectedPostId(firstRep.id); return; }
    }
    
    const firstPending = plan.posts.find(p => 
      p.status !== 'aprovado' && p.status !== 'reprovado' && 
      p.status !== 'descartado' && p.status !== 'validado_equipe'
    );
    if (firstPending) { setSelectedPostId(firstPending.id); return; }
    if (plan.posts.length > 0) setSelectedPostId(plan.posts[0].id);
  }, [plan, userRole, roleLoaded]);

  const loadUserRole = async () => {
    if (!currentEmail) return;
    setUserEmail(currentEmail);
    try {
      if (currentEmail === 'admin@boraselect.com.br') {
        setUserRole('master');
        setRoleLoaded(true);
        return;
      }
      const qBora = query(collection(db, 'boraselect'), where('email', '==', currentEmail));
      const snapBora = await getDocs(qBora);
      if (!snapBora.empty) {
        setUserRole(snapBora.docs[0].data().role || 'redator');
        setRoleLoaded(true);
        return;
      }
      const q = query(collection(db, 'clientes'), where('email', '==', currentEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const role = snap.docs[0].data().role || 'cliente';
        setUserRole(role);
      }
    } catch (e) {
      console.warn('Erro ao carregar role:', e);
    } finally {
      setRoleLoaded(true);
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
      
      const clientSnap = await getDoc(doc(db, 'clientes', planData.clientId));
      if (clientSnap.exists()) {
        setClientEmail(clientSnap.data().email?.toLowerCase() || '');
      }

      const members = await teamService.getClientTeamMembers(planData.clientId);
      setTeamMembers(members);

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

  // Filtra posts para editor/designer (apenas posts com tasks delegadas pra ele)
  const myPosts = showMyDemandsFilter && isEditor 
    ? plan?.posts.filter(post => {
        const tasks = (post as any).tasks || [];
        return tasks.some((t: any) => t.responsibleEmail?.toLowerCase() === currentEmail?.toLowerCase());
      }) || []
    : plan?.posts || [];

  const notifyTeam = async () => {
    if (!plan) return;
    try {
      const teamQuery = query(
        collection(db, 'clientes'),
        where('type', '==', 'membro'),
        where('companyId', '==', plan.clientId)
      );
      const teamSnap = await getDocs(teamQuery);
      const members = teamSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      for (const member of members) {
        await notificacaoService.criar({
          para: member.email?.toLowerCase(),
          tipo: 'planejamento_aprovado_cliente',
          titulo: 'Planejamento Aprovado pelo Cliente',
          descricao: `Planejamento "${plan.name}" foi aprovado e aguarda sua validação`,
          planId: planId
        });
      }
    } catch (e) {
      console.warn('Erro ao notificar equipe:', e);
    }
  };

  const notifyRedator = async () => {
    if (!plan || !planId) return;
    try {
      await notificacaoService.criar({
        para: 'boranovfilms@gmail.com',
        tipo: 'planejamento_validado_equipe',
        titulo: 'Planejamento Validado pela Equipe',
        descricao: `Planejamento "${plan.name}" foi validado pela equipe e está pronto para delegação`,
        planId: planId
      });
    } catch (e) {
      console.warn('Erro ao notificar redator:', e);
    }
  };

  const notifyClient = async () => {
    if (!plan || !clientEmail) {
      console.warn('Erro: plan ou clientEmail não disponível', { plan: !!plan, clientEmail });
      return;
    }
    try {
      console.log('Notificando cliente:', clientEmail);
      
      await notificacaoService.criar({
        para: clientEmail.toLowerCase(),
        tipo: 'planejamento_enviado',
        titulo: 'Novo Planejamento Enviado',
        descricao: `Planejamento "${plan.name}" foi enviado para sua aprovação`,
        planId: planId
      });
      
      console.log('Notificação enviada com sucesso para:', clientEmail);
    } catch (e) {
      console.error('Erro ao notificar cliente:', e);
    }
  };

  const acceptDemand = async () => {
    if (!selectedPost || !planId || !plan) return;
    setSaving(true);
    try {
      const tasks = (selectedPost as any).tasks || [];
      const userTask = tasks.find((t: any) => t.responsibleEmail?.toLowerCase() === currentEmail?.toLowerCase());
      
      if (!userTask) {
        toast.error('Tarefa não encontrada');
        return;
      }

      // Atualiza o status da task para em_andamento
      const updatedPosts = plan.posts.map(p => {
        if (p.id !== selectedPost.id) return p;
        return {
          ...p,
          tasks: (p as any).tasks.map((t: any) => 
            t.id === userTask.id ? { ...t, status: 'em_andamento' } : t
          )
        };
      });

      await updateDoc(doc(db, 'demandas', planId), {
        posts: updatedPosts,
        updatedAt: serverTimestamp()
      });

      toast.success('Demanda aceita! Você pode começar a trabalhar.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao aceitar demanda');
    } finally {
      setSaving(false);
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
        const allApprovedOrDiscarded = updatedPlan.posts.every(p => 
          p.status === 'aprovado' || p.status === 'descartado'
        );
        
        if (allEvaluated) {
          setShowCompletionModal(true);
          setCompletionMode('cliente');
          if (allApprovedOrDiscarded) {
            await contentPlanService.updateStatus(planId, 'aguardando_validacao_equipe');
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
            await contentPlanService.updateStatus(planId, 'aguardando_validacao_equipe');
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
        
        const postsAindaAprovados = updatedPlan.posts.filter(p => p.status === 'aprovado');
        const algumValidado = updatedPlan.posts.some(p => p.status === 'validado_equipe');
        const todosValidados = postsAindaAprovados.length === 0 && algumValidado;
        
        if (todosValidados) {
          await contentPlanService.updateStatus(planId, 'aprovado_equipe');
          await loadData();
          setShowCompletionModal(true);
          setCompletionMode('equipe');
          await notifyRedator();
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
        
        const postsAindaAprovados = updatedPlan.posts.filter(p => p.status === 'aprovado');
        const algumValidado = updatedPlan.posts.some(p => p.status === 'validado_equipe');
        const todosValidados = postsAindaAprovados.length === 0 && algumValidado;
        
        if (todosValidados) {
          await contentPlanService.updateStatus(planId, 'aprovado_equipe');
          await loadData();
          setShowCompletionModal(true);
          setCompletionMode('equipe');
          await notifyRedator();
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
      const planRef = doc(db, 'demandas', planId);
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
      const clientSnap = await getDoc(doc(db, 'clientes', plan.clientId));
      const clientData = clientSnap.exists() ? clientSnap.data() : null;
      const targetEmail = clientData?.email?.toLowerCase() || clientEmail;
      const targetName = clientData?.name || targetEmail;

      if (!targetEmail) throw new Error('Email do cliente não encontrado');

      const planRef = doc(db, 'demandas', planId);
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

      await notificacaoService.criar({
        para: targetEmail,
        tipo: 'planejamento_revisado',
        titulo: 'Planejamento Revisado',
        descricao: `Planejamento "${plan.name}" foi revisado pelo redator e está pronto para sua avaliação`,
        planId: planId
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
    if (!planId || !plan) return;
    setSaving(true);
    try {
      await contentPlanService.updateStatus(planId, 'aguardando_cliente');
      await notifyClient();
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

  const getTasksForPost = (post: ContentPost): any[] => {
    return (post as any).tasks || [];
  };

  const getUserTasksForPost = (post: ContentPost): any[] => {
    const tasks = getTasksForPost(post);
    return tasks.filter((t: any) => t.responsibleEmail?.toLowerCase() === currentEmail?.toLowerCase());
  };

  const getTaskIcon = (dept: string): string => {
    const icons: any = {
      'video': '🎬',
      'design': '🎨',
      'redacao': '✍️',
      'midia_social': '📱'
    };
    return icons[dept] || '•';
  };

  const getTaskStatus = (post: ContentPost): string => {
    const userTasks = getUserTasksForPost(post);
    if (userTasks.length === 0) return post.status;
    
    const statuses = userTasks.map(t => t.status);
    if (statuses.includes('fazer_correcao')) return 'fazer_correcao';
    if (statuses.includes('em_andamento')) return 'em_andamento';
    if (statuses.includes('pendente')) return 'pendente';
    if (statuses.every(s => s === 'concluido')) return 'concluido';
    
    return post.status;
  };

  if (loading || !plan) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  const sidebarPosts = isEquipe 
    ? plan.posts.filter(p => p.status === 'aprovado' || p.status === 'validado_equipe')
    : isInternal && plan.status === 'devolvido'
      ? plan.posts.filter(p => p.status === 'reprovado' || p.status === 'em_revisao')
      : showMyDemandsFilter && isEditor
        ? myPosts
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

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <header className="bg-[#1a1a1a] border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-xl font-black uppercase italic text-white">{plan.name}</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{plan.monthReference}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isInternal && plan.status === 'rascunho' && (
              <button onClick={handleSendToClient} disabled={saving} className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all disabled:opacity-50">
                Enviar para Cliente
              </button>
            )}
            {isInternal && plan.status === 'devolvido' && (
              <button onClick={handleReenviarParaCliente} disabled={saving} className="h-10 px-6 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2">
                <Send className="w-4 h-4" /> Reenviar
              </button>
            )}
            {isInternal && (plan.status === 'aprovado_equipe' || plan.status === 'aprovado') && (
              <button onClick={() => navigate(`/planejamento/${planId}/tarefas`)} className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2">
                <Zap className="w-4 h-4" /> Delegar Tarefas
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="bg-[#1a1a1a] border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex gap-6 items-center">
          <button onClick={() => setActiveTab('posts')} className={cn("py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === 'posts' ? "text-[#ff5351] border-[#ff5351]" : "text-zinc-500 border-transparent hover:text-zinc-300")}>
            Posts ({plan.posts.length})
          </button>
          <button onClick={() => setActiveTab('historico')} className={cn("py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === 'historico' ? "text-[#ff5351] border-[#ff5351]" : "text-zinc-500 border-transparent hover:text-zinc-300")}>
            Histórico
          </button>
          {isEditor && (
            <button onClick={() => setShowMyDemandsFilter(!showMyDemandsFilter)} className={cn("py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ml-auto", showMyDemandsFilter ? "text-[#ff5351] border-[#ff5351]" : "text-zinc-500 border-transparent hover:text-zinc-300")}>
              {showMyDemandsFilter ? '✓ Minhas Demandas' : 'Minhas Demandas'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'historico' ? (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-lg font-black uppercase italic text-white mb-6">Linha do Tempo</h2>
            <div className="space-y-0">
              {/* Histórico aqui */}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto flex gap-6 px-6 py-6">
          <aside className="w-80 shrink-0">
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Posts</span>
                  <span className="text-[10px] font-black text-[#ff5351]">{sidebarPosts.length}</span>
                </div>
              </div>

              {pendingPosts.length > 0 && (
                <div className="p-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 px-2 py-2">Pendentes</p>
                  {pendingPosts.map(post => {
                    const userTasks = getUserTasksForPost(post);
                    return (
                      <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 mb-1", selectedPostId === post.id ? "bg-[#ff5351]/10 border border-[#ff5351]/20" : "hover:bg-zinc-800/50")}>
                        <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                          {userTasks.length > 0 && (
                            <p className="text-[9px] text-[#ff5351] mt-0.5">
                              {userTasks.map(t => `${getTaskIcon(t.dept)} ${t.deptLabel}`).join(' + ')}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {approvedPosts.length > 0 && isEquipe && (
                <div className="p-2 border-t border-zinc-800">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 px-2 py-2">Para Validar</p>
                  {approvedPosts.map(post => (
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 mb-1", selectedPostId === post.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </button>
                  ))}
                </div>
              )}

              {validatedPosts.length > 0 && (
                <div className="p-2 border-t border-zinc-800">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 px-2 py-2">Validados</p>
                  {validatedPosts.map(post => (
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 opacity-60 mb-1", selectedPostId === post.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                      </div>
                      <Check className="w-3 h-3 text-emerald-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className="flex-1 bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
            {selectedPost ? (
              <>
                <div className="p-6 border-b border-zinc-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={cn('px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest', getTypeStyles(selectedPost.type))}>
                        {selectedPost.type}
                      </span>
                      <span className="text-[10px] font-black text-zinc-500">#{String(selectedPost.number).padStart(2, '0')}</span>
                      {isEditor && getUserTasksForPost(selectedPost).length > 0 && (
                        <div className="flex items-center gap-1">
                          {getUserTasksForPost(selectedPost).map(task => (
                            <span key={task.id} className="px-2 py-1 bg-[#ff5351]/10 border border-[#ff5351]/20 rounded-lg text-[8px] font-black text-[#ff5351] uppercase tracking-widest">
                              {getTaskIcon(task.dept)} {task.deptLabel}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPost.status === 'aprovado' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[8px] font-black uppercase tracking-widest">✓ Aprovado</span>}
                    </div>
                  </div>
                  <h2 className="text-lg font-black uppercase italic text-white">{selectedPost.headline}</h2>
                </div>

                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{selectedPost.publishDate}</span>
                  </div>

                  <section className="space-y-2">
                    <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Legenda</label>
                    {isEditing ? (
                      <textarea value={editingCaption} onChange={e => setEditingCaption(e.target.value)} rows={6} className="w-full bg-zinc-900 border border-[#ff5351] rounded-xl p-4 text-white text-sm focus:outline-none resize-none" />
                    ) : (
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{selectedPost.caption}</p>
                    )}
                  </section>
                </div>

                <footer className="p-6 bg-black border-t border-zinc-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    {isEditor && getUserTasksForPost(selectedPost).some((t: any) => t.status === 'pendente') && (
                      <button onClick={acceptDemand} disabled={saving} className="h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20 disabled:opacity-50">
                        <Check className="w-4 h-4" /> Aceitar Demanda
                      </button>
                    )}
                    {isEditor && getUserTasksForPost(selectedPost).some((t: any) => t.status === 'em_andamento') && (
                      <button disabled={saving} className="h-12 px-8 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 border border-zinc-700">
                        <Upload className="w-4 h-4" /> Upload Arquivo (em breve)
                      </button>
                    )}
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
      )}
    </div>
  );
}
