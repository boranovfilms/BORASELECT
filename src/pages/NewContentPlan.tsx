import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, FileText, Loader2, Save, Send, ChevronDown, ChevronUp, Clock, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { contentPlanService, parsePostsFromText, ContentPost } from '../services/contentPlanService';
import { cn } from '../lib/utils';

type Step = 'form' | 'review';

function detectPlanInfo(text: string): { name: string; month: string } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] || '';
  
  // Detecta padrão: "PLANEJAMENTO JUNHO 2026 – CANAPLAN"
  // ou "PLANEJAMENTO JUNHO 2026 - CANAPLAN"
  const planMatch = firstLine.match(/PLANEJAMENTO\s+([A-ZÀ-Ú]+\s+\d{4})\s*[-–]\s*(.+)/i);
  if (planMatch) {
    return {
      month: planMatch[1].trim(),
      name: `Planejamento ${planMatch[1].trim()} — ${planMatch[2].trim()}`
    };
  }
  
  // Tenta detectar só o mês no texto
  const monthMatch = text.match(/\b(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+(\d{4})\b/i);
  if (monthMatch) {
    return {
      month: `${monthMatch[1]} ${monthMatch[2]}`,
      name: ''
    };
  }
  
  return { name: '', month: '' };
}

export default function NewContentPlan() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    monthReference: '',
    text: ''
  });
  
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [expandedRoteiros, setExpandedRoteiros] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadClient() {
      if (!clientId) return;
      try {
        const docRef = doc(db, 'clientes', clientId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setClientName(snap.data().name || '');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  const handleProcessText = () => {
    if (!form.name || !form.text) {
      toast.error('Preencha o nome da campanha e o texto do planejamento');
      return;
    }

    const detectedPosts = parsePostsFromText(form.text);
    if (detectedPosts.length === 0) {
      toast.error('Nenhum post detectado. Verifique se o texto segue o padrão CONTEÚDO N — TIPO | DD/MM/AAAA');
      return;
    }

    setPosts(detectedPosts);
    setStep('review');
    window.scrollTo(0, 0);
  };

  const handleSave = async (status: 'rascunho' | 'aguardando_cliente') => {
    if (!clientId) return;
    setSaving(true);
    try {
      await contentPlanService.createPlan({
        clientId,
        name: form.name,
        monthReference: form.monthReference,
        currentText: form.text,
        posts: posts,
        status: status
      });
      toast.success('Planejamento criado!');
      navigate(`/clients/${clientId}`);
    } catch (error: any) {
      console.error('ERRO AO SALVAR:', error);
      console.error('CÓDIGO:', error?.code);
      console.error('MENSAGEM:', error?.message);
      toast.error(`Erro: ${error?.message || 'desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleRoteiro = (id: string) => {
    const next = new Set(expandedRoteiros);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRoteiros(next);
  };

  const getTypeColor = (type: string) => {
    const colors: any = {
      FEED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      REEL: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      STORIES: 'bg-green-500/10 text-green-400 border-green-500/20',
      CARROSSEL: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      VIDEO: 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return colors[type] || 'bg-zinc-800 text-zinc-400';
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 text-left">
      <header className="space-y-4">
        <button 
          onClick={() => step === 'form' ? navigate(`/clients/${clientId}`) : setStep('form')}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 'form' ? 'Voltar para o Cliente' : 'Voltar e Editar'}
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            CRIAÇÃO DE CONTEÚDO • {clientName.toUpperCase()}
          </p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight leading-none">
            {step === 'form' ? 'Novo Planejamento' : 'Revisar Detecção'}
          </h1>
        </div>
      </header>

      {step === 'form' ? (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[32px] p-8 space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome da Campanha</label>
              <input 
                type="text" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="Ex: Lançamento Coleção Verão" 
                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-white focus:border-[#ff5351] outline-none transition-all font-bold uppercase" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mês de Referência</label>
              <div className="relative">
                <select 
                  value={form.monthReference} 
                  onChange={e => setForm({...form, monthReference: e.target.value})}
                  className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer font-bold uppercase"
                >
                  <option value="">Selecione o mês</option>
                  {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map(m => (
                    <option key={m} value={`${m} 2026`}>{m} 2026</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Texto do Planejamento</label>
            <p className="text-zinc-600 text-[10px] uppercase font-bold mb-2 ml-1">Cole aqui o texto completo enviado pela redatora</p>
            <textarea 
              rows={15} 
              value={form.text} 
              onChange={e => {
                const newText = e.target.value;
                setForm({...form, text: newText});
                if (newText.length > 50) {
                  const detected = detectPlanInfo(newText);
                  setForm(prev => ({
                    ...prev,
                    name: detected.name && !prev.name ? detected.name : prev.name,
                    monthReference: detected.month && !prev.monthReference ? detected.month : prev.monthReference
                  }));
                }
              }} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-[24px] p-6 text-white focus:border-[#ff5351] outline-none resize-none transition-all leading-relaxed font-medium" 
              placeholder="📅 CONTEÚDO 01 — REEL | 15/05/2026..." 
            />
          </div>

          <div className="flex justify-end">
            <button 
              onClick={handleProcessText}
              className="h-14 px-10 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all flex items-center gap-3 shadow-xl shadow-[#ff5351]/20"
            >
              <FileText className="w-5 h-5" /> Processar Planejamento
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div className="px-4 py-2 bg-[#ff5351]/10 border border-[#ff5351]/20 rounded-full text-[#ff5351] text-[10px] font-black uppercase tracking-widest">
              {posts.length} posts detectados
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <div key={post.id} className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 overflow-hidden flex flex-col hover:border-[#ff5351]/50 transition-all shadow-xl">
                <header className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border", getTypeColor(post.type))}>
                      {post.type}
                    </span>
                    <div className="text-[10px] font-black text-white uppercase tracking-widest">
                      POST {String(post.number).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-black uppercase">
                    <Calendar className="w-3.5 h-3.5" />
                    {post.publishDate}
                  </div>
                </header>

                <div className="space-y-4 flex-1">
                  <h3 className="text-white font-black uppercase text-sm leading-tight">
                    {post.headline || 'Sem headline'}
                  </h3>
                  
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-xs line-clamp-4 leading-relaxed font-medium">
                      {post.caption}
                    </p>
                  </div>

                  {post.cta && (
                    <div className="space-y-1">
                      <p className="text-[#ff5351] text-[10px] font-bold uppercase">🎯 {post.cta}</p>
                    </div>
                  )}

                  {post.hashtags && (
                    <p className="text-zinc-500 text-xs font-medium italic">{post.hashtags}</p>
                  )}

                  {post.roteiro && (
                    <div className="pt-2 border-t border-zinc-800/50">
                      <button 
                        onClick={() => toggleRoteiro(post.id)}
                        className="flex items-center justify-between w-full text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
                      >
                        {expandedRoteiros.has(post.id) ? 'Ocultar Roteiro' : 'Ver Roteiro'}
                        {expandedRoteiros.has(post.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {expandedRoteiros.has(post.id) && (
                        <div className="mt-3 p-4 bg-black/20 rounded-2xl text-[10px] text-zinc-400 leading-relaxed font-medium border border-zinc-800/50 whitespace-pre-wrap animate-in slide-in-from-top-2">
                          {post.roteiro}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <footer className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-md border-t border-zinc-800 flex justify-center gap-4 z-50">
            <div className="max-w-6xl w-full flex justify-end gap-4">
              <button 
                disabled={saving}
                onClick={() => handleSave('rascunho')}
                className="h-14 px-10 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Criar Planejamento
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
