import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2, Zap, Eye, X, Save, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { contentPlanService, ContentPlan, ContentPost, MicroTask, TaskDept } from '../services/contentPlanService';
import { cn } from '../lib/utils';

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

const DEPTS = [
  { id: 'video' as TaskDept, icon: '🎬', name: 'Edição de Vídeo', sub: 'Gravação e edição',
    tags: ['Gravação', 'Edição', 'Color Grade', 'Motion', 'Corte', 'Vinheta'] },
  { id: 'design' as TaskDept, icon: '🎨', name: 'Design / Arte', sub: 'Arte estática e capa',
    tags: ['Arte Estática', 'Capa de Vídeo', 'Logo', 'Identidade Visual', 'Carrossel', 'Story'] },
  { id: 'redacao' as TaskDept, icon: '✍️', name: 'Redação', sub: 'Revisão de texto',
    tags: ['Revisão', 'Reescrita', 'Legenda', 'Roteiro', 'Hashtags'] },
  { id: 'midia_social' as TaskDept, icon: '📱', name: 'Mídia Social', sub: 'Programação',
    tags: ['Programar Post', 'Programar Story', 'Programar Reel', 'Impulsionar'] },
];

function getPostFase(post: ContentPost): string {
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

  // Estados do modal de delegação
  const [showDelegModal, setShowDelegModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<TaskDept[]>([]);
  const [deptResponsibles, setDeptResponsibles] = useState<Record<TaskDept, string>>({} as any);
  const [deptTags, setDeptTags] = useState<Record<TaskDept, string[]>>({} as any);
  const [deptDescriptions, setDeptDescriptions] = useState<Record<TaskDept, string>>({} as any);
  const [depArteDependeVideo, setDepArteDependeVideo] = useState(false);
  const [depVideoDependeArte, setDepVideoDependeArte] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

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

      const q = query(
        collection(db, 'clients'),
        where('clienteId', '==', planData.clientId),
        where('role', '==', 'equipe')
      );
      const snap = await getDocs(q);
      setTeamMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const openDelegModal = (post: ContentPost) => {
    setSelectedPost(post);
    setSelectedDepts([]);
    setDeptResponsibles({} as any);
    setDeptTags({} as any);
    setDeptDescriptions({} as any);
    setDepArteDependeVideo(false);
    setDepVideoDependeArte(false);
    setShowDelegModal(true);
  };

  const toggleDept = (dept: TaskDept) => {
    setSelectedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  };

  const toggleTag = (dept: TaskDept, tag: string) => {
    setDeptTags(prev => {
      const current = prev[dept] || [];
      const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
      return { ...prev, [dept]: updated };
    });
  };

  const handleSaveDeleg = async () => {
    if (!selectedPost || selectedDepts.length === 0) {
      toast.error('Selecione pelo menos um departamento');
      return;
    }
    setSaving(true);
    try {
      const tasks: MicroTask[] = selectedDepts.map(dept => {
        const deptInfo = DEPTS.find(d => d.id === dept)!;
        let dependsOn: TaskDept | null = null;
        if (dept === 'design' && depArteDependeVideo) dependsOn = 'video';
        if (dept === 'video' && depVideoDependeArte) dependsOn = 'design';

        return {
          id: `task_${dept}_${Date.now()}`,
          dept,
          deptLabel: deptInfo.name,
          responsibleEmail: deptResponsibles[dept] || '',
          responsibleName: deptResponsibles[dept] || '',
          tags: deptTags[dept] || [],
          description: deptDescriptions[dept] || '',
          status: 'pendente' as const,
          dependsOn,
          createdAt: new Date().toISOString()
        };
      });

      await contentPlanService.delegatePost(plan!.id!, selectedPost.id, tasks);
      toast.success('Tarefas delegadas com sucesso!');
      setShowDelegModal(false);
      setSelectedDepts([]);
      setDeptResponsibles({} as any);
      setDeptTags({} as any);
      setDeptDescriptions({} as any);
      setDepArteDependeVideo(false);
      setDepVideoDependeArte(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao delegar tarefas.');
    } finally {
      setSaving(false);
    }
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

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Progresso Geral</span>
          <span className="text-2xl font-black italic text-[#ff5351]">{porcentagemGeral}%</span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-[#ff5351] rounded-full transition-all duration-700" style={{ width: `${porcentagemGeral}%` }} />
        </div>
        <div className="flex flex-wrap gap-1">
          {postsOrdenados.map((post, idx) => {
            const concluido = isPostConcluido(post);
            const emAndamento = !concluido && idx === concluidos;
            return (
              <div
                key={post.id}
                title={`Post ${post.number}`}
                className={cn('w-4 h-1.5 rounded-sm transition-all', concluido ? 'bg-[#ff5351]' : emAndamento ? 'bg-amber-500' : 'bg-zinc-800')}
              />
            );
          })}
        </div>
      </div>

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
                <th className="text-center px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {postsOrdenados.map((post) => {
                const faseId = getPostFase(post);
                const faseConfig = getFaseConfig(faseId);
                const percent = FASE_PERCENT[faseId as keyof typeof FASE_PERCENT] || 0;
                const dateInfo = formatDate(post.publishDate);
                const hasTasks = post.tasks && post.tasks.length > 0;

                return (
                  <tr key={post.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-all">
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
                      <span className={cn('px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest', getTypeStyles(post.type))}>
                        {post.type}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className={cn('text-xs font-black uppercase', dateInfo.isUrgente ? 'text-amber-400' : 'text-white')}>
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
                        <span className={cn('px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest', faseConfig.bg, faseConfig.color, faseConfig.border)}>
                          {faseConfig.label}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all duration-500', faseConfig.barColor)} style={{ width: `${percent}%` }} />
                          </div>
                          <span className={cn('text-[10px] font-black w-8 text-right', faseConfig.color)}>{percent}%</span>
                        </div>
                        <div className="flex gap-1">
                          {FASES.slice(0, 4).map((fase, idx) => {
                            const faseIndex = FASES.findIndex(f => f.id === faseId);
                            const isActive = idx <= faseIndex && faseIndex < 5;
                            const isCurrent = fase.id === faseId;
                            return (
                              <div key={fase.id} className={cn('w-8 h-1.5 rounded-sm transition-all', isActive ? faseConfig.barColor : 'bg-zinc-800', isCurrent && 'ring-1 ring-white/20')} title={fase.label} />
                            );
                          })}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      {hasTasks ? (
                        <button
                          onClick={() => toast.success('Em breve: visualização de tarefas!')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-[#ff5351] transition-all"
                        >
                          <Eye className="w-3 h-3" /> Ver
                        </button>
                      ) : (
                        <button
                          onClick={() => openDelegModal(post)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff5351] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                        >
                          <Zap className="w-3 h-3" /> Delegar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DELEGAÇÃO */}
      {showDelegModal && selectedPost && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-[24px] w-full max-w-[580px] max-h-[88vh] flex flex-col">
            <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">POST {String(selectedPost.number).padStart(2, '0')} · {selectedPost.type}</p>
                <h3 className="text-lg font-black text-white uppercase italic">Delegar Tarefas</h3>
              </div>
              <button onClick={() => setShowDelegModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {/* SEÇÃO 1 — DEPARTAMENTOS */}
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Departamentos</p>
                <div className="grid grid-cols-2 gap-3">
                  {DEPTS.map(dept => {
                    const isSelected = selectedDepts.includes(dept.id);
                    return (
                      <button
                        key={dept.id}
                        onClick={() => toggleDept(dept.id)}
                        className={cn(
                          'p-4 rounded-2xl border text-left transition-all',
                          isSelected ? 'border-[#ff5351] bg-[#ff5351]/5' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-2xl">{dept.icon}</span>
                          {isSelected && <div className="w-5 h-5 rounded-full bg-[#ff5351] flex items-center justify-center"><Zap className="w-3 h-3 text-white" /></div>}
                        </div>
                        <p className="text-white font-black uppercase text-xs">{dept.name}</p>
                        <p className="text-zinc-500 text-[9px] mt-0.5">{dept.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO 2 — RESPONSÁVEL + TAGS + DESCRIÇÃO */}
              {selectedDepts.length > 0 && (
                <div className="space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Configuração por Departamento</p>
                  {selectedDepts.map(deptId => {
                    const deptInfo = DEPTS.find(d => d.id === deptId)!;
                    return (
                      <div key={deptId} className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span>{deptInfo.icon}</span>
                          <p className="text-white font-black uppercase text-xs">{deptInfo.name}</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Responsável</label>
                          <div className="relative">
                            <select
                              value={deptResponsibles[deptId] || ''}
                              onChange={e => setDeptResponsibles(prev => ({ ...prev, [deptId]: e.target.value }))}
                              className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none appearance-none cursor-pointer"
                            >
                              <option value="">Selecionar...</option>
                              {teamMembers.map(m => (
                                <option key={m.id} value={m.email}>{m.name} ({m.jobTitle || m.role})</option>
                              ))}
                              <option value="boranov">Equipe Boranov</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Tags</label>
                          <div className="flex flex-wrap gap-1.5">
                            {deptInfo.tags.map(tag => {
                              const isActive = (deptTags[deptId] || []).includes(tag);
                              return (
                                <button
                                  key={tag}
                                  onClick={() => toggleTag(deptId, tag)}
                                  className={cn(
                                    'px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all',
                                    isActive ? 'bg-[#ff5351] text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                                  )}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Descrição / Briefing</label>
                          <textarea
                            value={deptDescriptions[deptId] || ''}
                            onChange={e => setDeptDescriptions(prev => ({ ...prev, [deptId]: e.target.value }))}
                            rows={2}
                            placeholder="Detalhes da tarefa..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-xs focus:border-[#ff5351] outline-none resize-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SEÇÃO 3 — DEPENDÊNCIAS */}
              {selectedDepts.includes('design') && selectedDepts.includes('video') && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Dependências</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-zinc-900/30 border border-zinc-800 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={depArteDependeVideo}
                        onChange={e => setDepArteDependeVideo(e.target.checked)}
                        className="w-4 h-4 accent-[#ff5351]"
                      />
                      <div>
                        <p className="text-white text-xs font-black uppercase">Arte depende do Vídeo</p>
                        <p className="text-zinc-500 text-[8px]">Designer aguarda Editor finalizar</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-zinc-900/30 border border-zinc-800 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={depVideoDependeArte}
                        onChange={e => setDepVideoDependeArte(e.target.checked)}
                        className="w-4 h-4 accent-[#ff5351]"
                      />
                      <div>
                        <p className="text-white text-xs font-black uppercase">Vídeo depende da Arte</p>
                        <p className="text-zinc-500 text-[8px]">Editor aguarda Designer finalizar</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-zinc-800 flex gap-3 shrink-0">
              <button
                onClick={() => setShowDelegModal(false)}
                className="flex-1 h-11 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDeleg}
                disabled={saving || selectedDepts.length === 0}
                className="flex-1 h-11 bg-[#ff5351] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar Delegação
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
