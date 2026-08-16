import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LayoutGrid } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ *
 * QUADRO DE PRODUÇÃO
 * Kanban das mini-tarefas geradas no processamento do planejamento.
 * A tarefa nasce COM SETOR e SEM DONO — quem executa clica em "Assumir".
 * ------------------------------------------------------------------ */

const SETORES: Record<string, { label: string; cor: string }> = {
  design: { label: 'Design', cor: '#8ba3ff' },
  video: { label: 'Edição de vídeo', cor: '#22c55e' },
  redacao: { label: 'Redação', cor: '#f5c14a' },
  midia_social: { label: 'Mídia social', cor: '#e879f9' },
};

/* papel do usuário → setor que ele executa */
const SETOR_DO_PAPEL: Record<string, string> = {
  designer: 'design',
  editor: 'video',
  redacao: 'redacao',
  midia_social: 'midia_social',
};

const COLUNAS = [
  { id: 'pendente', label: 'Pendente', cor: '#6a6a6a' },
  { id: 'em_andamento', label: 'Em andamento', cor: '#8ba3ff' },
  { id: 'concluido', label: 'Concluído', cor: '#22c55e' },
];

/* ---------- datas ---------- */
const paraDate = (s: any): Date | null => {
  if (!s) return null;
  const t = String(s).trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
};
const fmtData = (s: any) => {
  const d = paraDate(s);
  if (!d) return { dm: '--.--', ano: '--' };
  return {
    dm: String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0'),
    ano: String(d.getFullYear()).slice(2),
  };
};
const diasAte = (s: any): number | null => {
  const d = paraDate(s);
  if (!d) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
};

