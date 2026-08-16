import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, FileText, Calendar, AlertTriangle, Video, Palette } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { contentPlanService } from '../services/contentPlanService';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ *
 * REGRA DE TAREFAS POR TIPO DE CONTEÚDO
 *   FEED      → Design
 *   CARROSSEL → Design
 *   REEL      → Edição de Vídeo + Design (capa)
 *   STORIES   → Design; + Edição de Vídeo se o redator marcar que tem vídeo
 * Toda tarefa nasce SEM DONO e em 'pendente'.
 * ------------------------------------------------------------------ */
const DEPTS = {
  design: { label: 'Design', cor: '#8ba3ff' },
  video: { label: 'Edição de vídeo', cor: '#22c55e' },
} as const;

const setoresDoPost = (post: any, storiesComVideo: boolean): ('design' | 'video')[] => {
  const t = String(post.type || '').toUpperCase();
  if (t === 'REEL' || t === 'VIDEO') return ['video', 'design'];
  if (t === 'STORIES') return storiesComVideo ? ['video', 'design'] : ['design'];
  return ['design'];
};

const descricaoTarefa = (post: any, dept: 'design' | 'video') => {
  const t = String(post.type || '').toUpperCase();
  if (dept === 'video') return `Editar o vídeo do ${t.toLowerCase()}`;
  if (t === 'REEL' || t === 'VIDEO') return 'Criar a capa do reel';
  if (t === 'CARROSSEL') return `Criar os ${post.slides?.length || 0} slides do carrossel`;
  if (t === 'STORIES') return 'Criar a arte do stories';
  return 'Criar a arte do post';
};

const montarTarefas = (post: any, storiesComVideo: boolean) =>
  setoresDoPost(post, storiesComVideo).map((dept, i) => ({
    id: `task_${post.id || post.number}_${dept}_${Date.now()}_${i}`,
    dept,
    deptLabel: DEPTS[dept].label,
    responsibleEmail: '',
    responsibleName: '',
    tags: [],
    description: descricaoTarefa(post, dept),
    status: 'pendente',
    dependsOn: null,
    createdAt: new Date().toISOString(),
  }));

