import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Loader2,
  Search,
  ShieldAlert,
  XCircle,
  BadgeDollarSign,
  CalendarClock,
  FolderKanban,
  Mail,
  User2
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

export default function Credits() {
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [reviewerNote, setReviewerNote] = useState('');
  const [processingAction, setProcessingAction] = useState<'analyze' | 'approve' | 'reject' | null>(null);
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
        .sort((a: any, b: any) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
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
    } catch (error) {
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
  }, [selectedRequestId, selectedRequest?.id]);

  const summary = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((item) => item.status === 'Aguardando pagamento').length,
      analyzing: requests.filter((item) => item.status === 'Em análise').length,
      approved: requests.filter((item) => item.status === 'Aprovado').length,
      rejected: requests.filter((item) => item.status === 'Recusado').length
    };
  }, [requests]);

  const totalApprovedValue = useMemo(() => {
    return requests
      .filter((item) => item.status === 'Aprovado')
      .reduce((acc, item) => acc + Number(item.totalAmount || 0), 0);
  }, [requests]);

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

  const getStatusDot = (status: CreditRequestStatus) => {
    switch (status) {
      case 'Aguardando pagamento':
        return 'bg-amber-400';
      case 'Em análise':
        return 'bg-cyan-400';
      case 'Aprovado':
        return 'bg-emerald-400';
      case 'Recusado':
        return 'bg-red-400';
      default:
        return 'bg-zinc-500';
    }
  };

  const handleAnalyze = async () => {
    if (!selectedRequest) return;
    if (selectedRequest.status === 'Aprovado' || selectedRequest.status === 'Recusado') {
      toast.error('Essa solicitação já foi finalizada');
      return;
    }

    try {
      setProcessingAction('analyze');

      await updateDoc(doc(db, 'creditRequests', selectedRequest.id), {
        status: 'Em análise',
        reviewerNote: reviewerNote.trim() || null,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Solicitação marcada como em análise');
      await loadRequests();
    } catch (error) {
      toast.error('Erro ao atualizar solicitação');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (selectedRequest.status === 'Aprovado') {
      toast.error('Essa solicitação já foi aprovada');
      return;
    }

    try {
      setProcessingAction('reject');

      await updateDoc(doc(db, 'creditRequests', selectedRequest.id), {
        status: 'Recusado',
        reviewerNote: reviewerNote.trim() || null,
        reviewedAt: serverTimestamp(),
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Solicitação recusada com sucesso');
      await loadRequests();
    } catch (error) {
      toast.error('Erro ao recusar solicitação');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (selectedRequest.status === 'Aprovado') {
      toast.error('Essa solicitação já foi aprovada');
      return;
    }
    if (selectedRequest.status === 'Recusado') {
      toast.error('Essa solicitação já foi recusada');
      return;
    }

    try {
      setProcessingAction('approve');

      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'creditRequests', selectedRequest.id);
        const projectRef = doc(db, 'projects', selectedRequest.projectId);

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
          reviewerNote: reviewerNote.trim() || null,
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
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
            Controle financeiro
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Solicitações de Créditos
          </h1>
          <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
            Central de análise para acompanhar, validar e concluir pedidos de créditos com mais clareza.
          </p>
        </div>

        <div className="relative w-full xl:w-[340px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, projeto ou status"
            className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-2xl pl-11 pr-4 text-white focus:border-[#ff5351] outline-none transition-all"
          />
        </div>
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="rounded-3xl border border-zinc-800 bg-[#151515] p-4 md:p-5">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Total</p>
          <p className="text-white text-2xl md:text-3xl font-black">{summary.total}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-[#151515] p-4 md:p-5">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Aguardando</p>
          <p className="text-amber-300 text-2xl md:text-3xl font-black">{summary.pending}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-[#151515] p-4 md:p-5">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Em análise</p>
          <p className="text-cyan-300 text-2xl md:text-3xl font-black">{summary.analyzing}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-[#151515] p-4 md:p-5">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Aprovadas</p>
          <p className="text-emerald-300 text-2xl md:text-3xl font-black">{summary.approved}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-[#151515] p-4 md:p-5">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Recusadas</p>
          <p className="text-red-300 text-2xl md:text-3xl font-black">{summary.rejected}</p>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-[#151515] p-4 md:p-5">
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor aprovado</p>
          <p className="text-[#ff5351] text-xl md:text-2xl font-black">{formatCurrency(totalApprovedValue)}</p>
        </div>
      </section>

      {requests.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-900/20 py-24 px-6 text-center">
          <CreditCard className="w-16 h-16 text-zinc-700 mx-auto mb-6" />
          <p className="text-zinc-300 font-black uppercase tracking-wider text-sm">Nenhuma solicitação encontrada</p>
          <p className="text-zinc-500 text-sm mt-2">Assim que os clientes pedirem créditos, eles aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
          <section className="rounded-[2rem] border border-zinc-800 bg-[#141414] overflow-hidden">
            <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">Fila de análise</p>
                <h2 className="text-white text-xl font-black uppercase">Solicitações</h2>
              </div>
              <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                {filteredRequests.length} itens
              </div>
            </div>

            <div className="max-h-[72vh] overflow-y-auto">
              {filteredRequests.length === 0 ? (
                <div className="p-6 text-zinc-500 text-sm">Nenhum resultado encontrado.</div>
              ) : (
                filteredRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
                    className={cn(
                      'w-full text-left px-5 py-4 border-b border-zinc-800/70 transition-all',
                      selectedRequest?.id === request.id
                        ? 'bg-zinc-900/90'
                        : 'hover:bg-zinc-900/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn('w-2 h-2 rounded-full', getStatusDot(request.status))} />
                          <p className="text-white font-black uppercase text-sm truncate">
                            {request.projectTitle}
                          </p>
                        </div>

                        <p className="text-zinc-400 text-sm truncate">{request.clientName}</p>
                        <p className="text-zinc-600 text-xs mt-2">{formatDateTime(request.createdAt)}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            'inline-flex px-3 py-1 rounded-full border text-[10px] uppercase font-black tracking-widest',
                            getStatusClass(request.status)
                          )}
                        >
                          {request.status}
                        </span>
                        <p className="text-[#ff5351] font-black text-sm mt-3">
                          {formatCurrency(request.totalAmount)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-800 bg-[#141414] overflow-hidden">
            {selectedRequest ? (
              <>
                <div className="px-6 py-6 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[#ff5351] font-black mb-2">
                      Solicitação selecionada
                    </p>
                    <h2 className="text-white text-3xl md:text-4xl font-black uppercase tracking-tight">
                      {selectedRequest.projectTitle}
                    </h2>
                    <p className="text-zinc-500 text-sm mt-3">
                      Pedido criado em {formatDateTime(selectedRequest.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        'inline-flex px-4 py-2 rounded-full border text-[10px] uppercase font-black tracking-widest',
                        getStatusClass(selectedRequest.status)
                      )}
                    >
                      {selectedRequest.status}
                    </span>

                    <a
                      href={`/api-v2/credits/review/${selectedRequest.reviewToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-all text-[10px] uppercase font-black tracking-widest"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir externa
                    </a>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Créditos</p>
                      <p className="text-white text-2xl font-black">{selectedRequest.creditsRequested}</p>
                    </div>

                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor total</p>
                      <p className="text-[#ff5351] text-2xl font-black">{formatCurrency(selectedRequest.totalAmount)}</p>
                    </div>

                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor unitário</p>
                      <p className="text-white text-xl font-black">
                        {selectedRequest.unitPrice ? formatCurrency(selectedRequest.unitPrice) : 'Não definido'}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Atualizado</p>
                      <p className="text-white text-sm font-black">{formatDateTime(selectedRequest.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
                    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                          Resumo do pedido
                        </p>
                        <h3 className="text-white text-lg font-black uppercase">Informações</h3>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3 flex items-start gap-3">
                          <FolderKanban className="w-4 h-4 text-[#ff5351] mt-1 shrink-0" />
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Projeto</p>
                            <p className="text-white font-bold">{selectedRequest.projectTitle}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3 flex items-start gap-3">
                          <User2 className="w-4 h-4 text-[#ff5351] mt-1 shrink-0" />
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Cliente</p>
                            <p className="text-white font-bold">{selectedRequest.clientName}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3 flex items-start gap-3">
                          <Mail className="w-4 h-4 text-[#ff5351] mt-1 shrink-0" />
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">E-mail</p>
                            <p className="text-white font-bold break-all">{selectedRequest.clientEmail}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3 flex items-start gap-3">
                          <CreditCard className="w-4 h-4 text-[#ff5351] mt-1 shrink-0" />
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Chave Pix</p>
                            <p className="text-white font-bold break-all">{selectedRequest.pixKey || 'Não informado'}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3 flex items-start gap-3">
                          <BadgeDollarSign className="w-4 h-4 text-[#ff5351] mt-1 shrink-0" />
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor informado</p>
                            <p className="text-white font-bold">{formatCurrency(selectedRequest.totalAmount)}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3 flex items-start gap-3">
                          <CalendarClock className="w-4 h-4 text-[#ff5351] mt-1 shrink-0" />
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Datas importantes</p>
                            <div className="space-y-1 text-sm text-zinc-300">
                              <p>Criado: {formatDateTime(selectedRequest.createdAt)}</p>
                              <p>Revisado: {formatDateTime(selectedRequest.reviewedAt)}</p>
                              <p>Aprovado: {formatDateTime(selectedRequest.approvedAt)}</p>
                              <p>Recusado: {formatDateTime(selectedRequest.rejectedAt)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Observação do cliente</p>
                          <p className="text-zinc-300 font-medium whitespace-pre-wrap leading-relaxed">
                            {selectedRequest.clientNote || 'Sem observação.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                          Operação
                        </p>
                        <h3 className="text-white text-lg font-black uppercase">Ações da análise</h3>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Observação interna</p>
                        <textarea
                          value={reviewerNote}
                          onChange={(e) => setReviewerNote(e.target.value)}
                          rows={8}
                          className="w-full bg-transparent text-white resize-none outline-none leading-relaxed"
                          placeholder="Escreva aqui a justificativa da análise, confirmação do banco ou qualquer observação interna."
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={handleAnalyze}
                          disabled={processingAction !== null}
                          className="h-12 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 font-black uppercase tracking-widest text-[11px] hover:bg-cyan-500/15 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {processingAction === 'analyze' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock3 className="w-4 h-4" />}
                          Em análise
                        </button>

                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={processingAction !== null}
                          className="h-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 font-black uppercase tracking-widest text-[11px] hover:bg-emerald-500/15 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {processingAction === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Aprovar
                        </button>

                        <button
                          type="button"
                          onClick={handleReject}
                          disabled={processingAction !== null}
                          className="h-12 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 font-black uppercase tracking-widest text-[11px] hover:bg-red-500/15 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {processingAction === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          Recusar
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-4">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Regra da aprovação</p>
                          <p className="text-zinc-300 text-sm leading-relaxed">
                            Ao aprovar, os créditos são adicionados automaticamente no projeto vinculado.
                          </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-4">
                          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Uso sugerido</p>
                          <p className="text-zinc-300 text-sm leading-relaxed">
                            Marque em análise quando estiver conferindo o banco, depois aprove ou recuse conforme a confirmação.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-[#141414] px-4 py-4 flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" />
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          Esta tela foi pensada para sua operação diária. Se quiser, no próximo passo eu também posso adaptar a visão do cliente para mostrar o status dessas solicitações.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
                <div>
                  <CreditCard className="w-14 h-14 text-zinc-700 mx-auto mb-5" />
                  <p className="text-zinc-400 font-medium">Selecione uma solicitação para visualizar os detalhes.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
