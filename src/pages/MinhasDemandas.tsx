import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Loader2, ChevronRight, AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { DataTable } from '../components/ui/DataTable';

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

  useEffect(() => { init(); }, []);

  const init = async () => {
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

    if (isMasterOrRedator) await loadClientes();
    else if (isEditorDesigner) await loadDemandasEditor(email);
    else if (isClienteOrEquipe && clientId) await loadDemandasCliente(clientId);

    setLoading(false);
  };

  const primeiroNome = (nomeCompleto: string) => {
    return nomeCompleto?.split(' ')[0] || nomeCompleto || '';
  };

  const loadClientes = async () => {
    const snap = await getDocs(query(collection(db, 'clientes'), where('role', '==', 'cliente')));
    const clientesData = await Promise.all(snap.docs.map(async d => {
      const clientId = d.id;

      // Busca planejamentos pendentes (coleção demandas)
      const demandasSnap = await getDocs(query(collection(db, 'demandas'), where('clientId', '==', clientId)));
      const demandasPendentes = demandasSnap.docs.filter(dd =>
        ['rascunho', 'aguardando_cliente', 'devolvido', 'aguardando_validacao_equipe', 'aprovado_equipe'].includes(dd.data().status)
      ).length;

      // Busca posts pendentes (coleção posts)
      const postsSnap = await getDocs(query(collection(db, 'posts'), where('clientId', '==', clientId)));
      const postsPendentes = postsSnap.docs.filter(pd => {
        const tasks = pd.data().tasks || [];
        return tasks.some((t: any) => ['pendente', 'em_andamento', 'arquivo_anexado'].includes(t.status));
      }).length;

      const total = demandasSnap.docs.length + postsSnap.docs.length;
      const pendentes = demandasPendentes + postsPendentes;

      return {
        id: clientId,
        ...d.data(),
        totalDemandas: total,
        pendentes
      };
    }));
    setClientes(clientesData);
  };

  const loadDemandasDoCliente = async (cliente: any) => {
    setClienteSelecionado(cliente);
    const itens: any[] = [];

    // Busca planejamentos da coleção demandas
    const demandasSnap = await getDocs(query(collection(db, 'demandas'), where('clientId', '==', cliente.id)));
    demandasSnap.docs.forEach(d => {
      const data = d.data();
      const statusOcultos = ['concluido'];
      if (!statusOcultos.includes(data.status)) {
        itens.push({
          id: d.id,
          name: data.name,
          type: 'Planejamento',
          status: data.status,
          updatedAt: data.updatedAt,
          isPost: false,
          isPlanejamento: true,
        });
      }
    });

    // Busca posts da coleção posts
    const postsSnap = await getDocs(query(collection(db, 'posts'), where('clientId', '==', cliente.id)));
    postsSnap.docs.forEach(d => {
      const data = d.data();
      const tasks = data.tasks || [];
      const taskStatus = tasks.length > 0 ? tasks[0].status : data.status;
      itens.push({
        id: d.id,
        planId: data.planId,
        postId: d.id,
        name: `#${String(data.number).padStart(2, '0')} ${data.headline}`,
        type: data.type,
        status: taskStatus || data.status,
        updatedAt: data.updatedAt,
        isPost: true,
        isPlanejamento: false,
        demandaNome: data.planNome,
      });
    });

    // Ordena por data
    itens.sort((a, b) => {
      const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
      const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    setDemandasCliente(itens);
  };

  const loadDemandasEditor = async (email: string) => {
    // Busca posts delegados para o editor na coleção posts
    const snap = await getDocs(collection(db, 'posts'));
    const itens: any[] = [];

    snap.docs.forEach(d => {
      const data = d.data();
      const tasks = data.tasks || [];
      tasks.forEach((task: any) => {
        if (task.responsibleEmail?.toLowerCase() === email) {
          itens.push({
            postId: d.id,
            demandaId: data.planId,
            demandaNome: data.planNome,
            clienteId: data.clientId,
            numero: data.number,
            headline: data.headline,
            tipo: data.type,
            taskTipo: task.dept,
            taskLabel: task.deptLabel,
            taskStatus: task.status,
            publishDate: data.publishDate,
            status: task.status,
            taskId: task.id,
          });
        }
      });
    });

    // Busca nomes dos clientes
    const clienteIds = [...new Set(itens.map(i => i.clienteId))];
    const clienteNomes: Record<string, string> = {};
    await Promise.all(clienteIds.map(async id => {
      const snap = await getDoc(doc(db, 'clientes', id));
      if (snap.exists()) clienteNomes[id] = snap.data().name;
    }));

    setDemandas(itens.map(i => ({ ...i, clienteNome: clienteNomes[i.clienteId] || i.clienteId })));
  };

  const loadDemandasCliente = async (clientId: string) => {
    const itens: any[] = [];

    // Busca planejamentos pendentes (ainda não processados)
    const demandasSnap = await getDocs(query(collection(db, 'demandas'), where('clientId', '==', clientId)));
    demandasSnap.docs.forEach(d => {
      const data = d.data();
      const statusAprovado = ['aprovado_equipe', 'em_producao', 'concluido'];
      if (!statusAprovado.includes(data.status)) {
        itens.push({
          tipo: 'planejamento',
          demandaId: d.id,
          demandaNome: data.name,
          postTipo: 'Planejamento',
          status: data.status,
          publishDate: data.updatedAt,
        });
      }
    });

    // Busca posts da coleção posts
    const postsSnap = await getDocs(query(collection(db, 'posts'), where('clientId', '==', clientId)));
    postsSnap.docs.forEach(d => {
      const data = d.data();
      itens.push({
        tipo: 'post',
        postId: d.id,
        demandaId: data.planId,
        demandaNome: data.planNome,
        numero: data.number,
        headline: data.headline,
        postTipo: data.type,
        publishDate: data.publishDate,
        status: data.status,
      });
    });

    setDemandas(itens);
  };

  const getStatusBadge = (status: string, isCliente = false) => {
    const configs: any = {
      pendente: { label: 'Pendente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      em_andamento: { label: 'Em Andamento', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      concluido: { label: 'Concluído', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      fazer_correcao: { label: 'Correção', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      aprovado: { label: 'Aprovado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      aprovado_equipe: { label: 'Aprovado ✓', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      reprovado: { label: 'Reprovado', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      em_revisao: {
        label: isCliente ? 'Em Produção' : 'Em Revisão',
        class: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      },
      arquivo_anexado: { label: 'Arquivo Enviado', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      aguardando_cliente: { label: 'Aguard. Aprovação', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      aguardando_validacao_equipe: { label: 'Aguard. Validação', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      aguardando_delegacao: { label: 'Aguard. Delegação', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      rascunho: { label: 'Rascunho', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
      devolvido: { label: 'Devolvido', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
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
      rascunho: 10, aguardando_cliente: 30,
      aguardando_validacao_equipe: 50, aprovado_equipe: 100,
      em_producao: 100, concluido: 100, devolvido: 20,
      pendente: 10, em_andamento: 40,
      arquivo_anexado: 60, fazer_correcao: 50,
      aguardando_delegacao: 15,
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

      {/* MASTER / REDATOR — Lista de clientes */}
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

      {/* MASTER / REDATOR — Demandas do cliente selecionado */}
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
                    {d.isPost && (
                      <p className="text-zinc-500 text-[10px] uppercase mt-0.5">📋 {d.demandaNome}</p>
                    )}
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
              header: 'Progresso',
              accessor: (d) => {
                const pct = calcProgresso(d.status);
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#ff5351] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-[#ff5351]">{pct}%</span>
                  </div>
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

      {/* EDITOR / DESIGNER — Posts delegados */}
      {isEditorDesigner && (
        <DataTable
          data={demandas}
          onRowClick={(item) => navigate(`/minha-demanda/${item.demandaId}/${item.postId}`)}
          emptyMessage="Nenhuma demanda delegada para você."
          columns={[
            {
              header: 'Item',
              className: 'w-96',
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
                <span className="text-zinc-300 text-xs font-black uppercase">
                  {primeiroNome(item.clienteNome)}
                </span>
              )
            },
            {
              header: 'Tipo',
              accessor: (item) => (
                <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                  {getDeptIcon(item.taskTipo)} {item.taskLabel}
                </span>
              ),
              align: 'center'
            },
            {
              header: 'Status',
              accessor: (item) => getStatusBadge(item.taskStatus),
              align: 'center'
            },
            {
              header: 'Data',
              accessor: (item) => (
                <span className="text-zinc-500 text-xs">{item.publishDate || '—'}</span>
              )
            }
          ]}
        />
      )}

      {/* CLIENTE / EQUIPE */}
      {isClienteOrEquipe && (
        <DataTable
          data={demandas}
          onRowClick={(item) => {
            if (item.tipo === 'post') {
              navigate(`/minha-demanda/${item.demandaId}/${item.postId}`);
            } else {
              navigate(`/planejamento/${item.demandaId}`);
            }
          }}
          emptyMessage="Nenhum conteúdo disponível."
          columns={[
            {
              header: 'Item',
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
                        : item.demandaNome
                      }
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
                  {item.postTipo || 'Planejamento'
                }</span>
              ),
              align: 'center'
            },
            {
              header: 'Status',
              accessor: (item) => getStatusBadge(item.status, true),
              align: 'center'
            },
            {
              header: 'Data',
              accessor: (item) => {
                try {
                  const date = item.publishDate?.toDate
                    ? item.publishDate.toDate()
                    : new Date(item.publishDate);
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