export default function ProcessarPlanejamento() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [origem, setOrigem] = useState<'salvos' | 'texto'>('salvos');
  const [clientName, setClientName] = useState('');
  const [jaProcessado, setJaProcessado] = useState(false);
  /* stories que o redator marcou como "tem vídeo" */
  const [comVideo, setComVideo] = useState<Record<string, boolean>>({});

  useEffect(() => { loadData(); }, [planId]);

  const loadData = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const planData = await contentPlanService.getPlanById(planId);
      if (!planData) { toast.error('Planejamento não encontrado'); navigate(-1); return; }
      setPlan(planData);

      /* ------------------------------------------------------------------
       * FONTE DOS CONTEÚDOS
       * Usa os posts JÁ SALVOS no planejamento (importador novo). Eles têm
       * os campos completos (textoArte, sugestaoVisual, duracao, roteiro,
       * slides) e as datas atualizadas na agenda.
       * Só cai no parser antigo se o planejamento for legado (sem posts).
       * ------------------------------------------------------------------ */
      const salvos = Array.isArray(planData.posts) ? planData.posts : [];
      if (salvos.length > 0) {
        setPosts(salvos);
        setOrigem('salvos');
      } else {
        const { parsePostsFromText } = await import('../services/contentPlanService');
        setPosts(parsePostsFromText(planData.currentText || ''));
        setOrigem('texto');
      }

      // Verifica se já foi processado
      const postsSnap = await getDocs(collection(db, 'posts'));
      const jaExiste = postsSnap.docs.some(d => d.data().planId === planId);
      setJaProcessado(jaExiste);

      const snap = await getDocs(collection(db, 'clientes'));
      const found = snap.docs.find(d => d.id === planData.clientId);
      if (found) setClientName(found.data().name || '');

    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  /* conteúdo reprovado pelo cliente/equipe não vira tarefa */
  const foiReprovado = (p: any) => {
    const aps = (p?.approvals || []).filter((a: any) =>
      ['aprovado', 'reprovado', 'validado_equipe'].includes(a.action)
    );
    if (!aps.length) return false;
    return aps[aps.length - 1].action === 'reprovado';
  };

  const aptos = posts.filter(p => !foiReprovado(p));
  const reprovados = posts.filter(foiReprovado);
  const totalTarefas = aptos.reduce(
    (n, p) => n + setoresDoPost(p, !!comVideo[p.id]).length, 0
  );

  const handleProcessar = async () => {
    if (!planId || !plan) return;
    if (aptos.length === 0) {
      toast.error('Nenhum conteúdo aprovado para processar');
      return;
    }
    setProcessing(true);
    try {
      /* cada post leva suas tarefas já montadas */
      const comTarefas = aptos.map(p => ({
        ...p,
        tasks: montarTarefas(p, !!comVideo[p.id]),
      }));

      await contentPlanService.criarDocumentosPostsIndividuais(
        planId,
        plan.clientId,
        plan.name,
        comTarefas
      );

      await contentPlanService.updateStatus(planId, 'em_producao');

      toast.success(`${aptos.length} conteúdo(s) e ${totalTarefas} tarefa(s) criados!`);
      navigate(`/minhas-demandas`);
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getTypeStyle = (type: string) => {
    const styles: any = {
      FEED: 'bg-[#ff5351]/15 text-[#ffb0af] border-[#ff5351]/25',
      CARROSSEL: 'bg-[#8ba3ff]/15 text-[#b9c6ff] border-[#8ba3ff]/25',
      REEL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      VIDEO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      STORIES: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    };
    return styles[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 text-left">
      <header className="space-y-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            Processar Planejamento • {clientName}
          </p>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">
            {plan?.name}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{plan?.monthReference}</p>
        </div>
      </header>

      {jaProcessado && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-amber-400 text-xs font-black uppercase tracking-widest">
            Este planejamento já foi processado. Processar novamente criará demandas duplicadas.
          </p>
        </div>
      )}

      {origem === 'texto' && posts.length > 0 && (
        <div className="bg-zinc-800/40 border border-zinc-700 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
          <p className="text-zinc-400 text-xs leading-relaxed">
            Planejamento antigo: os conteúdos foram lidos do texto original, não da lista salva.
            Campos do formato novo (texto da arte, sugestão visual, duração) não estarão disponíveis.
          </p>
        </div>
      )}

      {reprovados.length > 0 && (
        <div className="bg-red-500/[0.07] border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-zinc-400 text-xs leading-relaxed">
            <b className="text-red-400">{reprovados.length} conteúdo(s) reprovado(s) pelo cliente</b> não entram em produção.
            Eles ficam guardados no planejamento e voltam ao fluxo depois que o redator revisar ou substituir.
          </p>
        </div>
      )}

      {posts.length === 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <p className="text-red-400 text-xs font-black uppercase tracking-widest mb-2">
            Nenhum conteúdo encontrado
          </p>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Este planejamento não tem conteúdos salvos nem texto reconhecível. Volte e verifique a importação.
          </p>
        </div>
      )}

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">
              Conteúdos do planejamento
            </h2>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">
              {origem === 'salvos' ? 'Lista salva no planejamento' : 'Lidos do texto original'}
            </p>
          </div>
          <span className="px-3 py-1 bg-[#ff5351]/10 border border-[#ff5351]/20 text-[#ff5351] text-[9px] font-black uppercase tracking-widest rounded-full">
            {aptos.length} {aptos.length === 1 ? 'conteúdo' : 'conteúdos'} · {totalTarefas} tarefa{totalTarefas === 1 ? '' : 's'}
          </span>
        </div>

        <div className="divide-y divide-zinc-800">
          {posts.map((post: any, i: number) => {
            const reprovado = foiReprovado(post);
            const ehStories = String(post.type || '').toUpperCase() === 'STORIES';
            const setores = reprovado ? [] : setoresDoPost(post, !!comVideo[post.id]);
            return (
              <div key={post.id || i} className={cn("p-5 flex items-start gap-4 transition-all", reprovado ? "opacity-50" : "hover:bg-zinc-800/20")}>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0">
                  <FileText className="w-4 h-4 text-[#ff5351]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-zinc-500 text-[10px] font-black uppercase">
                      #{String(post.number ?? i + 1).padStart(2, '0')}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border', getTypeStyle(post.type))}>
                      {post.type}
                    </span>
                    {post.publishDate && (
                      <span className="flex items-center gap-1 text-zinc-600 text-[10px]">
                        <Calendar className="w-3 h-3" />
                        {post.publishDate}
                      </span>
                    )}
                    {reprovado && (
                      <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/25 text-red-400 text-[8px] font-black uppercase tracking-widest">
                        Reprovado — não entra em produção
                      </span>
                    )}
                  </div>
                  <p className={cn("text-white font-black uppercase text-sm leading-tight line-clamp-2", reprovado && "line-through decoration-[#ff5351]")}>
                    {post.headline}
                  </p>

                  {/* tarefas que este conteúdo vai gerar */}
                  {!reprovado && (
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      {setores.map(d => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] border"
                          style={{ color: DEPTS[d].cor, borderColor: DEPTS[d].cor + '55', background: DEPTS[d].cor + '18' }}
                        >
                          {d === 'video' ? <Video className="w-3 h-3" /> : <Palette className="w-3 h-3" />}
                          {DEPTS[d].label}
                        </span>
                      ))}

                      {/* Stories pode ser arte ou vídeo — o redator decide aqui */}
                      {ehStories && (
                        <button
                          onClick={() => setComVideo(v => ({ ...v, [post.id]: !v[post.id] }))}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] border transition-all",
                            comVideo[post.id]
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                          )}
                        >
                          <Video className="w-3 h-3" />
                          {comVideo[post.id] ? 'Com vídeo ✓' : 'Este stories tem vídeo?'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {reprovado
                    ? <span className="text-red-400/70 text-lg leading-none">✕</span>
                    : <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          onClick={() => navigate(-1)}
          className="h-12 px-8 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleProcessar}
          disabled={processing || aptos.length === 0}
          className="h-12 px-10 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-3 shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
        >
          {processing ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Criando tarefas...</>
          ) : (
            <><Check className="w-5 h-5" /> Criar {totalTarefas} tarefa{totalTarefas === 1 ? '' : 's'}</>
          )}
        </button>
      </div>
    </div>
  );
}
