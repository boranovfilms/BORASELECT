import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Loader2, UploadCloud, CheckCircle2,
  AlertTriangle, Images, Film, LayoutGrid, Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  contentPlanService,
  parsePlanejamentoPadrao,
  PlanejamentoParseado
} from '../services/contentPlanService';

export default function NewContentPlan() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');

  const [texto, setTexto] = useState('');
  const [parsed, setParsed] = useState<PlanejamentoParseado | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadClient() {
      if (!clientId) return;
      try {
        const snap = await getDoc(doc(db, 'clientes', clientId));
        if (snap.exists()) setClientName(snap.data().name || '');
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  // normaliza para comparar nomes (sem acento, sem espaço, maiúsculo)
  const norm = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .trim();

  const nomeConfere =
    parsed && parsed.cliente && clientName
      ? norm(parsed.cliente).includes(norm(clientName)) ||
        norm(clientName).includes(norm(parsed.cliente))
      : true;

  const handleTexto = (t: string) => {
    setTexto(t);
    if (!t.trim()) {
      setParsed(null);
      return;
    }
    try {
      const r = parsePlanejamentoPadrao(t);
      setParsed(r.posts.length > 0 ? r : null);
    } catch {
      setParsed(null);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleTexto(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleCreate = async () => {
    if (!clientId || !parsed) return;
    if (parsed.posts.length === 0) {
      toast.error('Nenhum conteúdo reconhecido no arquivo.');
      return;
    }
    setSaving(true);
    try {
      await contentPlanService.createPlan({
        clientId,
        name: parsed.titulo || `Planejamento — ${clientName}`,
        monthReference: parsed.periodo || '',
        currentText: texto,
        posts: parsed.posts,
        status: 'rascunho'
      });
      toast.success('Planejamento criado!');
      navigate(`/clients/${clientId}`);
    } catch (error: any) {
      toast.error(`Erro: ${error?.message || 'desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const tipoBadge = (type: string) => {
    const map: Record<string, { label: string; cls: string; icon: any }> = {
      FEED: { label: 'Feed', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Images },
      CARROSSEL: { label: 'Carrossel', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: LayoutGrid },
      REEL: { label: 'Reel', cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: Film },
      VIDEO: { label: 'Vídeo', cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: Film },
      STORIES: { label: 'Stories', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Sparkles }
    };
    const cfg = map[type] || map.FEED;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest ${cfg.cls}`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20 text-left">
      <header className="space-y-4">
        <button
          onClick={() => navigate(`/clients/${clientId}`)}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Cliente
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            PLANEJAMENTO • {clientName.toUpperCase()}
          </p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight leading-none">
            Importar Planejamento
          </h1>
        </div>
      </header>

      {/* PASSO 1 — colar / subir */}
      <section className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          1 · Cole ou suba o arquivo do planejamento
        </p>
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] p-6 space-y-4">
          <input ref={fileRef} type="file" accept=".md,.txt" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-16 border border-dashed border-zinc-700 rounded-2xl flex items-center justify-center gap-3 text-zinc-500 hover:border-[#ff5351] hover:text-[#ff5351] transition-all text-xs font-black uppercase tracking-widest"
          >
            <UploadCloud className="w-5 h-5" /> Escolher arquivo (.md ou .txt)
          </button>
          <textarea
            rows={12}
            value={texto}
            onChange={e => handleTexto(e.target.value)}
            placeholder={`… ou cole aqui o texto gerado pelo Claude:\n\n# PLANEJAMENTO: PLANEJAMENTO MENSAL - JULHO/2026 - ${clientName.toUpperCase()}\n\n## CONTEÚDO 1 — FEED\nTipo: Feed\nTema: ...\nData: 09/07/2026\n...`}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-white focus:border-[#ff5351] outline-none resize-none font-mono text-xs leading-relaxed"
          />
        </div>
      </section>

      {/* PASSO 2 — prévia */}
      {parsed && (
        <section className="space-y-3 animate-in fade-in duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            2 · Confira o que o sistema entendeu
          </p>

          {/* conferidor de nome */}
          {nomeConfere ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 text-xs text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              O cliente do arquivo ({parsed.cliente || '—'}) confere com o cliente selecionado.
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                <b className="text-white">Atenção:</b> este planejamento parece ser do cliente{' '}
                <b className="text-white">{parsed.cliente || '—'}</b>, mas você está em{' '}
                <b className="text-white">{clientName.toUpperCase()}</b>. Confira antes de continuar
                para não subir o arquivo no cliente errado.
              </p>
            </div>
          )}

          {/* resumo */}
          <div className="bg-[#191919] border border-zinc-800 rounded-2xl p-5 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Nome do planejamento</p>
              <p className="text-sm font-black text-white mt-0.5">{parsed.titulo || '—'}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Tipo</p>
              <p className="text-sm font-black text-[#ff5351] mt-0.5">{parsed.tipo || '—'}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Período</p>
              <p className="text-sm font-black text-white mt-0.5">{parsed.periodo || '—'}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Conteúdos</p>
              <p className="text-sm font-black text-[#ff5351] mt-0.5">{parsed.posts.length}</p>
            </div>
          </div>

          {/* lista de conteúdos */}
          <div className="space-y-2">
            {parsed.posts.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-[#151515] border border-zinc-800 rounded-xl px-4 py-3">
                <span className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[11px] font-black text-zinc-500 shrink-0">
                  {p.number}
                </span>
                {tipoBadge(p.type)}
                <span className="flex-1 text-sm font-bold text-zinc-200 truncate">{p.headline || '(sem tema)'}</span>
                {p.type === 'CARROSSEL' && p.slides && (
                  <span className="text-[9px] text-zinc-600 font-bold shrink-0">{p.slides.length} slides</span>
                )}
                {(p.type === 'REEL' || p.type === 'VIDEO') && p.roteiro && (
                  <span className="text-[9px] text-zinc-600 font-bold shrink-0">
                    {p.roteiro.split('\n').filter(l => l.trim().startsWith('-')).length} cenas
                  </span>
                )}
                <span className="text-[11px] text-zinc-500 font-mono shrink-0">{p.publishDate || '—'}</span>
              </div>
            ))}
          </div>

          {/* ações */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setTexto(''); setParsed(null); }}
              className="flex-1 h-13 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all text-xs font-black uppercase tracking-widest"
            >
              Limpar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-[2] py-4 rounded-2xl bg-[#ff5351] text-white hover:brightness-110 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Criar planejamento ({parsed.posts.length} conteúdos)
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 text-center">
            O planejamento é criado como rascunho. Nada é enviado ao cliente ainda — isso é um passo separado.
          </p>
        </section>
      )}

      {/* estado: texto digitado mas nada reconhecido */}
      {texto.trim() && !parsed && (
        <div className="flex items-start gap-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            Ainda não reconheci nenhum conteúdo. Verifique se o arquivo segue o formato padrão
            (linha <span className="font-mono text-zinc-300">#&nbsp;PLANEJAMENTO:</span> no topo e blocos{' '}
            <span className="font-mono text-zinc-300">##&nbsp;CONTEÚDO&nbsp;N&nbsp;—&nbsp;TIPO</span>).
          </p>
        </div>
      )}
    </div>
  );
}
