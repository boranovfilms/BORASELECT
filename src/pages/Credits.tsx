import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Loader2,
  Save,
  UserRound,
  Wallet,
  XCircle
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

type CreditRequestStatus =
  | 'Aguardando pagamento'
  | 'Em análise'
  | 'Aprovado'
  | 'Recusado';

type CreditRequest = {
  id: string;
  projectId: string;
  projectTitle: string;
  clientName: string;
  clientEmail: string;
  creditsRequested: number;
  unitPrice?: number | null;
  totalAmount: number;
  pixKey?: string | null;
  pixKeyType?: string | null;
  clientNote?: string | null;
  reviewerNote?: string | null;
  reviewToken: string;
  status: CreditRequestStatus;
  createdAt?: any;
  updatedAt?: any;
  reviewedAt?: any;
  approvedAt?: any;
  rejectedAt?: any;
};

type ProcessingAction = 'update' | null;

type ClientGroup = {
  key: string;
  clientName: string;
  clientEmail: string;
  requests: CreditRequest[];
  latestRequest: CreditRequest;
  pendingCount: number;
  analyzingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalRequests: number;
  hasPending: boolean;
};

const statusOptions: CreditRequestStatus[] = [
  'Aguardando pagamento',
  'Em análise',
  'Aprovado',
  'Recusado'
];

const getRequestTime = (request: CreditRequest) => {
  const updatedAt = request.updatedAt?.toDate ? request.updatedAt.toDate().getTime() : null;
  const createdAt = request.createdAt?.toDate ? request.createdAt.toDate().getTime() : null;
  return updatedAt || createdAt || 0;
};

const getClientKey = (request: CreditRequest) => {
  const email = String(request.clientEmail || '').trim().toLowerCase();
  if (email) return email;

  return `${String(request.clientName || '').trim().toLowerCase()}::${String(
    request.projectId || request.projectTitle || ''
  )
    .trim()
    .toLowerCase()}`;
};

