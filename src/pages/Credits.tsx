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
  XCircle,
  TrendingUp
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
import { DataTable } from '../components/ui/DataTable';

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
  totalRevenue: number; // Novo campo para o total gerado
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
  return `${String(request.clientName || '').trim().toLowerCase()}::${String(request.projectId || request.projectTitle || '').trim().toLowerCase()}`;
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
        .map((item) => ({ id: item.id, ...(item.data() as Omit<CreditRequest, 'id'>) }))
        .sort((a, b) => getRequestTime(b) - getRequestTime(a));
      setRequests(data);
      setStatusDrafts(Object.fromEntries(data.map((request) => [request.id, request.status as CreditRequestStatus])));
    } catch { toast.error('Erro ao carregar solicitações'); } finally { setLoading(false); }
  };

  useEffect(() => { loadRequests(); }, []);

  useEffect(() => {
    if (!openStatusMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const wrapper = document.querySelector(`[data-status-menu-wrapper="${openStatusMenuId}"]`);
      if (wrapper && !wrapper.contains(event.target as Node)) setOpenStatusMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openStatusMenuId]);

  const summary = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((item) => item.status === 'Aguardando pagamento').length,
    analyzing: requests.filter((item) => item.status === 'Em análise').length,
    approved: requests.filter((item) => item.status === 'Aprovado').length,
    rejected: requests.filter((item) => item.status === 'Recusado').length
  }), [requests]);

  const clientGroups = useMemo(() => {
    const groups = new Map<string, CreditRequest[]>();
    requests.forEach((request) => {
      const key = getClientKey(request);
      const current = groups.get(key) || [];
      current.push(request);
      groups.set(key, current);
    });
    return Array.from(groups.entries()).map(([key, clientRequests]) => {
      const ordered = [...clientRequests].sort((a, b) => getRequestTime(b) - getRequestTime(a));
      const latest = ordered[0];
      
      // Cálculo do faturamento total aprovado para este cliente
      const totalRevenue = ordered
        .filter(r => r.status === 'Aprovado')
        .reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

      return {
        key,
        clientName: latest.clientName,
        clientEmail: latest.clientEmail,
        requests: ordered,
        latestRequest: latest,
        pendingCount: ordered.filter(i => i.status === 'Aguardando pagamento').length,
        analyzingCount: ordered.filter(i => i.status === 'Em análise').length,
        approvedCount: ordered.filter(i => i.status === 'Aprovado').length,
        rejectedCount: ordered.filter(i => i.status === 'Recusado').length,
        totalRequests: ordered.length,
        totalRevenue,
        hasPending: ordered.some(i => i.status === 'Aguardando pagamento')
      } satisfies ClientGroup;
    }).sort((a, b) => getRequestTime(b.latestRequest) - getRequestTime(a.latestRequest));
  }, [requests]);

  const selectedClient = useMemo(() => clientGroups.find(g => g.key === selectedClientKey) || null, [clientGroups, selectedClientKey]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const formatDateTime = (value: any) => {
    if (!value) return '--';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : format(date, 'dd/MM/yyyy HH:mm');
  };

  const getStatusClass = (status: CreditRequestStatus) => {
    switch (status) {
      case 'Aguardando pagamento': return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'Em análise': return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
      case 'Aprovado': return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'Recusado': return 'bg-red-500/10 text-red-300 border-red-500/20';
      default: return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getStatusButtonClass = (status: CreditRequestStatus) => {
    switch (status) {
      case 'Aguardando pagamento': return 'border-amber-500/20 bg-amber-500/8 text-amber-300';
      case 'Em análise': return 'border-cyan-500/20 bg-cyan-500/8 text-cyan-300';
      case 'Aprovado': return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300';
      case 'Recusado': return 'border-red-500/20 bg-red-500/8 text-red-300';
      default: return 'border-zinc-700 bg-zinc-900 text-zinc-300';
    }
  };

  const getStatusIcon = (status: CreditRequestStatus) => {
    switch (status) {
      case 'Aguardando pagamento': return <Wallet className="w-3.5 h-3.5" />;
      case 'Em análise': return <Clock3 className="w-3.5 h-3.5" />;
      case 'Aprovado': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Recusado': return <XCircle className="w-3.5 h-3.5" />;
      default: return <CreditCard className="w-3.5 h-3.5" />;
    }
  };

  const handleStatusUpdate = async (request: CreditRequest) => {
    const nextStatus = statusDrafts[request.id] || request.status;
    if (nextStatus === request.status) { toast('Selecione um status diferente'); return; }
    if (request.status === 'Aprovado') { toast.error('Solicitações aprovadas são bloqueadas para alteração'); return; }

    try {
      setProcessingAction('update');
      setProcessingRequestId(request.id);
      if (nextStatus === 'Aprovado') {
        await runTransaction(db, async (t) => {
          const rRef = doc(db, 'creditRequests', request.id);
          const pRef = doc(db, 'projects', request.projectId);
          const rSnap = await t.get(rRef);
          if (!rSnap.exists() || rSnap.data().status === 'Aprovado') throw new Error('Operação inválida');
          t.update(pRef, { creditsTotal: increment(request.creditsRequested), updatedAt: serverTimestamp() });
          t.update(rRef, { status: 'Aprovado', reviewedAt: serverTimestamp(), approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        });
        toast.success('Créditos adicionados com sucesso');
      } else {
        await updateDoc(doc(db, 'creditRequests', request.id), { status: nextStatus, updatedAt: serverTimestamp() });
        toast.success('Status atualizado');
      }
      await loadRequests();
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar'); } finally { setProcessingAction(null); setProcessingRequestId(null); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  return (
    <div className="space-y-5 pb-16">
      {selectedClient && <button onClick={() => setSelectedClientKey(null)} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-bold"><ArrowLeft className="w-4 h-4" />Voltar para clientes</button>}

      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <p className={cn('text-[10px] uppercase tracking-[0.3em] font-black mb-2', selectedClient ? 'text-white' : 'text-[#ff5351]')}>{selectedClient ? 'Cliente selecionado' : 'Controle financeiro'}</p>
          <h1 className={cn('text-3xl md:text-4xl font-black tracking-tight uppercase italic', selectedClient ? 'text-[#ff5351]' : 'text-white')}>{selectedClient ? selectedClient.clientName : 'Solicitações de Créditos'}</h1>
          <p className={cn('text-sm md:text-base mt-2', selectedClient ? 'text-white' : 'text-zinc-500')}>{selectedClient ? selectedClient.clientEmail : 'Gerencie pedidos de crédito e histórico financeiro.'}</p>
        </div>
        {selectedClient && (
          <div className="grid grid-cols-2 gap-3 min-w-[340px]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"><p className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Solicitações</p><p className="text-3xl font-black text-white mt-1">{selectedClient.totalRequests}</p></div>
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4"><p className="text-[10px] uppercase tracking-widest font-black text-amber-200/70">Aguardando</p><p className="text-3xl font-black text-amber-300 mt-1">{selectedClient.pendingCount}</p></div>
          </div>
        )}
      </header>

      <section className="flex flex-wrap gap-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-2"><CreditCard className="w-3.5 h-3.5 text-zinc-500" /><span className="text-[10px] uppercase font-black text-zinc-500">Total</span><span className="text-sm font-black text-white">{summary.total}</span></div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-2"><Wallet className="w-3.5 h-3.5 text-amber-300" /><span className="text-[10px] uppercase font-black text-amber-200/70">Pendente</span><span className="text-sm font-black text-amber-300">{summary.pending}</span></div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /><span className="text-[10px] uppercase font-black text-emerald-200/70">Aprovado</span><span className="text-sm font-black text-emerald-300">{summary.approved}</span></div>
      </section>

      {!selectedClient ? (
        <div className="space-y-4">
          <h2 className="text-white font-black uppercase tracking-tight text-xl">Clientes</h2>
          <DataTable 
            data={clientGroups}
            onRowClick={(g) => setSelectedClientKey(g.key)}
            columns={[
              {
                header: 'Cliente',
                accessor: (g) => (
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center shrink-0', g.hasPending ? 'border-[#ff5351]/20 bg-[#ff5351]/10' : 'border-zinc-800 bg-zinc-900')}>
                      {g.hasPending ? <BellRing className="w-4 h-4 text-[#ff5351]" /> : <UserRound className="w-4 h-4 text-zinc-400" />}
                    </div>
                    <div>
                      <p className="text-white font-black text-sm">{g.clientName}</p>
                      <p className="text-zinc-500 text-xs">{g.clientEmail}</p>
                    </div>
                  </div>
                )
              },
              { header: 'Último Projeto', accessor: (g) => <p className="text-white font-bold text-xs">{g.latestRequest.projectTitle}</p> },
              { 
                header: 'Faturamento Total', 
                accessor: (g) => (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-emerald-400 font-black text-sm">{formatCurrency(g.totalRevenue)}</span>
                  </div>
                )
              },
              { header: 'Pedidos', align: 'center', accessor: (g) => <div className="text-center"><p className="text-white font-black text-xs">{g.totalRequests}</p><p className="text-zinc-500 text-[10px]">{g.pendingCount} pendente(s)</p></div> },
              { header: 'Atualização', accessor: (g) => <p className="text-zinc-400 text-xs">{formatDateTime(g.latestRequest.updatedAt || g.latestRequest.createdAt)}</p> },
              {
                header: 'Status',
                align: 'right',
                accessor: (g) => g.hasPending ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#ff5351]/20 bg-[#ff5351]/10 text-[#ff8f8e] text-[10px] uppercase font-black tracking-widest"><BellRing className="w-3 h-3" />Pendência</span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 text-[10px] uppercase font-black tracking-widest">OK</span>
                )
              }
            ]}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-white font-black uppercase tracking-tight text-xl">Histórico de Solicitações</h2>
          <DataTable 
            data={selectedClient.requests}
            columns={[
              { header: 'Projeto', accessor: 'projectTitle', className: 'text-white font-black text-sm' },
              { header: 'Créditos', align: 'center', accessor: (r) => <span className="text-white font-bold">{r.creditsRequested}</span> },
              { header: 'Valor', align: 'center', accessor: (r) => <span className="text-[#ff5351] font-black">{formatCurrency(r.totalAmount)}</span> },
              { header: 'Criado em', accessor: (r) => formatDateTime(r.createdAt), className: 'text-zinc-400 text-xs' },
              {
                header: 'Status',
                accessor: (r) => {
                  const nextStatus = statusDrafts[r.id] || r.status;
                  return (
                    <div className="relative" data-status-menu-wrapper={r.id}>
                      <button onClick={() => setOpenStatusMenuId(openStatusMenuId === r.id ? null : r.id)} className={cn('inline-flex h-9 min-w-[160px] items-center justify-center gap-2 rounded-xl border px-3 text-[10px] uppercase font-black tracking-widest transition-all', getStatusButtonClass(nextStatus))}>
                        {getStatusIcon(nextStatus)}<span>{nextStatus}</span><ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {openStatusMenuId === r.id && (
                        <div className="absolute left-1/2 top-[calc(100%+8px)] z-30 w-[180px] -translate-x-1/2 rounded-2xl border border-zinc-800 bg-[#090909] p-2 shadow-2xl">
                          {statusOptions.map(s => (
                            <button key={s} onClick={() => { setStatusDrafts({...statusDrafts, [r.id]: s}); setOpenStatusMenuId(null); }} className={cn('w-full rounded-xl border px-3 py-2 text-left text-[10px] uppercase font-black tracking-widest mb-1 last:mb-0 transition-all', (statusDrafts[r.id] || r.status) === s ? getStatusClass(s) : 'border-transparent text-zinc-400 hover:bg-zinc-900')}>
                              <span className="flex items-center gap-2">{getStatusIcon(s)}{s}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
              }
            ]}
            actions={(r) => (
              <button onClick={() => handleStatusUpdate(r)} disabled={processingAction !== null} className="p-2.5 rounded-xl border border-[#ff5351]/20 bg-[#ff5351]/10 text-[#ff9e9d] hover:bg-[#ff5351]/15 transition-all disabled:opacity-50">
                {processingRequestId === r.id && processingAction === 'update' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
            )}
          />
        </div>
      )}
    </div>
  );
}
