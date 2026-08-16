import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Loader2, ChevronRight, AlertCircle, CheckCircle2, Clock, FileText, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { DataTable } from '../components/ui/DataTable';

const TOTAL_ETAPAS_FLUXO = 7;
const pctAprovacao = (status: string): number => {
  const etapa: Record<string, number> = {
    rascunho: 1,
    devolvido: 1,
    aguardando_cliente: 2,
    aguardando_validacao_equipe: 3,
    aprovado: 3,
    aprovado_equipe: 4,
    em_producao: 4,
    concluido: 7,
  };
  return Math.round(((etapa[status] || 1) / TOTAL_ETAPAS_FLUXO) * 100);
};

export default function MinhasDemandas() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('cliente');
  const [userEmail, setUserEmail] = useState('');
  const [userClientId, setUserClientId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [demandas, setDemandas] = useState<any[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<any | null>(null);
  const [demandasCliente, setDemandasCliente] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const email = user.email?.toLowerCase().trim() || '';
      setUserEmail(email);

      let role = 'cliente';
      let clientId: string | null = null;

      if (email === 'admin@boraselect.com.br') {
        role = 'master';
      } else {
        const qBora = query(collection(db, 'boraselect'), where('email', '==', email));
        const snapBora = await getDocs(qBora);
        if (!snapBora.empty) {
          role = snapBora.docs[0].data().role || 'redator';
        } else {
          const qCliente = query(collection(db, 'clientes'), where('email', '==', email));
          const snapCliente = await getDocs(qCliente);
          if (!snapCliente.empty) {
            const data = snapCliente.docs[0].data();
            role = data.role || 'cliente';
            clientId = data.companyId || snapCliente.docs[0].id;
          }
        }
      }

      setUserRole(role);
      setUserClientId(clientId);

      const isMasterOrRedator = ['master', 'admin', 'redator'].includes(role);
      const isEditorDesigner = ['editor', 'designer', 'midia_social'].includes(role);
      const isClienteOrEquipe = ['cliente', 'equipe'].includes(role);

      if (isMasterOrRedator) {
        unsubscribe = onSnapshot(
          query(collection(db, 'clientes'), where('role', '==', 'cliente')),
          async (snap) => {
            const clientesData = await Promise.all(snap.docs.map(async d => {
              const cId = d.id;
              const demandasSnap = await getDocs(query(collection(db, 'demandas'), where('clientId', '==', cId)));
              const postsSnap = await getDocs(query(collection(db, 'posts'), where('clientId', '==', cId)));
              const pendentes = demandasSnap.docs.filter(dd =>
                ['rascunho', 'aguardando_cliente', 'devolvido', 'aguardando_validacao_equipe', 'aprovado_equipe', 'em_producao'].includes(dd.data().status)
              ).length + postsSnap.docs.filter(pd => {
                const tasks = pd.data().tasks || [];
                return tasks.some((t: any) => ['pendente', 'em_andamento', 'arquivo_anexado', 'aguardando_aprovacao_cliente', 'aguardando_revisao_equipe', 'em_programacao'].includes(t.status));
              }).length;
              return {
                id: cId,
                ...d.data(),
                totalDemandas: demandasSnap.docs.length + postsSnap.docs.length,
                pendentes,
                updatedAt: d.data().updatedAt
              };
            }));
            setClientes(clientesData);
            setLoading(false);
          }
        );
      } else if (isEditorDesigner) {
        unsubscribe = onSnapshot(collection(db, 'posts'), async (snap) => {
          const itens: any[] = [];
          snap.docs.forEach(d => {
            const data = d.data();
            const tasks = data.tasks || [];
            tasks.forEach((task: any) => {
              if (task.responsibleEmail?.toLowerCase() === email) {
                // Se o post está concluído, mostra como concluído para o editor também
                const statusFinal = data.status === 'concluido' ? 'concluido' : task.status;
                itens.push({
                  postId: d.id,
                  demandaId: data.planId,
                  demandaNome: data.planNome,
                  clienteId: data.clientId,
                  numero: data.number,
                  headline: data.headline,
                  tipoPost: data.type,
                  taskTipo: task.dept,
                  taskLabel: task.deptLabel,
                  taskStatus: statusFinal,
                  publishDate: data.publishDate,
                  status: statusFinal,
                });
              }
            });
          });

          const clienteIds = [...new Set(itens.map(i => i.clienteId))];
          const clienteNomes: Record<string, string> = {};
          await Promise.all(clienteIds.map(async id => {
            const s = await getDoc(doc(db, 'clientes', id));
            if (s.exists()) clienteNomes[id] = s.data().name;
          }));

          setDemandas(itens.map(i => ({ ...i, clienteNome: clienteNomes[i.clienteId] || i.clienteId })));
          setLoading(false);
        });
      } else if (isClienteOrEquipe && clientId) {
        unsubscribe = onSnapshot(
          query(collection(db, 'demandas'), where('clientId', '==', clientId)),
          async (demandasSnap) => {
            const postsSnap = await getDocs(query(collection(db, 'posts'), where('clientId', '==', clientId)));
            const todosPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            const itens: any[] = [];

            for (const d of demandasSnap.docs) {
              const data = d.data();
              const statusVisiveis = ['aguardando_cliente', 'aguardando_validacao_equipe', 'aprovado_equipe', 'em_producao'];
              if (!statusVisiveis.includes(data.status)) continue;

              const postsDoPlano = todosPosts.filter(p => p.planId === d.id);
              const totalPosts = postsDoPlano.length;
              const postsConcluidos = postsDoPlano.filter(p => p.status === 'concluido').length;

              if (totalPosts > 0 && postsConcluidos === totalPosts) continue;

              itens.push({
                tipo: 'planejamento',
                demandaId: d.id,
                demandaNome: data.name,
                postTipo: 'Planejamento',
                status: data.status,
                publishDate: data.updatedAt,
                totalPosts,
                postsConcluidos,
                aprovacaoPct: pctAprovacao(data.status),
              });

              postsDoPlano.forEach(post => {
                const postTasks = post.tasks || [];
                /* alguma tarefa com versão liberada pelo redator aguardando o cliente? */
                const idxAguardando = postTasks.findIndex((t: any) => {
                  const v = t.versoes?.length ? t.versoes[t.versoes.length - 1] : null;
                  return v?.status === 'aprovado_interno';
                });
                if (postTasks.length === 0) return;

                const taskStatus = postTasks[0].status;
                // Se o post está concluído usa concluido direto
                const statusFinal = post.status === 'concluido' ? 'concluido' : taskStatus;

                const statusClienteMap: Record<string, string> = {
                  pendente: 'em_producao',
                  em_andamento: 'em_producao',
                  em_edicao: 'em_producao',
                  arquivo_anexado: 'em_producao',
                  fazer_correcao: 'em_producao',
                  aguardando_aprovacao_cliente: 'aguardando_cliente',
                  aguardando_revisao_equipe: 'aguardando_validacao_equipe',
                  em_programacao: 'em_finalizacao',
                  programado: 'em_finalizacao',
                  concluido: 'concluido',
                };

                const progressoClienteMap: Record<string, number> = {
                  pendente: 10,
                  em_andamento: 20,
                  em_edicao: 35,
                  arquivo_anexado: 50,
                  fazer_correcao: 40,
                  aguardando_aprovacao_cliente: 60,
                  aguardando_revisao_equipe: 75,
                  em_programacao: 85,
                  programado: 95,
                  concluido: 100,
                };

                itens.push({
                  tipo: 'post',
                  postId: post.id,
                  taskIndex: idxAguardando,
                  precisaAprovar: idxAguardando >= 0,
                  demandaId: d.id,
                  demandaNome: data.name,
                  numero: post.number,
                  headline: post.headline,
                  postTipo: post.type,
                  publishDate: post.publishDate,
                  status: idxAguardando >= 0 ? 'aguardando_aprovacao_cliente' : (statusClienteMap[statusFinal] || 'em_producao'),
                  taskStatus: statusFinal,
                  progressoCliente: progressoClienteMap[statusFinal] || 10,
                });
              });
            }

            setDemandas(itens);
            setLoading(false);
          }
        );
      } else {
        setLoading(false);
      }
    };

    setup();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // ============================================================
  // CARREGAR DEMANDAS DO CLIENTE SELECIONADO (Master/Redator)
  // ============================================================
  const loadDemandasDoCliente = async (cliente: any) => {
    setClienteSelecionado(cliente);
    const itens: any[] = [];

    const demandasSnap = await getDocs(query(collection(db, 'demandas'), where('clientId', '==', cliente.id)));
    const postsSnap = await getDocs(query(collection(db, 'posts'), where('clientId', '==', cliente.id)));
    const todosPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    for (const d of demandasSnap.docs) {
      const data = d.data();
      const postsDoPlano = todosPosts.filter(p => p.planId === d.id);
      const totalPosts = postsDoPlano.length;
      const postsConcluidos = postsDoPlano.filter(p => p.status === 'concluido').length;

      if (data.status === 'concluido') continue;

      itens.push({
        id: d.id,
        name: data.name,
        type: 'Planejamento',
        status: data.status,
        updatedAt: data.updatedAt,
        isPost: false,
        isPlanejamento: true,
        aprovacaoPct: pctAprovacao(data.status),
        postsConcluidos,
        totalPosts,
      });
    }

    for (const post of todosPosts) {
      if (post.status === 'aguardando_delegacao') continue;
      const tasks = post.tasks || [];
      // Usa status do post se concluído, senão usa status da task
      const statusFinal = post.status === 'concluido' ? 'concluido' : (tasks.length > 0 ? tasks[0].status : post.status);

      itens.push({
        id: post.id,
        planId: post.planId,
        postId: post.id,
        name: `#${String(post.number).padStart(2, '0')} ${post.headline}`,
        type: post.type,
        status: statusFinal,
        updatedAt: post.updatedAt,
        isPost: true,
        isPlanejamento: false,
        demandaNome: post.planNome,
        aprovacaoPct: null,
        postsConcluidos: null,
        totalPosts: null,
      });
    }

    itens.sort((a, b) => {
      if (a.isPlanejamento && !b.isPlanejamento) return -1;
      if (!a.isPlanejamento && b.isPlanejamento) return 1;
      return 0;
    });

    setDemandasCliente(itens);
  };

  // ============================================================
  // UTILITÁRIOS
  // ============================================================
  const primeiroNome = (nomeCompleto: string) => nomeCompleto?.split(' ')[0] || nomeCompleto || '';

  const getStatusBadge = (status: string, isCliente = false) => {
    const configs: any = {
      pendente: { label: 'Pendente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      em_andamento: { label: 'Em Andamento', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      arquivo_anexado: { label: 'Arquivo Enviado', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      fazer_correcao: { label: 'Correção', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      aguardando_aprovacao_cliente: { label: 'Aguard. Cliente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      aguardando_revisao_equipe: { label: 'Aguard. Equipe', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      em_programacao: { label: isCliente ? 'Em Finalização' : 'Pronto p/ Agendar', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      programado: { label: isCliente ? 'Em Finalização' : 'Agendado ✓', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      aprovado_editor: { label: 'Aprovado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      em_finalizacao: { label: 'Em Finalização', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      concluido: { label: 'Concluído', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      rascunho: { label: 'Rascunho', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
      aguardando_cliente: { label: 'Aguard. Aprovação', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      aguardando_validacao_equipe: { label: isCliente ? 'Aguard. Equipe' : 'Aguard. Validação', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      aprovado_equipe: { label: 'Aprovado ✓', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      em_producao: { label: 'Em Produção', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      devolvido: { label: 'Devolvido', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      aguardando_delegacao: { label: 'Aguard. Delegação', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    };
    const config = configs[status] || configs.rascunho;
    return <span className={cn("px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest whitespace-nowrap", config.class)}>{config.label}</span>;
  };

  const getDeptIcon = (dept: string) => {
    const icons: any = { video: '🎬', design: '🎨', redacao: '✍️', midia_social: '📱' };
    return icons[dept] || '•';
  };

  const calcProgresso = (status: string) => {
    const map: any = {
      pendente: 10, em_andamento: 20, em_edicao: 35,
      arquivo_anexado: 50, fazer_correcao: 40,
      aguardando_aprovacao_cliente: 60, aguardando_revisao_equipe: 75,
      em_programacao: 85, programado: 95, concluido: 100,
      rascunho: 10, aguardando_cliente: 30,
      aguardando_validacao_equipe: 50, aprovado_equipe: 100,
      em_producao: 100, devolvido: 20, aguardando_delegacao: 0,
    };
    return map[status] || 0;
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  const isMasterOrRedator = ['master', 'admin', 'redator'].includes(userRole);
  const isEditorDesigner = ['editor', 'designer', 'midia_social'].includes(userRole);
  const isClienteOrEquipe = ['cliente', 'equipe'].includes(userRole);

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER */}
      <header>
        <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">
          {isMasterOrRedator ? 'Gestão de Demandas' : isEditorDesigner ? 'Minhas Tarefas' : 'Meus Conteúdos'}
        </p>
        <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">
          {clienteSelecionado ? clienteSelecionado.name : 'Minhas Demandas'}
        </h1>
        {clienteSelecionado && (
          <button
            onClick={() => setClienteSelecionado(null)}
            className="mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all flex items-center gap-1"
          >
            ← Voltar para clientes
          </button>
        )}
      </header>

      {/* TABELA 1 — MASTER/REDATOR: Lista de clientes */}
      {isMasterOrRedator && !clienteSelecionado && (
        <DataTable
          data={clientes}
          onRowClick={loadDemandasDoCliente}
          emptyMessage="Nenhum cliente encontrado."
          columns={[
            {
              header: 'Cliente',
              accessor: (c) => (
                <div className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 flex items-center justify-center text-[#ff5351] font-black text-xs">
                    {c.name?.charAt(0)}
                  </div>
                  <span className="text-white font-black uppercase text-sm">{c.name}</span>
                </div>
              )
            },
            {
              header: 'Total Demandas',
              accessor: (c) => <span className="text-white font-black">{c.totalDemandas}</span>,
              align: 'center'
            },
            {
              header: 'Pendentes',
              accessor: (c) => c.pendentes > 0 ? (
                <div className="flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-black text-xs">{c.pendentes}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-black text-xs">Em dia</span>
                </div>
              ),
              align: 'center'
            },
            {
              header: 'Última Atividade',
              accessor: (c) => (
                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  {c.updatedAt ? new Intl.DateTimeFormat('pt-BR').format(
                    c.updatedAt?.toDate ? c.updatedAt.toDate() : new Date(c.updatedAt)
                  ) : '—'}
                </div>
              )
            }
          ]}
          actions={() => <ChevronRight className="w-4 h-4 text-zinc-600" />}
        />
      )}

      {/* TABELA 2 — MASTER/REDATOR: Demandas do cliente selecionado */}
      {isMasterOrRedator && clienteSelecionado && (
        <DataTable
          data={demandasCliente}
          onRowClick={(d) => {
            if (d.isPost) {
              navigate(`/minha-demanda/${d.planId}/${d.postId}`);
            } else {
              navigate(`/planejamento/${d.id}`);
            }
          }}
          emptyMessage="Nenhuma demanda encontrada para este cliente."
          columns={[
            {
              header: 'Demanda',
              className: 'w-96',
              accessor: (d) => (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0">
                    <FileText className="w-4 h-4 text-[#ff5351]" />
                  </div>
                  <div>
                    <p className="text-white font-black uppercase text-sm line-clamp-2 leading-tight">{d.name}</p>
                    {d.isPost && <p className="text-zinc-500 text-[10px] uppercase mt-0.5">📋 {d.demandaNome}</p>}
                  </div>
                </div>
              )
            },
            {
              header: 'Tipo',
              accessor: (d) => (
                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                  {d.type || 'Planejamento'}
                </span>
              ),
              align: 'center'
            },
            { header: 'Status', accessor: (d) => getStatusBadge(d.status), align: 'center' },
            {
              header: 'Aprovação',
              accessor: (d) => {
                if (!d.isPlanejamento) return <span className="text-zinc-600 text-xs">—</span>;
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#ff5351] rounded-full" style={{ width: `${d.aprovacaoPct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-[#ff5351]">{d.aprovacaoPct}%</span>
                  </div>
                );
              },
              align: 'center'
            },
            {
              header: 'Execução',
              accessor: (d) => {
                if (!d.isPlanejamento) {
                  const pct = calcProgresso(d.status);
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-emerald-400">{pct}%</span>
                    </div>
                  );
                }
                if (d.totalPosts === 0) return <span className="text-zinc-600 text-xs">—</span>;
                const pct = Math.round((d.postsConcluidos / d.totalPosts) * 100);
                return (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-emerald-400">{d.postsConcluidos}/{d.totalPosts}</span>
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              },
              align: 'center'
            },
            {
              header: 'Ação',
              accessor: (d) => {
                if (!d.isPlanejamento) return null;
                if (!['aprovado_equipe', 'em_producao'].includes(d.status)) return null;
                return (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/planejamento/${d.id}/tarefas`); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all"
                  >
                    <Zap className="w-3 h-3" /> Delegar
                  </button>
                );
              },
              align: 'center'
            },
            {
              header: 'Data',
              accessor: (d) => (
                <span className="text-zinc-500 text-xs">
                  {d.updatedAt ? new Intl.DateTimeFormat('pt-BR').format(
                    d.updatedAt?.toDate ? d.updatedAt.toDate() : new Date(d.updatedAt)
                  ) : '—'}
                </span>
              )
            }
          ]}
        />
      )}

      {/* TABELA 3 — EDITOR/DESIGNER: Posts delegados */}
      {isEditorDesigner && (
        <DataTable
          data={demandas}
          onRowClick={(item) => navigate(`/minha-demanda/${item.demandaId}/${item.postId}`)}
          emptyMessage="Nenhuma demanda delegada para você."
          columns={[
            {
              header: 'Item',
              className: 'w-80',
              accessor: (item) => (
                <div>
                  <p className="text-white font-black uppercase text-sm line-clamp-2 leading-tight">
                    #{String(item.numero).padStart(2, '0')} {item.headline}
                  </p>
                  <p className="text-zinc-500 text-[10px] uppercase mt-1">📋 {item.demandaNome}</p>
                </div>
              )
            },
            {
              header: 'Cliente',
              accessor: (item) => (
                <span className="text-zinc-300 text-xs font-black uppercase">{primeiroNome(item.clienteNome)}</span>
              )
            },
            {
              header: 'Post',
              accessor: (item) => (
                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                  {item.tipoPost || '—'}
                </span>
              ),
              align: 'center'
            },
            {
              header: 'Departamento',
              accessor: (item) => (
                <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                  {getDeptIcon(item.taskTipo)} {item.taskLabel}
                </span>
              ),
              align: 'center'
            },
            {
              header: 'Status',
              accessor: (item) => getStatusBadge(
                item.taskStatus === 'concluido' ? 'concluido' :
                ['em_programacao', 'programado'].includes(item.taskStatus) ? 'aprovado_editor' : item.taskStatus
              ),
              align: 'center'
            },
            {
              header: 'Data',
              accessor: (item) => <span className="text-zinc-500 text-xs">{item.publishDate || '—'}</span>
            }
          ]}
        />
      )}

      {/* TABELA 4 — CLIENTE/EQUIPE */}
      {isClienteOrEquipe && (
        <DataTable
          data={demandas}
          onRowClick={(item) => {
            if (item.tipo === 'post') {
              if (item.precisaAprovar) {
                navigate(`/aprovar/${item.postId}/${item.taskIndex}`);
                return;
              }
              navigate(`/minha-demanda/${item.demandaId}/${item.postId}`);
            } else {
              navigate(`/planejamento/${item.demandaId}`);
            }
          }}
          emptyMessage="Nenhum conteúdo disponível."
          columns={[
            {
              header: 'Demanda',
              className: 'w-96',
              accessor: (item) => (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0">
                    <FileText className="w-4 h-4 text-[#ff5351]" />
                  </div>
                  <div>
                    <p className="text-white font-black uppercase text-sm line-clamp-2 leading-tight">
                      {item.tipo === 'post'
                        ? `#${String(item.numero).padStart(2, '0')} ${item.headline}`
                        : item.demandaNome}
                    </p>
                    {item.tipo === 'post' && (
                      <p className="text-zinc-500 text-[10px] uppercase mt-0.5">📋 {item.demandaNome}</p>
                    )}
                  </div>
                </div>
              )
            },
            {
              header: 'Tipo',
              accessor: (item) => (
                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                  {item.postTipo || 'Planejamento'}
                </span>
              ),
              align: 'center'
            },
            { header: 'Status', accessor: (item) => getStatusBadge(item.status, true), align: 'center' },
            {
              header: 'Aprovação',
              accessor: (item) => {
                if (item.tipo !== 'planejamento') return <span className="text-zinc-600 text-xs">—</span>;
                const pct = item.aprovacaoPct || 0;
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#ff5351] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-[#ff5351]">{pct}%</span>
                  </div>
                );
              },
              align: 'center'
            },
            {
              header: 'Execução',
              accessor: (item) => {
                if (item.tipo === 'planejamento') {
                  if (!item.totalPosts) return <span className="text-zinc-600 text-xs">—</span>;
                  return (
                    <span className="text-[10px] font-black text-emerald-400">
                      {item.postsConcluidos}/{item.totalPosts}
                    </span>
                  );
                }
                const pct = item.progressoCliente || 0;
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400">{pct}%</span>
                  </div>
                );
              },
              align: 'center'
            },
            {
              header: 'Data',
              accessor: (item) => {
                try {
                  const date = item.publishDate?.toDate ? item.publishDate.toDate() : new Date(item.publishDate);
                  return <span className="text-zinc-500 text-xs">{new Intl.DateTimeFormat('pt-BR').format(date)}</span>;
                } catch {
                  return <span className="text-zinc-600">—</span>;
                }
              }
            }
          ]}
        />
      )}
    </div>
  );
}
