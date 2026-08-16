import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Upload, X, Check, Copy, Maximize2, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as sref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../lib/firebase';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ *
 * TELA DE EXECUÇÃO DA TAREFA
 * Quem usa: editor de vídeo / designer, depois de assumir no quadro.
 * Faz três coisas: lê a demanda, sobe o arquivo pronto, conversa.
 *
 * Dados novos gravados no documento de `posts`:
 *   task.versoes[] = { n, arquivos[], enviadoEm, enviadoPor, status, motivo }
 *   post.mensagens[] = { id, autorNome, autorEmail, papel, texto, visivelCliente, criadoEm }
 * ------------------------------------------------------------------ */

const SETORES: Record<string, { label: string; cor: string }> = {
  design: { label: 'Design', cor: '#8ba3ff' },
  video: { label: 'Edição de vídeo', cor: '#22c55e' },
  redacao: { label: 'Redação', cor: '#f5c14a' },
  midia_social: { label: 'Mídia social', cor: '#e879f9' },
};

/* especificações derivadas do tipo — não vêm do banco */
const SPECS: Record<string, [string, string][]> = {
  REEL:      [['Formato', '9:16'], ['Resolução', '1080×1920'], ['Arquivo', 'MP4']],
  VIDEO:     [['Formato', '9:16'], ['Resolução', '1080×1920'], ['Arquivo', 'MP4']],
  STORIES:   [['Formato', '9:16'], ['Resolução', '1080×1920'], ['Arquivo', 'PNG ou MP4']],
  FEED:      [['Formato', '4:5'], ['Resolução', '1080×1350'], ['Arquivo', 'PNG']],
  CARROSSEL: [['Formato', '4:5'], ['Resolução', '1080×1350'], ['Arquivo', 'PNG']],
};
const proporcao = (t: string) => ['REEL', 'VIDEO', 'STORIES'].includes(t) ? '9 / 16' : '4 / 5';
const ehVideo = (t: string) => ['REEL', 'VIDEO'].includes(t);

const paraDate = (s: any): Date | null => {
  if (!s) return null;
  const br = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  const d = new Date(s); return isNaN(d.getTime()) ? null : d;
};
const fmtData = (s: any) => {
  const d = paraDate(s); if (!d) return '--.--.--';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
};
const diasAte = (s: any): number | null => {
  const d = paraDate(s); if (!d) return null;
  const h = new Date(); h.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - h.getTime()) / 86400000);
};
const tamanho = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

/* botão copiar reutilizável */
function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  if (!texto) return null;
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1400); }}
      className={cn(
        "shrink-0 flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-[0.1em] border rounded-md px-2 py-[3px] transition-all mt-0.5",
        ok ? "text-emerald-400 border-emerald-500/40" : "text-zinc-600 border-zinc-800 hover:text-white hover:border-zinc-600"
      )}
    >
      {ok ? <><Check className="w-2.5 h-2.5" /> copiado</> : <><Copy className="w-2.5 h-2.5" /> copiar</>}
    </button>
  );
}

