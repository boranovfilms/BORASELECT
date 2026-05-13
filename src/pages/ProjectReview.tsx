export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  CheckCircle2,
  CreditCard,
  ShoppingBag,
  Info,
  Loader2,
  Image as ImageIcon,
  Lock,
  Download,
  AlertTriangle,
  Copy,
  X,
  Upload
} from 'lucide-react';
import { projectService, Project } from '../services/projectService';
import { mediaService, MediaItem } from '../services/mediaService';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { useProjectStore } from '../store/useProjectStore';

export default function ProjectReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setProjectInfo } = useProjectStore();
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<'NOT_FOUND' | 'DENIED' | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [isVideoError, setIsVideoError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoRefreshKey, setVideoRefreshKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const globalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [isCreditBlinking, setIsCreditBlinking] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);

  const [pixKey, setPixKey] = useState('boranovfilms@gmail.com');
  const [pixKeyType, setPixKeyType] = useState('email');
  const [creditUnitPrice, setCreditUnitPrice] = useState(0);
  const [loadingCreditConfig, setLoadingCreditConfig] = useState(false);
  const [creditsToBuy, setCreditsToBuy] = useState(1);
  const [creditReceiptFile, setCreditReceiptFile] = useState<File | null>(null);
  const [creditReceiptPreview, setCreditReceiptPreview] = useState('');
  const [creditClientNote, setCreditClientNote] = useState('');
  const [submittingCreditRequest, setSubmittingCreditRequest] = useState(false);

  const effectiveCreditUnitPrice = Number(project?.extraPrice || creditUnitPrice || 0);
  const creditRequestTotal = Number((creditsToBuy * effectiveCreditUnitPrice).toFixed(2));

  useEffect(() => {
    if (id) loadData();
    return () => {
      setProjectInfo(null, null);
      if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (project) {
      loadCreditConfig();
    }
  }, [project?.id, project?.extraPrice]);

  useEffect(() => {
    if (isVideoLoading && selectedPreview) {
      setLoadTimeout(false);
      if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);

      globalTimeoutRef.current = setTimeout(() => {
        if (isVideoLoading) {
          setLoadTimeout(true);
        }
      }, 8000);
    } else {
      setLoadTimeout(false);
      if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
    }
  }, [isVideoLoading, selectedPreview]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [selectedPreview?.id]);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (creditReceiptPreview.startsWith('blob:')) {
        URL.revokeObjectURL(creditReceiptPreview);
      }
    };
  }, [creditReceiptPreview]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const resetCreditForm = () => {
    if (creditReceiptPreview.startsWith('blob:')) {
      URL.revokeObjectURL(creditReceiptPreview);
    }
    setCreditsToBuy(1);
    setCreditReceiptFile(null);
    setCreditReceiptPreview('');
    setCreditClientNote('');
    setSubmittingCreditRequest(false);
  };

  const closeAddCreditsModal = () => {
    setShowAddCreditsModal(false);
    resetCreditForm();
  };

  const openAddCreditsModal = async () => {
    setShowCreditModal(false);
    setShowAddCreditsModal(true);
    setIsCreditBlinking(false);
    if (!pixKey || effectiveCreditUnitPrice <= 0) {
      await loadCreditConfig();
    }
  };

  const loadCreditConfig = async () => {
    if (!project) return;

    setLoadingCreditConfig(true);
    try {
      const response = await fetch('/api-v2/credits/config');
      if (!response.ok) {
        throw new Error('Não foi possível carregar a configuração de créditos.');
      }

      const data = await response.json();

      if (data.pixKey) {
        setPixKey(data.pixKey);
      }

      if (data.pixKeyType) {
        setPixKeyType(data.pixKeyType);
      }

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

  const loadData = async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      const p = await projectService.getProject(id!);
      if (!p) {
        setErrorStatus('NOT_FOUND');
        setLoading(false);
        return;
      }
      const m = await mediaService.getMedia(id!);
      setProject(p);
      setMedia(m);
      setProjectInfo(p.clientName || p.title, p.clientEmail || 'Projeto de Seleção');
    } catch (error) {
      setErrorStatus('DENIED');
      toast.error('Erro ao acessar o projeto');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoError = async (e?: any) => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);

    console.error('Erro ao carregar vídeo:', e || 'Timeout');
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
        console.warn('Video loading timeout reached');
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

      if (!hash || !hash.startsWith('#t=')) {
        hash = '#t=0.1';
      }

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
    } catch (e) {
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

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleCopyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      toast.success('Chave Pix copiada');
    } catch (error) {
      toast.error('Não foi possível copiar a chave Pix');
    }
  };

  const handleReceiptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem do comprovante');
      return;
    }

    if (creditReceiptPreview.startsWith('blob:')) {
      URL.revokeObjectURL(creditReceiptPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setCreditReceiptFile(file);
    setCreditReceiptPreview(previewUrl);
  };

  const uploadCreditReceipt = async (file: File) => {
    const uploadUrlResponse = await fetch('/api-v2/media/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        folderPrefix: `credit-receipts/${id}`
      })
    });

    const uploadUrlData = await uploadUrlResponse.json();

    if (!uploadUrlResponse.ok) {
      throw new Error(uploadUrlData.error || 'Erro ao preparar upload do comprovante');
    }

    if (!uploadUrlData.uploadUrl || !uploadUrlData.fileUrl) {
      throw new Error('Não foi possível gerar o link do comprovante');
    }

    const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error('Erro ao enviar comprovante');
    }

    return {
      fileUrl: uploadUrlData.fileUrl,
      fileName: file.name
    };
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

    if (!creditReceiptFile) {
      toast.error('Anexe o comprovante do pagamento');
      return;
    }

    try {
      setSubmittingCreditRequest(true);

      const uploadedReceipt = await uploadCreditReceipt(creditReceiptFile);

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
          receiptImageUrl: uploadedReceipt.fileUrl,
          receiptFileName: uploadedReceipt.fileName,
          clientNote: creditClientNote.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar solicitação');
      }

      toast.success('Solicitação enviada para análise');
      closeAddCreditsModal();
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

      setMedia(prev => prev.map(m => m.id === item.id ? { ...m, isSelected: newStatus } : m));

      const updatedCreditsUsed = newStatus ? project.creditsUsed + 1 : Math.max(0, project.creditsUsed - 1);
      await projectService.updateProject(id, { creditsUsed: updatedCreditsUsed });

      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          creditsUsed: updatedCreditsUsed
        };
      });

      if (newStatus) toast.success('Item selecionado!');
      else toast.success('Seleção removida');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Erro ao atualizar seleção');
    } finally {
      setIsTogglingId(current => current === item.id ? null : current);
    }
  };

  const currentIndex = selectedPreview
    ? media.findIndex(m => m.id === selectedPreview.id)
    : -1;

  const handleNext = () => {
    if (currentIndex < media.length - 1) {
      setSelectedPreview(media[currentIndex + 1]);
      setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedPreview(media[currentIndex - 1]);
      setIsPlaying(false);
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

  return (
    <div className="animate-in fade-in duration-700 pb-20 relative">
      {showAddCreditsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={closeAddCreditsModal} />
          <div className="relative w-full max-w-3xl bg-[#141414] border border-zinc-800 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(255,83,81,0.12)]">
            <div className="px-5 md:px-8 py-5 border-b border-zinc-800 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#ff5351] font-black mb-2">
                  Compra manual
                </p>
                <h2 className="text-white text-2xl md:text-3xl font-black uppercase italic tracking-tight">
                  Adicionar créditos
                </h2>
                <p className="text-zinc-500 text-sm mt-2 max-w-xl">
                  Escolha a quantidade de créditos, faça o pagamento no Pix e envie o comprovante para análise.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddCreditsModal}
                className="w-11 h-11 rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Projeto</p>
                  <p className="text-white font-black text-lg leading-tight">{project?.title}</p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Disponíveis hoje</p>
                  <p className="text-white font-black text-2xl">{project ? project.creditsTotal - project.creditsUsed : 0}</p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor por crédito</p>
                  <p className="text-white font-black text-2xl">
                    {loadingCreditConfig ? '...' : effectiveCreditUnitPrice > 0 ? formatCurrency(effectiveCreditUnitPrice) : 'Não definido'}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-5 md:p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                      Quantidade
                    </p>
                    <h3 className="text-white font-black text-xl uppercase">Créditos desejados</h3>
                  </div>

                  <div className="text-right">
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Total</p>
                    <p className="text-[#ff5351] font-black text-2xl md:text-3xl">
                      {formatCurrency(creditRequestTotal)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCreditsToBuy(prev => Math.max(1, prev - 1))}
                    className="w-12 h-12 rounded-2xl border border-zinc-800 bg-zinc-900 text-white font-black text-xl hover:border-zinc-700 transition-all"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min={1}
                    value={creditsToBuy}
                    onChange={(e) => setCreditsToBuy(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 text-white text-center text-2xl font-black focus:border-[#ff5351] outline-none transition-all"
                  />

                  <button
                    type="button"
                    onClick={() => setCreditsToBuy(prev => prev + 1)}
                    className="w-12 h-12 rounded-2xl border border-zinc-800 bg-zinc-900 text-white font-black text-xl hover:border-zinc-700 transition-all"
                  >
                    +
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[5, 10, 20].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setCreditsToBuy(amount)}
                      className={cn(
                        'h-12 rounded-2xl border text-sm font-black uppercase tracking-wider transition-all',
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
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-amber-300 text-sm font-medium">
                    O valor por crédito ainda não está configurado neste projeto.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-5 md:p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                      Pagamento
                    </p>
                    <h3 className="text-white font-black text-xl uppercase">Pix para pagamento</h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPixKey}
                    className="h-11 px-4 rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-200 font-black uppercase tracking-widest text-xs hover:border-zinc-700 transition-all flex items-center gap-2 self-start md:self-auto"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar chave
                  </button>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 md:p-5">
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">
                    Chave Pix {pixKeyType ? `(${pixKeyType})` : ''}
                  </p>
                  <p className="text-white text-lg md:text-2xl font-black break-all">
                    {pixKey}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    Faça o pagamento de <span className="text-white font-black">{formatCurrency(creditRequestTotal)}</span> usando a chave Pix acima.
                    Depois, anexe o comprovante para eu analisar e liberar os créditos no seu projeto.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-5 md:p-6 space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                    Comprovante
                  </p>
                  <h3 className="text-white font-black text-xl uppercase">Enviar imagem do pagamento</h3>
                </div>

                <label className="block rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/70 p-6 text-center cursor-pointer hover:border-[#ff5351]/40 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-[#ff5351]" />
                    </div>
                    <div>
                      <p className="text-white font-black uppercase text-sm tracking-wide">
                        {creditReceiptFile ? 'Trocar comprovante' : 'Selecionar comprovante'}
                      </p>
                      <p className="text-zinc-500 text-xs mt-1">
                        Envie uma imagem do comprovante Pix
                      </p>
                    </div>
                  </div>
                </label>

                {creditReceiptFile && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-4">
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Arquivo selecionado</p>
                      <p className="text-white text-sm font-bold break-all">{creditReceiptFile.name}</p>
                    </div>

                    {creditReceiptPreview && (
                      <img
                        src={creditReceiptPreview}
                        alt="Comprovante"
                        className="w-full max-h-[280px] object-contain rounded-2xl border border-zinc-800 bg-black"
                      />
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                    Observação
                  </label>
                  <textarea
                    value={creditClientNote}
                    onChange={(e) => setCreditClientNote(e.target.value)}
                    rows={3}
                    placeholder="Se quiser, escreva uma observação sobre o pagamento."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 md:px-8 py-5 border-t border-zinc-800 flex flex-col md:flex-row gap-3">
              <button
                type="button"
                onClick={closeAddCreditsModal}
                className="flex-1 h-12 rounded-2xl border border-zinc-800 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-900 transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmitCreditRequest}
                disabled={submittingCreditRequest || effectiveCreditUnitPrice <= 0}
                className="flex-[1.4] h-12 rounded-2xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submittingCreditRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando solicitação
                  </>
                ) : (
                  'Enviar para análise'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowCreditModal(false)} />
          <div className="relative bg-[#1a1a1a] border border-zinc-800 rounded-[3rem] p-8 md:p-12 max-w-md w-full text-center shadow-[0_0_100px_rgba(255,83,81,0.2)] animate-in zoom-in duration-300">
            <div className="w-16 h-16 md:w-24 md:h-24 bg-[#ff5351]/10 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 relative">
              <div className="absolute inset-0 bg-[#ff5351]/5 rounded-full animate-ping" />
              <CreditCard className="w-8 h-8 md:w-12 md:h-12 text-[#ff5351]" />
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter mb-4">Limite Atingido</h3>
            <p className="text-zinc-400 text-xs md:text-sm font-bold leading-relaxed mb-8 md:mb-10">
              Você atingiu o seu limite de seleções. Para continuar escolhendo novos materiais, adicione mais créditos à sua conta.
            </p>
            <div className="space-y-3">
              <button
                onClick={openAddCreditsModal}
                className="w-full bg-[#ff5351] text-white py-4 md:py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[#ff5351]/30"
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
              <p className="text-[#ff5351] font-bold text-[10px] uppercase tracking-widest">{project.category || (project as any).type || 'PODCAST'}</p>
            </div>

            <p className="text-white font-black text-lg italic uppercase tracking-tight leading-none truncate">{project.title}</p>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-zinc-800/50 rounded-xl px-3 py-2">
                <span className="text-base font-black text-white italic">{media.length}</span>
                <span className="text-[8px] font-black uppercase text-[#ff5351] tracking-wider">vídeos</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-zinc-800/50 rounded-xl px-3 py-2">
                <span className="text-base font-black text-white italic">{project.creditsTotal - project.creditsUsed}</span>
                <span className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">/{project.creditsTotal}</span>
              </div>
              <button
                onClick={openAddCreditsModal}
                className={cn(
                  'rounded-xl px-3 py-2 font-black uppercase text-[8px] tracking-wider transition-all border',
                  isCreditBlinking
                    ? 'animate-subtle-blink border-[#ff5351]/50'
                    : 'bg-[#1a1a1a] border-zinc-800/50 text-zinc-400 active:scale-95'
                )}
              >
                +CRÉDITOS
              </button>
              <button
                onClick={() => navigate(`/download/${id}`)}
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
                <p className="text-[#ff5351] font-bold text-[11px] uppercase tracking-widest italic opacity-90">{project.category || (project as any).type || 'PODCAST'}</p>
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
                  <h2 className="text-[9px] font-black text-[#ff5351] uppercase tracking-[0.22em] italic opacity-80 text-left ml-1">SELEÇÕES</h2>
                  <div className="w-[110px] h-[64px] bg-[#1a1a1a] border border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center gap-0 group hover:border-zinc-700 transition-all shadow-lg">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xl font-black text-white">{project.creditsTotal - project.creditsUsed}</span>
                      <span className="text-sm font-bold text-zinc-600">/ {project.creditsTotal}</span>
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600 mt-0.5">Disponíveis</span>
                  </div>
                </div>

                <div className="pb-0">
                  <button
                    onClick={openAddCreditsModal}
                    className={cn(
                      'h-[64px] px-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[8px] transition-all shadow-xl flex items-center justify-center text-center leading-tight',
                      isCreditBlinking
                        ? 'animate-subtle-blink'
                        : 'bg-[#1a1a1a] border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white active:scale-95'
                    )}
                  >
                    ADICIONAR<br />CREDITOS
                  </button>
                </div>

                <div className="pb-0">
                  <button
                    onClick={() => navigate(`/download/${id}`)}
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
            {[...media].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map((item) => (
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
