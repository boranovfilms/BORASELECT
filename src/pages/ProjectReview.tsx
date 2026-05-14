export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import {
  ChevronLeft,
  Play,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { projectService, Project } from '../services/projectService';
import { mediaService, MediaItem } from '../services/mediaService';
import { projetoFluxoService } from '../services/projetoFluxoService';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { useProjectStore } from '../store/useProjectStore';

type PageMode = 'review' | 'credits';

export default function ProjectReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setProjectInfo } = useProjectStore();

  const [pageMode, setPageMode] = useState<PageMode>('review');
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<'NOT_FOUND' | 'DENIED' | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isVideoError, setIsVideoError] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);

  const [pixKey, setPixKey] = useState('boranovfilms@gmail.com');
  const [pixKeyType, setPixKeyType] = useState('email');
  const [creditUnitPrice, setCreditUnitPrice] = useState(0);
  const [loadingCreditConfig, setLoadingCreditConfig] = useState(false);
  const [creditsToBuy, setCreditsToBuy] = useState(5);
  const [creditClientNote, setCreditClientNote] = useState('');
  const [submittingCreditRequest, setSubmittingCreditRequest] = useState(false);

  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveCreditUnitPrice = Number(project?.extraPrice || creditUnitPrice || 0);
  const creditRequestTotal = Number((creditsToBuy * effectiveCreditUnitPrice).toFixed(2));

  useEffect(() => {
    if (id) loadData();

    return () => {
      setProjectInfo(null, null);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (project) {
      loadCreditConfig();
    }
  }, [project?.id, project?.extraPrice]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const loadData = async () => {
    setLoading(true);
    setErrorStatus(null);
    setPageMode('review');

    try {
      const projectData = await projectService.getProject(id!);

      if (!projectData) {
        setErrorStatus('NOT_FOUND');
        setLoading(false);
        return;
      }

      const mediaData = await mediaService.getMedia(id!);
      const wfData = await projetoFluxoService.getProjectWorkflow(id!);

      setProject(projectData);
      setMedia(mediaData);
      setProjectInfo(projectData.clientName || projectData.title, projectData.clientEmail || 'Projeto de Seleção');

      // REGRA 2: Cliente entrou pela primeira vez, atualiza para "Em Andamento"
      if (wfData && wfData.stages) {
        let updated = false;
        const selecaoIndex = wfData.stages.findIndex((s: any) => s.name.toUpperCase().includes('SELEÇÃO'));
        
        if (selecaoIndex >= 0 && wfData.stages[selecaoIndex].status === 'pending') {
          wfData.stages[selecaoIndex].status = 'in_progress';
          wfData.stages[selecaoIndex].startedAt = new Date().toISOString();
          wfData.currentStageIndex = selecaoIndex;
          updated = true;
        }

        if (updated) {
          await projetoFluxoService.updateWorkflow(id!, { 
            stages: wfData.stages, 
            currentStageIndex: wfData.currentStageIndex 
          });
        }
        setWorkflow(wfData);
      }

    } catch (error) {
      setErrorStatus('DENIED');
      toast.error('Erro ao acessar o projeto');
    } finally {
      setLoading(false);
    }
  };

  // REGRA 3: Marca a etapa de Seleção como "Aguardando Cliente" ao interagir
  const markAsWaitingApproval = async () => {
    if (!workflow) return;
    const selecaoIndex = workflow.stages.findIndex((s: any) => s.name.toUpperCase().includes('SELEÇÃO'));
    if (selecaoIndex >= 0 && workflow.stages[selecaoIndex].status === 'in_progress') {
      const newStages = [...workflow.stages];
      newStages[selecaoIndex].status = 'waiting_approval';
      newStages[selecaoIndex].waitingApprovalAt = new Date().toISOString();
      
      await projetoFluxoService.updateWorkflow(id!, { stages: newStages });
      setWorkflow({ ...workflow, stages: newStages });
    }
  };

  // REGRA 4: Ao clicar em Enviar Seleção, conclui a etapa atual e inicia o Download
  const handleEnviarSelecao = async () => {
    if (workflow) {
      const newStages = [...workflow.stages];
      const selecaoIndex = newStages.findIndex((s: any) => s.name.toUpperCase().includes('SELEÇÃO'));
      const downloadIndex = newStages.findIndex((s: any) => s.name.toUpperCase().includes('DOWNLOAD'));
      
      let changed = false;
      let newCurrentIndex = workflow.currentStageIndex;

      if (selecaoIndex >= 0 && newStages[selecaoIndex].status !== 'completed') {
         newStages[selecaoIndex].status = 'completed';
         newStages[selecaoIndex].completedAt = new Date().toISOString();
         changed = true;
      }

      if (downloadIndex >= 0 && newStages[downloadIndex].status === 'pending') {
         newStages[downloadIndex].pendingAt = new Date().toISOString();
         newCurrentIndex = downloadIndex;
         changed = true;
      }

      if (changed) {
         await projetoFluxoService.updateWorkflow(id!, { stages: newStages, currentStageIndex: newCurrentIndex });
      }
    }
    navigate(`/download/${id}`);
  };

  const loadCreditConfig = async () => {
    if (!project) return;
    setLoadingCreditConfig(true);
    try {
      const response = await fetch('/api-v2/credits/config');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar configuração de créditos');
      }

      if (data.pixKey) setPixKey(data.pixKey);
      if (data.pixKeyType) setPixKeyType(data.pixKeyType);

      if (project.extraPrice && Number(project.extraPrice) > 0) {
        setCreditUnitPrice(Number(project.extraPrice));
      } else if (data.unitPrice && Number(data.unitPrice) > 0) {
        setCreditUnitPrice(Number(data.unitPrice));
      }
    } catch (error) {
      if (project.extraPrice && Number(project.extraPrice) > 0) {
        setCreditUnitPrice(Number(project.extraPrice));
      }
    } finally {
      setLoadingCreditConfig(false);
    }
  };

  const resetCreditForm = () => {
    setCreditsToBuy(5);
    setCreditClientNote('');
    setSubmittingCreditRequest(false);
  };

  const openAddCreditsScreen = async () => {
    setShowCreditModal(false);
    setPageMode('credits');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!pixKey || effectiveCreditUnitPrice <= 0) {
      await loadCreditConfig();
    }
  };

  const closeAddCreditsScreen = () => {
    resetCreditForm();
    setPageMode('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVideoError = async (error?: any) => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);

    console.error('Erro ao carregar vídeo:', error || 'Timeout');
    if (selectedPreview) {
      console.error('URL que falhou:', getVideoUrl(selectedPreview));
    }
    setIsVideoError(true);
    setIsVideoLoading(false);
  };

  const startLoadingTimeout = () => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      if (isVideoLoading) {
        handleVideoError();
      }
    }, 12000);
  };

  const getThumbnailUrl = (item: MediaItem) => {
    if (!item.url) return item.thumbnailUrl || '';
    if (item.externalId && item.url.includes('cloudflarestream.com')) {
      return `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${item.externalId}/thumbnails/thumbnail.jpg`;
    }
    if (isGoogleDriveUrl(item.url)) {
      const match = item.url.match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]+)/);
      const fileId = match ? match[1] : item.url;
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    let finalUrl = item.url;
    try {
      const urlObj = new URL(item.url);
      let path = urlObj.pathname;
      let hash = urlObj.hash;

      if (!hash || !hash.startsWith('#t=')) hash = '#t=0.1';

      const encodedPath = path.split('/').map(segment => {
        if (!segment) return '';
        if (segment.includes('%')) return segment;
        return encodeURIComponent(segment)
          .replace(/!/g, '%21')
          .replace(/'/g, '%27')
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29')
          .replace(/\*/g, '%2a');
      }).join('/');
      finalUrl = `${urlObj.origin}${encodedPath}${urlObj.search}${hash}`;
    } catch (error) {
      finalUrl = item.url.replace(/#/g, '%23') + '#t=0.1';
    }
    return finalUrl;
  };

  const getDriveEmbedUrl = (inputUrl: string) => {
    const match = inputUrl.match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return '';
  };

  const isGoogleDriveUrl = (inputUrl: string) => {
    return inputUrl.includes('drive.google.com') || (inputUrl.length > 20 && !inputUrl.includes('/') && !inputUrl.includes('.'));
  };

  const getVideoUrl = (item: MediaItem | null) => {
    if (!item) return '';
    return item.url || '';
  };

  const handleCopyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      toast.success('Chave Pix copiada');
    } catch (error) {
      toast.error('Não foi possível copiar a chave Pix');
    }
  };

  const handleSubmitCreditRequest = async () => {
    if (!id || !project) return;
    if (!effectiveCreditUnitPrice || effectiveCreditUnitPrice <= 0) {
      toast.error('Valor por crédito não configurado');
      return;
    }
    if (!creditsToBuy || creditsToBuy <= 0) {
      toast.error('Informe quantos créditos deseja comprar');
      return;
    }

    try {
      setSubmittingCreditRequest(true);
      const response = await fetch('/api-v2/credits/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          projectTitle: project.title,
          clientName: project.clientName || project.title,
          clientEmail: project.clientEmail || auth.currentUser?.email || '',
          creditsRequested: creditsToBuy,
          unitPrice: effectiveCreditUnitPrice,
          totalAmount: creditRequestTotal,
          clientNote: creditClientNote.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar solicitação');
      }
      toast.success('Solicitação enviada para análise');
      closeAddCreditsScreen();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar solicitação');
    } finally {
      setSubmittingCreditRequest(false);
    }
  };

  const handleToggleSelect = async (item: MediaItem) => {
    if (!id || !project) return;
    if (!item.id || isTogglingId) return;

    if (item.isDownloaded) {
      toast('Este item já foi baixado e não pode ser alterado.', { icon: '🔒' });
      return;
    }

    if (!item.isSelected && (project.creditsTotal - project.creditsUsed) <= 0) {
      setShowCreditModal(true);
      return;
    }

    try {
      setIsTogglingId(item.id);

      const newStatus = !item.isSelected;
      await mediaService.updateMedia(id, item.id, { isSelected: newStatus });
      setMedia(prev => prev.map(m => (m.id === item.id ? { ...m, isSelected: newStatus } : m)));

      const updatedCreditsUsed = newStatus ? project.creditsUsed + 1 : Math.max(0, project.creditsUsed - 1);
      await projectService.updateProject(id, { creditsUsed: updatedCreditsUsed });
      setProject(prev => {
        if (!prev) return null;
        return { ...prev, creditsUsed: updatedCreditsUsed };
      });

      if (newStatus) toast.success('Item selecionado!');
      else toast.success('Seleção removida');

      // REGRA 3: Atualiza status do fluxo
      markAsWaitingApproval();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Erro ao atualizar seleção');
    } finally {
      setIsTogglingId(current => (current === item.id ? null : current));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  if (errorStatus === 'NOT_FOUND') {
    return (
      <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-4 uppercase italic">Projeto não encontrado</h1>
        <p className="text-zinc-500 max-w-md">Este projeto não existe ou foi removido definitivamente.</p>
        <button onClick={() => navigate('/')} className="mt-8 text-[#ff5351] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all">Voltar ao Portal</button>
      </div>
    );
  }

  if (errorStatus === 'DENIED') {
    return (
      <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-20 h-20 bg-[#ff5351]/10 rounded-full flex items-center justify-center mb-8">
          <Lock className="w-10 h-10 text-[#ff5351]" />
        </div>
        <h1 className="text-3xl font-bold mb-4 uppercase italic">Acesso Restrito</h1>
        <p className="text-zinc-500 max-w-sm">Você não tem permissão para acessar esta vitrine. Certifique-se de estar logado com o e-mail convidado.</p>
        <div className="flex flex-col gap-4 mt-8">
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Logado como: {auth.currentUser?.email}</p>
          <button onClick={() => navigate('/')} className="text-[#ff5351] font-black uppercase tracking-[0.2em] border border-[#ff5351]/20 px-8 py-4 rounded-xl hover:bg-[#ff5351]/5 transition-all">Trocar Conta / Voltar</button>
        </div>
      </div>
    );
  }

  if (pageMode === 'credits') {
    return (
      <div className="space-y-6 pb-16">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <button
              onClick={closeAddCreditsScreen}
              className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar para seleção
            </button>

            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
              Compra manual
            </p>

            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase italic">
              Adicionar Créditos
            </h1>

            <p className="text-[#ff5351] text-xl md:text-2xl font-black uppercase tracking-tight leading-tight max-w-3xl mt-3">
              {project?.title}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="rounded-2xl border border-zinc-800 bg-[#151515] px-4 py-4 min-w-[130px]">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Disponíveis</p>
              <p className="text-white text-2xl font-black">{project ? project.creditsTotal - project.creditsUsed : 0}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-[#151515] px-4 py-4 min-w-[130px]">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor unitário</p>
              <p className="text-white text-lg font-black">
                {loadingCreditConfig ? '...' : effectiveCreditUnitPrice > 0 ? formatCurrency(effectiveCreditUnitPrice) : 'Não definido'}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-[#151515] px-4 py-4 min-w-[130px]">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Total</p>
              <p className="text-[#ff5351] text-2xl font-black">{formatCurrency(creditRequestTotal)}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
          <section className="space-y-5">
            <div className="rounded-3xl border border-zinc-800 bg-[#141414] p-5 md:p-6 space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                    Quantidade
                  </p>
                  <h2 className="text-white text-xl md:text-2xl font-black uppercase">
                    Créditos desejados
                  </h2>
                </div>

                <p className="text-[#ff5351] text-3xl font-black">{formatCurrency(creditRequestTotal)}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreditsToBuy(prev => Math.max(1, prev - 1))}
                  className="w-11 h-11 rounded-2xl border border-zinc-800 bg-zinc-900 text-white font-black text-xl hover:border-zinc-700 transition-all shrink-0"
                >
                  -
                </button>

                <input
                  type="number"
                  min={1}
                  value={creditsToBuy}
                  onChange={(e) => setCreditsToBuy(Math.max(1, Number(e.target.value) || 1))}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-white text-center text-2xl font-black focus:border-[#ff5351] outline-none transition-all"
                />

                <button
                  type="button"
                  onClick={() => setCreditsToBuy(prev => prev + 1)}
                  className="w-11 h-11 rounded-2xl border border-zinc-800 bg-zinc-900 text-white font-black text-xl hover:border-zinc-700 transition-all shrink-0"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[5, 10, 20].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCreditsToBuy(amount)}
                    className={cn(
                      'h-11 rounded-2xl border text-xs md:text-sm font-black uppercase tracking-wide transition-all',
                      creditsToBuy === amount
                        ? 'bg-[#ff5351] border-[#ff5351] text-white'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    )}
                  >
                    {amount} créditos
                  </button>
                ))}
              </div>

              {effectiveCreditUnitPrice <= 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-300 text-sm">
                  O valor por crédito ainda não foi configurado neste projeto.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-[#141414] p-5 md:p-6 space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                    Pagamento
                  </p>
                  <h2 className="text-white text-xl md:text-2xl font-black uppercase">
                    Pix para pagamento
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPixKey}
                  className="h-10 px-4 rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-200 font-black uppercase tracking-widest text-[11px] hover:border-zinc-700 transition-all flex items-center gap-2 shrink-0"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </button>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                  Chave Pix {pixKeyType ? `(${pixKeyType})` : ''}
                </p>
                <p className="text-white text-lg md:text-2xl font-black break-all">
                  {pixKey}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300 leading-relaxed">
                Faça o pagamento de <span className="text-white font-black">{formatCurrency(creditRequestTotal)}</span> usando a chave Pix acima.
                Depois, clique em enviar para análise para que eu confira o pagamento no banco e libere os créditos.
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-3xl border border-zinc-800 bg-[#141414] p-5 md:p-6 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                  Confirmação
                </p>
                <h2 className="text-white text-xl md:text-2xl font-black uppercase">
                  Enviar solicitação
                </h2>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300 leading-relaxed">
                Ao enviar, vou receber um aviso com:
                <span className="text-white font-black"> projeto</span>,
                <span className="text-white font-black"> quantidade de créditos</span> e
                <span className="text-white font-black"> valor total</span>.
                Depois disso, farei a conferência manual no banco e aprovarei ou recusarei a compra.
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                  Observação
                </label>
                <textarea
                  value={creditClientNote}
                  onChange={(e) => setCreditClientNote(e.target.value)}
                  rows={7}
                  placeholder="Se quiser, escreva uma observação sobre o pagamento."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-[#141414] p-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={closeAddCreditsScreen}
                className="flex-1 h-11 rounded-2xl border border-zinc-800 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-900 transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmitCreditRequest}
                disabled={submittingCreditRequest || effectiveCreditUnitPrice <= 0}
                className="flex-[1.3] h-11 rounded-2xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submittingCreditRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando
                  </>
                ) : (
                  'Enviar para análise'
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700 pb-20 relative">
      {showCreditModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-6 sm:p-0">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowCreditModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-[0_0_100px_rgba(255,83,81,0.2)] animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-[#ff5351]/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-[#ff5351]/5 rounded-full animate-ping" />
              <CreditCard className="w-8 h-8 text-[#ff5351]" />
            </div>

            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">
              Limite Atingido
            </h3>

            <p className="text-zinc-400 text-sm font-bold leading-relaxed mb-8">
              Você atingiu o seu limite de seleções. Para continuar escolhendo novos materiais, adicione mais créditos.
            </p>

            <div className="space-y-3">
              <button
                onClick={openAddCreditsScreen}
                className="w-full bg-[#ff5351] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[#ff5351]/30"
              >
                Adicionar créditos
              </button>

              <button
                onClick={() => setShowCreditModal(false)}
                className="w-full border border-zinc-800 text-zinc-300 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-900 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto w-full px-3 sm:px-6">
        <div className="sticky top-16 z-[150] bg-[#131313] py-3 md:py-6 -mt-8 -mx-3 px-3 sm:-mx-6 sm:px-6 mb-2 md:mb-4 border-b-2 border-[#ff5351] shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1 text-zinc-500 text-[10px] font-black uppercase tracking-widest"
              >
                <ChevronLeft className="w-3 h-3" />
                Voltar
              </button>

              <p className="text-[#ff5351] font-bold text-[10px] uppercase tracking-widest">
                {project?.category || (project as any)?.type || 'PODCAST'}
              </p>
            </div>

            <p className="text-white font-black text-lg italic uppercase tracking-tight leading-none truncate">
              {project?.title}
            </p>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-zinc-800/50 rounded-xl px-3 py-2">
                <span className="text-base font-black text-white italic">{media.length}</span>
                <span className="text-[8px] font-black uppercase text-[#ff5351] tracking-wider">vídeos</span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-zinc-800/50 rounded-xl px-3 py-2">
                <span className="text-base font-black text-white italic">
                  {project ? project.creditsTotal - project.creditsUsed : 0}
                </span>
                <span className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">
                  /{project?.creditsTotal}
                </span>
              </div>

              <button
                onClick={openAddCreditsScreen}
                className="rounded-xl px-3 py-2 font-black uppercase text-[8px] tracking-wider transition-all border bg-[#1a1a1a] border-zinc-800/50 text-zinc-400 active:scale-95"
              >
                +CRÉDITOS
              </button>

              <button
                onClick={handleEnviarSelecao}
                className="flex-1 bg-[#ff5351] text-white rounded-xl px-3 py-2 font-black uppercase tracking-wider text-[8px] active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3 h-3" />
                ENVIAR
              </button>
            </div>
          </div>

          <div className="hidden md:flex flex-row items-end justify-between gap-4">
            <div className="space-y-6">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest group"
              >
                <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                VOLTAR AO PAINEL
              </button>

              <div className="space-y-1 border-l-[3px] border-[#ff5351] pl-5 py-0.5">
                <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
                  PROJETO DE SELEÇÃO
                </h1>
                <p className="text-[#ff5351] font-bold text-[11px] uppercase tracking-widest italic opacity-90">
                  {project?.category || (project as any)?.type || 'PODCAST'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-start gap-3">
                <div className="space-y-1.5">
                  <div className="w-[110px] h-[64px] bg-[#1a1a1a] border border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center gap-0 shadow-lg">
                    <span className="text-xl font-black text-white italic tracking-tighter">{media.length}</span>
                    <span className="text-[7px] font-black uppercase tracking-widest text-[#ff5351] mt-0.5">VÍDEOS</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-[9px] font-black text-[#ff5351] uppercase tracking-[0.22em] italic opacity-80 text-left ml-1">
                    SELEÇÕES
                  </h2>
                  <div className="w-[110px] h-[64px] bg-[#1a1a1a] border border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center gap-0 group hover:border-zinc-700 transition-all shadow-lg">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xl font-black text-white">
                        {project ? project.creditsTotal - project.creditsUsed : 0}
                      </span>
                      <span className="text-sm font-bold text-zinc-600">/ {project?.creditsTotal}</span>
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mt-0.5">
                      Disponíveis
                    </span>
                  </div>
                </div>

                <div className="pb-0">
                  <button
                    onClick={openAddCreditsScreen}
                    className="h-[64px] px-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[8px] transition-all shadow-xl flex items-center justify-center text-center leading-tight bg-[#1a1a1a] border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white active:scale-95"
                  >
                    ADICIONAR<br />CREDITOS
                  </button>
                </div>

                <div className="pb-0">
                  <button
                    onClick={handleEnviarSelecao}
                    className="h-[64px] px-10 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,83,81,0.2)] flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    ENVIAR SELEÇÃO
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-4 pt-2 md:pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 pb-10">
            {[...media]
              .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
              .map((item) => (
                <div key={item.id} className="space-y-1.5 md:space-y-2 group/item">
                  <div
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => {
                      if (isTogglingId) return;
                      if (selectedPreview?.id !== item.id) {
                        setIsVideoError(false);
                        setIsVideoLoading(true);
                        setSelectedPreview(item);
                        setIsPlaying(true);
                        if (item.type === 'video') startLoadingTimeout();
                        
                        // REGRA 3: Atualiza status do fluxo
                        markAsWaitingApproval();
                      }
                    }}
                    className={cn(
                      'relative aspect-[9/16] rounded-2xl md:rounded-[2.5rem] overflow-hidden cursor-pointer border-2 transition-all duration-500 bg-[#0c0c0c]',
                      selectedPreview?.id === item.id
                        ? 'border-[#ff5351] shadow-[0_0_60px_rgba(255,83,81,0.25)]'
                        : 'border-white/5 hover:border-white/10'
                    )}
                  >
                    {selectedPreview?.id === item.id && item.type === 'video' ? (
                      <div className="w-full h-full relative" onClick={(e) => e.stopPropagation()}>
                        {isVideoLoading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-[60]">
                            <Loader2 className="w-8 h-8 text-[#ff5351] animate-spin" />
                          </div>
                        )}

                        {!isVideoError && selectedPreview ? (
                          isGoogleDriveUrl(selectedPreview.url) ? (
                            <div className="w-full h-full relative overflow-hidden bg-black">
                              <iframe
                                src={`${getDriveEmbedUrl(selectedPreview.url)}?rm=minimal`}
                                className="absolute top-0 left-[-108%] w-[316%] h-full border-0 z-30"
                                allow="autoplay"
                                onLoad={() => setIsVideoLoading(false)}
                              />
                              <div className="absolute top-4 right-4 z-40 bg-black/50 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              </div>
                            </div>
                          ) : selectedPreview.externalId && selectedPreview.url?.includes('cloudflarestream.com') ? (
                            <div className="w-full h-full relative overflow-hidden bg-black">
                              <iframe
                                src={`https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${selectedPreview.externalId}/iframe?autoplay=true`}
                                className="absolute inset-0 w-full h-full border-0"
                                allow="autoplay; fullscreen"
                                allowFullScreen
                                onLoad={() => setIsVideoLoading(false)}
                              />
                            </div>
                          ) : (
                            <Player
                              url={getVideoUrl(selectedPreview)}
                              playing={isPlaying}
                              controls
                              muted
                              playsinline
                              width="100%"
                              height="100%"
                              onReady={() => setIsVideoLoading(false)}
                              onStart={() => setIsPlaying(true)}
                              onPlay={() => setIsPlaying(true)}
                              onPause={() => setIsPlaying(false)}
                              onBuffer={() => setIsVideoLoading(true)}
                              onBufferEnd={() => setIsVideoLoading(false)}
                              onError={handleVideoError}
                              config={{
                                file: {
                                  attributes: {
                                    style: { width: '100%', height: '100%', objectFit: 'cover' },
                                    controlsList: 'nodownload'
                                  }
                                }
                              }}
                            />
                          )
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-[#ff5351]">
                            <AlertTriangle className="w-8 h-8 mb-2" />
                            <p className="text-[10px] uppercase font-black tracking-widest leading-tight">
                              Erro no player.<br />Verifique sua conexão ou formato.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <img
                          src={getThumbnailUrl(item)}
                          className={cn(
                            'w-full h-full object-cover transition-transform duration-700',
                            selectedPreview?.id === item.id ? 'brightness-110 shadow-inner' : 'brightness-[0.4] group-hover/item:brightness-75'
                          )}
                          alt={item.name}
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (item.type === 'video' && !target.src.includes('drive.google.com')) {
                              if (target.src.includes('#t=0.1')) {
                                target.src = target.src.split('#')[0];
                              }
                            }
                          }}
                        />

                        <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover/item:opacity-100 transition-opacity">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                            <Play className="w-4 h-4 md:w-5 md:h-5 ml-0.5 text-white fill-current" />
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(item);
                      }}
                      disabled={Boolean(isTogglingId)}
                      className={cn(
                        'absolute top-3 left-3 md:top-6 md:left-6 z-50 transition-transform active:scale-90',
                        isTogglingId === item.id && 'opacity-70'
                      )}
                    >
                      {isTogglingId === item.id ? (
                        <div className="w-[26px] h-[26px] md:w-[30px] md:h-[30px] bg-black/70 rounded-full flex items-center justify-center shadow-lg border border-white/20">
                          <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white animate-spin" />
                        </div>
                      ) : item.isDownloaded ? (
                        <div className="w-[26px] h-[26px] md:w-[30px] md:h-[30px] bg-amber-500 rounded-full flex items-center justify-center shadow-lg border border-white/20">
                          <Lock className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                        </div>
                      ) : item.isSelected ? (
                        <div className="w-[26px] h-[26px] md:w-[30px] md:h-[30px] bg-[#22c55e] rounded-full flex items-center justify-center shadow-lg border border-white/20">
                          <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-[26px] h-[26px] md:w-[30px] md:h-[30px] rounded-full border-2 border-white/30 backdrop-blur-sm bg-black/20 hover:border-[#22c55e] hover:bg-[#22c55e]/10" />
                      )}
                    </button>
                  </div>

                  <div
                    className={cn(
                      'bg-[#111111] p-2.5 md:p-4 rounded-xl md:rounded-3xl border transition-all duration-300 min-h-[48px] md:min-h-[72px] flex items-center justify-center text-center',
                      selectedPreview?.id === item.id
                        ? 'border-[#ff5351]/30 bg-[#151515]'
                        : 'border-white/5 group-hover/item:border-white/10'
                    )}
                  >
                    <p
                      className={cn(
                        'text-[10px] font-medium capitalize tracking-wide leading-tight transition-colors line-clamp-2',
                        selectedPreview?.id === item.id ? 'text-[#ff5351]' : 'text-zinc-500'
                      )}
                    >
                      {item.name?.toLowerCase()}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
