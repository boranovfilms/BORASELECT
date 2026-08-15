import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Check, X, Clock, User, ChevronDown, ChevronUp, Zap,
  CalendarDays, List, GripVertical, Undo2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { contentPlanService, ContentPlan } from '../services/contentPlanService';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ *
 * TIPOS DE CONTEÚDO — cores e rótulos
 * ------------------------------------------------------------------ */
type TipoConteudo = 'FEED' | 'CARROSSEL' | 'REEL' | 'STORIES';

const TIPOS: Record<TipoConteudo, { cor: string; bg: string; bgHover: string; texto: string }> = {
  FEED:      { cor: '#ff5351', bg: 'rgba(255,83,81,0.17)',  bgHover: 'rgba(255,83,81,0.25)',  texto: '#ffb0af' },
  CARROSSEL: { cor: '#8ba3ff', bg: 'rgba(139,163,255,0.15)', bgHover: 'rgba(139,163,255,0.23)', texto: '#b9c6ff' },
  REEL:      { cor: '#22c55e', bg: 'rgba(34,197,94,0.16)',  bgHover: 'rgba(34,197,94,0.24)',  texto: '#79e3a1' },
  STORIES:   { cor: '#f5c14a', bg: 'rgba(245,193,74,0.14)', bgHover: 'rgba(245,193,74,0.22)', texto: '#f3cd7e' },
};

const normalizaTipo = (v: any): TipoConteudo => {
  const t = String(v || '').toUpperCase().trim();
  if (t.includes('CARROSSEL') || t.includes('CARROUSEL')) return 'CARROSSEL';
  if (t.includes('REEL') || t.includes('VIDEO') || t.includes('VÍDEO')) return 'REEL';
  if (t.includes('STOR')) return 'STORIES';
  return 'FEED';
};

/* Etapas do fluxo novo (7 passos) */
const ETAPAS = ['Criação', 'Texto', 'Validação', 'Produção', 'Liberar', 'Arte', 'Programar'];

const etapaDoStatus = (status: string): number => {
  const map: Record<string, number> = {
    rascunho: 1,
    devolvido: 1,
    aguardando_cliente: 2,
    aguardando_validacao_equipe: 3,
    aprovado_equipe: 4,
    em_producao: 4,
    concluido: 7,
  };
  return map[status] || 1;
};

/* ------------------------------------------------------------------ *
 * DATAS — o parser grava "DD/MM/AAAA"; aceitamos ISO também
 * ------------------------------------------------------------------ */