export default function TarefaExecucao() {
  const { postId, taskIndex } = useParams<{ postId: string; taskIndex: string }>();
  const idx = Number(taskIndex ?? 0);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [cliente, setCliente] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [enviando, setEnviando] = useState<{ nome: string; pct: number; i: number; total: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [sugAberta, setSugAberta] = useState(false);
  const [equipe, setEquipe] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [slideLB, setSlideLB] = useState(0);

  useEffect(() => { carregar(); }, [postId]);

  const carregar = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const u = auth.currentUser;
      const email = u?.email?.toLowerCase().trim() || '';
      setUserEmail(email);

      const snap = await getDoc(doc(db, 'posts', postId));
      if (!snap.exists()) { toast.error('Tarefa não encontrada'); navigate(-1); return; }
      const p = { id: snap.id, ...snap.data() } as any;
      setPost(p);

      const cs = await getDoc(doc(db, 'clientes', p.clientId));
      if (cs.exists()) setCliente(cs.data().name || '');

      const bs = await getDocs(collection(db, 'boraselect'));
      const membros = bs.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setEquipe(membros);
      const eu = membros.find(m => m.email?.toLowerCase() === email);
      setUserName(eu?.name || u?.displayName || email);
      setUserRole(eu?.role || (email === 'admin@boraselect.com.br' ? 'master' : ''));
    } catch (e) {
      console.error(e); toast.error('Erro ao carregar a tarefa');
    } finally { setLoading(false); }
  };

  const task = post?.tasks?.[idx];
  const tipo = String(post?.type || '').toUpperCase();
  const setor = SETORES[task?.dept] || { label: task?.deptLabel || '', cor: '#6a6a6a' };
  const versoes: any[] = task?.versoes || [];
  const versaoAtual = versoes.length ? versoes[versoes.length - 1] : null;
  const mensagens: any[] = post?.mensagens || [];
  const dias = diasAte(post?.publishDate);

  /* ---------- gravar alterações na tarefa ---------- */
  const gravarTask = async (mudancas: any) => {
    const novas = (post.tasks || []).map((t: any, i: number) => i === idx ? { ...t, ...mudancas } : t);
    await updateDoc(doc(db, 'posts', postId!), { tasks: novas, updatedAt: serverTimestamp() });
    setPost((p: any) => ({ ...p, tasks: novas }));
  };

  /* ---------- upload (aceita vários arquivos, envia um por um) ---------- */
  const subirArquivos = async (files: FileList | File[]) => {
    const lista = Array.from(files);
    if (!lista.length || !postId) return;

    const storage = getStorage();
    /* se a última versão ainda é rascunho, os arquivos entram nela; senão abre uma nova */
    const continuar = versaoAtual?.status === 'rascunho';
    const nVer = continuar ? versaoAtual.n : versoes.length + 1;
    let acumulados: any[] = continuar ? [...(versaoAtual.arquivos || [])] : [];
    let novasVersoes = versoes;

    for (let i = 0; i < lista.length; i++) {
      const file = lista[i];
      setEnviando({ nome: file.name, pct: 0, i: i + 1, total: lista.length });
      try {
        const caminho = `entregas/${postId}/task${idx}/v${nVer}/${Date.now()}_${file.name}`;
        const tarefa = uploadBytesResumable(sref(storage, caminho), file);
        await new Promise<void>((ok, erro) => {
          tarefa.on('state_changed',
            st => setEnviando({ nome: file.name, pct: Math.round((st.bytesTransferred / st.totalBytes) * 100), i: i + 1, total: lista.length }),
            erro,
            () => ok()
          );
        });
        const url = await getDownloadURL(tarefa.snapshot.ref);
        acumulados = [...acumulados, { nome: file.name, url, tamanho: file.size, tipo: file.type, caminho }];

        /* grava a cada arquivo concluído, para nada se perder no meio */
        novasVersoes = continuar
          ? versoes.map((v, k) => k === versoes.length - 1 ? { ...v, arquivos: acumulados } : v)
          : [...versoes, {
              n: nVer, arquivos: acumulados, status: 'rascunho',
              enviadoPor: userName, enviadoEm: new Date().toISOString(), motivo: null,
            }];
        await gravarTask({ versoes: novasVersoes });
      } catch (e) {
        console.error(e);
        toast.error(`Falha ao enviar ${file.name}`);
      }
    }

    setEnviando(null);
    toast.success(lista.length > 1 ? `${lista.length} arquivos enviados` : 'Arquivo enviado');
  };

  const removerArquivo = async (i: number) => {
    if (!versaoAtual) return;
    const novas = versoes.map((v, k) =>
      k === versoes.length - 1 ? { ...v, arquivos: v.arquivos.filter((_: any, j: number) => j !== i) } : v);
    await gravarTask({ versoes: novas });
  };

  const enviarParaRevisao = async () => {
    if (!versaoAtual?.arquivos?.length) { toast.error('Suba pelo menos um arquivo'); return; }
    setSalvando(true);
    try {
      const novas = versoes.map((v, i) =>
        i === versoes.length - 1 ? { ...v, status: 'em_revisao', enviadoEm: new Date().toISOString() } : v);
      await gravarTask({ versoes: novas, status: 'em_andamento' });

      const bs = await getDocs(query(collection(db, 'boraselect'), where('role', 'in', ['master', 'admin', 'redator'])));
      for (const m of bs.docs) {
        const email = m.data().email?.toLowerCase();
        if (!email) continue;
        await notificacaoService.criar({
          para: email, tipo: 'entrega_para_revisao',
          titulo: 'Entrega aguardando revisão',
          descricao: `${setor.label} · ${post.headline} (${cliente})`,
          planId: post.planId, postId,
          visto: false, criadoEm: new Date().toISOString(),
        });
      }
      toast.success('Enviado para revisão');
    } catch { toast.error('Erro ao enviar'); }
    finally { setSalvando(false); }
  };

  /* ---------- chat ---------- */
  const mencionaCliente = /@cliente/i.test(msg) || (cliente && new RegExp('@' + cliente.split(' ')[0], 'i').test(msg));

  const enviarMensagem = async () => {
    const texto = msg.trim();
    if (!texto || !postId) return;
    const nova = {
      id: `m_${Date.now()}`,
      autorNome: userName, autorEmail: userEmail, papel: userRole,
      texto, visivelCliente: !!mencionaCliente,
      criadoEm: new Date().toISOString(),
    };
    try {
      await updateDoc(doc(db, 'posts', postId), {
        mensagens: [...mensagens, nova], updatedAt: serverTimestamp(),
      });
      setPost((p: any) => ({ ...p, mensagens: [...mensagens, nova] }));
      setMsg('');
      toast.success(nova.visivelCliente ? 'Enviado — o cliente verá esta mensagem' : 'Enviado');
    } catch { toast.error('Erro ao enviar mensagem'); }
  };

  const inserirMencao = (nome: string) => {
    const p = msg.split(/\s/); p[p.length - 1] = '@' + nome.split(' ')[0];
    setMsg(p.join(' ') + ' '); setSugAberta(false);
  };

  const iniciais = (n: string) => n ? n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() : '?';

  /* "CANAPLAN CONSULTORIA TECNICA LTDA" -> "Canaplan" */
  const nomeCurto = (n: string) => {
    if (!n) return '';
    const limpo = n.replace(/\b(LTDA|ME|EIRELI|S\/A|SA|EPP|MEI)\b\.?/gi, '').trim();
    const p = limpo.split(/\s+/);
    const c = p.length > 2 ? p.slice(0, 2).join(' ') : limpo;
    return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
  };

  if (loading || !post) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  if (!task) return (
    <div className="max-w-xl mx-auto py-20 text-center">
      <p className="text-white font-black uppercase tracking-widest mb-2">Tarefa não encontrada</p>
      <button onClick={() => navigate('/producao')} className="text-[#ff5351] font-bold underline text-sm">Voltar ao quadro</button>
    </div>
  );

  const slides: any[] = post.slides || [];
  const cenas: any[] = post.cenas || [];

  return (
    <div className="text-left pb-16">
      {/* ---------- barra do topo ---------- */}
      <div className="flex items-center gap-4 flex-wrap border-b border-zinc-800 pb-4 mb-5">
        <button onClick={() => navigate('/producao')} className="text-zinc-600 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 max-w-[380px]">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff5351]">
              #{String(post.number).padStart(2, '0')} · {post.planNome?.split('-')?.[1]?.trim() || 'Planejamento'}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.12em] px-2 py-[3px] rounded-md"
              style={{ background: setor.cor, color: '#0d1330' }}>{setor.label}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.12em] px-2 py-[3px] rounded-md bg-zinc-800 text-zinc-400">
              {tipo}
            </span>
          </div>
          <h1 className="text-lg font-black text-white leading-tight">{post.headline}</h1>
        </div>

        <div className="w-px h-8 bg-zinc-800" />
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Cliente</div>
          <div className="text-[13px] font-bold text-zinc-200 whitespace-nowrap" title={cliente}>{nomeCurto(cliente)}</div>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Publica em</div>
          <div className="text-[13px] font-bold text-zinc-200">{fmtData(post.publishDate)}</div>
        </div>
        {dias !== null && (
          <>
            <div className="w-px h-8 bg-zinc-800" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Prazo</div>
              <div className={cn("text-[13px] font-bold whitespace-nowrap",
                dias < 0 || dias <= 3 ? "text-[#ff8c8b]" : dias <= 5 ? "text-amber-300" : dias <= 10 ? "text-emerald-400" : "text-zinc-400")}>
                {dias < 0 ? `${Math.abs(dias)} dias atrasado` : dias === 0 ? 'hoje' : `${dias} dia${dias > 1 ? 's' : ''}`}
              </div>
            </div>
          </>
        )}

        <div className="ml-auto flex gap-2.5">
          <button
            onClick={enviarParaRevisao}
            disabled={salvando || !versaoAtual?.arquivos?.length}
            className={cn("px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.13em] transition-all flex items-center gap-2",
              versaoAtual?.arquivos?.length ? "bg-[#ff5351] text-white hover:brightness-110" : "bg-zinc-800 text-zinc-600 cursor-not-allowed")}
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar para revisão
          </button>
        </div>
      </div>

      {/* ---------- grade ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_330px] gap-6 md:gap-8 items-start">

        {/* ===== ESQUERDA: briefing e textos ===== */}
        <div>
          {/* metadados */}
          <div className="flex gap-5 flex-wrap items-baseline pb-4 mb-1">
            <span className="text-[9.5px] font-black uppercase tracking-[0.15em] text-zinc-700">{task.description}</span>
            {(SPECS[tipo] || []).map(([k, v], i) => (
              <React.Fragment key={k}>
                {i > 0 && <span className="text-zinc-800">·</span>}
                <span className="text-[12px] text-zinc-500">{k}<b className="text-zinc-200 font-bold ml-1.5">{v}</b></span>
              </React.Fragment>
            ))}
            {post.duracao && <><span className="text-zinc-800">·</span>
              <span className="text-[12px] text-zinc-500">Duração<b className="text-zinc-200 font-bold ml-1.5">{post.duracao}</b></span></>}
          </div>

          {/* roteiro / slides */}
          {cenas.length > 0 && (
            <>
              <h2 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-3">
                Roteiro <span className="text-[9.5px] text-zinc-700">{cenas.length} cenas</span>
                <span className="flex-1 h-px bg-zinc-800" />
              </h2>
              <div className="mb-7">
                {cenas.map((c: any, i: number) => (
                  <div key={i} className="flex gap-3.5 py-3 border-t border-zinc-800 first:border-t-0 first:pt-0 group items-start">
                    <span className="font-display text-[12px] font-black text-emerald-400/70 w-5 shrink-0 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-white leading-snug">{c.title}</div>
                      {c.description && <div className="text-[12.5px] text-zinc-500 mt-1 leading-relaxed">{c.description}</div>}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copiar texto={`${c.title}${c.description ? ' — ' + c.description : ''}`} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {slides.length > 0 && (
            <>
              <h2 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-3">
                Textos das artes <span className="text-[9.5px] text-zinc-700">{slides.length} slides</span>
                <span className="flex-1 h-px bg-zinc-800" />
              </h2>
              <div className="mb-7">
                {slides.map((s: any, i: number) => (
                  <div key={i} className="flex gap-3 py-1.5 border-t border-zinc-800/60 first:border-t-0 first:pt-0 group items-center">
                    <span className="font-display text-[11.5px] font-black text-[#8ba3ff]/70 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0 text-[13.5px] font-bold text-white leading-snug">{s.title}</div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity"><Copiar texto={s.title} /></div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* textos */}
          <h2 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-3">
            Textos <span className="flex-1 h-px bg-zinc-800" />
          </h2>
          <div className="mb-7">
            {([
              [ehVideo(tipo) ? 'Capa do reel' : 'Sugestão visual', post.sugestaoVisual],
              ['Texto da arte', post.textoArte],
              ['Legenda', post.caption],
              ['Hashtags', post.hashtags],
              ['CTA', post.cta],
            ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex gap-3.5 py-3 border-t border-zinc-800 first:border-t-0 first:pt-0 group items-start">
                <div className="flex-1 min-w-0">
                  <span className="text-[9.5px] font-black uppercase tracking-[0.15em] text-zinc-600">{k}</span>
                  <div className={cn("text-[13.5px] mt-1 leading-relaxed", k === 'Hashtags' ? "text-[#8ba3ff]" : "text-zinc-300")}>{v}</div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity"><Copiar texto={v} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== DIREITA: entrega, versões e conversa ===== */}
        <div className="space-y-4">
          <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[20px] p-5">
            <div className="flex justify-center mb-3.5 relative">
              <div className="relative rounded-xl overflow-hidden bg-[#232323] border border-zinc-700 flex items-center justify-center"
                style={{ width: versaoAtual?.arquivos?.length ? (ehVideo(tipo) ? 148 : 186) : (ehVideo(tipo) ? 104 : 132), aspectRatio: proporcao(tipo) }}>
                {versaoAtual?.arquivos?.[0]?.url && !ehVideo(tipo) ? (
                  <img src={versaoAtual.arquivos[0].url} alt="" className="w-full h-full object-cover" />
                ) : versaoAtual?.arquivos?.[0]?.url ? (
                  <div className="w-9 h-9 rounded-full bg-black/50 border-2 border-white/70 flex items-center justify-center text-white text-xs pl-0.5">▶</div>
                ) : (
                  <span className="text-[10px] text-zinc-600 font-bold px-3 text-center">sem arquivo</span>
                )}
                <span className="absolute bottom-1.5 left-1.5 text-[8px] font-black bg-black/60 rounded px-1.5 py-0.5 text-zinc-300">
                  {SPECS[tipo]?.[0]?.[1]}
                </span>
                {versaoAtual?.arquivos?.length > 0 && (
                  <button onClick={() => { setSlideLB(0); setLightbox(true); }}
                    className="absolute top-2 right-2 bg-black/65 border border-zinc-700 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-[0.09em] text-zinc-300 hover:bg-[#ff5351] hover:text-white hover:border-[#ff5351]">
                    <Maximize2 className="w-3 h-3 inline -mt-px" /> Tela cheia
                  </button>
                )}
              </div>
            </div>

            {versaoAtual && (
              <div className="text-center mb-3.5">
                <div className="font-display text-[12.5px] font-black text-white truncate">{versaoAtual.arquivos?.[0]?.nome || '—'}</div>
                <span className={cn("inline-block text-[8.5px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md mt-1.5",
                  versaoAtual.status === 'rascunho' ? "bg-amber-500/15 text-amber-300"
                    : versaoAtual.status === 'em_revisao' ? "bg-blue-500/15 text-blue-300"
                      : "bg-emerald-500/15 text-emerald-400")}>
                  {versaoAtual.status === 'rascunho' ? `rascunho v${versaoAtual.n}`
                    : versaoAtual.status === 'em_revisao' ? `v${versaoAtual.n} em revisão` : `v${versaoAtual.n}`}
                </span>
              </div>
            )}

            <input ref={fileRef} type="file" className="hidden"
              multiple
              onChange={e => { if (e.target.files?.length) subirArquivos(e.target.files); e.target.value = ''; }} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files?.length) subirArquivos(e.dataTransfer.files); }}
              className="border-[1.5px] border-dashed border-zinc-700 rounded-2xl py-4 px-3 text-center cursor-pointer hover:border-[#ff5351] hover:bg-[#ff5351]/[0.04] transition-all"
            >
              <Upload className="w-4 h-4 mx-auto text-zinc-600" />
              <div className="text-[12px] font-bold text-zinc-400 mt-1.5">
                {versoes.length ? 'Nova versão' : 'Arraste o arquivo ou clique'}
              </div>
              <div className="text-[10.5px] text-zinc-600">
                {ehVideo(tipo) ? 'MP4 até 200 MB' : 'PNG ou JPG · pode selecionar várias'}
              </div>
            </div>

            {enviando && (
              <div className="bg-[#151515] border border-zinc-800 rounded-xl p-2.5 mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11.5px] font-semibold text-zinc-200 truncate flex-1">{enviando.nome}</span>
                  <span className="text-[10.5px] font-black text-emerald-400">{enviando.pct}%</span>
                </div>
                <div className="text-[10px] text-zinc-600">
                  {enviando.total > 1 ? `enviando ${enviando.i} de ${enviando.total}…` : 'enviando…'}
                </div>
                <div className="h-[3px] bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${enviando.pct}%` }} />
                </div>
              </div>
            )}

            {versaoAtual?.arquivos?.map((a: any, i: number) => (
              <div key={i} className="bg-[#151515] border border-zinc-800 rounded-xl p-2.5 mt-2 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs shrink-0">
                  {a.tipo?.startsWith('video') ? '🎬' : '🖼'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11.5px] font-semibold text-zinc-200 truncate flex-1">{a.nome}</span>
                    <span className="text-[10.5px] font-black text-zinc-600">100%</span>
                  </div>
                  <div className="text-[10px] text-zinc-600">{tamanho(a.tamanho || 0)} · enviado</div>
                  <div className="h-[3px] bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
                </div>
                {versaoAtual.status === 'rascunho' && (
                  <button onClick={() => removerArquivo(i)} className="text-zinc-700 hover:text-[#ff8c8b]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* versões */}
          {versoes.length > 0 && (
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[20px] p-5">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-3">Versões</h2>
              {[...versoes].reverse().map((v: any) => (
                <div key={v.n} className="flex gap-2.5 py-2.5 border-t border-zinc-800 first:border-t-0 first:pt-0">
                  <span className={cn("font-display text-[11px] font-black w-5 shrink-0",
                    v === versaoAtual ? "text-[#ff5351]" : "text-zinc-600")}>v{v.n}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-zinc-300">
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(v.enviadoEm))}
                      </span>
                      <span className={cn("text-[8.5px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md",
                        v.status === 'ajuste' ? "bg-[#ff5351]/15 text-[#ff8c8b]"
                          : v.status === 'aprovado' ? "bg-emerald-500/15 text-emerald-400"
                            : v.status === 'em_revisao' ? "bg-blue-500/15 text-blue-300"
                              : "bg-amber-500/15 text-amber-300")}>
                        {v.status === 'ajuste' ? 'ajuste' : v.status === 'aprovado' ? 'aprovado' : v.status === 'em_revisao' ? 'em revisão' : 'rascunho'}
                      </span>
                    </div>
                    {v.motivo && (
                      <p className="text-[11.5px] text-zinc-500 mt-1.5 border-l-2 border-[#3a2020] pl-2.5 leading-snug">{v.motivo}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* conversa */}
          <h2 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-3">
            Conversa <span className="text-[9.5px] text-zinc-700">{mensagens.length} mensagens</span>
            <span className="flex-1 h-px bg-zinc-800" />
          </h2>

          <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto pr-1 mb-3">
            {mensagens.length === 0 && <p className="text-[12px] text-zinc-700">Nenhuma mensagem ainda.</p>}
            {mensagens.map((m: any) => (
              <div key={m.id} className="flex gap-2.5">
                <span className="w-[25px] h-[25px] shrink-0 rounded-full bg-zinc-800 text-zinc-400 text-[8.5px] font-black flex items-center justify-center">
                  {iniciais(m.autorNome)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[11px] font-black text-zinc-300">{m.autorNome}</span>
                    <span className="text-[9.5px] text-zinc-700">
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(m.criadoEm))}
                    </span>
                  </div>
                  <div className={cn("text-[12.5px] text-zinc-300 leading-relaxed",
                    m.visivelCliente && "border-l-2 border-amber-500/50 pl-2.5")}>
                    {m.texto}
                  </div>
                  {m.visivelCliente && (
                    <div className="text-[9px] font-black uppercase text-amber-300 mt-1">visível para o cliente</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            {sugAberta && (
              <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 bg-[#242424] border border-zinc-700 rounded-xl p-1.5 z-10">
                {equipe.map((m: any) => (
                  <button key={m.id} onClick={() => inserirMencao(m.name || m.email)}
                    className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800 text-left">
                    <span className="w-5 h-5 rounded-full bg-zinc-700 text-[8px] font-black flex items-center justify-center text-zinc-300">
                      {iniciais(m.name || m.email)}
                    </span>
                    <span className="text-[12px] font-bold text-zinc-200">{m.name || m.email}</span>
                    <span className="text-[9.5px] text-zinc-500 ml-auto">{m.role}</span>
                  </button>
                ))}
                <button onClick={() => inserirMencao('cliente')}
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800 text-left">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[8px] font-black flex items-center justify-center">CL</span>
                  <span className="text-[12px] font-bold text-zinc-200">{cliente}</span>
                  <span className="text-[9.5px] text-amber-300 ml-auto">cliente</span>
                </button>
              </div>
            )}
            <textarea
              rows={2} value={msg}
              onChange={e => { setMsg(e.target.value); setSugAberta(e.target.value.split(/\s/).pop() === '@'); }}
              placeholder="Escreva aqui. Use @ para chamar alguém…"
              className="w-full bg-[#151515] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-200 outline-none focus:border-[#ff5351] resize-none"
            />
          </div>

          {mencionaCliente && (
            <div className="flex gap-2 bg-amber-500/[0.07] border border-amber-500/30 rounded-xl px-3 py-2.5 mt-2 text-[11px] text-amber-100/80 leading-snug">
              👁 <span><b className="text-amber-300">Visível para o cliente.</b> Remova a menção para falar só com a equipe.</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10.5px] text-zinc-700 flex-1">Digite <b className="text-zinc-500">@</b> para mencionar</span>
            <button onClick={enviarMensagem} disabled={!msg.trim()}
              className={cn("px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.13em] transition-all",
                msg.trim() ? "bg-[#ff5351] text-white hover:brightness-110" : "bg-zinc-800 text-zinc-600 cursor-not-allowed")}>
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* ---------- lightbox ---------- */}
      {lightbox && versaoAtual?.arquivos?.length > 0 && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-6">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <div className="font-display text-[15px] font-black text-white">{post.headline}</div>
              <div className="text-[12px] text-zinc-500">
                {versaoAtual.arquivos[slideLB]?.nome} · {SPECS[tipo]?.[1]?.[1]}
              </div>
            </div>
            <button onClick={() => setLightbox(false)}
              className="ml-auto border border-zinc-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400 hover:text-white">
              Fechar ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center gap-5 min-h-0">
            {versaoAtual.arquivos.length > 1 && (
              <button onClick={() => setSlideLB(s => (s - 1 + versaoAtual.arquivos.length) % versaoAtual.arquivos.length)}
                className="w-11 h-11 shrink-0 rounded-full border border-zinc-700 text-zinc-300 text-xl hover:bg-[#ff5351] hover:text-white hover:border-[#ff5351]">‹</button>
            )}
            <div className="h-full flex items-center justify-center">
              {versaoAtual.arquivos[slideLB]?.tipo?.startsWith('video') ? (
                <video src={versaoAtual.arquivos[slideLB].url} controls className="max-h-full rounded-2xl" />
              ) : (
                <img src={versaoAtual.arquivos[slideLB]?.url} alt="" className="max-h-full rounded-2xl object-contain" />
              )}
            </div>
            {versaoAtual.arquivos.length > 1 && (
              <button onClick={() => setSlideLB(s => (s + 1) % versaoAtual.arquivos.length)}
                className="w-11 h-11 shrink-0 rounded-full border border-zinc-700 text-zinc-300 text-xl hover:bg-[#ff5351] hover:text-white hover:border-[#ff5351]">›</button>
            )}
          </div>
          {versaoAtual.arquivos.length > 1 && (
            <div className="flex gap-2 justify-center mt-4">
              {versaoAtual.arquivos.map((_: any, i: number) => (
                <button key={i} onClick={() => setSlideLB(i)}
                  className={cn("w-9 h-12 rounded-lg border-2 flex items-center justify-center text-[11px] font-black",
                    i === slideLB ? "border-white text-white bg-zinc-800" : "border-zinc-800 text-zinc-600 bg-zinc-900")}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
