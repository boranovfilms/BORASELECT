import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, FileText, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { contentPlanService } from '../services/contentPlanService';
import { cn } from '../lib/utils';

export default function ProcessarPlanejamento() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [clientName, setClientName] = useState('');
  const [jaProcessado, setJaProcessado] = useState(false);

  useEffect(() => { loadData(); }, [planId]);

  const loadData = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const planData = await contentPlanService.getPlanById(planId);
      if (!planData) { toast.error('Planejamento não encontrado'); navigate(-1); return; }
      setPlan(planData);
      setPosts(planData.posts || []);

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

  const handleProcessar = async () => {
    if (!planId || !plan) return;
    setProcessing(true);
    try {
      await contentPlanService.criarDocumentosPostsIndividuais(
        planId,
        plan.clientId,
        plan.name,
        posts
      );

      // Atualiza status do planejamento
      await contentPlanService.updateStatus(planId, 'em_producao');

      toast.success(`${posts.length} demandas criadas com sucesso!`);
      navigate(`/minhas-demandas`);
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const getTypeStyle = (type: string) => {
    const styles: any = {
      FEED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      REEL: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      STORIES: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      CARROSSEL: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      VIDEO: 'bg-red-500/10 text-red-400 border-red-500/20',
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

      {/* Aviso se já processado */}
      {jaProcessado && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-amber-400 text-lg">⚠️</span>
          <p className="text-amber-400 text-xs font-black uppercase tracking-widest">
            Este planejamento já foi processado. Processar novamente criará demandas duplicadas.
          </p>
        </div>
      )}

      {/* Lista de posts detectados */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">
            Posts Detectados
          </h2>
          <span className="px-3 py-1 bg-[#ff5351]/10 border border-[#ff5351]/20 text-[#ff5351] text-[9px] font-black uppercase tracking-widest rounded-full">
            {posts.length} posts
          </span>
        </div>

        <div className="divide-y divide-zinc-800">
          {posts.map((post: any) => (
            <div key={post.id} className="p-5 flex items-start gap-4 hover:bg-zinc-800/20 transition-all">
              <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0">
                <FileText className="w-4 h-4 text-[#ff5351]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-zinc-500 text-[10px] font-black uppercase">
                    #{String(post.number).padStart(2, '0')}
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
                </div>
                <p className="text-white font-black uppercase text-sm leading-tight line-clamp-2">
                  {post.headline}
                </p>
                {post.caption && (
                  <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{post.caption}</p>
                )}
              </div>
              <div className="shrink-0">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão processar */}
      <div className="flex justify-end gap-4">
        <button
          onClick={() => navigate(-1)}
          className="h-12 px-8 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleProcessar}
          disabled={processing}
          className="h-12 px-10 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-3 shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
        >
          {processing ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Criando Demandas...</>
          ) : (
            <><Check className="w-5 h-5" /> Criar {posts.length} Demandas</>
          )}
        </button>
      </div>
    </div>
  );
}