export default function QuadroProducao() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [soMinhas, setSoMinhas] = useState(false);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const email = user?.email?.toLowerCase().trim() || '';
      setUserEmail(email);

      let role = '';
      let nome = user?.displayName || '';
      if (email === 'admin@boraselect.com.br') {
        role = 'master'; nome = nome || 'Admin';
      } else {
        const snap = await getDocs(query(collection(db, 'boraselect'), where('email', '==', email)));
        if (!snap.empty) {
          role = snap.docs[0].data().role || '';
          nome = snap.docs[0].data().name || nome;
        }
      }
      setUserRole(role);
      setUserName(nome);

      /* quem executa começa vendo o próprio setor */
      const meuSetor = SETOR_DO_PAPEL[role];
      if (meuSetor) setFiltro(meuSetor);

      const postsSnap = await getDocs(collection(db, 'posts'));
      const todos = postsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(p => (p.tasks || []).length > 0);
      setPosts(todos);

      const cliSnap = await getDocs(collection(db, 'clientes'));
      const mapa: Record<string, string> = {};
      cliSnap.docs.forEach(d => { mapa[d.id] = d.data().name || ''; });
      setClientes(mapa);

    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar as tarefas');
    } finally {
      setLoading(false);
    }
  };

  /* achata posts → lista de tarefas */
  const tarefas = useMemo(() => {
    const lista: any[] = [];
    posts.forEach(p => {
      (p.tasks || []).forEach((t: any, i: number) => {
        lista.push({
          chave: p.id + '::' + (t.id || i),
          postId: p.id,
          taskIndex: i,
          planId: p.planId,
          planNome: p.planNome,
          cliente: clientes[p.clientId] || '',
          numero: p.number,
          headline: p.headline,
          tipo: p.type,
          publishDate: p.publishDate,
          setor: t.dept,
          setorLabel: t.deptLabel || SETORES[t.dept]?.label || t.dept,
          descricao: t.description,
          status: t.status === 'concluido' ? 'concluido'
                : t.status === 'pendente' ? 'pendente' : 'em_andamento',
          statusReal: t.status,
          donoEmail: t.responsibleEmail || '',
          donoNome: t.responsibleName || '',
        });
      });
    });
    return lista;
  }, [posts, clientes]);

  const visiveis = useMemo(() => {
    return tarefas
      .filter(t => (filtro === 'todos' || t.setor === filtro))
      .filter(t => !soMinhas || t.donoEmail === userEmail)
      .sort((a, b) => {
        if (a.status === 'concluido' && b.status !== 'concluido') return 1;
        if (b.status === 'concluido' && a.status !== 'concluido') return -1;
        const da = paraDate(a.publishDate), dbb = paraDate(b.publishDate);
        if (!da) return 1;
        if (!dbb) return -1;
        return da.getTime() - dbb.getTime();
      });
  }, [tarefas, filtro, soMinhas, userEmail]);

  const contagem = (setor: string) => {
    const base = tarefas.filter(t => !soMinhas || t.donoEmail === userEmail);
    return setor === 'todos' ? base.length : base.filter(t => t.setor === setor).length;
  };

  /* ---------- gravar alteração numa tarefa ---------- */
  const alterarTarefa = async (t: any, mudancas: any) => {
    setSalvando(t.chave);
    try {
      const post = posts.find(p => p.id === t.postId);
      if (!post) return;
      const novas = (post.tasks || []).map((x: any, i: number) =>
        i === t.taskIndex ? { ...x, ...mudancas } : x
      );
      await updateDoc(doc(db, 'posts', t.postId), { tasks: novas, updatedAt: serverTimestamp() });
      setPosts(ps => ps.map(p => p.id === t.postId ? { ...p, tasks: novas } : p));
    } catch (e) {
      toast.error('Não foi possível salvar');
    } finally {
      setSalvando(null);
    }
  };

  const assumir = (t: any) => {
    alterarTarefa(t, {
      responsibleEmail: userEmail,
      responsibleName: userName || userEmail,
      status: t.statusReal === 'pendente' ? 'em_andamento' : t.statusReal,
    });
    toast.success('Tarefa assumida');
  };
  const concluir = (t: any) => { alterarTarefa(t, { status: 'concluido' }); toast.success('Tarefa concluída'); };
  const reabrir = (t: any) => alterarTarefa(t, { status: 'em_andamento' });
  const largar = (t: any) => alterarTarefa(t, { responsibleEmail: '', responsibleName: '', status: 'pendente' });

  const iniciais = (n: string) => n ? n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() : '';

  /* pílula de prazo: até 3 vermelho · até 5 amarelo · até 10 verde · acima cinza */
  const Prazo = ({ t }: { t: any }) => {
    if (t.status === 'concluido')
      return <span className="ml-auto shrink-0 inline-flex items-baseline gap-1 rounded-full px-2.5 py-[3px] border text-[8px] font-black uppercase border-emerald-500/35 text-emerald-400 bg-emerald-500/[0.08]"><b className="text-[12px] font-black">✓</b>feito</span>;
    const d = diasAte(t.publishDate);
    if (d === null) return null;
    const base = "ml-auto shrink-0 inline-flex items-baseline gap-[3px] rounded-full px-2.5 py-[3px] border leading-none";
    const pulso = "animate-[pulsaPrazo_1.15s_ease-in-out_infinite]";
    if (d < 0) return <span className={cn(base, "border-[#ff5351] bg-[#ff5351] text-white", pulso)}><b className="font-display text-[12px] font-black">{Math.abs(d)}</b><i className="not-italic text-[8px] font-black uppercase">atrasado</i></span>;
    if (d === 0) return <span className={cn(base, "border-[#ff5351] bg-[#ff5351] text-white", pulso)}><b className="font-display text-[12px] font-black">hoje</b></span>;
    const cls = d <= 3 ? "border-[#ff5351] text-[#ff8c8b] bg-[#ff5351]/[0.13]"
      : d <= 5 ? "border-[#f5c14a]/45 text-[#f3cd7e] bg-[#f5c14a]/10"
      : d <= 10 ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
      : "border-zinc-700 text-zinc-500";
    return <span className={cn(base, cls, d === 1 && pulso)}>
      <b className="font-display text-[12px] font-black">{d}</b>
      <i className="not-italic text-[8px] font-black uppercase">{d === 1 ? 'dia' : 'dias'}</i>
    </span>;
  };

  const Card = ({ t }: { t: any }) => {
    const cor = SETORES[t.setor]?.cor || '#6a6a6a';
    const f = fmtData(t.publishDate);
    const meu = t.donoEmail === userEmail;
    const ocupado = salvando === t.chave;
    return (
      <div className={cn("bg-[#1f1f1f] border border-zinc-800 rounded-2xl flex overflow-hidden transition-all hover:border-zinc-700", t.status === 'concluido' && "opacity-[0.62]", ocupado && "opacity-50")}>
        <div className="w-[28px] shrink-0 flex items-center justify-center" style={{ background: cor }}>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[8.5px] font-black uppercase tracking-[0.15em] whitespace-nowrap py-2.5 text-white">
            {t.setorLabel}
          </span>
        </div>
        <div className="flex-1 min-w-0 p-3 px-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-display text-[15px] font-black text-white leading-none tracking-tight">
              {f.dm}<span className="text-[13px] text-zinc-600 font-bold">.{f.ano}</span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 border border-zinc-700 rounded-md px-1.5 py-0.5">
              {t.tipo}
            </span>
            <Prazo t={t} />
          </div>

          <h4 className={cn("text-[13.5px] font-bold text-white leading-snug mb-1.5", t.status === 'concluido' && "line-through decoration-2 decoration-[#ff5351]")}>
            {t.headline}
          </h4>
          {t.descricao && <p className="text-[11px] text-zinc-600 mb-1.5">{t.descricao}</p>}

          <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-zinc-600">
            <span className="text-zinc-500 font-semibold">{t.cliente}</span>

            {t.donoNome ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-[10.5px] min-w-0">
                <span className="w-[19px] h-[19px] shrink-0 rounded-full bg-zinc-700 text-zinc-300 text-[8.5px] font-black flex items-center justify-center">
                  {iniciais(t.donoNome)}
                </span>
                <span className="truncate">{t.donoNome}{meu && ' (você)'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-bold text-[10.5px] text-zinc-600">
                <span className="w-[19px] h-[19px] shrink-0 rounded-full border border-dashed border-zinc-700" />
                livre
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {!t.donoEmail && t.status !== 'concluido' && (
                <button onClick={() => assumir(t)} disabled={ocupado}
                  className="text-[9px] font-black uppercase tracking-[0.11em] border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all">
                  Assumir
                </button>
              )}
              {meu && t.status === 'em_andamento' && (
                <>
                  <button onClick={() => largar(t)} disabled={ocupado}
                    className="text-[9px] font-black uppercase tracking-[0.11em] border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-600 hover:text-zinc-300 transition-all">
                    Largar
                  </button>
                  <button onClick={() => concluir(t)} disabled={ocupado}
                    className="text-[9px] font-black uppercase tracking-[0.11em] bg-emerald-500 rounded-lg px-2.5 py-1 text-[#08240f] hover:brightness-110 transition-all">
                    Concluir
                  </button>
                </>
              )}
              {t.status === 'concluido' && meu && (
                <button onClick={() => reabrir(t)} disabled={ocupado}
                  className="text-[9px] font-black uppercase tracking-[0.11em] border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-600 hover:text-zinc-300 transition-all">
                  Reabrir
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  return (
    <div className="space-y-5 pb-20 text-left">
      <style>{`@keyframes pulsaPrazo{
        0%{box-shadow:0 0 0 0 rgba(255,83,81,.5)}
        60%{box-shadow:0 0 0 7px rgba(255,83,81,0)}
        100%{box-shadow:0 0 0 0 rgba(255,83,81,0)}
      }
      @media (prefers-reduced-motion:reduce){
        .animate-\\[pulsaPrazo_1\\.15s_ease-in-out_infinite\\]{animation:none}
      }`}</style>

      <header>
        <p className="text-[#ff5351] text-[11px] font-black uppercase tracking-[0.2em]">Produção</p>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tight mt-1.5">
          Quadro de tarefas
        </h1>
      </header>

      {/* filtros */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['todos', ...Object.keys(SETORES)].map(s => {
            const n = contagem(s);
            if (s !== 'todos' && n === 0) return null;
            return (
              <button key={s} onClick={() => setFiltro(s)}
                className={cn(
                  "inline-flex items-center gap-2 border rounded-full px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.06em] transition-all",
                  filtro === s ? "bg-white text-[#111] border-white" : "bg-[#1f1f1f] border-zinc-800 text-zinc-500 hover:text-zinc-300"
                )}>
                {s !== 'todos' && <i className="w-2.5 h-2.5 rounded-[3px]" style={{ background: SETORES[s].cor }} />}
                {s === 'todos' ? 'Todos' : SETORES[s].label}
                <span className={cn("rounded-md px-1.5 text-[10px]", filtro === s ? "bg-black/10" : "bg-white/[0.08]")}>{n}</span>
              </button>
            );
          })}
        </div>

        <button onClick={() => setSoMinhas(v => !v)}
          className={cn(
            "inline-flex items-center gap-2.5 bg-[#1f1f1f] border rounded-full px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.06em] transition-all",
            soMinhas ? "border-[#ff5351] text-[#ff8c8b]" : "border-zinc-800 text-zinc-500"
          )}>
          <span className={cn("w-[30px] h-4 rounded-full relative transition-colors", soMinhas ? "bg-[#ff5351]" : "bg-zinc-700")}>
            <span className={cn("absolute top-0.5 w-3 h-3 rounded-full transition-all", soMinhas ? "left-[16px] bg-white" : "left-0.5 bg-zinc-500")} />
          </span>
          Só as minhas
        </button>
      </div>

      {/* kanban */}
      {tarefas.length === 0 ? (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[26px] p-14 text-center">
          <LayoutGrid className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Nenhuma tarefa em produção</p>
          <p className="text-zinc-500 text-sm">As tarefas aparecem aqui depois que um planejamento aprovado é processado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-start">
          {COLUNAS.map(col => {
            const its = visiveis.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="bg-white/[0.015] border border-zinc-800 rounded-[20px] p-3.5 min-h-[220px]">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.16em] flex items-center gap-2" style={{ color: col.cor }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: col.cor }} />
                    {col.label}
                  </h3>
                  <span className="bg-zinc-800 rounded-md px-2 py-0.5 text-[10px] font-black text-zinc-500">{its.length}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {its.length
                    ? its.map(t => <Card key={t.chave} t={t} />)
                    : <p className="text-[12px] text-zinc-700 px-0.5 py-2">Nada aqui.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
