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
    await updateDoc(doc(db, 'demandas', planId), {
      status: 'aprovado_equipe',
      updatedAt: serverTimestamp()
    });
    await notificacaoService.criar({
      para: 'boranovfilms@gmail.com',
      tipo: 'planejamento_validado_equipe',
      titulo: 'Planejamento Aprovado — Pronto para Processar!',
      descricao: `O planejamento "${plan.name}" foi aprovado. Acesse para processar as demandas.`,
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
            </p>\n            <h1 className=\"text-4xl font-black text-white uppercase italic tracking-tight\">\n              {plan.name}\n            </h1>\n            <p className=\"text-zinc-500 text-sm mt-1\">{plan.monthReference}</p>\n          </div>\n          <div className=\"shrink-0 mt-2 flex flex-col items-end gap-3\">\n            {getStatusLabel(plan.status)}\n            \n            {/* Progresso */}\n            <div className=\"flex items-center gap-2\">\n              <div className=\"w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden\">\n                <div\n                  className=\"h-full bg-[#ff5351] rounded-full transition-all duration-500\"\n                  style={{ width: `${progresso}%` }}\n                />\n              </div>\n              <span className=\"text-[10px] font-black text-[#ff5351]\">{progresso}%</span>\n            </div>\n\n            {/* Botão Processar Planejamento */}\n            {isMasterOrRedator && plan.status === 'aprovado_equipe' && (\n              <button\n                onClick={() => navigate(`/processar-planejamento/${planId}`)}\n                className=\"h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-[#ff5351]/20\"\n              >\n                <Zap className=\"w-4 h-4\" /> Processar Planejamento\n              </button>\n            )}\n          </div>\n        </div>\n      </header>\n\n      {/* Texto do Planejamento */}\n      <div className=\"bg-[#1f1f1f] border border-zinc-800 rounded-[32px] overflow-hidden\">\n        <div className=\"p-6 border-b border-zinc-800 flex items-center justify-between\">\n          <h2 className=\"text-sm font-black uppercase tracking-widest text-white\">\n            Texto do Planejamento\n          </h2>\n          {canEdit && !isEditing && (\n            <button\n              onClick={() => setIsEditing(true)}\n              className=\"px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all\"\n            >\n              ✏️ Editar Texto\n            </button>\n          )}\n          {isEditing && (\n            <div className=\"flex items-center gap-2\">\n              <button\n                onClick={() => { setIsEditing(false); setEditingText(plan.currentText || ''); }}\n                className=\"px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all\"\n              >\n                Cancelar\n              </button>\n              <button\n                onClick={handleSaveText}\n                disabled={saving}\n                className=\"px-4 py-2 bg-[#ff5351] rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:brightness-110 transition-all flex items-center gap-2\"\n              >\n                <Save className=\"w-3 h-3\" /> Salvar\n              </button>\n            </div>\n          )}\n        </div>\n\n        <div className=\"p-8\">\n          {isEditing ? (\n            <textarea\n              value={editingText}\n              onChange={e => setEditingText(e.target.value)}\n              rows={30}\n              className=\"w-full bg-zinc-900 border border-[#ff5351] rounded-2xl p-6 text-white text-sm leading-relaxed outline-none resize-none font-mono\"\n            />\n          ) : (\n            <pre className=\"text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans\">\n              {plan.currentText || 'Nenhum texto disponível'}\n            </pre>\n          )}\n        </div>\n      </div>\n\n      {/* Histórico de Edições */}\n      {plan.history && plan.history.length > 0 && (\n        <div className=\"bg-[#1f1f1f] border border-zinc-800 rounded-[32px] overflow-hidden\">\n          <button\n            onClick={() => setShowHistory(!showHistory)}\n            className=\"w-full p-6 flex items-center justify-between\"\n          >\n            <h2 className=\"text-sm font-black uppercase tracking-widest text-white\">\n              Histórico de Edições ({plan.history.length})\n            </h2>\n            {showHistory ? (\n              <ChevronUp className=\"w-4 h-4 text-zinc-500\" />\n            ) : (\n              <ChevronDown className=\"w-4 h-4 text-zinc-500\" />\n            )}\n          </button>\n\n          {showHistory && (\n            <div className=\"px-6 pb-6 space-y-4\">\n              {plan.history.map((item: any, index: number) => (\n                <div key={index} className=\"bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3\">\n                  <div className=\"flex items-center gap-3\">\n                    <div className=\"w-8 h-8 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 flex items-center justify-center\">\n                      <User className=\"w-4 h-4 text-[#ff5351]\" />\n                    </div>\n                    <div>\n                      <p className=\"text-white text-xs font-black uppercase\">{item.userName}</p>\n                      <div className=\"flex items-center gap-1 text-zinc-500 text-[10px]\">\n                        <Clock className=\"w-3 h-3\" />\n                        {new Intl.DateTimeFormat('pt-BR', {\n                          day: '2-digit', month: '2-digit', year: 'numeric',\n                          hour: '2-digit', minute: '2-digit'\n                        }).format(new Date(item.date))}\n                      </div>\n                    </div>\n                    <span className=\"ml-auto px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-black uppercase tracking-widest text-zinc-400\">\n                      {item.action === 'editado_equipe' ? 'Equipe' : 'Cliente'}\n                    </span>\n                  </div>\n\n                  {item.textBefore && item.textAfter && (\n                    <div className=\"space-y-2\">\n                      <div className=\"bg-red-500/5 border border-red-500/20 rounded-xl p-3\">\n                        <p className=\"text-[9px] font-black uppercase tracking-widest text-red-400 mb-1\">Antes</p>\n                        <p className=\"text-zinc-400 text-xs leading-relaxed line-clamp-3\">{item.textBefore}</p>\n                      </div>\n                      <div className=\"bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3\">\n                        <p className=\"text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-1\">Depois</p>\n                        <p className=\"text-zinc-400 text-xs leading-relaxed line-clamp-3\">{item.textAfter}</p>\n                      </div>\n                    </div>\n                  )}\n                </div>\n              ))}\n            </div>\n          )}\n        </div>\n      )}\n\n      {/* Posts criados (após aprovação) */}\n      {plan.posts && plan.posts.length > 0 && (\n        <div className=\"bg-[#1f1f1f] border border-zinc-800 rounded-[32px] overflow-hidden\">\n          <div className=\"p-6 border-b border-zinc-800\">\n            <h2 className=\"text-sm font-black uppercase tracking-widest text-white\">\n              Posts Criados ({plan.posts.length})\n            </h2>\n          </div>\n          <div className=\"p-6 space-y-3\">\n            {plan.posts.map((post: any) => (\n              <div key={post.id} className=\"flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl\">\n                <span className={cn(\n                  \"px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border\",\n                  post.type === 'FEED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :\n                  post.type === 'REEL' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :\n                  post.type === 'STORIES' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :\n                  post.type === 'CARROSSEL' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :\n                  'bg-red-500/10 text-red-400 border-red-500/20'\n                )}>\n                  {post.type}\n                </span>\n                <span className=\"text-zinc-500 text-[10px] font-black\">#{String(post.number).padStart(2, '0')}</span>\n                <span className=\"text-white text-sm font-medium flex-1 truncate\">{post.headline}</span>\n                <span className=\"text-zinc-500 text-xs\">{post.publishDate}</span>\n                <span className={cn(\n                  \"px-2 py-0.5 rounded-full border text-[9px] font-black uppercase\",\n                  post.status === 'pendente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :\n                  post.status === 'em_andamento' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :\n                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'\n                )}>\n                  {post.status}\n                </span>\n              </div>\n            ))}\n          </div>\n        </div>\n      )}\n\n      {/* Botões de Ação */}\n      {canApprove && (\n        <div className=\"fixed bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-md border-t border-zinc-800 z-50\">\n          <div className=\"max-w-4xl mx-auto flex items-center justify-end gap-4\">\n            {isMasterOrRedator && plan.status === 'rascunho' && (\n              <>\n                <button\n                  onClick={handleMasterReject}\n                  disabled={saving}\n                  className=\"h-12 px-8 bg-zinc-800 border border-zinc-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all flex items-center gap-2\"\n                >\n                  <X className=\"w-4 h-4\" /> Devolver\n                </button>\n                <button\n                  onClick={handleMasterApprove}\n                  disabled={saving}\n                  className=\"h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl\"\n                >\n                  {saving ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Check className=\"w-4 h-4\" />}\n                  Aprovar e Enviar para Cliente\n                </button>\n              </>\n            )}\n\n            {isCliente && plan.status === 'aguardando_cliente' && (\n              <button\n                onClick={handleClientApprove}\n                disabled={saving}\n                className=\"h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl\"\n              >\n                {saving ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Check className=\"w-4 h-4\" />}\n                Aprovar Planejamento\n              </button>\n            )}\n\n            {isEquipe && plan.status === 'aguardando_validacao_equipe' && (\n              <button\n                onClick={handleEquipeValidate}\n                disabled={saving}\n                className=\"h-12 px-8 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl\"\n              >\n                {saving ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Check className=\"w-4 h-4\" />}\n                Validar Planejamento\n              </button>\n            )}\n          </div>\n        </div>\n      )}\n    </div>\n  );\n}\n