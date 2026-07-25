import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { contentPlanService } from '../services/contentPlanService';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

export default function MinhaDemandaDetalhe() {
  const { planId, postId } = useParams<{ planId: string; postId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [userTask, setUserTask] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    loadData();
  }, [planId, postId]);

  const loadData = async () => {
    if (!planId || !postId) return;
    setLoading(true);
    try {
      const email = auth.currentUser?.email?.toLowerCase().trim() || '';
      setUserEmail(email);

      const planData = await contentPlanService.getPlanById(planId);
      if (!planData) {
        toast.error('Planejamento não encontrado');
        navigate(-1);
        return;
      }
      setPlan(planData);

      const postData = planData.posts?.find((p: any) => p.id === postId);
      if (!postData) {
        toast.error('Post não encontrado');
        navigate(-1);
        return;
      }
      setPost(postData);

      const task = postData.tasks?.find((t: any) =>
        t.responsibleEmail?.toLowerCase() === email
      );
      setUserTask(task || null);

      const clientSnap = await getDocs(query(
        collection(db, 'clientes'),
        where('__name__', '==', planData.clientId)
      ));
      if (!clientSnap.empty) {
        setClientName(clientSnap.docs[0].data().name || '');
      } else {
        const snap = await getDocs(query(
          collection(db, 'clientes'),
          where('role', '==', 'cliente')
        ));
        const found = snap.docs.find(d => d.id === planData.clientId);
        if (found) setClientName(found.data().name || '');
      }

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAceitar = async () => {
    if (!planId || !plan || !post || !userTask) return;
    setSaving(true);
    try {
      const updatedPosts = plan.posts.map((p: any) => {
        if (p.id !== post.id) return p;
        return {
          ...p,
          tasks: p.tasks.map((t: any) =>
            t.id === userTask.id ? { ...t, status: 'em_andamento' } : t
          )
        };
      });

      await updateDoc(doc(db, 'demandas', planId), {
        posts: updatedPosts,
        updatedAt: serverTimestamp()
      });

      toast.success('Demanda aceita! Mãos à obra!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao aceitar demanda');
    } finally {
      setSaving(false);
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

  const getDeptIcon = (dept: string) => {
    const icons: any = { video: '🎬', design: '🎨', redacao: '✍️', midia_social: '📱' };
    return icons[dept] || '•';
  };

  const getTaskStatusBadge = (status: string) => {
    const configs: any = {
      pendente: { label: '⏳ Pendente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      em_andamento: { label: '⚡ Em Andamento', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      concluido: { label: '✅ Concluído', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      fazer_correcao: { label: '🔄 Correção', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const config = configs[status] || configs.pendente;
    return (
      <span className={cn('px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest', config.class)}>
        {config.label}
      </span>
    );
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  if (!post || !plan) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-32 text-left">

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
              Sua Tarefa • {clientName}
            </p>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
              Post #{String(post.number).padStart(2, '0')} — {post.type}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">{plan.name}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0 mt-1">
            {userTask && (
              <span className="px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest bg-[#ff5351]/10 text-[#ff5351] border-[#ff5351]/20">
                {getDeptIcon(userTask.dept)} {userTask.deptLabel}
              </span>
            )}
            {userTask && getTaskStatusBadge(userTask.status)}
          </div>
        </div>
      </header>

      {/* Conteúdo do Post */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">
            Conteúdo do Post
          </h2>
          <div className="flex items-center gap-3">
            <span className={cn('px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest', getTypeStyle(post.type))}>
              {post.type}
            </span>
            <span className="text-zinc-500 text-[10px] font-black uppercase">{post.publishDate}</span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Headline */}
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">Headline</span>
            <p className="text-white font-black uppercase text-base leading-tight">{post.headline}</p>
          </div>

          <div className="h-px bg-zinc-800" />

          {/* Legenda */}
          {post.caption && (
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">Legenda</span>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</p>
            </div>
          )}

          {/* CTA */}
          {post.cta && (
            <>
              <div className="h-px bg-zinc-800" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">CTA</span>
                <div className="bg-[#ff5351]/5 border border-[#ff5351]/15 rounded-xl p-3">
                  <p className="text-[#ff5351] text-sm font-bold">🎯 {post.cta}</p>
                </div>
              </div>
            </>
          )}

          {/* Hashtags */}
          {post.hashtags && (
            <>
              <div className="h-px bg-zinc-800" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">Hashtags</span>
                <p className="text-zinc-500 text-xs italic">{post.hashtags}</p>
              </div>
            </>
          )}

          {/* Slides (Carrossel) */}
          {post.slides && post.slides.length > 0 && (
            <>
              <div className="h-px bg-zinc-800" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-3">Slides</span>
                <div className="space-y-2">
                  {post.slides.map((slide: any, i: number) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-white text-xs font-black uppercase mb-1">Slide {i + 1} — {slide.title}</p>
                      {slide.description && (
                        <p className="text-zinc-400 text-xs">{slide.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Informações da Tarefa */}
      {userTask && (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">Sua Tarefa</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 p-4 bg-[#ff5351]/5 border border-[#ff5351]/10 rounded-2xl">
              <span className="text-3xl">{getDeptIcon(userTask.dept)}</span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Departamento</p>
                <p className="text-white font-black uppercase text-sm">{userTask.deptLabel}</p>
              </div>
            </div>

            {userTask.tags && userTask.tags.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {userTask.tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {userTask.description && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Briefing</p>
                <p className="text-zinc-300 text-sm leading-relaxed">{userTask.description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botões de Ação */}
      {userTask && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-black/90 backdrop-blur-md border-t border-zinc-800 z-50">
          <div className="max-w-2xl mx-auto flex items-center justify-end gap-3">
            {userTask.status === 'pendente' && (
              <button
                onClick={handleAceitar}
                disabled={saving}
                className="h-12 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Aceitar Demanda
              </button>
            )}
            {userTask.status === 'em_andamento' && (
              <button
                disabled
                className="h-12 px-8 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 cursor-not-allowed"
              >
                <Upload className="w-4 h-4" /> Upload Arquivo (em breve)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
