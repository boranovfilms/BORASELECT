import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { contentPlanService, ContentPlan, ContentPost } from '../services/contentPlanService';
import { cn } from '../lib/utils';

// Fases possíveis de um post
const FASES = [
  { id: 'aguardando', label: 'Aguardando', color: 'text-zinc-500', bg: 'bg-zinc-800', border: 'border-zinc-700', barColor: 'bg-zinc-600' },
  { id: 'producao', label: 'Em Produção', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', barColor: 'bg-amber-500' },
  { id: 'arquivo_anexado', label: 'Arquivo Anexado', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', barColor: 'bg-blue-500' },
  { id: 'em_aprovacao', label: 'Em Aprovação', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', barColor: 'bg-purple-500' },
  { id: 'programado', label: 'Postagem Programada', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', barColor: 'bg-emerald-500' },
  { id: 'concluido', label: 'Concluído', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', barColor: 'bg-emerald-500' }
];

const FASE_PERCENT = {
  aguardando: 0,
  producao: 25,
  arquivo_anexado: 50,
  em_aprovacao: 75,
  programado: 100,
  concluido: 100
};

function getPostFase(post: ContentPost): string {
  // Por enquanto usa campo fase se existir, senão calcula pelo status
  if ((post as any).fase) return (post as any).fase;
  if (post.status === 'aprovado') return 'programado';
  if (post.status === 'reprovado' || post.status === 'em_revisao') return 'em_aprovacao';
  return 'aguardando';
}

function isPostConcluido(post: ContentPost): boolean {
  const fase = getPostFase(post);
  return fase === 'programado' || fase === 'concluido';
}

function getFaseConfig(faseId: string) {
  return FASES.find(f => f.id === faseId) || FASES[0];
}

function formatDate(dateStr: string): { data: string; diaSemana: string; isUrgente: boolean } {
  try {
    const [dia, mes, ano] = dateStr.split('/').map(Number);
    const date = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    const diffMs = date.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return {
      data: dateStr,
      diaSemana: diasSemana[date.getDay()],
      isUrgente: diffDias <= 2 && diffDias >= 0
    };
  } catch {
    return { data: dateStr, diaSemana: '', isUrgente: false };
  }
}

export default function PlanejamentoTarefas() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);

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
        navigate('/projetos');
        return;
      }
      setPlan(planData);

      const clientSnap = await getDoc(doc(db, 'clients', planData.clientId));
      if (clientSnap.exists()) {
        setClientName(clientSnap.data().name || '');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const postsOrdenados = useMemo(() => {
    if (!plan?.posts) return [];
    return [...plan.posts].sort((a, b) => {
      const [d1, m1, y1] = a.publishDate.split('/').map(Number);
      const [d2, m2, y2] = b.publishDate.split('/').map(Number);
      return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
    });
  }, [plan]);

  const totalPosts = postsOrdenados.length;
  const concluidos = postsOrdenados.filter(isPostConcluido).length;
  const porcentagemGeral = totalPosts > 0 ? Math.round((concluidos / totalPosts) * 100) : 0;

  const getTypeStyles = (type: string) => {
    const styles: Record<string, string> = {
      FEED: 'bg-blue-900/40 text-blue-400 border-blue-500/20',
      REEL: 'bg-purple-900/40 text-purple-400 border-purple-500/20',
      STORIES: 'bg-emerald-900/40 text-emerald-400 border-emerald-500/20',
      CARROSSEL: 'bg-orange-900/40 text-orange-400 border-orange-500/20',
      VIDEO: 'bg-red-900/40 text-red-400 border-red-500/20'
    };
    return styles[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
  };

  if (loading || !plan) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto text-left pb-20">
      {/* HEADER */}
      <header className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#ff5351] text-[10px] font-black uppercase tracking-widest mb-4 hover:brightness-110 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] mb-1">
          PLANEJAMENTO · {clientName}
        </p>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
          {plan.name}
        </h1>
        <p className="text-zinc-500 text-sm mt-1">{plan.monthReference}</p>
      </header>

      {/* CARD DE PROGRESSO GERAL */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Progresso Geral</span>
          <span className="text-2xl font-black italic text-[#ff5351]">{porcentagemGeral}%</span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[#ff5351] rounded-full transition-all duration-700"
            style={{ width: `${porcentagemGeral}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {postsOrdenados.map((post, idx) => {
            const concluido = isPostConcluido(post);
            const emAndamento = !concluido && idx === concluidos;
            return (
              <div
                key={post.id}
                title={`Post ${post.number}`}
                className={cn(
                  'w-4 h-1.5 rounded-sm transition-all',
                  concluido ? 'bg-[#ff5351]' : emAndamento ? 'bg-amber-500' : 'bg-zinc-800'
                )}
              />
            );
          })}
        </div>
      </div>

      {/* TABELA DE POSTS */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">POST</th>
                <th className="text-center px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">TIPO</th>
                <th className="text-center px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">DATA POSTAGEM</th>
                <th className="text-center px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">FASE ATUAL</th>
                <th className="text-left px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">PROGRESSO</th>
              </tr>
            </thead>
            <tbody>
              {postsOrdenados.map((post) => {
                const faseId = getPostFase(post);
                const faseConfig = getFaseConfig(faseId);
                const percent = FASE_PERCENT[faseId as keyof typeof FASE_PERCENT] || 0;
                const dateInfo = formatDate(post.publishDate);

                return (
                  <tr
                    key={post.id}
                    onClick={() => toast.success('Em breve: detalhes da microtarefa!')}
                    className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-all cursor-pointer"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] font-black text-zinc-600 mt-0.5">#{String(post.number).padStart(2, '0')}</span>
                        <div>
                          <p className="text-white font-black uppercase text-sm leading-tight">{post.headline || 'Sem título'}</p>
                          <p className="text-zinc-500 text-[10px] mt-1 line-clamp-2">{post.caption}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <span className={cn(
                        'px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest',
                        getTypeStyles(post.type)
                      )}>
                        {post.type}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          'text-xs font-black uppercase',
                          dateInfo.isUrgente ? 'text-amber-400' : 'text-white'
                        )}>
                          {dateInfo.data}
                        </span>
                        <span className="text-[9px] text-zinc-500 mt-0.5">{dateInfo.diaSemana}</span>
                        {dateInfo.isUrgente && (
                          <span className="text-[7px] font-black uppercase tracking-widest text-amber-500 mt-1">URGENTE</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', faseConfig.barColor)} />
                        <span className={cn(
                          'px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest',
                          faseConfig.bg, faseConfig.color, faseConfig.border
                        )}>
                          {faseConfig.label}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all duration-500', faseConfig.barColor)}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className={cn('text-[10px] font-black w-8 text-right', faseConfig.color)}>
                            {percent}%
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {FASES.slice(0, 4).map((fase, idx) => {
                            const faseIndex = FASES.findIndex(f => f.id === faseId);
                            const isActive = idx <= faseIndex && faseIndex < 5;
                            const isCurrent = fase.id === faseId;
                            return (
                              <div
                                key={fase.id}
                                className={cn(
                                  'w-8 h-1.5 rounded-sm transition-all',
                                  isActive ? faseConfig.barColor : 'bg-zinc-800',
                                  isCurrent && 'ring-1 ring-white/20'
                                )}
                                title={fase.label}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
