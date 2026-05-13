import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Loader2,
  Search,
  ShieldAlert,
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

type ProcessingAction = 'analyze' | 'approve' | 'reject' | null;

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
  ).trim().toLowerCase()}`;
};

export default function Credits() {
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState<Record<string, string>>({});
  const [processingAction, setProcessingAction] = useState<ProcessingAction>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
      setReviewerNotes(
        Object.fromEntries(data.map((request) => [request.id, request.reviewerNote || '']))
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

  const filteredClientGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientGroups;

    return clientGroups.filter((group) =>
      [
        group.clientName,
        group.clientEmail,
        group.latestRequest.projectTitle,
        group.latestRequest.status,
        ...group.requests.map((request) => request.projectTitle),
        ...group.requests.map((request) => request.status)
      ].some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [clientGroups, search]);

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

  const isFinalStatus = (status: CreditRequestStatus) => {
    return status === 'Aprovado' || status === 'Recusado';
  };

  const openExternalApproval = (request: CreditRequest) => {
    window.open(`/api-v2/credits/review/${request.reviewToken}`, '_blank', 'noopener,noreferrer');
  };

  const getNoteValue = (requestId: string) => {
    return reviewerNotes[requestId]?.trim() || null;
  };

  const handleAnalyze = async (request: CreditRequest) => {
    if (request.status === 'Aprovado' || request.status === 'Recusado') {
      toast.error('Essa solicitação já foi finalizada');
      return;
    }

    try {
      setProcessingAction('analyze');
      setProcessingRequestId(request.id);

      await updateDoc(doc(db, 'creditRequests', request.id), {
        status: 'Em análise',
        reviewerNote: getNoteValue(request.id),
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Solicitação marcada como em análise');
      await loadRequests();
    } catch {
      toast.error('Erro ao atualizar solicitação');
    } finally {
      setProcessingAction(null);
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (request: CreditRequest) => {
    if (request.status === 'Aprovado') {
      toast.error('Essa solicitação já foi aprovada');
      return;
    }

    try {
      setProcessingAction('reject');
      setProcessingRequestId(request.id);

      await updateDoc(doc(db, 'creditRequests', request.id), {
        status: 'Recusado',
        reviewerNote: getNoteValue(request.id),
        reviewedAt: serverTimestamp(),
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Solicitação recusada com sucesso');
      await loadRequests();
    } catch {
      toast.error('Erro ao recusar solicitação');
    } finally {
      setProcessingAction(null);
      setProcessingRequestId(null);
    }
  };

  const handleApprove = async (request: CreditRequest) => {
    if (request.status === 'Aprovado') {
      toast.error('Essa solicitação já foi aprovada');
      return;
    }

    if (request.status === 'Recusado') {
      toast.error('Essa solicitação já foi recusada');
      return;
    }

    try {
      setProcessingAction('approve');
      setProcessingRequestId(request.id);

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

        if (requestData.status === 'Recusado') {
          throw new Error('Essa solicitação já foi recusada');
        }

        transaction.update(projectRef, {
          creditsTotal: increment(Number(requestData.creditsRequested || 0)),
          updatedAt: serverTimestamp()
        });

        transaction.update(requestRef, {
          status: 'Aprovado',
          reviewerNote: getNoteValue(request.id),
          reviewedAt: serverTimestamp(),
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      toast.success('Créditos aprovados e adicionados ao projeto');
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao aprovar solicitação');
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
    <div className="space-y-6 pb-16">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-2">
            Controle financeiro
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white uppercase italic">
            Solicitações de Créditos
          </h1>
          <p className="text-zinc-500 text-sm md:text-base mt-2 max-w-3xl">
            Visualize clientes com pedidos de crédito e acompanhe o histórico completo de cada um.
          </p>
        </div>

        <div className="relative w-full xl:w-[340px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, e-mail ou projeto"
            className="w-full h-11 bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-11 pr-4 text-sm text-white focus:border-[#ff5351] outline-none transition-all"
          />
        </div>
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
                {filteredClientGroups.length} cliente(s)
              </div>
            </div>
          </div>

          <div className="hidden xl:grid xl:grid-cols-[1.3fr_1fr_160px_170px_200px] gap-4 px-6 py-3 border-b border-zinc-800/60 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">
            <span>Cliente</span>
            <span>Último projeto</span>
            <span>Solicitações</span>
            <span>Atualização</span>
            <span>Status</span>
          </div>

          {filteredClientGroups.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-zinc-500 text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {filteredClientGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedClientKey(group.key)}
                  className={cn(
                    'w-full text-left px-6 py-4 transition-all',
                    group.hasPending
                      ? 'bg-[#ff5351]/[0.05] hover:bg-[#ff5351]/[0.08]'
                      : 'hover:bg-zinc-900/35'
                  )}
                >
                  <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr_160px_170px_200px] gap-4 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
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

                    <div className="flex flex-wrap gap-2">
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
        <section className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setSelectedClientKey(null)}
              className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para clientes
            </button>

            {selectedClient.hasPending && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[#ff5351]/20 bg-[#ff5351]/10 text-[#ff8f8e] text-[10px] uppercase font-black tracking-widest">
                <BellRing className="w-3.5 h-3.5" />
                Cliente com pendência
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden">
            <div className="px-6 py-6 border-b border-zinc-800/60">
              <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#ff5351] font-black mb-2">
                    Dados do cliente
                  </p>
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                    {selectedClient.clientName}
                  </h2>
                  <p className="text-zinc-500 text-sm mt-2">{selectedClient.clientEmail}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 text-[10px] uppercase font-black tracking-widest">
                    {selectedClient.totalRequests} solicitação(ões)
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/15 bg-amber-500/5 text-amber-300 text-[10px] uppercase font-black tracking-widest">
                    {selectedClient.pendingCount} aguardando
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/15 bg-cyan-500/5 text-cyan-300 text-[10px] uppercase font-black tracking-widest">
                    {selectedClient.analyzingCount} em análise
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/5 text-emerald-300 text-[10px] uppercase font-black tracking-widest">
                    {selectedClient.approvedCount} aprovadas
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/15 bg-red-500/5 text-red-300 text-[10px] uppercase font-black tracking-widest">
                    {selectedClient.rejectedCount} recusadas
                  </span>
                </div>
              </div>
            </div>

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

            <div className="p-6 space-y-4">
              {selectedClient.requests.map((request) => {
                const isProcessingThisRow = processingRequestId === request.id;

                return (
                  <div
                    key={request.id}
                    className={cn(
                      'rounded-[28px] border p-5 space-y-5',
                      request.status === 'Aguardando pagamento'
                        ? 'border-[#ff5351]/20 bg-[#ff5351]/[0.04]'
                        : 'border-zinc-800 bg-zinc-900/35'
                    )}
                  >
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-white text-lg font-black uppercase tracking-tight">
                            {request.projectTitle}
                          </h3>

                          {request.status === 'Aguardando pagamento' && (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ff5351]/20 bg-[#ff5351]/10 text-[#ff8f8e] text-[10px] uppercase font-black tracking-widest">
                              <BellRing className="w-3.5 h-3.5" />
                              Pendente
                            </span>
                          )}
                        </div>

                        <p className="text-zinc-500 text-sm">
                          {request.creditsRequested} crédito(s) • {formatCurrency(request.totalAmount)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] uppercase font-black tracking-widest',
                            getStatusClass(request.status)
                          )}
                        >
                          {getStatusIcon(request.status)}
                          {request.status}
                        </span>

                        <button
                          type="button"
                          onClick={() => openExternalApproval(request)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all text-[10px] uppercase font-black tracking-widest"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir aprovação
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Créditos
                        </p>
                        <p className="text-white font-black">{request.creditsRequested}</p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Valor
                        </p>
                        <p className="text-[#ff5351] font-black">
                          {formatCurrency(request.totalAmount)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Criado em
                        </p>
                        <p className="text-white text-sm font-bold">
                          {formatDateTime(request.createdAt)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Atualizado em
                        </p>
                        <p className="text-white text-sm font-bold">
                          {formatDateTime(request.updatedAt || request.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                            Chave Pix
                          </p>
                          <p className="text-white font-bold break-all">
                            {request.pixKey || 'Não informado'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                            Observação do cliente
                          </p>
                          <p className="text-zinc-300 whitespace-pre-wrap text-sm">
                            {request.clientNote || 'Sem observação.'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                            Observação interna
                          </p>
                          <textarea
                            value={reviewerNotes[request.id] || ''}
                            onChange={(e) =>
                              setReviewerNotes((current) => ({
                                ...current,
                                [request.id]: e.target.value
                              }))
                            }
                            rows={4}
                            className="w-full bg-transparent text-white resize-none outline-none text-sm"
                            placeholder="Escreva aqui uma observação interna sobre a solicitação."
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {request.status !== 'Aprovado' && request.status !== 'Recusado' && (
                            <button
                              type="button"
                              onClick={() => handleAnalyze(request)}
                              disabled={processingAction !== null}
                              className="h-10 px-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 font-black text-[10px] uppercase tracking-[0.16em] hover:bg-cyan-500/15 transition-all disabled:opacity-60 inline-flex items-center gap-2"
                            >
                              {isProcessingThisRow && processingAction === 'analyze' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Clock3 className="w-3.5 h-3.5" />
                              )}
                              Marcar em análise
                            </button>
                          )}

                          {!isFinalStatus(request.status) && (
                            <button
                              type="button"
                              onClick={() => handleApprove(request)}
                              disabled={processingAction !== null}
                              className="h-10 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 font-black text-[10px] uppercase tracking-[0.16em] hover:bg-emerald-500/15 transition-all disabled:opacity-60 inline-flex items-center gap-2"
                            >
                              {isProcessingThisRow && processingAction === 'approve' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Aprovar crédito
                            </button>
                          )}

                          {request.status !== 'Aprovado' && (
                            <button
                              type="button"
                              onClick={() => handleReject(request)}
                              disabled={processingAction !== null}
                              className="h-10 px-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 font-black text-[10px] uppercase tracking-[0.16em] hover:bg-red-500/15 transition-all disabled:opacity-60 inline-flex items-center gap-2"
                            >
                              {isProcessingThisRow && processingAction === 'reject' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              Recusar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-4 flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" />
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        Quando a validação ainda não vier pela API do Pix, use a aprovação
                        manual. A aprovação já adiciona os créditos no projeto automaticamente.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
