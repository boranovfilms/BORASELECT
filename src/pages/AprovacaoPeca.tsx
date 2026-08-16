import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ *
 * APROVAÇÃO DA PEÇA — tela cheia
 * Serve aos DOIS momentos: revisão interna do redator e aprovação do cliente.
 * A decisão é POR ARQUIVO entregue (não por slide do briefing — o carrossel
 * pode ter menos artes que slides planejados, e isso é normal).
 *
 * Regra: a peça só avança quando TODOS os arquivos estiverem aprovados.
 * Havendo qualquer reprovação, a versão volta inteira para quem produziu,
 * mas só os arquivos marcados precisam ser refeitos.
 * ------------------------------------------------------------------ */

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

export default function AprovacaoPeca() {
  const { postId, taskIndex } = useParams<{ postId: string; taskIndex: string }>();
  const idx = Number(taskIndex ?? 0);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [post, setPost] = useState<any>(null);
  const [cliente, setCliente] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [papel, setPapel] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [atual, setAtual] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [decisoes, setDecisoes] = useState<Record<number, { d: 'ok' | 'no'; motivo: string }>>({});

  useEffect(() => { carregar(); }, [postId]);

  const carregar = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const u = auth.currentUser;
      const email = u?.email?.toLowerCase().trim() || '';
      setUserEmail(email);

      const snap = await getDoc(doc(db, 'posts', postId));
      if (!snap.exists()) { toast.error('Peça não encontrada'); navigate(-1); return; }
      const p = { id: snap.id, ...snap.data() } as any;
      setPost(p);

      const cs = await getDoc(doc(db, 'clientes', p.clientId));
      if (cs.exists()) { setCliente(cs.data().name || ''); setClienteEmail(cs.data().email?.toLowerCase() || ''); }

      /* papel do usuário */
      if (email === 'admin@boraselect.com.br') { setPapel('master'); setUserName('Admin'); }
      else {
        const bs = await getDocs(query(collection(db, 'boraselect'), where('email', '==', email)));
        if (!bs.empty) { setPapel(bs.docs[0].data().role || 'redator'); setUserName(bs.docs[0].data().name || email); }
        else {
          const cq = await getDocs(query(collection(db, 'clientes'), where('email', '==', email)));
          if (!cq.empty) { setPapel(cq.docs[0].data().role || 'cliente'); setUserName(cq.docs[0].data().name || email); }
        }
      }
    } catch (e) {
      console.error(e); toast.error('Erro ao carregar');
    } finally { setLoading(false); }
  };

  const task = post?.tasks?.[idx];
  const versoes: any[] = task?.versoes || [];
  const versao = versoes.length ? versoes[versoes.length - 1] : null;
  const arquivos: any[] = versao?.arquivos || [];
  const ehCliente = ['cliente', 'equipe'].includes(papel);
  const ehVideoArq = (a: any) => a?.tipo?.startsWith('video');

  /* fase: interna (redator revisa) ou cliente */
  const fase = versao?.status === 'aprovado_interno' ? 'cliente' : 'interna';

  const oks = Object.values(decisoes).filter(d => d.d === 'ok').length;
  const nos = Object.values(decisoes).filter(d => d.d === 'no').length;
  const falta = arquivos.length - oks - nos;
  const dec = decisoes[atual];

  const marcar = (v: 'ok' | 'no') => {
    if (v === 'ok') {
      setDecisoes(s => ({ ...s, [atual]: { d: 'ok', motivo: '' } }));
      setMotivo('');
      setTimeout(() => setAtual(a => Math.min(a + 1, arquivos.length - 1)), 240);
    } else {
      setDecisoes(s => ({ ...s, [atual]: { d: 'no', motivo: s[atual]?.motivo || '' } }));
      setMotivo(decisoes[atual]?.motivo || '');
    }
  };

  const salvarMotivo = () => {
    const t = motivo.trim();
    if (!t) { toast.error('Escreva o que precisa mudar'); return; }
    setDecisoes(s => ({ ...s, [atual]: { d: 'no', motivo: t } }));
    toast.success('Ajuste anotado');
    const prox = arquivos.findIndex((_, i) => i !== atual && !decisoes[i]);
    if (prox >= 0) { setAtual(prox); setMotivo(''); }
  };

  const nav = (n: number) => {
    const i = (atual + n + arquivos.length) % arquivos.length;
    setAtual(i);
    setMotivo(decisoes[i]?.motivo || '');
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') nav(1);
      if (e.key === 'ArrowLeft') nav(-1);
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  /* ---------- concluir ---------- */
  const concluir = async () => {
    if (falta > 0 || !postId) return;
    setSalvando(true);
    try {
      const reprovados = arquivos
        .map((a, i) => ({ a, i, d: decisoes[i] }))
        .filter(x => x.d?.d === 'no');

      /* mensagens no chat da tarefa, uma por arquivo reprovado */
      const novasMsgs = reprovados.map(r => ({
        id: `m_${Date.now()}_${r.i}`,
        autorNome: userName, autorEmail: userEmail, papel,
        texto: `Ajuste no arquivo ${r.i + 1} (${r.a.nome}): ${r.d!.motivo}`,
        arquivoIndex: r.i,
        visivelCliente: true,
        criadoEm: new Date().toISOString(),
      }));

      const houveReprovacao = reprovados.length > 0;
      const novoStatusVersao = houveReprovacao
        ? 'ajuste'
        : (ehCliente ? 'aprovado' : 'aprovado_interno');

      const resumo = houveReprovacao
        ? reprovados.map(r => `#${r.i + 1} ${r.a.nome}: ${r.d!.motivo}`).join(' · ')
        : null;

      const novasVersoes = versoes.map((v, i) =>
        i === versoes.length - 1
          ? {
              ...v,
              status: novoStatusVersao,
              motivo: resumo,
              revisadoPor: userName,
              revisadoEm: new Date().toISOString(),
              decisoes: arquivos.map((_, i2) => decisoes[i2]?.d || null),
            }
          : v);

      const novasTasks = (post.tasks || []).map((t: any, i: number) =>
        i === idx
          ? { ...t, versoes: novasVersoes, status: houveReprovacao ? 'em_andamento' : (ehCliente ? 'concluido' : t.status) }
          : t);

      await updateDoc(doc(db, 'posts', postId), {
        tasks: novasTasks,
        mensagens: [...(post.mensagens || []), ...novasMsgs],
        updatedAt: serverTimestamp(),
      });

      /* notificações */
      if (houveReprovacao) {
        if (task?.responsibleEmail) {
          await notificacaoService.criar({
            para: task.responsibleEmail, tipo: 'peca_com_ajustes',
            titulo: `${reprovados.length} ajuste(s) na sua entrega`,
            descricao: `${post.headline} — ${cliente}`,
            planId: post.planId, postId, visto: false, criadoEm: new Date().toISOString(),
          });
        }
        toast.success('Devolvido para ajuste');
      } else if (!ehCliente) {
        if (clienteEmail) {
          await notificacaoService.criar({
            para: clienteEmail, tipo: 'arte_para_aprovacao',
            titulo: 'Nova arte para aprovar',
            descricao: `${post.headline} — publica em ${post.publishDate}`,
            planId: post.planId, postId, visto: false, criadoEm: new Date().toISOString(),
          });
        }
        toast.success('Liberado para o cliente');
      } else {
        const bs = await getDocs(collection(db, 'boraselect'));
        for (const m of bs.docs) {
          const em = m.data().email?.toLowerCase();
          if (!em) continue;
          await notificacaoService.criar({
            para: em, tipo: 'arte_aprovada_cliente',
            titulo: 'Arte aprovada pelo cliente',
            descricao: `${post.headline} — ${cliente}`,
            planId: post.planId, postId, visto: false, criadoEm: new Date().toISOString(),
          });
        }
        toast.success('Peça aprovada!');
      }
      navigate(ehCliente ? '/minhas-demandas' : '/producao');
    } catch (e) {
      console.error(e); toast.error('Erro ao concluir');
    } finally { setSalvando(false); }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  if (!task || !versao || !arquivos.length) return (
    <div className="max-w-lg mx-auto py-24 text-center">
      <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Nada para revisar</p>
      <p className="text-zinc-500 text-sm mb-5">Esta tarefa ainda não tem arquivos entregues.</p>
      <button onClick={() => navigate(-1)} className="text-[#ff5351] font-bold underline text-sm">Voltar</button>
    </div>
  );

  const arq = arquivos[atual];

  return (
    <div className="fixed inset-0 bg-[#0b0b0b] z-[9998] flex flex-col">

      {/* ---------- topo ---------- */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4 flex-wrap bg-[#111]">
        <div className="min-w-0 max-w-[420px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.12em] px-2 py-[3px] rounded-md bg-[#8ba3ff] text-[#0d1330]">
              {task.deptLabel}
            </span>
            <span className={cn("text-[9px] font-black uppercase tracking-[0.12em] px-2 py-[3px] rounded-md",
              ehCliente ? "bg-amber-500/15 text-amber-300" : "bg-blue-500/15 text-blue-300")}>
              {ehCliente ? 'Aprovação do cliente' : 'Revisão interna'}
            </span>
          </div>
          <h1 className="text-[17px] font-black text-white leading-tight truncate">{post.headline}</h1>
          <div className="text-[11.5px] text-zinc-500 mt-0.5">
            {cliente} · publica em {fmtData(post.publishDate)} · versão {versao.n}
          </div>
        </div>

        <div className="w-px h-8 bg-zinc-800" />

        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-emerald-500/[0.07] border border-emerald-500/30 rounded-xl px-3.5 py-1.5">
            <span className="font-display text-[17px] font-black text-emerald-400 leading-none">{oks}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.11em] text-emerald-600">Aprovados</span>
          </div>
          <div className="flex items-center gap-2 bg-[#ff5351]/[0.07] border border-[#ff5351]/30 rounded-xl px-3.5 py-1.5">
            <span className="font-display text-[17px] font-black text-[#ff8c8b] leading-none">{nos}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.11em] text-[#a06f6e]">Ajustes</span>
          </div>
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-zinc-800 rounded-xl px-3.5 py-1.5">
            <span className="font-display text-[17px] font-black text-zinc-400 leading-none">{falta}</span>
            <span className="text-[9px] font-black uppercase tracking-[0.11em] text-zinc-600">A ver</span>
          </div>
        </div>

        <button onClick={() => navigate(-1)}
          className="ml-auto flex items-center gap-2 border border-zinc-700 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400 hover:text-white hover:border-zinc-500">
          <X className="w-3.5 h-3.5" /> Fechar
        </button>
      </div>

      {/* ---------- corpo ---------- */}
      <div className="flex-1 flex min-h-0">

        {/* palco */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-6 gap-4">
          <div className="flex items-center gap-5 flex-1 min-h-0 w-full justify-center">
            {arquivos.length > 1 && (
              <button onClick={() => nav(-1)}
                className="w-11 h-11 shrink-0 rounded-full border border-zinc-700 text-zinc-300 flex items-center justify-center hover:bg-[#ff5351] hover:text-white hover:border-[#ff5351]">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <div className={cn("h-full flex items-center justify-center border-2 bg-black relative max-w-[62%]",
              dec?.d === 'ok' ? "border-emerald-500/60" : dec?.d === 'no' ? "border-[#ff5351]/70" : "border-zinc-800")}>
              {ehVideoArq(arq)
                ? <video src={arq.url} controls className="max-h-full max-w-full" />
                : <img src={arq.url} alt="" className="max-h-full max-w-full object-contain" />}
              {dec && (
                <span className={cn("absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-black",
                  dec.d === 'ok' ? "bg-emerald-500 text-[#062a12]" : "bg-[#ff5351] text-white")}>
                  {dec.d === 'ok' ? '✓' : '✕'}
                </span>
              )}
            </div>

            {arquivos.length > 1 && (
              <button onClick={() => nav(1)}
                className="w-11 h-11 shrink-0 rounded-full border border-zinc-700 text-zinc-300 flex items-center justify-center hover:bg-[#ff5351] hover:text-white hover:border-[#ff5351]">
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {arquivos.length > 1 && (
            <div className="flex gap-2 justify-center flex-wrap">
              {arquivos.map((_, i) => {
                const d = decisoes[i]?.d;
                return (
                  <button key={i} onClick={() => { setAtual(i); setMotivo(decisoes[i]?.motivo || ''); }}
                    className={cn("w-10 h-[52px] rounded-lg border-2 flex items-center justify-center text-[11px] font-black relative",
                      i === atual ? "border-white text-white" : d === 'ok' ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                        : d === 'no' ? "border-[#ff5351] bg-[#ff5351]/10 text-[#ff8c8b]" : "border-zinc-800 text-zinc-600")}>
                    {i + 1}
                    {d && (
                      <span className={cn("absolute -top-1.5 -right-1.5 w-[17px] h-[17px] rounded-full text-[9px] font-black flex items-center justify-center border-2 border-[#0b0b0b]",
                        d === 'ok' ? "bg-emerald-500 text-[#062a12]" : "bg-[#ff5351] text-white")}>
                        {d === 'ok' ? '✓' : '✕'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* painel de decisão */}
        <aside className="w-[352px] shrink-0 border-l border-zinc-800 bg-[#111] flex flex-col min-h-0">
          <div className="p-5 border-b border-zinc-900">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600 mb-1">
              Arquivo {atual + 1} de {arquivos.length}
            </div>
            <div className="font-display text-[14px] font-black text-white leading-snug break-words">{arq.nome}</div>
          </div>

          <div className="p-5 border-b border-zinc-900">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-3">Sua decisão</h2>
            <div className="flex gap-2.5">
              <button onClick={() => marcar('ok')}
                className={cn("flex-1 py-3 rounded-2xl text-[10.5px] font-black uppercase tracking-[0.12em] border transition-all",
                  dec?.d === 'ok' ? "bg-emerald-500 text-[#062a12] border-emerald-500"
                    : "border-emerald-500/45 text-emerald-400 hover:bg-emerald-500/10")}>
                ✓ {ehCliente ? 'Aprovar' : 'Liberar'}
              </button>
              <button onClick={() => marcar('no')}
                className={cn("flex-1 py-3 rounded-2xl text-[10.5px] font-black uppercase tracking-[0.12em] border transition-all",
                  dec?.d === 'no' ? "bg-[#ff5351] text-white border-[#ff5351]"
                    : "border-[#ff5351]/40 text-[#ff8c8b] hover:bg-[#ff5351]/10")}>
                ✕ Ajustar
              </button>
            </div>

            {dec?.d === 'no' && (
              <div className="mt-3">
                <span className="block text-[9.5px] font-black uppercase tracking-[0.15em] text-zinc-600 mb-1.5">
                  O que precisa mudar?
                </span>
                <textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Ex.: o texto está cortando na base."
                  className="w-full bg-[#151515] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-200 outline-none focus:border-[#ff5351] resize-none" />
                <button onClick={salvarMotivo}
                  className="w-full mt-2.5 py-2.5 bg-[#ff5351] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.13em] hover:brightness-110">
                  Anotar ajuste
                </button>
                <p className="text-[11px] text-zinc-600 leading-snug mt-2">
                  O comentário vai para a conversa da tarefa marcado como <b className="text-amber-300">arquivo {atual + 1}</b>,
                  para quem produziu saber onde mexer.
                </p>
              </div>
            )}
          </div>

          {/* ajustes já anotados */}
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500 mb-3">Ajustes anotados</h2>
            {nos === 0 && <p className="text-[12px] text-zinc-700">Nenhum até agora.</p>}
            {arquivos.map((a, i) => {
              const d = decisoes[i];
              if (d?.d !== 'no' || !d.motivo) return null;
              return (
                <div key={i} onClick={() => { setAtual(i); setMotivo(d.motivo); }}
                  className="mb-3 cursor-pointer group">
                  <span className="inline-flex items-center gap-1.5 bg-[#ff5351]/12 border border-[#ff5351]/30 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#ff8c8b] mb-1 group-hover:bg-[#ff5351]/20">
                    ◧ Arquivo {i + 1}
                  </span>
                  <p className="text-[12.5px] text-zinc-400 leading-snug">{d.motivo}</p>
                </div>
              );
            })}
          </div>

          {/* rodapé */}
          <div className="p-5 border-t border-zinc-900">
            <button onClick={concluir} disabled={falta > 0 || salvando}
              className={cn("w-full py-3.5 rounded-2xl text-[10.5px] font-black uppercase tracking-[0.14em] flex items-center justify-center gap-2 transition-all",
                falta > 0 ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  : nos > 0 ? "border border-[#ff5351] text-[#ff8c8b] hover:bg-[#ff5351] hover:text-white"
                    : "bg-[#ff5351] text-white hover:brightness-110")}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : nos === 0 && falta === 0 ? <Check className="w-4 h-4" /> : null}
              {falta > 0
                ? `Falta${falta > 1 ? 'm' : ''} ${falta} arquivo${falta > 1 ? 's' : ''}`
                : nos > 0
                  ? `Devolver para ajuste (${nos})`
                  : ehCliente ? 'Aprovar peça' : 'Liberar para o cliente'}
            </button>
            <p className="text-[11px] text-zinc-600 leading-snug mt-2.5 text-center">
              {falta > 0
                ? 'Decida cada arquivo para liberar o botão.'
                : nos > 0
                  ? `A peça volta inteira para quem produziu. Só ${nos === 1 ? 'o arquivo marcado precisa' : `os ${nos} arquivos marcados precisam`} ser refeito${nos === 1 ? '' : 's'}.`
                  : ehCliente ? 'A peça segue para programação.' : 'O cliente passa a ver esta peça.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