export default function Credits() {
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, CreditRequestStatus>>({});
  const [processingAction, setProcessingAction] = useState<ProcessingAction>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'creditRequests'));

      const data = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...(item.data() as Omit<CreditRequest, 'id'>)
        }))
        .sort((a: CreditRequest, b: CreditRequest) => getRequestTime(b) - getRequestTime(a));

      setRequests(data);
      setStatusDrafts(
        Object.fromEntries(
          data.map((request) => [request.id, request.status as CreditRequestStatus])
        )
      );
    } catch {
      toast.error('Erro ao carregar solicitações de crédito');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (!openStatusMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const wrapper = document.querySelector(
        `[data-status-menu-wrapper="${openStatusMenuId}"]`
      );

      if (wrapper && !wrapper.contains(target)) {
        setOpenStatusMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openStatusMenuId]);

  const summary = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((item) => item.status === 'Aguardando pagamento').length,
      analyzing: requests.filter((item) => item.status === 'Em análise').length,
      approved: requests.filter((item) => item.status === 'Aprovado').length,
      rejected: requests.filter((item) => item.status === 'Recusado').length
    };
  }, [requests]);

  const clientGroups = useMemo(() => {
    const groups = new Map<string, CreditRequest[]>();

    requests.forEach((request) => {
      const key = getClientKey(request);
      const current = groups.get(key) || [];
      current.push(request);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .map(([key, clientRequests]) => {
        const orderedRequests = [...clientRequests].sort(
          (a, b) => getRequestTime(b) - getRequestTime(a)
        );
        const latestRequest = orderedRequests[0];

        return {
          key,
          clientName: latestRequest.clientName,
          clientEmail: latestRequest.clientEmail,
          requests: orderedRequests,
          latestRequest,
          pendingCount: orderedRequests.filter(
            (item) => item.status === 'Aguardando pagamento'
          ).length,
          analyzingCount: orderedRequests.filter((item) => item.status === 'Em análise').length,
          approvedCount: orderedRequests.filter((item) => item.status === 'Aprovado').length,
          rejectedCount: orderedRequests.filter((item) => item.status === 'Recusado').length,
          totalRequests: orderedRequests.length,
          hasPending: orderedRequests.some(
            (item) => item.status === 'Aguardando pagamento'
          )
        } satisfies ClientGroup;
      })
      .sort((a, b) => getRequestTime(b.latestRequest) - getRequestTime(a.latestRequest));
  }, [requests]);

  const selectedClient = useMemo(() => {
    return clientGroups.find((group) => group.key === selectedClientKey) || null;
  }, [clientGroups, selectedClientKey]);

  useEffect(() => {
    if (selectedClientKey && !clientGroups.some((group) => group.key === selectedClientKey)) {
      setSelectedClientKey(null);
    }
  }, [clientGroups, selectedClientKey]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
  };

  const formatDateTime = (value: any) => {
    if (!value) return 'Sem data';
    const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sem data';
    return format(parsed, 'dd/MM/yyyy HH:mm');
  };

  const getStatusClass = (status: CreditRequestStatus) => {
    switch (status) {
      case 'Aguardando pagamento':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'Em análise':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
      case 'Aprovado':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'Recusado':
        return 'bg-red-500/10 text-red-300 border-red-500/20';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getStatusButtonClass = (status: CreditRequestStatus) => {
    switch (status) {
      case 'Aguardando pagamento':
        return 'border-amber-500/20 bg-amber-500/8 text-amber-300';
      case 'Em análise':
        return 'border-cyan-500/20 bg-cyan-500/8 text-cyan-300';
      case 'Aprovado':
        return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300';
      case 'Recusado':
        return 'border-red-500/20 bg-red-500/8 text-red-300';
      default:
        return 'border-zinc-700 bg-zinc-900 text-zinc-300';
    }
  };

  const getStatusIcon = (status: CreditRequestStatus) => {
    switch (status) {
      case 'Aguardando pagamento':
        return <Wallet className="w-3.5 h-3.5" />;
      case 'Em análise':
        return <Clock3 className="w-3.5 h-3.5" />;
      case 'Aprovado':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Recusado':
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return <CreditCard className="w-3.5 h-3.5" />;
    }
  };

  const handleDraftStatusChange = (requestId: string, status: CreditRequestStatus) => {
    setStatusDrafts((current) => ({
      ...current,
      [requestId]: status
    }));
    setOpenStatusMenuId(null);
  };

  const handleStatusUpdate = async (request: CreditRequest) => {
    const nextStatus = statusDrafts[request.id] || request.status;

    if (nextStatus === request.status) {
      toast('Selecione um status diferente para atualizar');
      return;
    }

    if (request.status === 'Aprovado' && nextStatus !== 'Aprovado') {
      toast.error('Uma solicitação aprovada não pode voltar de status por segurança');
      return;
    }

    try {
      setProcessingAction('update');
      setProcessingRequestId(request.id);
      setOpenStatusMenuId(null);

      if (nextStatus === 'Aprovado') {
        await runTransaction(db, async (transaction) => {
          const requestRef = doc(db, 'creditRequests', request.id);
          const projectRef = doc(db, 'projects', request.projectId);

          const requestSnap = await transaction.get(requestRef);
          const projectSnap = await transaction.get(projectRef);

          if (!requestSnap.exists()) {
            throw new Error('Solicitação não encontrada');
          }

          if (!projectSnap.exists()) {
            throw new Error('Projeto vinculado não encontrado');
          }

          const requestData = requestSnap.data() as CreditRequest;

          if (requestData.status === 'Aprovado') {
            throw new Error('Essa solicitação já foi aprovada');
          }

          transaction.update(projectRef, {
            creditsTotal: increment(Number(requestData.creditsRequested || 0)),
            updatedAt: serverTimestamp()
          });

          transaction.update(requestRef, {
            status: 'Aprovado',
            reviewedAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
            rejectedAt: null,
            updatedAt: serverTimestamp()
          });
        });

        toast.success('Status atualizado para aprovado e créditos adicionados');
      } else {
        const payload: Record<string, any> = {
          status: nextStatus,
          updatedAt: serverTimestamp()
        };

        if (nextStatus === 'Aguardando pagamento') {
          payload.reviewedAt = null;
          payload.rejectedAt = null;
        }

        if (nextStatus === 'Em análise') {
          payload.reviewedAt = serverTimestamp();
          payload.rejectedAt = null;
        }

        if (nextStatus === 'Recusado') {
          payload.reviewedAt = serverTimestamp();
          payload.rejectedAt = serverTimestamp();
        }

        await updateDoc(doc(db, 'creditRequests', request.id), payload);
        toast.success('Status atualizado com sucesso');
      }

      await loadRequests();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar status');
    } finally {
      setProcessingAction(null);
      setProcessingRequestId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      {selectedClient && (
        <button
          type="button"
          onClick={() => setSelectedClientKey(null)}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para clientes
        </button>
      )}

      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <p
            className={cn(
              'text-[10px] uppercase tracking-[0.3em] font-black mb-2',
              selectedClient ? 'text-white' : 'text-[#ff5351]'
            )}
          >
            {selectedClient ? 'Cliente selecionado' : 'Controle financeiro'}
          </p>

          <h1
            className={cn(
              'text-3xl md:text-4xl font-black tracking-tight uppercase italic',
              selectedClient ? 'text-[#ff5351]' : 'text-white'
            )}
          >
            {selectedClient ? selectedClient.clientName : 'Solicitações de Créditos'}
          </h1>

          <p
            className={cn(
              'text-sm md:text-base mt-2',
              selectedClient ? 'text-white' : 'text-zinc-500'
            )}
          >
            {selectedClient
              ? selectedClient.clientEmail
              : 'Visualize clientes com pedidos de crédito e acompanhe o histórico de forma limpa.'}
          </p>
        </div>

        {selectedClient && (
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:min-w-[340px]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-zinc-500">
                Solicitações
              </p>
              <p className="text-3xl font-black text-white mt-2">
                {selectedClient.totalRequests}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-amber-200/70">
                Aguardando
              </p>
              <p className="text-3xl font-black text-amber-300 mt-2">
                {selectedClient.pendingCount}
              </p>
            </div>
          </div>
        )}
      </header>

      <section className="flex flex-wrap gap-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2">
          <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
            Total
          </span>
          <span className="text-sm font-black text-white">{summary.total}</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-2">
          <Wallet className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-black text-amber-200/70">
            Aguardando
          </span>
          <span className="text-sm font-black text-amber-300">{summary.pending}</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/15 bg-cyan-500/5 px-3 py-2">
          <Clock3 className="w-3.5 h-3.5 text-cyan-300" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-200/70">
            Em análise
          </span>
          <span className="text-sm font-black text-cyan-300">{summary.analyzing}</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-black text-emerald-200/70">
            Aprovadas
          </span>
          <span className="text-sm font-black text-emerald-300">{summary.approved}</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/15 bg-red-500/5 px-3 py-2">
          <XCircle className="w-3.5 h-3.5 text-red-300" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-black text-red-200/70">
            Recusadas
          </span>
          <span className="text-sm font-black text-red-300">{summary.rejected}</span>
        </div>
      </section>

      {!selectedClient ? (
        <section className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60">
            <div className="flex items-center gap-3">
              <p className="text-white text-sm font-black uppercase tracking-[0.18em] shrink-0">
                Clientes
              </p>
              <div className="h-px flex-1 bg-zinc-800/70" />
              <div className="text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500 shrink-0">
                {clientGroups.length} cliente(s)
              </div>
            </div>
          </div>

          <div className="hidden xl:grid xl:grid-cols-[1.3fr_1fr_160px_170px_200px] gap-4 px-6 py-3 border-b border-zinc-800/60 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 text-center items-center">
            <span>Cliente</span>
            <span>Último projeto</span>
            <span>Solicitações</span>
            <span>Atualização</span>
            <span>Status</span>
          </div>

          {clientGroups.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-zinc-500 text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {clientGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedClientKey(group.key)}
                  className={cn(
                    'w-full text-left px-6 py-3 transition-all',
                    group.hasPending
                      ? 'bg-[#ff5351]/[0.05] hover:bg-[#ff5351]/[0.08]'
                      : 'hover:bg-zinc-900/35'
                  )}
                >
                  <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr_160px_170px_200px] gap-4 items-center text-center">
                    <div className="min-w-0 flex items-center justify-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0',
                          group.hasPending
                            ? 'border-[#ff5351]/20 bg-[#ff5351]/10'
                            : 'border-zinc-800 bg-zinc-900/80'
                        )}
                      >
                        {group.hasPending ? (
                          <BellRing className="w-4 h-4 text-[#ff5351]" />
                        ) : (
                          <UserRound className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-white font-black text-sm truncate">
                          {group.clientName}
                        </p>
                        <p className="text-zinc-500 text-xs truncate">
                          {group.clientEmail}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-white font-black text-sm truncate">
                        {group.latestRequest.projectTitle}
                      </p>
                      <p className="text-zinc-500 text-xs mt-1">
                        Última solicitação registrada
                      </p>
                    </div>

                    <div>
                      <p className="text-white text-sm font-black">
                        {group.totalRequests} solicitação(ões)
                      </p>
                      <p className="text-zinc-500 text-[11px] mt-1">
                        {group.pendingCount} pendente(s)
                      </p>
                    </div>

                    <div>
                      <p className="text-white text-sm font-bold">
                        {formatDateTime(group.latestRequest.updatedAt || group.latestRequest.createdAt)}
                      </p>
                      <p className="text-zinc-500 text-[11px] mt-1">Última movimentação</p>
                    </div>

                    <div className="flex justify-center">
                      {group.hasPending ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ff5351]/20 bg-[#ff5351]/10 text-[#ff8f8e] text-[10px] uppercase font-black tracking-widest">
                          <BellRing className="w-3.5 h-3.5" />
                          Pendência
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 text-[10px] uppercase font-black tracking-widest">
                          Sem pendência
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-[32px] border border-zinc-800 bg-[#101010]">
          <div className="px-6 py-4 border-b border-zinc-800/60">
            <div className="flex items-center gap-3">
              <p className="text-white text-sm font-black uppercase tracking-[0.18em] shrink-0">
                Histórico de solicitações
              </p>
              <div className="h-px flex-1 bg-zinc-800/70" />
              <div className="text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500 shrink-0">
                {selectedClient.requests.length} registro(s)
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 pb-3">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <colgroup>
                <col style={{ width: '36%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '6%' }} />
              </colgroup>

              <thead>
                <tr>
                  <th className="px-2 py-3 text-left text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Nome do projeto
                  </th>
                  <th className="px-2 py-3 text-center text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Créditos
                  </th>
                  <th className="px-2 py-3 text-center text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Valor
                  </th>
                  <th className="px-2 py-3 text-center text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Criado em
                  </th>
                  <th className="px-2 py-3 text-center text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Atualizado em
                  </th>
                  <th className="px-2 py-3 text-center text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Status
                  </th>
                  <th className="px-2 py-3 text-center text-[10px] uppercase tracking-[0.18em] font-black text-zinc-500">
                    Ação
                  </th>
                </tr>
              </thead>

              <tbody>
                {selectedClient.requests.map((request) => {
                  const isProcessingThisRow = processingRequestId === request.id;
                  const nextStatus = statusDrafts[request.id] || request.status;

                  return (
                    <tr
                      key={request.id}
                      className={cn(
                        'border-t border-zinc-800/60',
                        request.status === 'Aguardando pagamento'
                          ? 'bg-[#ff5351]/[0.035]'
                          : ''
                      )}
                    >
                      <td className="px-2 py-3 align-top">
                        <p
                          className="text-white font-black text-sm leading-5 whitespace-normal break-words text-left"
                          title={request.projectTitle}
                        >
                          {request.projectTitle}
                        </p>
                      </td>

                      <td className="px-2 py-3 text-center align-middle">
                        <p className="text-white text-sm font-bold">
                          {request.creditsRequested}
                        </p>
                      </td>

                      <td className="px-2 py-3 text-center align-middle">
                        <p className="text-[#ff5351] text-sm font-bold">
                          {formatCurrency(request.totalAmount)}
                        </p>
                      </td>

                      <td className="px-2 py-3 text-center align-middle">
                        <p className="text-white text-sm font-bold">
                          {formatDateTime(request.createdAt)}
                        </p>
                      </td>

                      <td className="px-2 py-3 text-center align-middle">
                        <p className="text-white text-sm font-bold">
                          {formatDateTime(request.updatedAt || request.createdAt)}
                        </p>
                      </td>

                      <td className="px-2 py-3 text-center align-middle">
                        <div
                          className="relative flex justify-center"
                          data-status-menu-wrapper={request.id}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenStatusMenuId((current) =>
                                current === request.id ? null : request.id
                              )
                            }
                            className={cn(
                              'inline-flex h-10 min-w-[170px] items-center justify-center gap-2 rounded-xl border px-4 text-[10px] uppercase font-black tracking-[0.14em] transition-all',
                              getStatusButtonClass(nextStatus)
                            )}
                          >
                            {getStatusIcon(nextStatus)}
                            <span>{nextStatus}</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {openStatusMenuId === request.id && (
                            <div className="absolute left-1/2 top-[calc(100%+8px)] z-30 w-[200px] -translate-x-1/2 rounded-2xl border border-zinc-800 bg-[#090909] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.45)]">
                              <div className="space-y-1">
                                {statusOptions.map((status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() =>
                                      handleDraftStatusChange(request.id, status)
                                    }
                                    className={cn(
                                      'w-full rounded-xl border px-3 py-2 text-left text-[10px] uppercase font-black tracking-[0.14em] transition-all',
                                      nextStatus === status
                                        ? getStatusClass(status)
                                        : 'border-transparent text-zinc-300 hover:bg-zinc-900'
                                    )}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      {getStatusIcon(status)}
                                      {status}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate(request)}
                          disabled={processingAction !== null}
                          title="Salvar status"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#ff5351]/20 bg-[#ff5351]/10 text-[#ff9e9d] hover:bg-[#ff5351]/15 transition-all disabled:opacity-60"
                        >
                          {isProcessingThisRow && processingAction === 'update' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
