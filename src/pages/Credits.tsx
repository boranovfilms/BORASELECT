import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  History,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
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

export default function Credits() {
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [reviewerNote, setReviewerNote] = useState('');
  const [processingAction, setProcessingAction] = useState<ProcessingAction>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const historyRef = useRef<HTMLDivElement | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'creditRequests'));

      const data = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...(item.data() as Omit<CreditRequest, 'id'>)
        }))
        .sort((a: any, b: any) => {
          const dateA = a.updatedAt?.toDate
            ? a.updatedAt.toDate().getTime()
            : a.createdAt?.toDate
              ? a.createdAt.toDate().getTime()
              : 0;

          const dateB = b.updatedAt?.toDate
            ? b.updatedAt.toDate().getTime()
            : b.createdAt?.toDate
              ? b.createdAt.toDate().getTime()
              : 0;

          return dateB - dateA;
        }) as CreditRequest[];

      setRequests(data);

      if (data.length > 0) {
        setSelectedRequestId((current) =>
          current && data.some((request) => request.id === current) ? current : data[0].id
        );
      } else {
        setSelectedRequestId(null);
      }
    } catch {
      toast.error('Erro ao carregar solicitações de crédito');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;

    return requests.filter((request) =>
      [
        request.projectTitle,
        request.clientName,
        request.clientEmail,
        request.status,
        request.id
      ].some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [requests, search]);

  const selectedRequest = useMemo(() => {
    return (
      filteredRequests.find((request) => request.id === selectedRequestId) ||
      requests.find((request) => request.id === selectedRequestId) ||
      null
    );
  }, [filteredRequests, requests, selectedRequestId]);

  useEffect(() => {
    if (selectedRequest) {
      setReviewerNote(selectedRequest.reviewerNote || '');
    } else {
      setReviewerNote('');
    }
  }, [selectedRequest?.id, selectedRequest?.reviewerNote]);

  const summary = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((item) => item.status === 'Aguardando pagamento').length,
      analyzing: requests.filter((item) => item.status === 'Em análise').length,
      approved: requests.filter((item) => item.status === 'Aprovado').length,
      rejected: requests.filter((item) => item.status === 'Recusado').length
    };
  }, [requests]);

  const selectedHistory = useMemo(() => {
    if (!selectedRequest) return [];

    return requests
      .filter((request) => {
        const sameProject = request.projectId
          ? request.projectId === selectedRequest.projectId
          : request.projectTitle === selectedRequest.projectTitle;

        return sameProject && request.clientEmail === selectedRequest.clientEmail;
      })
      .sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });
  }, [requests, selectedRequest]);

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
        return <Wallet className="w-4 h-4" />;
      case 'Em análise':
        return <Clock3 className="w-4 h-4" />;
      case 'Aprovado':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'Recusado':
        return <XCircle className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const getHistoryCount = (request: CreditRequest) => {
    return requests.filter((item) => {
      const sameProject = item.projectId
        ? item.projectId === request.projectId
        : item.projectTitle === request.projectTitle;

      return sameProject && item.clientEmail === request.clientEmail;
    }).length;
  };

  const isFinalStatus = (status: CreditRequestStatus) => {
    return status === 'Aprovado' || status === 'Recusado';
  };

  const openExternalApproval = (request: CreditRequest) => {
    window.open(`/api-v2/credits/review/${request.reviewToken}`, '_blank', 'noopener,noreferrer');
  };

  const showHistory = (requestId: string) => {
    setSelectedRequestId(requestId);
    setTimeout(() => {
      historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const getNoteValue = (request: CreditRequest) => {
    if (request.id === selectedRequest?.id) {
      return reviewerNote.trim() || null;
    }

    return request.reviewerNote || null;
  };

  const handleAnalyze = async (requestOverride?: CreditRequest) => {
    const targetRequest = requestOverride || selectedRequest;
    if (!targetRequest) return;

    if (targetRequest.status === 'Aprovado' || targetRequest.status === 'Recusado') {
      toast.error('Essa solicitação já foi finalizada');
      return;
    }

    try {
      setSelectedRequestId(targetRequest.id);
      setProcessingAction('analyze');
      setProcessingRequestId(targetRequest.id);

      await updateDoc(doc(db, 'creditRequests', targetRequest.id), {
        status: 'Em análise',
        reviewerNote: getNoteValue(targetRequest),
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

  const handleReject = async (requestOverride?: CreditRequest) => {
    const targetRequest = requestOverride || selectedRequest;
    if (!targetRequest) return;

    if (targetRequest.status === 'Aprovado') {
      toast.error('Essa solicitação já foi aprovada');
      return;
    }

    try {
      setSelectedRequestId(targetRequest.id);
      setProcessingAction('reject');
      setProcessingRequestId(targetRequest.id);

      await updateDoc(doc(db, 'creditRequests', targetRequest.id), {
        status: 'Recusado',
        reviewerNote: getNoteValue(targetRequest),
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

  const handleApprove = async (requestOverride?: CreditRequest) => {
    const targetRequest = requestOverride || selectedRequest;
    if (!targetRequest) return;

    if (targetRequest.status === 'Aprovado') {
      toast.error('Essa solicitação já foi aprovada');
      return;
    }

    if (targetRequest.status === 'Recusado') {
      toast.error('Essa solicitação já foi recusada');
      return;
    }

    try {
      setSelectedRequestId(targetRequest.id);
      setProcessingAction('approve');
      setProcessingRequestId(targetRequest.id);

      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'creditRequests', targetRequest.id);
        const projectRef = doc(db, 'projects', targetRequest.projectId);

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
          reviewerNote: getNoteValue(targetRequest),
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
    <div className="space-y-8 pb-16">
      <header className="flex flex-col 2xl:flex-row 2xl:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#ff5351] font-black mb-3">
            Controle financeiro
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Solicitações de Créditos
          </h1>
          <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
            Visualize tudo em linha, aprove manualmente quando necessário e acompanhe o
            histórico de cada cliente por projeto.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full 2xl:w-auto">
          <div className="relative w-full 2xl:w-[360px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, projeto ou status"
              className="w-full h-12 bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-11 pr-4 text-white focus:border-[#ff5351] outline-none transition-all"
            />
          </div>

          <div className="h-12 px-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 flex items-center gap-3 text-zinc-300">
            <Sparkles className="w-4 h-4 text-[#ff5351]" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">
              Visual em linha
            </span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">Total</p>
            <CreditCard className="w-5 h-5 text-zinc-500" />
          </div>
          <p className="text-white text-3xl font-black">{summary.total}</p>
        </div>

        <div className="rounded-[28px] border border-amber-500/15 bg-amber-500/5 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-amber-200/70 text-[10px] uppercase tracking-widest font-black">
              Aguardando
            </p>
            <Wallet className="w-5 h-5 text-amber-300" />
          </div>
          <p className="text-amber-300 text-3xl font-black">{summary.pending}</p>
        </div>

        <div className="rounded-[28px] border border-cyan-500/15 bg-cyan-500/5 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-cyan-200/70 text-[10px] uppercase tracking-widest font-black">
              Em análise
            </p>
            <Clock3 className="w-5 h-5 text-cyan-300" />
          </div>
          <p className="text-cyan-300 text-3xl font-black">{summary.analyzing}</p>
        </div>

        <div className="rounded-[28px] border border-emerald-500/15 bg-emerald-500/5 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-emerald-200/70 text-[10px] uppercase tracking-widest font-black">
              Aprovadas
            </p>
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          </div>
          <p className="text-emerald-300 text-3xl font-black">{summary.approved}</p>
        </div>

        <div className="rounded-[28px] border border-red-500/15 bg-red-500/5 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-red-200/70 text-[10px] uppercase tracking-widest font-black">
              Recusadas
            </p>
            <XCircle className="w-5 h-5 text-red-300" />
          </div>
          <p className="text-red-300 text-3xl font-black">{summary.rejected}</p>
        </div>
      </section>

      {requests.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-zinc-800 bg-zinc-900/20 py-24 px-6 text-center">
          <CreditCard className="w-14 h-14 text-zinc-700 mx-auto mb-5" />
          <p className="text-zinc-400 font-medium">Nenhuma solicitação de crédito encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.7fr)_minmax(390px,0.95fr)] gap-6 items-start">
          <section className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-white text-xl font-black uppercase">Visualização em linha</p>
                <p className="text-zinc-500 text-sm mt-1">
                  Cliente, projeto, status, atualização, aprovação manual e histórico em uma
                  única lista.
                </p>
              </div>
              <div className="text-xs uppercase tracking-[0.25em] font-black text-zinc-500">
                {filteredRequests.length} resultado(s)
              </div>
            </div>

            <div className="hidden xl:grid xl:grid-cols-[1.1fr_1fr_190px_170px_380px] gap-4 px-6 py-4 border-b border-zinc-800/80 text-[10px] uppercase tracking-[0.25em] font-black text-zinc-500">
              <span>Cliente</span>
              <span>Projeto</span>
              <span>Status</span>
              <span>Atualização</span>
              <span>Ações</span>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="p-8 text-zinc-500 text-sm">Nenhum resultado encontrado.</div>
            ) : (
              <div className="divide-y divide-zinc-800/70">
                {filteredRequests.map((request) => {
                  const isSelected = selectedRequest?.id === request.id;
                  const historyCount = getHistoryCount(request);
                  const isProcessingThisRow = processingRequestId === request.id;

                  return (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequestId(request.id)}
                      className={cn(
                        'relative px-6 py-5 transition-all cursor-pointer',
                        isSelected
                          ? 'bg-[#ff5351]/[0.06]'
                          : 'hover:bg-zinc-900/45'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-all',
                          isSelected ? 'bg-[#ff5351]' : 'bg-transparent'
                        )}
                      />

                      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr_190px_170px_380px] gap-4 items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl border border-zinc-800 bg-zinc-900/80 flex items-center justify-center shrink-0">
                              <UserRound className="w-5 h-5 text-zinc-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-black truncate">{request.clientName}</p>
                              <p className="text-zinc-500 text-sm truncate">{request.clientEmail}</p>
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <p className="text-white font-black truncate">{request.projectTitle}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-zinc-500 text-sm">
                              {request.creditsRequested} crédito(s)
                            </span>
                            <span className="text-zinc-700">•</span>
                            <span className="text-[#ff5351] text-sm font-bold">
                              {formatCurrency(request.totalAmount)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span
                            className={cn(
                              'inline-flex items-center gap-2 px-3 py-2 rounded-full border text-[10px] uppercase font-black tracking-widest',
                              getStatusClass(request.status)
                            )}
                          >
                            {getStatusIcon(request.status)}
                            {request.status}
                          </span>
                        </div>

                        <div>
                          <p className="text-white text-sm font-bold">
                            {formatDateTime(request.updatedAt || request.createdAt)}
                          </p>
                          <p className="text-zinc-500 text-xs mt-1">Última movimentação</p>
                        </div>

                        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                          {!isFinalStatus(request.status) && (
                            <button
                              type="button"
                              onClick={() => handleApprove(request)}
                              disabled={processingAction !== null}
                              className="h-11 px-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 font-black text-[11px] uppercase tracking-widest hover:bg-emerald-500/15 transition-all disabled:opacity-60 inline-flex items-center gap-2"
                            >
                              {isProcessingThisRow && processingAction === 'approve' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Aprovar crédito
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openExternalApproval(request)}
                            className="h-11 px-4 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-300 font-black text-[11px] uppercase tracking-widest hover:text-white hover:border-zinc-600 transition-all inline-flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Aprovação
                          </button>

                          <button
                            type="button"
                            onClick={() => showHistory(request.id)}
                            className="h-11 px-4 rounded-2xl border border-[#ff5351]/20 bg-[#ff5351]/10 text-[#ff9e9d] font-black text-[11px] uppercase tracking-widest hover:bg-[#ff5351]/15 transition-all inline-flex items-center gap-2"
                          >
                            <History className="w-4 h-4" />
                            Histórico
                            <span className="px-2 py-0.5 rounded-full bg-black/30 text-white text-[10px]">
                              {historyCount}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden 2xl:sticky 2xl:top-24">
            {selectedRequest ? (
              <>
                <div className="px-6 py-6 border-b border-zinc-800">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-[#ff5351] font-black mb-2">
                        Detalhes da solicitação
                      </p>
                      <h2 className="text-white text-3xl font-black uppercase tracking-tight">
                        {selectedRequest.projectTitle}
                      </h2>
                      <p className="text-zinc-500 text-sm mt-2">
                        {selectedRequest.clientName} • {selectedRequest.clientEmail}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] uppercase font-black tracking-widest',
                          getStatusClass(selectedRequest.status)
                        )}
                      >
                        {getStatusIcon(selectedRequest.status)}
                        {selectedRequest.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => openExternalApproval(selectedRequest)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all text-[10px] uppercase font-black tracking-widest"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir aprovação
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/70 p-4">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                        Créditos
                      </p>
                      <p className="text-white text-2xl font-black">
                        {selectedRequest.creditsRequested}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/70 p-4">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                        Valor total
                      </p>
                      <p className="text-[#ff5351] text-2xl font-black">
                        {formatCurrency(selectedRequest.totalAmount)}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/70 p-4">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                        Criado em
                      </p>
                      <p className="text-white text-sm font-black">
                        {formatDateTime(selectedRequest.createdAt)}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-zinc-800 bg-zinc-900/70 p-4">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                        Atualizado em
                      </p>
                      <p className="text-white text-sm font-black">
                        {formatDateTime(selectedRequest.updatedAt || selectedRequest.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/45 p-5 space-y-4">
                    <h3 className="text-white text-lg font-black uppercase">Dados principais</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Cliente
                        </p>
                        <p className="text-white font-bold">{selectedRequest.clientName}</p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          E-mail
                        </p>
                        <p className="text-white font-bold break-all">
                          {selectedRequest.clientEmail}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Projeto
                        </p>
                        <p className="text-white font-bold">{selectedRequest.projectTitle}</p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Chave Pix
                        </p>
                        <p className="text-white font-bold break-all">
                          {selectedRequest.pixKey || 'Não informado'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3 sm:col-span-2">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                          Observação do cliente
                        </p>
                        <p className="text-zinc-300 font-medium whitespace-pre-wrap">
                          {selectedRequest.clientNote || 'Sem observação.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/45 p-5 space-y-4">
                    <h3 className="text-white text-lg font-black uppercase">Ações da aprovação</h3>

                    <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-3">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                        Observação interna
                      </p>
                      <textarea
                        value={reviewerNote}
                        onChange={(e) => setReviewerNote(e.target.value)}
                        rows={5}
                        className="w-full bg-transparent text-white resize-none outline-none"
                        placeholder="Escreva aqui uma observação interna sobre a solicitação."
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <button
                        type="button"
                        onClick={() => handleAnalyze()}
                        disabled={processingAction !== null}
                        className="h-12 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 font-black uppercase tracking-widest text-[11px] hover:bg-cyan-500/15 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {processingAction === 'analyze' && processingRequestId === selectedRequest.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Clock3 className="w-4 h-4" />
                        )}
                        Marcar em análise
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove()}
                        disabled={processingAction !== null}
                        className="h-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 font-black uppercase tracking-widest text-[11px] hover:bg-emerald-500/15 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {processingAction === 'approve' && processingRequestId === selectedRequest.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Aprovar crédito
                      </button>

                      <button
                        type="button"
                        onClick={() => handleReject()}
                        disabled={processingAction !== null}
                        className="h-12 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 font-black uppercase tracking-widest text-[11px] hover:bg-red-500/15 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {processingAction === 'reject' && processingRequestId === selectedRequest.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Recusar solicitação
                      </button>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-[#111111] px-4 py-4 flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" />
                      <p className="text-zinc-400 text-sm leading-relaxed">
                        Quando a validação ainda não vier pela API do Pix, use o botão de aprovação
                        manual. A aprovação já adiciona os créditos no projeto automaticamente.
                      </p>
                    </div>
                  </div>

                  <div
                    ref={historyRef}
                    className="rounded-[28px] border border-zinc-800 bg-zinc-900/45 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-white text-lg font-black uppercase">
                          Histórico do cliente
                        </h3>
                        <p className="text-zinc-500 text-sm mt-1">
                          Solicitações feitas mais de uma vez para este mesmo cliente e projeto.
                        </p>
                      </div>
                      <span className="px-3 py-2 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 text-[#ff9e9d] text-[10px] uppercase tracking-widest font-black">
                        {selectedHistory.length} registro(s)
                      </span>
                    </div>

                    {selectedHistory.length > 1 ? (
                      <div className="space-y-3">
                        {selectedHistory.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedRequestId(item.id)}
                            className={cn(
                              'w-full text-left rounded-2xl border px-4 py-4 transition-all',
                              item.id === selectedRequest.id
                                ? 'border-[#ff5351]/30 bg-[#ff5351]/10'
                                : 'border-zinc-800 bg-[#111111] hover:border-zinc-700'
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <p className="text-white font-black">{item.projectTitle}</p>
                                <p className="text-zinc-500 text-sm mt-1">
                                  {formatDateTime(item.createdAt)} • {formatCurrency(item.totalAmount)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-2 px-3 py-2 rounded-full border text-[10px] uppercase font-black tracking-widest',
                                    getStatusClass(item.status)
                                  )}
                                >
                                  {getStatusIcon(item.status)}
                                  {item.status}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#111111] p-6 text-center">
                        <p className="text-zinc-400 text-sm">
                          Ainda não há outra solicitação para esse mesmo cliente e projeto.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
                <div>
                  <CreditCard className="w-14 h-14 text-zinc-700 mx-auto mb-5" />
                  <p className="text-zinc-400 font-medium">
                    Selecione uma solicitação para visualizar os detalhes.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
