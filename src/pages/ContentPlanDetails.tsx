import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Check, X, Clock, User, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { contentPlanService, ContentPlan, parsePostsFromText } from '../services/contentPlanService';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

export default function ContentPlanDetails() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('cliente');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [hasTeam, setHasTeam] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    loadAll();
  }, [planId]);

  const loadAll = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const email = user?.email?.toLowerCase().trim() || '';
      setUserEmail(email);

      let role = 'cliente';
      let name = user?.displayName || '';

      if (email === 'admin@boraselect.com.br') {
        role = 'master';
        name = 'Admin';
      } else {
        const qBora = query(collection(db, 'boraselect'), where('email', '==', email));
        const snapBora = await getDocs(qBora);
        if (!snapBora.empty) {
          role = snapBora.docs[0].data().role || 'redator';
          name = snapBora.docs[0].data().name || '';
        } else {
          const qCliente = query(collection(db, 'clientes'), where('email', '==', email));
          const snapCliente = await getDocs(qCliente);
          if (!snapCliente.empty) {
            role = snapCliente.docs[0].data().role || 'cliente';
            name = snapCliente.docs[0].data().name || '';
          }
        }
      }

      setUserRole(role);
      setUserName(name);

      const planData = await contentPlanService.getPlanById(planId);
      if (!planData) {
        toast.error('Planejamento não encontrado');
        navigate(-1);
        return;
      }
      setPlan(planData);
      setEditingText(planData.currentText || '');

      const clientSnap = await getDoc(doc(db, 'clientes', planData.clientId));
      if (clientSnap.exists()) {
        setClientEmail(clientSnap.data().email?.toLowerCase() || '');
        setClientId(planData.clientId);
      }

      const teamSnap = await getDocs(query(
        collection(db, 'clientes'),
        where('type', '==', 'membro'),
        where('companyId', '==', planData.clientId)
      ));
      setHasTeam(!teamSnap.empty);

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const calcProgresso = (status: string) => {
    const map: any = {
      rascunho: 10,
      aguardando_cliente: 30,
      aguardando_validacao_equipe: 50,
      aprovado_equipe: 100,
      em_producao: 70,
      concluido: 100,
      devolvido: 20,
    };
    return map[status] || 0;
  };

  const handleSaveText = async () => {
    if (!planId || !plan || !user) return;
    setSaving(true);
    try {
      const oldText = plan.currentText;
      if (oldText === editingText) {
        toast('Nenhuma alteração detectada');
        setIsEditing(false);
        return;
      }

      const historyItem = {
        userId: user.uid,
        userName: userName || user.email || '',
        userEmail: user.email || '',
        date: new Date().toISOString(),
        textBefore: oldText,
        textAfter: editingText,
        action: userRole === 'equipe' ? 'editado_equipe' : 'edicao'
      };

      await updateDoc(doc(db, 'demandas', planId), {
        currentText: editingText,
        history: [...(plan.history || []), historyItem],
        updatedAt: serverTimestamp()
      });

      toast.success('Texto salvo!');
      setIsEditing(false);
      await loadAll();
    } catch (error) {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleMasterApprove = async () => {
    if (!planId || !plan) return;
    setSaving(true);
    try {
      await contentPlanService.updateStatus(planId, 'aguardando_cliente');
      await notificacaoService.criar({
        para: clientEmail,
        tipo: 'planejamento_enviado',
        titulo: 'Novo Planejamento para Aprovação',
        descricao: `O planejamento "${plan.name}" está aguardando sua aprovação`,
        planId,
        visto: false,
        criadoEm: new Date().toISOString()
      });
      toast.success('Enviado para o cliente!');
      await loadAll();
    } catch (error) {
      toast.error('Erro ao aprovar');
    } finally {
      setSaving(false);
    }
  };

  const handleMasterReject = async () => {
    if (!planId) return;
    setSaving(true);
    try {
      await contentPlanService.updateStatus(planId, 'devolvido');
      toast.success('Devolvido para o redator!');
      await loadAll();
    } catch (error) {
      toast.error('Erro ao devolver');
    } finally {
      setSaving(false);
    }
  };

  const handleClientApprove = async () => {
    if (!planId || !plan || !user) return;
    setSaving(true);
    try {
      if (hasTeam) {
        await contentPlanService.updateStatus(planId, 'aguardando_validacao_equipe');
        const teamSnap = await getDocs(query(
          collection(db, 'clientes'),
          where('type', '==', 'membro'),
          where('companyId', '==', clientId)
        ));
        for (const member of teamSnap.docs) {
          await notificacaoService.criar({
            para: member.data().email?.toLowerCase(),
            tipo: 'planejamento_aprovado_cliente',
            titulo: 'Planejamento Aguardando Validação',
            descricao: `O planejamento "${plan.name}" foi aprovado pelo cliente e aguarda sua validação`,
            planId,
            visto: false,
            criadoEm: new Date().toISOString()
          });
        }
        toast.success('Aprovado! Equipe foi notificada para validar.');
      } else {
        await criarPostsEFinalizar();
      }
      await loadAll();
    } catch (error) {
      toast.error('Erro ao aprovar');
    } finally {
      setSaving(false);
    }
  };

  const handleEquipeValidate = async () => {
    if (!planId || !plan) return;
    setSaving(true);
    try {
      await criarPostsEFinalizar();
      await loadAll();
    } catch (error) {
      toast.error('Erro ao validar');
    } finally {
      setSaving(false);
    }
  };

  const criarPostsEFinalizar = async () => {
    if (!planId || !plan) return;
    const posts = parsePostsFromText(plan.currentText || editingText);
    await updateDoc(doc(db, 'demandas', planId), {
      posts,
      status: 'aprovado_equipe',
      updatedAt: serverTimestamp()
    });
    await notificacaoService.criar({
      para: 'boranovfilms@gmail.com',
      tipo: 'planejamento_validado_equipe',
      titulo: 'Planejamento Aprovado!',
      descricao: `O planejamento "${plan.name}" foi aprovado e está pronto para delegação`,
      planId,
      visto: false,
      criadoEm: new Date().toISOString()
    });
    toast.success('Planejamento aprovado! Redator foi notificado.');
  };

  const getStatusLabel = (status: string) => {
    const labels: any = {
      rascunho: { label: 'Rascunho', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
      aguardando_cliente: { label: 'Aguardando Cliente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      aguardando_validacao_equipe: { label: 'Aguardando Validação', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      aprovado_equipe: { label: 'Aprovado ✓', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      devolvido: { label: 'Devolvido', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const config = labels[status] || labels.rascunho;
    return <span className={cn("px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest", config.class)}>{config.label}</span>;
  };

  const isMasterOrRedator = ['master', 'admin', 'redator'].includes(userRole);
  const isCliente = userRole === 'cliente';
  const isEquipe = userRole === 'equipe';

  const canEdit = (isCliente && plan?.status === 'aguardando_cliente') ||
    (isEquipe && plan?.status === 'aguardando_validacao_equipe');

  const canApprove = (isMasterOrRedator && plan?.status === 'rascunho') ||
    (isCliente && plan?.status === 'aguardando_cliente') ||
    (isEquipe && plan?.status === 'aguardando_validacao_equipe');

  if (loading || !plan) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  const progresso = calcProgresso(plan.status);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 text-left">

      {/* Header */}
      <header className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
              Planejamento de Conteúdo
            </p>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">
              {plan.name}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">{plan.monthReference}</p>
          </div>
          <div className="shrink-0 mt-2 flex flex-col items-end gap-3">
            {getStatusLabel(plan.status)}
            
            {/* Progresso */}
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff5351] rounded-full transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <span className="text-[10px] font-black text-[#ff5351]">{progresso}%</span>
            </div>

            {/* Botão Delegar */}
            {isMasterOrRedator && plan.status === 'aprovado_equipe' && (
              <button
                onClick={() => navigate(`/planejamento/${planId}/tarefas`)}
                className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-[#ff5351]/20"
              >
                <Zap className="w-4 h-4" /> Delegar Tarefas
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Texto do Planejamento */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[32px] overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">
            Texto do Planejamento
          </h2>
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
            >
              ✏️ Editar Texto
            </button>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setIsEditing(false); setEditingText(plan.currentText || ''); }}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveText}
                disabled={saving}
                className="px-4 py-2 bg-[#ff5351] rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Save className="w-3 h-3" /> Salvar
              </button>
            </div>
          )}
        </div>

        <div className="p-8">
          {isEditing ? (
            <textarea
              value={editingText}
              onChange={e => setEditingText(e.target.value)}
              rows={30}
              className="w-full bg-zinc-900 border border-[#ff5351] rounded-2xl p-6 text-white text-sm leading-relaxed outline-none resize-none font-mono"
            />
          ) : (
            <pre className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {plan.currentText || 'Nenhum texto disponível'}
            </pre>
          )}
        </div>
      </div>

      {/* Histórico de Edições */}
      {plan.history && plan.history.length > 0 && (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[32px] overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-6 flex items-center justify-between"
          >
            <h2 className="text-sm font-black uppercase tracking-widest text-white">
              Histórico de Edições ({plan.history.length})
            </h2>
            {showHistory ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </button>

          {showHistory && (
            <div className="px-6 pb-6 space-y-4">
              {plan.history.map((item: any, index: number) => (
                <div key={index} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-[#ff5351]" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-black uppercase">{item.userName}</p>
                      <div className="flex items-center gap-1 text-zinc-500 text-[10px]">
                        <Clock className="w-3 h-3" />
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }).format(new Date(item.date))}
                      </div>
                    </div>
                    <span className="ml-auto px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {item.action === 'editado_equipe' ? 'Equipe' : 'Cliente'}
                    </span>
                  </div>

                  {item.textBefore && item.textAfter && (
                    <div className="space-y-2">
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-1">Antes</p>
                        <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">{item.textBefore}</p>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1">Depois</p>
                        <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">{item.textAfter}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Posts criados (após aprovação) */}
      {plan.posts && plan.posts.length > 0 && (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[32px] overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">
              Posts Criados ({plan.posts.length})
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {plan.posts.map((post: any) => (
              <div key={post.id} className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                  post.type === 'FEED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  post.type === 'REEL' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  post.type === 'STORIES' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  post.type === 'CARROSSEL' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
                )}>
                  {post.type}
                </span>
                <span className="text-zinc-500 text-[10px] font-black">#{String(post.number).padStart(2, '0')}</span>
                <span className="text-white text-sm font-medium flex-1 truncate">{post.headline}</span>
                <span className="text-zinc-500 text-xs">{post.publishDate}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full border text-[9px] font-black uppercase",
                  post.status === 'pendente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  post.status === 'em_andamento' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                )}>
                  {post.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botões de Ação */}
      {canApprove && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-md border-t border-zinc-800 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-end gap-4">
            {isMasterOrRedator && plan.status === 'rascunho' && (
              <>
                <button
                  onClick={handleMasterReject}
                  disabled={saving}
                  className="h-12 px-8 bg-zinc-800 border border-zinc-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Devolver
                </button>
                <button
                  onClick={handleMasterApprove}
                  disabled={saving}
                  className="h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Aprovar e Enviar para Cliente
                </button>
              </>
            )}

            {isCliente && plan.status === 'aguardando_cliente' && (
              <button
                onClick={handleClientApprove}
                disabled={saving}
                className="h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Aprovar Planejamento
              </button>
            )}

            {isEquipe && plan.status === 'aguardando_validacao_equipe' && (
              <button
                onClick={handleEquipeValidate}
                disabled={saving}
                className="h-12 px-8 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Validar Planejamento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
