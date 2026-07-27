import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2, Zap, Eye, X, Save, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { TaskDept } from '../services/contentPlanService';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

const DEPARTMENTS: TaskDept[] = [
  { id: 'video', label: 'Edição de Vídeo', icon: '🎬', description: 'Gravação e edição', tags: ['Gravação', 'Edição', 'Color Grade', 'Motion', 'Corte', 'Vinheta'] },
  { id: 'design', label: 'Design / Arte', icon: '🎨', description: 'Arte estática e capa', tags: ['Thumbnail', 'Arte', 'Identidade', 'Capa', 'Banner'] },
  { id: 'redacao', label: 'Redação', icon: '✍️', description: 'Revisão de texto', tags: ['Copywriting', 'Revisão', 'Legenda', 'Roteiro'] },
  { id: 'midia_social', label: 'Mídia Social', icon: '📱', description: 'Programação', tags: ['Agendamento', 'Publicação', 'Stories', 'Feed'] },
];

export default function PlanejamentoTarefas() {
  const { id: planId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [planNome, setPlanNome] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [showDelegModal, setShowDelegModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [deptResponsibles, setDeptResponsibles] = useState<Record<string, string>>({});
  const [deptTags, setDeptTags] = useState<Record<string, string[]>>({});
  const [deptDescriptions, setDeptDescriptions] = useState<Record<string, string>>({});
  const [depArteDependeVideo, setDepArteDependeVideo] = useState(false);
  const [depVideoDependeArte, setDepVideoDependeArte] = useState(false);

  useEffect(() => { loadData(); }, [planId]);

  const loadData = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      // Busca o planejamento para pegar clientId e nome
      const planDoc = await getDoc(doc(db, 'demandas', planId));
      if (!planDoc.exists()) { toast.error('Planejamento não encontrado'); navigate(-1); return; }
      const planData = planDoc.data();
      setPlanNome(planData.name || '');

      const clientDoc = await getDoc(doc(db, 'clientes', planData.clientId));
      if (clientDoc.exists()) setClientName(clientDoc.data().name || '');

      // Busca posts da coleção posts/ vinculados a esse planejamento
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('planId', '==', planId)));
      const postsData = postsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => a.number - b.number);
      setPosts(postsData);

      // Busca membros da equipe
      const teamSnap = await getDocs(collection(db, 'boraselect'));
      setTeamMembers(teamSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (error) {
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const calcularFasePost = (post: any): { fase: string; progresso: number } => {
    const tasks = post.tasks || [];
    if (tasks.length === 0) return { fase: 'Aguardando Delegação', progresso: 17 };
    const allDone = tasks.every((t: any) => t.status === 'concluido');
    if (allDone) return { fase: 'Concluído', progresso: 100 };
    const anyInProgress = tasks.some((t: any) => ['em_andamento', 'arquivo_anexado'].includes(t.status));
    if (anyInProgress) return { fase: 'Em Produção', progresso: 60 };
    return { fase: 'Delegado', progresso: 30 };
  };

  const toggleDept = (deptId: string) => {
    setSelectedDepts(prev =>
      prev.includes(deptId) ? prev.filter(d => d !== deptId) : [...prev, deptId]
    );
  };

  const handleSaveDeleg = async () => {
    if (!selectedPost || selectedDepts.length === 0) {
      toast.error('Selecione pelo menos um departamento.');
      return;
    }
    setSaving(true);
    try {
      const tasks = selectedDepts.map(deptId => {
        const dept = DEPARTMENTS.find(d => d.id === deptId)!;
        return {
          id: `task_${deptId}_${Date.now()}`,
          dept: deptId,
          deptLabel: dept.label,
          responsibleEmail: deptResponsibles[deptId] || '',
          responsibleName: teamMembers.find((m: any) => m.email === deptResponsibles[deptId])?.name || '',
          status: 'pendente',
          tags: deptTags[deptId] || [],
          description: deptDescriptions[deptId] || '',
         dependsOn: deptId === 'design' && depArteDependeVideo ? 'video' :
  deptId === 'video' && depVideoDependeArte ? 'design' : null,
        };
      });

      // Atualiza o post na coleção posts/
      await updateDoc(doc(db, 'posts', selectedPost.id), {
        tasks,
        status: 'delegado',
        updatedAt: serverTimestamp()
      });

      // Notifica responsáveis
      const emailsNotificados = new Set<string>();
      for (const task of tasks) {
        if (task.responsibleEmail && !emailsNotificados.has(task.responsibleEmail)) {
          emailsNotificados.add(task.responsibleEmail);
          await notificacaoService.criar({
            para: task.responsibleEmail,
            tipo: 'tarefa_delegada',
            titulo: 'Nova Tarefa Delegada',
            descricao: `Post #${String(selectedPost.number).padStart(2, '0')} — ${selectedPost.headline?.slice(0, 50)}`,
            planId: planId!,
            postId: selectedPost.id,
            visto: false,
            criadoEm: new Date().toISOString()
          });
        }
      }

      toast.success('Tarefas delegadas com sucesso!');
      setShowDelegModal(false);
      setSelectedDepts([]);
      setDeptResponsibles({});
      setDeptTags({});
      setDeptDescriptions({});
      setDepArteDependeVideo(false);
      setDepVideoDependeArte(false);
      loadData();
    } catch (error: any) {
  console.error('Erro ao delegar:', error);
  toast.error(`Erro: ${error?.message || 'desconhecido'}`);
} finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#131313]">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  const delegatedCount = posts.filter(p => (p.tasks || []).length > 0).length;
  const totalProgress = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + calcularFasePost(p).progresso, 0) / posts.length)
    : 0;

  return (
    <div className="space-y-8 pb-20 text-left">
      <header className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div>
          <p className="text-[#ff5351] text-[10px] font-black uppercase tracking-[0.3em]">
            {clientName} • Planejamento de Conteúdo
          </p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight mt-1">
            {planNome}
          </h1>
        </div>

        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Progresso Geral</span>
            <span className="text-[#ff5351] font-black text-lg">{totalProgress}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ff5351] to-[#ff8c8b] rounded-full transition-all duration-700"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            {[
              { val: 17, label: 'Aguardando', color: 'bg-amber-500' },
              { val: 30, label: 'Delegado', color: 'bg-blue-500' },
              { val: 60, label: 'Em Produção', color: 'bg-purple-500' },
              { val: 100, label: 'Concluído', color: 'bg-emerald-500' },
            ].map((item) => (
              <div key={item.val} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", item.color)} />
                <span className="text-[9px] text-zinc-500 font-bold uppercase">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">
            {posts.length} Posts
          </h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {delegatedCount}/{posts.length} delegados
          </span>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Post</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipo</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Data</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Fase</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Progresso</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {posts.map((post) => {
              const { fase, progresso } = calcularFasePost(post);
              const isDelegated = (post.tasks || []).length > 0;
              return (
                <tr key={post.id} className="group hover:bg-zinc-800/30 transition-all">
                  <td className="px-6 py-4 max-w-xs">
                    <p className="text-white font-bold text-sm line-clamp-2 uppercase">{post.headline}</p>
                    {post.caption && (
                      <p className="text-zinc-500 text-xs line-clamp-1 mt-0.5">{post.caption}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                      post.type === 'FEED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        post.type === 'REEL' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          post.type === 'STORIES' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            post.type === 'CARROSSEL' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                              'bg-red-500/10 text-red-400 border-red-500/20'
                    )}>
                      {post.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-white text-xs font-bold">{post.publishDate}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      progresso === 100 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        progresso === 60 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          progresso === 30 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-zinc-800 text-zinc-400 border-zinc-700'
                    )}>
                      {fase}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            progresso === 100 ? "bg-emerald-500" :
                              progresso >= 60 ? "bg-purple-500" :
                                progresso >= 30 ? "bg-blue-500" : "bg-amber-500"
                          )}
                          style={{ width: `${progresso}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-zinc-400">{progresso}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!isDelegated ? (
                      <button
                        onClick={() => { setSelectedPost(post); setShowDelegModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all ml-auto"
                      >
                        <Zap className="w-3 h-3" /> Delegar
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedPost(post); setShowDelegModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all ml-auto"
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Delegação */}
      {showDelegModal && selectedPost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-[#1a1a1a]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Post #{String(selectedPost.number).padStart(2, '0')} · {selectedPost.type}
                </p>
                <h3 className="text-xl font-black text-white uppercase italic mt-1">Delegar Tarefas</h3>
              </div>
              <button onClick={() => setShowDelegModal(false)} className="p-2 text-zinc-500 hover:text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Departamentos</p>
                <div className="grid grid-cols-2 gap-3">
                  {DEPARTMENTS.map(dept => (
                    <button
                      key={dept.id}
                      onClick={() => toggleDept(dept.id)}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all",
                        selectedDepts.includes(dept.id)
                          ? "bg-[#ff5351]/10 border-[#ff5351]/50 text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-2xl">{dept.icon}</span>
                        {selectedDepts.includes(dept.id) && (
                          <span className="w-5 h-5 rounded-full bg-[#ff5351] flex items-center justify-center">
                            <Zap className="w-3 h-3 text-white" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black uppercase mt-2">{dept.label}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{dept.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {selectedDepts.map(deptId => {
                const dept = DEPARTMENTS.find(d => d.id === deptId)!;
                return (
                  <div key={deptId} className="space-y-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                      <span>{dept.icon}</span> {dept.label}
                    </p>

                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Responsável</label>
                      <div className="relative">
                        <select
                          value={deptResponsibles[deptId] || ''}
                          onChange={e => setDeptResponsibles(prev => ({ ...prev, [deptId]: e.target.value }))}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-xs appearance-none focus:border-[#ff5351] outline-none"
                        >
                          <option value="">Selecionar...</option>
                          {teamMembers.map((m: any) => (
                            <option key={m.id} value={m.email}>{m.name} — {m.role}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {dept.tags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => {
                              const current = deptTags[deptId] || [];
                              setDeptTags(prev => ({
                                ...prev,
                                [deptId]: current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
                              }));
                            }}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                              (deptTags[deptId] || []).includes(tag)
                                ? "bg-[#ff5351]/10 border-[#ff5351]/30 text-[#ff5351]"
                                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                            )}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Descrição / Briefing</label>
                      <textarea
                        value={deptDescriptions[deptId] || ''}
                        onChange={e => setDeptDescriptions(prev => ({ ...prev, [deptId]: e.target.value }))}
                        rows={2}
                        placeholder="Detalhes da tarefa..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-white text-xs resize-none focus:border-[#ff5351] outline-none"
                      />
                    </div>
                  </div>
                );
              })}

              {selectedDepts.includes('video') && selectedDepts.includes('design') && (
                <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dependências</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={depArteDependeVideo} onChange={e => setDepArteDependeVideo(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-xs text-zinc-300">Arte depende do vídeo</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={depVideoDependeArte} onChange={e => setDepVideoDependeArte(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-xs text-zinc-300">Vídeo depende da arte</span>
                  </label>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-800 flex gap-3 sticky bottom-0 bg-[#1a1a1a]">
              <button
                onClick={() => setShowDelegModal(false)}
                className="flex-1 h-12 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDeleg}
                disabled={saving || selectedDepts.length === 0}
                className="flex-1 h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar Delegação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
