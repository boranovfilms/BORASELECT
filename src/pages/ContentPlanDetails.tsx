import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Check, X, Edit3, Loader2, Send,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Target, Hash, Zap, RotateCcw, FileText, Users
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

  useEffect(() => {
    if (!plan || selectedPostId || !roleLoaded) return;
    
    if (userRole === 'equipe') {
      const primeiroAprovado = plan.posts.find(p => p.status === 'aprovado');
      if (primeiroAprovado) { setSelectedPostId(primeiroAprovado.id); return; }
      const primeiroValidado = plan.posts.find(p => p.status === 'validado_equipe');
      if (primeiroValidado) { setSelectedPostId(primeiroValidado.id); return; }
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

  const getTimelineEvents = () => {
    if (!plan) return [];
    const events: any[] = [];

    events.push({
      type: 'criado',
      title: 'Planejamento Criado',
      date: plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('pt-BR') : '—',
      description: `Planejamento "${plan.name}" criado com ${plan.posts.length} posts.`,
      icon: <FileText className="w-3.5 h-3.5 text-zinc-400" />,
      color: 'border-zinc-600 bg-zinc-900'
    });

    if (plan.status !== 'rascunho') {
      events.push({
        type: 'enviado_cliente',
        title: 'Enviado para o Cliente',
        date: '—',
        description: 'O planejamento foi enviado para aprovação do cliente.',
        icon: <Send className="w-3.5 h-3.5 text-amber-400" />,
        color: 'border-amber-500 bg-amber-500/10'
      });
    }

    const aprovadosCount = plan.posts.filter(p => p.status === 'aprovado' || p.status === 'validado_equipe').length;
    const reprovadosCount = plan.posts.filter(p => p.status === 'reprovado').length;
    const descartadosCount = plan.posts.filter(p => p.status === 'descartado').length;

    if (aprovadosCount > 0 || reprovadosCount > 0 || descartadosCount > 0) {
      events.push({
        type: 'aprovado_cliente',
        title: 'Avaliação do Cliente',
        date: '—',
        description: `${aprovadosCount} posts aprovados, ${reprovadosCount} reprovados, ${descartadosCount} descartados.`,
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        color: 'border-emerald-500 bg-emerald-500/10'
      });
    }

    const hasRedatorEdit = plan.posts.some(p => p.approvals?.some((a: any) => a.action === 'editado_redator'));
    if (hasRedatorEdit) {
      events.push({
        type: 'revisado_redator',
        title: 'Revisado pelo Redator',
        date: '—',
        description: 'O redator revisou os posts conforme feedback do cliente.',
        icon: <Edit3 className="w-3.5 h-3.5 text-purple-400" />,
        color: 'border-purple-500 bg-purple-500/10'
      });
    }

    if (plan.status === 'aprovado_equipe' || plan.status === 'aguardando_validacao_equipe') {
      events.push({
        type: 'validado_equipe',
        title: plan.status === 'aprovado_equipe' ? 'Validado pela Equipe' : 'Aguardando Validação da Equipe',
        date: '—',
        description: plan.status === 'aprovado_equipe' 
          ? 'Todos os posts foram validados pela equipe do cliente.'
          : 'A equipe do cliente está validando os posts aprovados.',
        icon: <Users className="w-3.5 h-3.5 text-blue-400" />,
        color: 'border-blue-500 bg-blue-500/10'
      });
    }

    if (plan.status === 'em_producao') {
      events.push({
        type: 'em_producao',
        title: 'Em Produção',
        date: '—',
        description: 'O planejamento está em fase de produção de conteúdo.',
        icon: <Zap className="w-3.5 h-3.5 text-[#ff5351]" />,
        color: 'border-[#ff5351] bg-[#ff5351]/10'
      });
    }

    return events;
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

  const postsReprovados = plan?.posts.filter(p => 
    p.status === 'reprovado' || p.status === 'em_revisao'
  ) || [];
  const todosEditados = postsReprovados.length > 0 && 
    postsReprovados.every(p => p.status === 'em_revisao');

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
            {isInternal && plan.status === 'devolvido' && todosEditados && (
              <button onClick={handleReenviarParaCliente} disabled={saving} className="h-10 px-6 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2">
                <Send className="w-4 h-4" /> Reenviar para Cliente
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
        <div className="max-w-7xl mx-auto px-6 flex gap-6">
          <button onClick={() => setActiveTab('posts')} className={cn("py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === 'posts' ? "text-[#ff5351] border-[#ff5351]" : "text-zinc-500 border-transparent hover:text-zinc-300")}>
            Posts ({plan.posts.length})
          </button>
          <button onClick={() => setActiveTab('historico')} className={cn("py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === 'historico' ? "text-[#ff5351] border-[#ff5351]" : "text-zinc-500 border-transparent hover:text-zinc-300")}>
            Histórico
          </button>
        </div>
      </div>

      {activeTab === 'historico' ? (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6">
            <h2 className="text-lg font-black uppercase italic text-white mb-6">Linha do Tempo</h2>
            <div className="space-y-0">
              {getTimelineEvents().map((evento, idx) => (
                <div key={idx} className="flex gap-4 pb-6 relative">
                  {idx < getTimelineEvents().length - 1 && (
                    <div className="absolute left-4 top-8 bottom-0 w-px bg-zinc-800" />
                  )}
                  <div className={cn("w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10", evento.color)}>
                    {evento.icon}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white font-black uppercase text-xs">{evento.title}</p>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{evento.date}</p>
                    {evento.description && (
                      <p className="text-zinc-400 text-xs mt-2 leading-relaxed">{evento.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto flex gap-6 px-6 py-6">
          <aside className="w-80 shrink-0">
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Progresso</span>
                  <span className="text-[10px] font-black text-[#ff5351]">{approvedCount + validatedCount}/{totalPosts}</span>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ff5351] rounded-full transition-all" style={{ width: `${((approvedCount + validatedCount) / totalPosts) * 100}%` }} />
                </div>
              </div>

              {pendingPosts.length > 0 && (
                <div className="p-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 px-2 py-2">Pendentes</p>
                  {pendingPosts.map(post => (
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3", selectedPostId === post.id ? "bg-[#ff5351]/10 border border-[#ff5351]/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{post.type}</p>
                      </div>
                      <div className={cn("w-2 h-2 rounded-full", getStatusDot(post.status))} />
                    </button>
                  ))}
                </div>
              )}

              {approvedPosts.length > 0 && isEquipe && (
                <div className="p-2 border-t border-zinc-800">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 px-2 py-2">Para Validar</p>
                  {approvedPosts.map(post => (
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3", selectedPostId === post.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{post.type}</p>
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
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 opacity-60", selectedPostId === post.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{post.type}</p>
                      </div>
                      <Check className="w-3 h-3 text-emerald-500" />
                    </button>
                  ))}
                </div>
              )}

              {emRevisaoPosts.length > 0 && (
                <div className="p-2 border-t border-zinc-800">
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 px-2 py-2">Em Correção</p>
                  {emRevisaoPosts.map(post => (
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3", selectedPostId === post.id ? "bg-amber-500/10 border border-amber-500/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{post.type}</p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                    </button>
                  ))}
                </div>
              )}

              {reprovedPosts.length > 0 && (
                <div className="p-2 border-t border-zinc-800">
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-600 px-2 py-2">Reprovados</p>
                  {reprovedPosts.map(post => (
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3", selectedPostId === post.id ? "bg-red-500/10 border border-red-500/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{post.headline || 'Sem título'}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{post.type}</p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </button>
                  ))}
                </div>
              )}

              {reprovedOrDiscardedPosts.length > 0 && (
                <div className="p-2 border-t border-zinc-800">
                  <button onClick={() => setShowApprovedInSidebar(!showApprovedInSidebar)} className="w-full flex items-center justify-between px-2 py-2 text-[9px] font-black uppercase tracking-widest text-red-600">
                    <span>Reprovados/Descartados</span>
                    {showApprovedInSidebar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showApprovedInSidebar && reprovedOrDiscardedPosts.map(post => (
                    <button key={post.id} onClick={() => setSelectedPostId(post.id)} className={cn("w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 opacity-50", selectedPostId === post.id ? "bg-red-500/10 border border-red-500/20" : "hover:bg-zinc-800/50")}>
                      <span className="text-[10px] font-black text-zinc-500">#{String(post.number).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white line-through">{post.headline || 'Sem título'}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{post.type}</p>
                      </div>
                      <X className="w-3 h-3 text-red-500" />
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
                      <span className={cn("px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest", getTypeStyles(selectedPost.type))}>
                        {selectedPost.type}
                      </span>
                      <span className="text-[10px] font-black text-zinc-500">#{String(selectedPost.number).padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPost.status === 'aprovado' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[8px] font-black uppercase tracking-widest">✓ Aprovado</span>}
                      {selectedPost.status === 'reprovado' && <span className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[8px] font-black uppercase tracking-widest">✕ Reprovado</span>}
                      {selectedPost.status === 'descartado' && <span className="px-2 py-1 bg-red-600/10 border border-red-600/20 rounded-lg text-red-500 text-[8px] font-black uppercase tracking-widest">✕ Descartado</span>}
                      {selectedPost.status === 'validado_equipe' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[8px] font-black uppercase tracking-widest">✓ Validado</span>}
                      {selectedPost.status === 'em_revisao' && <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[8px] font-black uppercase tracking-widest">Em Revisão</span>}
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

                  {(selectedPost.cta || isEditing) && (
                    <section className="space-y-2">
                      <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Call to Action</label>
                      {isEditing ? (
                        <input value={editingCta} onChange={e => setEditingCta(e.target.value)} className="w-full bg-zinc-900 border border-[#ff5351] rounded-xl p-4 text-white text-sm focus:outline-none" />
                      ) : (
                        <p className="text-sm text-zinc-300">{selectedPost.cta}</p>
                      )}
                    </section>
                  )}

                  {(selectedPost.hashtags || isEditing) && (
                    <section className="space-y-2">
                      <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Hashtags</label>
                      {isEditing ? (
                        <input value={editingHashtags} onChange={e => setEditingHashtags(e.target.value)} className="w-full bg-zinc-900 border border-[#ff5351] rounded-xl p-4 text-white text-sm focus:outline-none" />
                      ) : (
                        <p className="text-sm text-zinc-400">{selectedPost.hashtags}</p>
                      )}
                    </section>
                  )}

                  {selectedPost.type === 'CARROSSEL' && selectedPost.slides && selectedPost.slides.length > 0 && (
                    <section className="space-y-3">
                      <label className="text-[10px] font-black text-[#ff5351] tracking-[0.3em] uppercase block">Slides ({selectedPost.slides.length})</label>
                      <div className="space-y-2">
                        {isEditing ? (
                          editingSlides.map((slide, idx) => (
                            <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 space-y-2">
                              <input value={slide.title} onChange={e => { const s = [...editingSlides]; s[idx].title = e.target.value; setEditingSlides(s); }} placeholder="Título do slide" className="w-full bg-zinc-900 border border-[#ff5351] rounded-lg p-2 text-white text-xs focus:outline-none" />
                              <input value={slide.description} onChange={e => { const s = [...editingSlides]; s[idx].description = e.target.value; setEditingSlides(s); }} placeholder="Descrição do slide" className="w-full bg-zinc-900 border border-[#ff5351] rounded-lg p-2 text-white text-xs focus:outline-none" />
                            </div>
                          ))
                        ) : (
                          selectedPost.slides.map((slide, idx) => (
                            <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                              <div className="text-[10px] font-black uppercase text-white mb-1">Slide {idx + 1} — {slide.title}</div>
                              {slide.description && <div className="text-[11px] text-zinc-400 leading-relaxed">{slide.description}</div>}
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  )}

                  {isEditing && isInternal && (
                    <section className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 tracking-[0.3em] uppercase block">Comentário para o cliente (opcional)</label>
                      <textarea value={editorComment} onChange={e => setEditorComment(e.target.value)} rows={3} placeholder="Ex: Ajustei o tom da legenda conforme solicitado..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-[#ff5351] outline-none resize-none" />
                    </section>
                  )}

                  {showReprovalInput && (
                    <section className="space-y-3 p-4 bg-red-500/5 rounded-2xl animate-in slide-in-from-bottom-4 text-left">
                      <label className="text-[10px] font-black text-red-500 tracking-[0.3em] uppercase block">Motivo do Ajuste</label>
                      <textarea value={reprovalComment} onChange={(e) => setReprovalComment(e.target.value)} placeholder="O que deve ser alterado neste post?" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-white focus:border-red-500 outline-none resize-none min-h-[100px]" />
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
                        {selectedPost.approvals.map((approval: any, idx: number) => (
                          <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                              {approval.action === 'aprovado' && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">✓ Aprovado</span>}
                              {approval.action === 'reprovado' && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-red-500/10 text-red-500 border border-red-500/20">✕ Reprovado</span>}
                              {approval.action === 'editado' && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-amber-500/10 text-amber-400 border border-amber-500/20">✎ Editado pelo Cliente</span>}
                              {approval.action === 'editado_equipe' && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-blue-500/10 text-blue-400 border border-blue-500/20">✎ Editado pela Equipe</span>}
                              {approval.action === 'validado_equipe' && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">✓ Validado pela Equipe</span>}
                              {approval.action === 'editado_redator' && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-purple-500/10 text-purple-400 border border-purple-500/20">✎ Editado pelo Redator</span>}
                              <span className="text-[9px] text-zinc-500">{new Date(approval.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {approval.comment && <p className="text-[11px] text-zinc-400 leading-relaxed">{approval.comment}</p>}
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
                        <button onClick={handleValidatePost} disabled={saving} className="h-12 px-8 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                          <Check className="w-4 h-4" /> Validar Post
                        </button>
                        <button onClick={startEditing} className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700">
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
                          <button onClick={startEditing} className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700">
                            <Edit3 className="w-4 h-4" /> Editar Texto
                          </button>
                        )}
                      </>
                    )}

                    {!isEquipe && !isInternal && hasApprovalPower && (plan.status === 'aguardando_cliente') && (
                      <>
                        <button onClick={() => handleUpdateStatus(selectedPost.id, 'aprovado')} disabled={saving} className="h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20 disabled:opacity-50">
                          <Check className="w-4 h-4" /> Aprovar Post
                        </button>
                        <button onClick={() => { setShowReprovalModal(true); setIsEditing(false); }} className="h-12 px-6 bg-zinc-800 border border-red-500/20 text-red-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                          <X className="w-4 h-4" /> Reprovar
                        </button>
                        <button onClick={startEditing} className="h-12 px-6 bg-zinc-800 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center gap-2 border border-zinc-700">
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
      )}

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
                  <p className="text-zinc-500 text-xs leading-relaxed">Validação concluída! O redator foi notificado para iniciar a produção.</p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black uppercase italic text-white text-center mb-1">Revisão Concluída</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center mb-6">Planejamento avaliado com sucesso</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#121212] border border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black italic text-emerald-500 mb-1">{aprovados}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Aprovados</div>
                  </div>
                  <div className="bg-[#121212] border border-zinc-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black italic text-red-400 mb-1">{reprovados}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-red-800">Reprovados</div>
                  </div>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full mb-6 overflow-hidden">
                  <div className="h-full bg-[#ff5351] rounded-full transition-all duration-1000" style={{ width: `${(aprovados / totalPosts) * 100}%` }} />
                </div>
                {reprovados > 0 ? (
                  <div className="mb-6 text-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[9px] font-black uppercase tracking-widest mb-3">
                      ⚠ {reprovados} posts aguardando correção
                    </span>
                    <p className="text-zinc-500 text-xs leading-relaxed">Os posts reprovados foram enviados para o redator corrigir. Você será notificado quando estiverem prontos.</p>
                  </div>
                ) : (
                  <div className="mb-6 text-center">
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[9px] font-black uppercase tracking-widest mb-3">
                      ✓ Aprovação total!
                    </span>
                    <p className="text-zinc-500 text-xs leading-relaxed">Todos os posts foram aprovados! O administrador foi notificado e a produção já pode começar.</p>
                  </div>
                )}
              </>
            )}

            <button onClick={() => { setShowCompletionModal(false); navigate('/projetos'); }} className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all">
              OK, Entendido
            </button>
          </div>
        </div>
      )}

      {showReprovalModal && selectedPost && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowReprovalModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-[20px] p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black uppercase italic text-white mb-1">O que deseja fazer?</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">Post {selectedPost.number} — {selectedPost.headline}</p>

            <div className="space-y-3 mb-6">
              <button onClick={() => setReprovalType('correcao')} className={cn("w-full p-4 rounded-2xl border text-left transition-all", reprovalType === 'correcao' ? "bg-amber-500/10 border-amber-500/30" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600")}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm">✎</div>
                  <div>
                    <p className="text-white font-black uppercase text-xs">Solicitar Correção</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">A redatora ajusta o texto conforme sua orientação</p>
                  </div>
                </div>
              </button>

              <button onClick={() => setReprovalType('descartar')} className={cn("w-full p-4 rounded-2xl border text-left transition-all", reprovalType === 'descartar' ? "bg-red-500/10 border-red-500/30" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600")}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-sm">✕</div>
                  <div>
                    <p className="text-white font-black uppercase text-xs">Não Usar Este Post</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">A redatora cria um novo post para substituir este</p>
                  </div>
                </div>
              </button>
            </div>

            {reprovalType && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  {reprovalType === 'correcao' ? 'O que precisa ser corrigido?' : 'Motivo do descarte (opcional)'}
                </label>
                <textarea value={reprovalComment} onChange={e => setReprovalComment(e.target.value)} rows={3} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white text-sm focus:border-[#ff5351] outline-none resize-none" placeholder={reprovalType === 'correcao' ? "Ex: O tom está muito formal..." : "Ex: Tema já foi abordado..."} />
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowReprovalModal(false); setReprovalType(null); setReprovalComment(''); }} className="flex-1 h-11 bg-zinc-900 border border-zinc-800 text-zinc-500 font-black uppercase tracking-widest text-[9px] rounded-xl hover:text-white transition-all">
                Cancelar
              </button>
              <button onClick={() => handleConfirmReproval()} disabled={!reprovalType} className="flex-1 h-11 bg-[#ff5351] text-white font-black uppercase tracking-widest text-[9px] rounded-xl hover:brightness-110 transition-all disabled:opacity-30">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