const parseData = (v: any): Date | null => {
  if (!v) return null;
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const paraBR = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/* ------------------------------------------------------------------ *
 * COMPONENTE
 * ------------------------------------------------------------------ */
export default function ContentPlanDetails() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('cliente');
  const [userName, setUserName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [hasTeam, setHasTeam] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTexto, setShowTexto] = useState(false);

  /* estado da visão nova */
  const [modo, setModo] = useState<'agenda' | 'linha'>('agenda');
  const [aberto, setAberto] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [diaAlvo, setDiaAlvo] = useState<string | null>(null);
  const [ultimoMove, setUltimoMove] = useState<{ idx: number; de: any } | null>(null);

  const user = auth.currentUser;

  useEffect(() => { loadAll(); }, [planId]);

  /* o aviso de "data alterada" some sozinho depois de 6s */
  useEffect(() => {
    if (!ultimoMove) return;
    const t = setTimeout(() => setUltimoMove(null), 6000);
    return () => clearTimeout(t);
  }, [ultimoMove]);

  const loadAll = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const email = user?.email?.toLowerCase().trim() || '';

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
      setPosts(Array.isArray((planData as any).posts) ? (planData as any).posts : []);

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

  /* ---------------- conteúdos normalizados ---------------- */
  const conteudos = useMemo(() => posts.map((p, idx) => ({
    idx,
    tipo: normalizaTipo(p.type ?? p.tipo ?? p.contentType),
    tema: p.headline || p.tema || p.title || 'Sem tema',
    data: parseData(p.publishDate ?? p.data ?? p.date),
    raw: p,
  })), [posts]);

  const comData = useMemo(
    () => conteudos.filter(c => c.data).sort((a, b) => a.data!.getTime() - b.data!.getTime()),
    [conteudos]
  );
  const semData = useMemo(() => conteudos.filter(c => !c.data), [conteudos]);

  /* mês exibido na agenda: o do primeiro conteúdo com data */
  const mesRef = useMemo(() => {
    if (comData.length) return { ano: comData[0].data!.getFullYear(), mes: comData[0].data!.getMonth() };
    const hoje = new Date();
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
  }, [comData]);

  const porDia = useMemo(() => {
    const m: Record<string, typeof conteudos> = {};
    comData.forEach(c => {
      const d = c.data!;
      if (d.getFullYear() !== mesRef.ano || d.getMonth() !== mesRef.mes) return;
      const k = String(d.getDate());
      (m[k] = m[k] || []).push(c);
    });
    return m;
  }, [comData, mesRef]);

  const composicao = useMemo(() => {
    const c: Record<string, number> = {};
    conteudos.forEach(x => { c[x.tipo] = (c[x.tipo] || 0) + 1; });
    return Object.entries(c).map(([t, n]) => `${n} ${t.toLowerCase()}`).join(' · ');
  }, [conteudos]);

  const janela = useMemo(() => {
    if (!comData.length) return 'sem datas definidas';
    const a = comData[0].data!, b = comData[comData.length - 1].data!;
    return `${String(a.getDate()).padStart(2, '0')} a ${String(b.getDate()).padStart(2, '0')} de ${MESES[b.getMonth()]}`;
  }, [comData]);

  /* ---------------- permissões ---------------- */
  const isMasterOrRedator = ['master', 'admin', 'redator'].includes(userRole);
  const isCliente = userRole === 'cliente';
  const isEquipe = userRole === 'equipe';

  /* só a equipe interna, e só enquanto é rascunho, pode remarcar datas */
  const podeArrastar = isMasterOrRedator && ['rascunho', 'devolvido'].includes(plan?.status || '');

  const canEdit = (isCliente && plan?.status === 'aguardando_cliente') ||
    (isEquipe && plan?.status === 'aguardando_validacao_equipe');

  const canApprove = (isMasterOrRedator && plan?.status === 'rascunho') ||
    (isCliente && plan?.status === 'aguardando_cliente') ||
    (isEquipe && plan?.status === 'aguardando_validacao_equipe');

  /* ---------------- mover conteúdo de data ---------------- */
  const gravarPosts = async (novos: any[]) => {
    if (!planId) return;
    await updateDoc(doc(db, 'demandas', planId), { posts: novos, updatedAt: serverTimestamp() });
  };

  const moverPara = async (idx: number, dia: number) => {
    const alvo = new Date(mesRef.ano, mesRef.mes, dia);
    const atual = conteudos[idx]?.data;
    if (atual && atual.getDate() === dia && atual.getMonth() === mesRef.mes) return;

    /* casa pelo id do post — mais seguro que a posição no array */
    const postId = posts[idx]?.id;
    const anterior = posts[idx]?.publishDate ?? null;
    const novos = posts.map((p, i) =>
      (postId ? p.id === postId : i === idx) ? { ...p, publishDate: paraBR(alvo) } : p
    );

    setPosts(novos);
    setUltimoMove({ idx, de: anterior });

    try {
      await gravarPosts(novos);
      toast.success(`${conteudos[idx].tipo} movido para ${String(dia).padStart(2, '0')}/${String(mesRef.mes + 1).padStart(2, '0')}`);
    } catch {
      setPosts(posts);
      setUltimoMove(null);
      toast.error('Não foi possível salvar a nova data');
    }
  };

  const desfazerMove = async () => {
    if (!ultimoMove) return;
    const novos = posts.map((p, i) => i === ultimoMove.idx ? { ...p, publishDate: ultimoMove.de } : p);
    setPosts(novos);
    setUltimoMove(null);
    try { await gravarPosts(novos); } catch { toast.error('Erro ao desfazer'); }
  };

  /* ---------------- ações originais (mantidas) ---------------- */
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
      const clienteDoc = await getDoc(doc(db, 'clientes', plan.clientId));
      const emailCliente = clienteDoc.exists() ? clienteDoc.data().email?.toLowerCase() : clientEmail;
      await notificacaoService.criar({
        para: emailCliente,
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
      rascunho: { label: 'Rascunho', class: 'bg-[#ff5351]/10 text-[#ff8c8b] border-[#ff5351]/30' },
      aguardando_cliente: { label: 'Aguardando Cliente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      aguardando_validacao_equipe: { label: 'Aguardando Validação', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      aprovado_equipe: { label: 'Aprovado ✓', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      devolvido: { label: 'Devolvido', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      em_producao: { label: 'Em Produção', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    };
    const config = labels[status] || labels.rascunho;
    return <span className={cn("px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.16em]", config.class)}>{config.label}</span>;
  };

  if (loading || !plan) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  const etapaAtual = etapaDoStatus(plan.status);
  const raio = 31, circ = 2 * Math.PI * raio;
  const dash = circ * (etapaAtual / ETAPAS.length);

  /* ---------------- células da agenda ---------------- */
  const primeiroDiaSemana = new Date(mesRef.ano, mesRef.mes, 1).getDay();
  const diasNoMes = new Date(mesRef.ano, mesRef.mes + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7) celulas.push(null);

  const detalhe = aberto !== null ? conteudos[aberto] : null;

  /* campos da gaveta, variando por tipo */
  const camposDoTipo = (c: any): [string, any][] => {
    const p = c.raw;
    const f: [string, any][] = [['Legenda', p.caption || p.legenda]];
    if (c.tipo === 'FEED') f.push(['Texto da arte', p.textoArte], ['Sugestão visual', p.sugestaoVisual]);
    if (c.tipo === 'CARROSSEL') f.push(['Slides', p.slides], ['Sugestão visual', p.sugestaoVisual]);
    if (c.tipo === 'REEL') f.push(['Duração', p.duracao], ['Roteiro', p.roteiro], ['Sugestão visual (capa)', p.sugestaoVisual]);
    if (c.tipo === 'STORIES') f.push(['Sugestão visual', p.sugestaoVisual]);
    f.push(['Hashtags', p.hashtags], ['CTA', p.cta]);
    if (p.strategicFunction) f.push(['Função estratégica', p.strategicFunction]);
    f.push(['Publicar em', c.data ? paraBR(c.data) : 'sem data']);
    return f.filter(([, v]) => v !== undefined && v !== null && v !== '');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-32 text-left">
      {/* -------- voltar -------- */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      {/* -------- CABEÇALHO COMPACTO -------- */}
      <header className="bg-[#1f1f1f] border border-zinc-800 rounded-[26px] p-6 md:p-7 flex gap-7 items-center flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <p className="text-[#ff5351] text-[11px] font-black uppercase tracking-[0.2em]">
            {plan.monthReference ? `Planejamento · ${plan.monthReference}` : 'Planejamento de Conteúdo'}
          </p>
          <h1 className="text-2xl md:text-[26px] font-black text-white uppercase italic tracking-tight leading-tight my-2">
            {plan.name}
          </h1>
          <div className="flex flex-wrap gap-2 items-center">
            {getStatusLabel(plan.status)}
            <span className="inline-flex items-center gap-2 bg-[#151515] border border-zinc-800 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-zinc-200">
              {conteudos.length} conteúdo{conteudos.length === 1 ? '' : 's'}
            </span>
            {composicao && (
              <span className="inline-flex items-center gap-2 bg-[#151515] border border-zinc-800 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-zinc-200">
                {composicao}
              </span>
            )}
            <span className="inline-flex items-center gap-2 bg-[#151515] border border-zinc-800 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-zinc-200">
              {janela}
            </span>
          </div>
        </div>

        {/* anel de progresso */}
        <div className="flex items-center gap-4">
          <div className="relative w-[74px] h-[74px] shrink-0">
            <svg width="74" height="74" className="-rotate-90">
              <circle cx="37" cy="37" r={raio} fill="none" stroke="#2e2e2e" strokeWidth="7" />
              <circle
                cx="37" cy="37" r={raio} fill="none" stroke="#ff5351" strokeWidth="7"
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - dash}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <b className="font-display text-[17px] text-white leading-none">
                {etapaAtual}<span className="text-zinc-600">/{ETAPAS.length}</span>
              </b>
              <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">etapa</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Etapa atual</p>
            <p className="text-[16px] font-black text-[#ff5351] uppercase italic">{ETAPAS[etapaAtual - 1]}</p>
            {etapaAtual < ETAPAS.length && (
              <p className="text-[11.5px] text-zinc-500">Próxima: {ETAPAS[etapaAtual]}</p>
            )}
          </div>
        </div>
      </header>

      {conteudos.length === 0 ? (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[26px] p-12 text-center">
          <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Sem conteúdos importados</p>
          <p className="text-zinc-500 text-sm">
            Este planejamento foi criado antes do importador novo. O texto original continua disponível abaixo.
          </p>
        </div>
      ) : (
        <>
          {/* -------- BARRA DE MODO -------- */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="inline-flex bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-1.5">
              {([['agenda', 'Agenda', CalendarDays], ['linha', 'Linha', List]] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => setModo(k as 'agenda' | 'linha')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10.5px] font-black uppercase tracking-[0.13em] transition-all",
                    modo === k ? "bg-[#ff5351] text-white" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
            <p className="text-[10.5px] font-black uppercase tracking-[0.1em] text-zinc-600">
              {modo === 'agenda'
                ? (podeArrastar ? <><span className="text-[#ff8c8b]">Arraste</span> um conteúdo para outro dia</> : 'Clique para ver o conteúdo')
                : 'Ordem de publicação · intervalo entre os cards'}
            </p>
          </div>

          {/* aviso de data alterada — ao lado do seletor, some sozinho */}
          {ultimoMove && (
            <div className="-mt-2 flex justify-start">
              <div className="inline-flex items-center gap-3 bg-[#242424] border border-zinc-700 rounded-2xl px-4 py-2">
                <span className="text-[12px] font-semibold text-zinc-300">Data alterada</span>
                <button
                  onClick={desfazerMove}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400 hover:text-white border border-zinc-700 rounded-[10px] px-2.5 py-1"
                >
                  <Undo2 className="w-3 h-3" /> Desfazer
                </button>
              </div>
            </div>
          )}

          {/* -------- AGENDA -------- */}
          {modo === 'agenda' && (
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[26px] p-4 md:p-5">
              <div className="grid grid-cols-7 gap-[7px] mb-2">
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
                  <span key={d} className="text-center text-[9.5px] font-black uppercase tracking-[0.16em] text-zinc-600 pb-1.5">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[7px]">
                {celulas.map((n, i) => {
                  if (n === null) return <div key={i} className="h-[104px] max-[900px]:h-[92px] max-[700px]:h-[70px]" />;
                  const itens = porDia[String(n)] || [];
                  const compacto = itens.length >= 3 ? 'tiny' : itens.length === 2 ? 'mini' : 'full';
                  const alvo = diaAlvo === String(n);
                  return (
                    <div
                      key={i}
                      onDragOver={e => { if (podeArrastar) { e.preventDefault(); setDiaAlvo(String(n)); } }}
                      onDragLeave={() => setDiaAlvo(prev => prev === String(n) ? null : prev)}
                      onDrop={e => {
                        e.preventDefault();
                        setDiaAlvo(null);
                        if (podeArrastar && arrastando !== null) moverPara(arrastando, n);
                        setArrastando(null);
                      }}
                      className={cn(
                        "h-[104px] max-[900px]:h-[92px] max-[700px]:h-[70px] rounded-[14px] border p-[7px] flex flex-col min-w-0 overflow-hidden transition-colors",
                        alvo ? "border-[#ff5351] bg-[#241a1a]" : "border-[#232323] bg-[#151515]"
                      )}
                    >
                      <span className={cn("text-[11px] font-bold shrink-0", alvo ? "text-[#ff8c8b]" : "text-zinc-600")}>{n}</span>
                      <div className="flex-1 min-h-0 mt-1.5 flex flex-col gap-1">
                        {itens.map(c => {
                          const t = TIPOS[c.tipo];
                          return (
                            <div
                              key={c.idx}
                              draggable={podeArrastar}
                              onDragStart={() => setArrastando(c.idx)}
                              onDragEnd={() => { setArrastando(null); setDiaAlvo(null); }}
                              onClick={() => setAberto(c.idx)}
                              title={c.tema}
                              style={{ background: t.bg, borderLeftColor: t.cor }}
                              className={cn(
                                "rounded-[10px] border-l-[3px] min-w-0 overflow-hidden select-none",
                                podeArrastar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                                compacto === 'full' ? "px-2 py-1.5" : "px-2 py-1 flex items-center gap-1.5",
                                arrastando === c.idx && "opacity-30"
                              )}
                            >
                              {compacto === 'tiny' ? (
                                <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: t.cor }} />
                              ) : (
                                <span className="text-[8px] font-black uppercase tracking-[0.12em] shrink-0" style={{ color: t.texto }}>
                                  {c.tipo}
                                </span>
                              )}
                              <span className={cn(
                                "font-display font-bold text-white leading-tight overflow-hidden",
                                compacto === 'full' ? "block text-[11px] mt-0.5 line-clamp-2" : "flex-1 text-[10px] truncate"
                              )}>
                                {c.tema}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-4 mt-4 pt-3.5 border-t border-[#262626]">
                {(Object.keys(TIPOS) as TipoConteudo[]).map(t => (
                  <span key={t} className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    <i className="inline-block w-2.5 h-2.5 rounded-[3px] mr-1.5 -mb-px" style={{ background: TIPOS[t].cor }} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* -------- LINHA DO TEMPO -------- */}
          {modo === 'linha' && (
            <div className="relative pl-8">
              <div className="absolute left-2 top-3 bottom-3 w-0.5 bg-[#282828]" />
              {comData.map((c, k) => {
                const t = TIPOS[c.tipo];
                const dif = k > 0
                  ? Math.round((c.data!.getTime() - comData[k - 1].data!.getTime()) / 86400000)
                  : null;
                return (
                  <div key={c.idx}>
                    {dif !== null && (
                      <div className={cn(
                        "flex items-center gap-2.5 py-1 pl-1 text-[10px] font-black uppercase tracking-[0.1em]",
                        dif <= 2 ? "text-[#ff8c8b]" : "text-zinc-700"
                      )}>
                        <span className="w-7 h-px bg-[#282828]" />
                        {dif === 0 ? 'mesmo dia' : `${dif} dia${dif > 1 ? 's' : ''} depois`}
                        {dif <= 2 && ' · muito perto'}
                      </div>
                    )}
                    <div className="relative mb-3">
                      <span
                        className="absolute -left-[26px] top-6 w-3 h-3 rounded-full bg-[#131313] border-2"
                        style={{ borderColor: t.cor }}
                      />
                      <div
                        onClick={() => setAberto(c.idx)}
                        style={{ borderLeftColor: t.cor }}
                        className="bg-[#1f1f1f] border border-zinc-800 border-l-4 rounded-[20px] px-5 py-4 flex gap-4 items-center cursor-pointer hover:border-zinc-700 transition-colors"
                      >
                        <div className="text-center shrink-0 w-[50px]">
                          <div className="font-display text-[23px] font-black text-white leading-none">
                            {String(c.data!.getDate()).padStart(2, '0')}
                          </div>
                          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500 mt-1">
                            {MESES[c.data!.getMonth()].slice(0, 3)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-[9.5px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
                            style={{ background: t.bg, color: t.texto }}
                          >
                            {c.tipo}
                          </span>
                          <h4 className="text-[15px] font-bold text-white mt-1.5 mb-0.5 truncate">{c.tema}</h4>
                          <p className="text-[12.5px] text-zinc-500 truncate">{c.raw.caption || c.raw.legenda || ''}</p>
                        </div>
                        <span className="text-zinc-700 text-lg">›</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* conteúdos sem data */}
          {semData.length > 0 && (
            <div className="bg-[#1f1f1f] border border-amber-500/20 rounded-[20px] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-400 mb-3">
                {semData.length} conteúdo{semData.length === 1 ? '' : 's'} sem data
              </p>
              <div className="flex flex-wrap gap-2">
                {semData.map(c => (
                  <button
                    key={c.idx}
                    onClick={() => setAberto(c.idx)}
                    style={{ background: TIPOS[c.tipo].bg, borderLeftColor: TIPOS[c.tipo].cor }}
                    className="rounded-[10px] border-l-[3px] px-3 py-2 text-left max-w-[240px]"
                  >
                    <span className="text-[8px] font-black uppercase tracking-[0.12em]" style={{ color: TIPOS[c.tipo].texto }}>
                      {c.tipo}
                    </span>
                    <p className="font-display text-[11px] font-bold text-white leading-tight truncate">{c.tema}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* -------- TEXTO ORIGINAL (recolhido) -------- */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[26px] overflow-hidden">
        <button onClick={() => setShowTexto(!showTexto)} className="w-full p-5 flex items-center justify-between">
          <h2 className="text-[13px] font-black uppercase tracking-widest text-white">Texto original do planejamento</h2>
          {showTexto ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </button>
        {showTexto && (
          <div className="px-6 pb-6">
            <p className="mb-4 text-[12px] text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
              Este é o texto de origem, guardado como referência. Editar aqui não altera os conteúdos da agenda.
            </p>
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="mb-4 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
              >
                Editar texto
              </button>
            )}
            {isEditing && (
              <div className="flex items-center gap-2 mb-4">
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
            {isEditing ? (
              <textarea
                value={editingText}
                onChange={e => setEditingText(e.target.value)}
                rows={30}
                className="w-full bg-zinc-900 border border-[#ff5351] rounded-2xl p-6 text-white text-sm leading-relaxed outline-none resize-none font-mono"
              />
            ) : (
              <pre className="text-zinc-400 text-[13px] leading-relaxed whitespace-pre-wrap font-sans">
                {plan.currentText || 'Nenhum texto disponível'}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* -------- HISTÓRICO (mantido) -------- */}
      {plan.history && plan.history.length > 0 && (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[26px] overflow-hidden">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full p-5 flex items-center justify-between">
            <h2 className="text-[13px] font-black uppercase tracking-widest text-white">
              Histórico de edições ({plan.history.length})
            </h2>
            {showHistory ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
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

      {/* -------- GAVETA LATERAL -------- */}
      {detalhe && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setAberto(null)} />
          <aside className="fixed top-0 right-0 bottom-0 w-full sm:w-[560px] bg-[#171717] border-l border-zinc-800 z-50 overflow-y-auto p-8 pb-16">
            <button
              onClick={() => setAberto(null)}
              className="absolute top-5 right-6 text-zinc-500 hover:text-white"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <span
              className="text-[9.5px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
              style={{ background: TIPOS[detalhe.tipo].bg, color: TIPOS[detalhe.tipo].texto }}
            >
              {detalhe.tipo}
            </span>
            <h3 className="text-[25px] font-black text-white uppercase italic tracking-tight leading-tight my-3">
              {detalhe.tema}
            </h3>

            {camposDoTipo(detalhe).map(([k, v]) => (
              <div key={k} className="flex gap-4 py-3 border-t border-[#242424]">
                <div className="min-w-[120px] shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{k}</div>
                <div className="text-[13.5px] text-zinc-200 leading-relaxed">
                  {Array.isArray(v) ? (
                    <div className="flex flex-col gap-1.5">
                      {v.map((s: any, n: number) => (
                        <span key={n} className="bg-[#151515] border border-zinc-800 rounded-[10px] px-3 py-2 text-[12px] text-zinc-400 block">
                          <b className="text-[#ff5351] font-black mr-2">{n + 1}</b>
                          {typeof s === 'string' ? s : (
                            <>
                              <span className="text-zinc-200">{s?.title}</span>
                              {s?.description && <span className="block text-zinc-500 mt-0.5 ml-6">{s.description}</span>}
                            </>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : String(v)}
                </div>
              </div>
            ))}

            <div className="flex gap-2 mt-5 pt-4 border-t border-[#242424]">
              <button
                onClick={() => toast('A edição de conteúdo entra na próxima fatia')}
                className="px-5 py-2.5 bg-[#ff5351] text-white rounded-2xl text-[10.5px] font-black uppercase tracking-[0.14em] hover:brightness-110 transition-all"
              >
                Editar conteúdo
              </button>
              <button
                onClick={() => setAberto(null)}
                className="px-5 py-2.5 border border-zinc-800 text-zinc-500 rounded-2xl text-[10.5px] font-black uppercase tracking-[0.14em] hover:text-white transition-all"
              >
                Fechar
              </button>
            </div>
          </aside>
        </>
      )}

      {/* -------- BARRA DE AÇÃO (mantida) -------- */}
      {canApprove && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-md border-t border-zinc-800 z-30">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[13px] text-zinc-500 max-w-md">
              {plan.status === 'rascunho' && <><b className="text-zinc-300 font-semibold">Nada foi enviado ainda.</b> Ao enviar, o dono do cliente recebe o planejamento para aprovar o texto.</>}
            </p>
            <div className="flex items-center gap-3 ml-auto">
              {isMasterOrRedator && plan.status === 'rascunho' && (
                <>
                  <button
                    onClick={handleMasterReject}
                    disabled={saving}
                    className="h-12 px-7 bg-zinc-800 border border-zinc-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all flex items-center gap-2"
                  >
                    <X className="w-4 h-4" /> Devolver
                  </button>
                  <button
                    onClick={handleMasterApprove}
                    disabled={saving}
                    className="h-12 px-7 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Enviar para o cliente
                  </button>
                </>
              )}
              {isCliente && plan.status === 'aguardando_cliente' && (
                <button
                  onClick={handleClientApprove}
                  disabled={saving}
                  className="h-12 px-7 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Aprovar planejamento
                </button>
              )}
              {isEquipe && plan.status === 'aguardando_validacao_equipe' && (
                <button
                  onClick={handleEquipeValidate}
                  disabled={saving}
                  className="h-12 px-7 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Validar planejamento
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* processar (mantido) */}
      {isMasterOrRedator && plan.status === 'aprovado_equipe' && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate(`/processar-planejamento/${planId}`)}
            className="h-12 px-7 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-[#ff5351]/20"
          >
            <Zap className="w-4 h-4" /> Processar planejamento
          </button>
        </div>
      )}
    </div>
  );
}
