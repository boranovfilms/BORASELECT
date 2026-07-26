import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2, Zap, Eye, X, Save, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { contentPlanService, ContentPlan, ContentPost, MicroTask, TaskDept } from '../services/contentPlanService';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

interface WorkflowStage {
  id: string;
  name: string;
  order: number;
  type: string;
  requiresApproval: boolean;
}

interface WorkflowModel {
  id: string;
  name: string;
  stages: WorkflowStage[];
}

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

function calcularFasePost(
  post: ContentPost,
  plan: ContentPlan,
  workflowModel: WorkflowModel | null
): { faseId: string; label: string; color: string; bg: string; border: string; barColor: string; percent: number } {
  if (!workflowModel || !workflowModel.stages || workflowModel.stages.length === 0) {
    const tasks = (post as any).tasks || [];
    if (tasks.length === 0) {
      return {
        faseId: 'aguardando',
        label: 'Aguardando Delegação',
        color: 'text-zinc-500',
        bg: 'bg-zinc-800',
        border: 'border-zinc-700',
        barColor: 'bg-zinc-600',
        percent: 0
      };
    }
    const total = tasks.length;
    const concluidas = tasks.filter((t: any) => t.status === 'concluido').length;
    const percent = Math.round((concluidas / total) * 100);
    return {
      faseId: 'producao',
      label: 'Em Produção',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      barColor: 'bg-amber-500',
      percent
    };
  }

  let etapasCumpridas = 0;
  const totalEtapas = workflowModel.stages.length;

  if (post.id) etapasCumpridas = 1;
  if (plan.status && plan.status !== 'rascunho') etapasCumpridas = Math.max(etapasCumpridas, 2);
  
  const hasClientApproval = (post as any).approvals?.some((a: any) => a.role === 'cliente' && a.status === 'aprovado');
  if (hasClientApproval) etapasCumpridas = Math.max(etapasCumpridas, 3);

  const hasTeamValidation = (post as any).approvals?.some((a: any) => a.role === 'equipe' && a.status === 'validado_equipe');
  if (hasTeamValidation) etapasCumpridas = Math.max(etapasCumpridas, 4);

  const tasks = (post as any).tasks || [];
  if (tasks.length > 0) etapasCumpridas = Math.max(etapasCumpridas, 5);

  if (tasks.length > 0) {
    const concluidas = tasks.filter((t: any) => t.status === 'concluido').length;
    if (concluidas === tasks.length && tasks.length > 0) {
      etapasCumpridas = totalEtapas;
    }
  }

  const percent = totalEtapas > 0 ? Math.round((etapasCumpridas / totalEtapas) * 100) : 0;

  if (percent === 100) {
    return {
      faseId: 'concluido',
      label: 'Concluído',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      barColor: 'bg-emerald-500',
      percent: 100
    };
  }

  if (tasks.length > 0) {
    const emAndamento = tasks.find((t: any) => t.status === 'em_andamento');
    return {
      faseId: 'producao',
      label: emAndamento?.deptLabel || 'Em Produção',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      barColor: 'bg-amber-500',
      percent
    };
  }

  return {
    faseId: 'aguardando',
    label: 'Aguardando Delegação',
    color: 'text-zinc-500',
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    barColor: 'bg-zinc-600',
    percent
  };
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
  const [workflowModel, setWorkflowModel] = useState<WorkflowModel | null>(null);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('cliente');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [showDelegModal, setShowDelegModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<TaskDept[]>([]);
  const [deptTags, setDeptTags] = useState<Record<string, string[]>>({});
  const [deptDescriptions, setDeptDescriptions] = useState<Record<string, string>>({});
  const [depArteDependeVideo, setDepArteDependeVideo] = useState(false);
  const [depVideoDependeArte, setDepVideoDependeArte] = useState(false);
  const [saving, setSaving] = useState(false);

  const internalRoles = ['master', 'admin', 'redator', 'editor', 'designer', 'midia_social'];
  const isInternal = internalRoles.includes(userRole);

  useEffect(() => {
    loadData();
    loadUserRole();
  }, [planId]);

  const loadUserRole = async () => {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    if (!currentEmail) { setRoleLoaded(true); return; }
    try {
      if (currentEmail === 'admin@boraselect.com.br') { setUserRole('master'); setRoleLoaded(true); return; }
      const qBora = query(collection(db, 'boraselect'), where('email', '==', currentEmail));
      const snapBora = await getDocs(qBora);
      if (!snapBora.empty) { setUserRole(snapBora.docs[0].data().role || 'redator'); setRoleLoaded(true); return; }
      const q = query(collection(db, 'clientes'), where('email', '==', currentEmail));
      const snap = await getDocs(q);
      if (!snap.empty) { setUserRole(snap.docs[0].data().role || 'cliente'); }
    } catch (e) { console.warn('Erro ao carregar role:', e); } finally { setRoleLoaded(true); }
  };

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
      if (planData.clientId) {
        try {
          const modelosSnap = await getDocs(collection(db, 'workflowModels'));
          const modelos = modelosSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkflowModel));
          const planningModel = modelos.find(m => m.name === 'PLANEJAMENTO');
          if (planningModel) setWorkflowModel(planningModel);
        } catch (error) { console.warn('Erro ao carregar modelo de fluxo:', error); }
      }
      const clientSnap = await getDoc(doc(db, 'clientes', planData.clientId));
      if (clientSnap.exists()) setClientName(clientSnap.data().name || '');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally { setLoading(false); }
  };

  const postsOrdenados = useMemo(() => {
    if (!plan?.posts) return [];
    return [...plan.posts]
      .sort((a, b) => {
        const [d1, m1, y1] = a.publishDate.split('/').map(Number);
        const [d2, m2, y2] = b.publishDate.split('/').map(Number);
        return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
      })
      .filter(post => {
        if (isInternal) {
          const tasks = (post as any).tasks || [];
          return tasks.length === 0;
        }
        return true;
      });
  }, [plan, isInternal]);

  const allPosts = useMemo(() => plan?.posts || [], [plan]);

  const porcentagemGeral = useMemo(() => {
    if (allPosts.length === 0) return 0;
    const totalPercent = allPosts.reduce((sum, post) => {
      const fase = calcularFasePost(post, plan!, workflowModel);
      return sum + fase.percent;
    }, 0);
    return Math.round(totalPercent / allPosts.length);
  }, [allPosts, plan, workflowModel]);

  const openDelegModal = (post: ContentPost) => {
    setSelectedPost(post);
    setSelectedDepts([]);
    setDeptTags({});
    setDeptDescriptions({});
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
      const deptToRole: Record<string, string> = {
        video: 'editor',
        design: 'designer',
        redacao: 'redator',
        midia_social: 'midia_social'
      };

      const tasks: MicroTask[] = selectedDepts.map(dept => {
        const deptInfo = DEPTS.find(d => d.id === dept)!;
        let dependsOn: TaskDept | null = null;
        if (dept === 'design' && depArteDependeVideo) dependsOn = 'video';
        if (dept === 'video' && depVideoDependeArte) dependsOn = 'design';
        return {
          id: `task_${dept}_${Date.now()}`,
          dept,
          deptLabel: deptInfo.name,
          responsibleEmail: '', // Agora delegado para departamento
          responsibleName: 'Aguardando...', 
          tags: deptTags[dept] || [],
          description: deptDescriptions[dept] || '',
          status: 'pendente' as const,
          dependsOn,
          createdAt: new Date().toISOString()
        };
      });

      await contentPlanService.delegatePost(plan!.id!, selectedPost.id, tasks);

      // Notificar todos os membros dos departamentos selecionados
      for (const dept of selectedDepts) {
        const deptInfo = DEPTS.find(d => d.id === dept)!;
        const roleToNotify = deptToRole[dept];
        const membrosSnap = await getDocs(
          query(collection(db, 'boraselect'), where('role', '==', roleToNotify))
        );

        for (const docMembro of membrosSnap.docs) {
          const membro = docMembro.data();
          await notificacaoService.criar({
            para: membro.email?.toLowerCase(),
            tipo: 'producao',
            titulo: `NOVA TAREFA: ${deptInfo.name} — ${selectedPost.headline}`,
            descricao: deptDescriptions[dept] || `Nova tarefa de ${deptInfo.name} para o post \"${selectedPost.headline}\"`,
            planId: plan!.id,
            postId: selectedPost.id
          });
        }
      }

      toast.success('Tarefas delegadas com sucesso!');
      setShowDelegModal(false);
      setSelectedDepts([]);
      setDeptTags({});
      setDeptDescriptions({});
      setDepArteDependeVideo(false);
      setDepVideoDependeArte(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao delegar tarefas.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !plan || !roleLoaded) {
    return (
      <div className=\"min-h-[60vh] flex items-center justify-center\">
        <Loader2 className=\"w-8 h-8 animate-spin text-[#ff5351]\" />
      </div>
    );
  }

  return (
    <div className=\"animate-in fade-in duration-700 pb-20\">
      <header className=\"mb-8\">
        <button
          onClick={() => navigate(-1)}
          className=\"flex items-center gap-2 text-[#ff5351] text-[10px] font-black uppercase tracking-widest mb-4 hover:brightness-110 transition-all\"
        >
          <ArrowLeft className=\"w-4 h-4\" /> Voltar
        </button>
        <p className=\"text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500\">
          PLANEJAMENTO · {clientName}
        </p>
        <h1 className=\"text-4xl font-black text-white uppercase italic tracking-tight\">
          # {plan.name}
        </h1>
        <p className=\"text-zinc-500 text-sm mt-1\">{plan.monthReference}</p>
        {isInternal && (
          <div className=\"flex items-center gap-3 mt-4\">
            <span className=\"px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[9px] font-black uppercase tracking-widest\">
              {postsOrdenados.length} post{postsOrdenados.length !== 1 ? 's' : ''} aguardando delegação
            </span>
            {postsOrdenados.length === 0 && (
              <span className=\"text-emerald-500 text-[10px] font-black uppercase tracking-widest\">
                ✓ Todos delegados!
              </span>
            )}
          </div>
        )}
      </header>

      {/* Barra de Progresso Geral */}
      <div className=\"bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-8 mb-8\">
        <div className=\"flex items-center justify-between mb-4\">
          <span className=\"text-[10px] font-black uppercase tracking-widest text-zinc-400\">Progresso Geral</span>
          <span className=\"text-xl font-black text-[#ff5351] italic\">{porcentagemGeral}%</span>
        </div>
        <div className=\"grid grid-cols-4 md:grid-cols-12 gap-2\">
          {allPosts.map((post, idx) => {
            const fase = calcularFasePost(post, plan, workflowModel);
            const isActive = idx < Math.ceil((porcentagemGeral / 100) * allPosts.length);
            return (
              <div
                key={idx}
                className={cn(
                  \"h-1.5 rounded-full transition-all duration-700\",
                  isActive ? \"bg-[#ff5351]\" : \"bg-zinc-800\"
                )}
                title={`Post ${idx + 1}: ${fase.label}`}
              />
            );
          })}
        </div>
      </div>

      <div className=\"bg-[#141414] border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl\">
        <DataTable
          data={postsOrdenados}
          columns={[
            {
              header: 'POST',
              className: 'w-96',
              accessor: (post) => (
                <div className=\"flex items-center gap-4 py-2\">
                  <div className=\"text-zinc-600 font-black text-xl italic\">#{String(post.number).padStart(2, '0')}</div>
                  <div className=\"flex-1 min-w-0\">
                    <p className=\"text-white font-black uppercase text-sm truncate\">{post.headline || 'Sem título'}</p>
                    <p className=\"text-zinc-500 text-[10px] truncate uppercase tracking-widest\">{post.caption?.slice(0, 80)}...</p>
                  </div>
                </div>
              )
            },
            {
              header: 'TIPO',
              accessor: (post) => (
                <span className={cn(
                  \"px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border\",
                  post.type === 'FEED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  post.type === 'REEL' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  post.type === 'STORIES' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  post.type === 'CARROSSEL' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                  'bg-red-500/10 text-red-400 border-red-500/20'
                )}>
                  {post.type}
                </span>
              ),
              align: 'center'
            },
            {
              header: 'DATA POSTAGEM',
              accessor: (post) => {
                const dateInfo = formatDate(post.publishDate);
                return (
                  <div className=\"flex flex-col items-center\">
                    <span className=\"text-zinc-400 font-bold text-xs\">{dateInfo.data}</span>
                    <span className=\"text-zinc-600 text-[9px] uppercase font-black\">{dateInfo.diaSemana}</span>
                    {dateInfo.isUrgente && (
                      <span className=\"mt-1 px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[7px] font-black uppercase rounded border border-red-500/20\">URGENTE</span>
                    )}
                  </div>
                );
              },
              align: 'center'
            },
            {
              header: 'FASE ATUAL',
              accessor: (post) => {
                const fase = calcularFasePost(post, plan, workflowModel);
                return (
                  <div className={cn(\"px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest\", fase.bg, fase.color, fase.border)}>
                    {fase.label}
                  </div>
                );
              },
              align: 'center'
            },
            {
              header: 'PROGRESSO',
              accessor: (post) => {
                const fase = calcularFasePost(post, plan, workflowModel);
                return (
                  <div className=\"flex items-center gap-2\">
                    <div className=\"w-16 h-1 bg-zinc-800 rounded-full overflow-hidden\">
                      <div className={cn(\"h-full rounded-full transition-all duration-500\", fase.barColor)} style={{ width: `${fase.percent}%` }} />
                    </div>
                    <span className=\"text-[9px] font-black text-zinc-500\">{fase.percent}%</span>
                  </div>
                );
              },
              align: 'center'
            },
            {
              header: 'AÇÃO',
              accessor: (post) => {
                const hasTasks = (post as any).tasks && (post as any).tasks.length > 0;
                return !roleLoaded ? (
                  <div className=\"w-4 h-4 rounded-full border border-zinc-800 animate-spin border-t-zinc-600\" />
                ) : isInternal ? (
                  hasTasks ? (
                    <button
                      onClick={() => toast.success('Em breve: visualização de tarefas!')}
                      className=\"inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-[#ff5351] transition-all\"
                    >
                      <Eye className=\"w-3 h-3\" /> Ver
                    </button>
                  ) : (
                    <button
                      onClick={() => openDelegModal(post)}
                      className=\"inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ff5351] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all\"
                    >
                      <Zap className=\"w-3 h-3\" /> Delegar
                    </button>
                  )
                ) : (
                  <span className=\"text-[9px] font-black uppercase text-zinc-600\">—</span>
                );
              },
              align: 'right'
            }
          ]}
        />
      </div>

      {/* MODAL DE DELEGAÇÃO */}
      {showDelegModal && selectedPost && (
        <div className=\"fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4\">
          <div className=\"bg-[#141414] border border-zinc-800 rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl\">
            <header className=\"p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30\">
              <div>
                <p className=\"text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] mb-1\">POST {String(selectedPost.number).padStart(2, '0')} · {selectedPost.type}</p>
                <h3 className=\"text-2xl font-black text-white uppercase italic tracking-tight\">Delegar Tarefas</h3>
              </div>
              <button onClick={() => setShowDelegModal(false)} className=\"p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 transition-all\"><X className=\"w-6 h-6\" /></button>
            </header>

            <div className=\"flex-1 overflow-y-auto p-8 space-y-10\">
              {/* Departamentos */}
              <div className=\"space-y-4\">
                <label className=\"text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2\">
                  <div className=\"w-1 h-1 bg-[#ff5351] rounded-full\" /> Departamentos
                </label>
                <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4\">
                  {DEPTS.map(dept => {
                    const isSelected = selectedDepts.includes(dept.id);
                    return (
                      <button
                        key={dept.id}
                        onClick={() => toggleDept(dept.id)}
                        className={cn(
                          'p-4 rounded-2xl border text-left transition-all group',
                          isSelected ? 'border-[#ff5351] bg-[#ff5351]/5' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                        )}
                      >
                        <div className=\"flex items-center justify-between mb-2\">
                          <span className=\"text-2xl\">{dept.icon}</span>
                          {isSelected && <div className=\"w-4 h-4 bg-[#ff5351] rounded-full flex items-center justify-center animate-in zoom-in\"><Check className=\"w-2.5 h-2.5 text-white\" strokeWidth={4} /></div>}
                        </div>
                        <p className={cn(\"font-black uppercase text-[10px] tracking-widest\", isSelected ? \"text-white\" : \"text-zinc-400\")}>{dept.name}</p>
                        <p className=\"text-[8px] text-zinc-600 font-bold uppercase tracking-tighter mt-0.5\">{dept.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDepts.length > 0 && (
                <div className=\"space-y-8 animate-in slide-in-from-bottom-2\">
                  <h4 className=\"text-sm font-black uppercase tracking-widest text-white border-b border-zinc-800 pb-2 flex items-center gap-2\">
                    Configuração por Departamento
                  </h4>
                  {selectedDepts.map(deptId => {
                    const deptInfo = DEPTS.find(d => d.id === deptId)!;
                    return (
                      <div key={deptId} className=\"bg-zinc-900/40 border border-zinc-800 rounded-[24px] p-6 space-y-6\">
                        <div className=\"flex items-center gap-3\">
                          <span className=\"text-xl\">{deptInfo.icon}</span>
                          <span className=\"text-xs font-black uppercase text-white tracking-widest\">{deptInfo.name}</span>
                        </div>

                        <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
                          {/* No longer selecting specific member - delegation is department-wide */}
                          <div className=\"space-y-3\">
                            <label className=\"text-[9px] font-black uppercase tracking-widest text-zinc-500\">Tags</label>
                            <div className=\"flex flex-wrap gap-2\">
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
                          
                          <div className=\"space-y-3\">
                            <label className=\"text-[9px] font-black uppercase tracking-widest text-zinc-500\">Dependências</label>
                            <div className=\"flex flex-col gap-2\">
                              {deptId === 'design' && (
                                <button
                                  onClick={() => setDepArteDependeVideo(!depArteDependeVideo)}
                                  className={cn(
                                    'p-3 rounded-xl border text-left transition-all flex items-center justify-between',
                                    depArteDependeVideo ? 'border-[#ff5351] bg-[#ff5351]/5 text-[#ff5351]' : 'border-zinc-800 bg-zinc-900/30 text-zinc-500'
                                  )}
                                >
                                  <span className=\"text-[9px] font-black uppercase tracking-widest\">Depende do Vídeo</span>
                                  {depArteDependeVideo && <Check className=\"w-3 h-3\" />}
                                </button>
                              )}
                              {deptId === 'video' && (
                                <button
                                  onClick={() => setDepVideoDependeArte(!depVideoDependeArte)}
                                  className={cn(
                                    'p-3 rounded-xl border text-left transition-all flex items-center justify-between',
                                    depVideoDependeArte ? 'border-[#ff5351] bg-[#ff5351]/5 text-[#ff5351]' : 'border-zinc-800 bg-zinc-900/30 text-zinc-500'
                                  )}
                                >
                                  <span className=\"text-[9px] font-black uppercase tracking-widest\">Depende da Arte</span>
                                  {depVideoDependeArte && <Check className=\"w-3 h-3\" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className=\"space-y-3\">
                          <label className=\"text-[9px] font-black uppercase tracking-widest text-zinc-500\">Descrição / Briefing</label>
                          <textarea
                            value={deptDescriptions[deptId] || ''}
                            onChange={(e) => setDeptDescriptions(prev => ({ ...prev, [deptId]: e.target.value }))}
                            rows={3}
                            className=\"w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs text-white focus:border-[#ff5351] outline-none resize-none\"
                            placeholder={`Instruções para o departamento de ${deptInfo.name}...`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className=\"p-8 bg-zinc-900/50 border-t border-zinc-800 flex justify-end gap-4\">
              <button
                onClick={() => setShowDelegModal(false)}
                className=\"px-8 py-3 bg-zinc-800 text-zinc-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all\"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDeleg}
                disabled={saving || selectedDepts.length === 0}
                className=\"px-8 py-3 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[#ff5351] hover:text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed\"
              >
                {saving ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Save className=\"w-4 h-4\" />}
                Confirmar Delegação
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
