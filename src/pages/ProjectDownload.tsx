export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Download, 
  CheckCircle2, 
  Loader2, 
  Lock,
  FileVideo,
  Calendar,
  Hash
} from 'lucide-react';
import { cn } from '../lib/utils';
import { projectService, Project } from '../services/projectService';
import { mediaService, MediaItem } from '../services/mediaService';
import { toast } from 'react-hot-toast';

export default function ProjectDownload() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await projectService.getProject(id!);
      if (!p) {
        toast.error('Projeto não encontrado');
        navigate('/');
        return;
      }
      const m = await mediaService.getMedia(id!);
      setProject(p);
      setMedia(m.filter(item => item.isSelected));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar projeto');
    } finally {
      setLoading(false);
    }
  };

  const extractFolderId = (driveLink: string): string | null => {
    const match = driveLink.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    const match2 = driveLink.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) return match2[1];
    return null;
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleDownload = async (item: MediaItem) => {
    if (!project?.originalDriveLink) {
      toast.error('Link do Drive não configurado neste projeto.');
      return;
    }

    const folderId = extractFolderId(project.originalDriveLink);
    if (!folderId) {
      toast.error('Link do Drive inválido.');
      return;
    }

    setDownloading(item.id!);

    try {
      const response = await fetch(`/api/drive-files?folderId=${encodeURIComponent(folderId)}&fileName=${encodeURIComponent(item.name || '')}`);
      const data = await response.json();

      if (!data.success || !data.files || data.files.length === 0) {
        toast.error(`Arquivo "${item.name}" não encontrado no Drive.`);
        setDownloading(null);
        return;
      }

      const file = data.files[0];
      
      // Marcar como baixado no banco
      await mediaService.markAsDownloaded(id!, item.id!);
      
      // Atualizar estado local
      setMedia(prev => prev.map(m => 
        m.id === item.id 
          ? { ...m, isDownloaded: true, downloadCount: (m.downloadCount || 0) + 1 } 
          : m
      ));

      if (isMobile()) {
        // Mobile: abrir link direto (único jeito que funciona)
        window.location.href = file.downloadUrl;
      } else {
        // Desktop: iframe invisível (não abre aba)
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = file.downloadUrl;
        document.body.appendChild(iframe);
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 10000);
      }

      toast.success(`Download: ${item.name}`);
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao buscar arquivo: ' + error.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    if (!project?.originalDriveLink) {
      toast.error('Link do Drive não configurado neste projeto.');
      return;
    }

    const folderId = extractFolderId(project.originalDriveLink);
    if (!folderId) {
      toast.error('Link do Drive inválido.');
      return;
    }

    toast.success(`Iniciando download de ${media.length} arquivos...`);

    for (let i = 0; i < media.length; i++) {
      const item = media[i];
      setDownloading(item.id!);

      try {
        const response = await fetch(`/api/drive-files?folderId=${encodeURIComponent(folderId)}&fileName=${encodeURIComponent(item.name || '')}`);
        const data = await response.json();

        if (!data.success || !data.files || data.files.length === 0) {
          toast.error(`"${item.name}" não encontrado no Drive.`);
          continue;
        }

        const file = data.files[0];

        await mediaService.markAsDownloaded(id!, item.id!);

        setMedia(prev => prev.map(m => 
          m.id === item.id 
            ? { ...m, isDownloaded: true, downloadCount: (m.downloadCount || 0) + 1 } 
            : m
        ));

        // Download via iframe invisível (não abre aba, não bloqueia popup)
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = file.downloadUrl;
        document.body.appendChild(iframe);
        
        // Remover iframe após 10 segundos
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 10000);

        toast.success(`(${i + 1}/${media.length}) ${item.name}`);
      } catch (error: any) {
        toast.error(`Erro: ${item.name}`);
      }

      // Delay entre downloads para não sobrecarregar
      if (i < media.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setDownloading(null);
    toast.success('Todos os downloads foram iniciados!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-2xl text-white font-bold">Projeto não encontrado</h2>
        <button onClick={() => navigate('/')} className="mt-4 text-[#ff5351] font-bold">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <button onClick={() => navigate(`/review/${id}`)} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" />
            Voltar à Seleção
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Downloads</h1>
            <p className="text-[#ff5351] font-bold text-lg">{project.title}</p>
          </div>
        </div>
        {media.length > 0 && (
          <button 
            onClick={handleDownloadAll}
            disabled={downloading !== null}
            className="hidden md:flex px-8 py-4 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest hover:brightness-110 transition-all text-sm shadow-2xl shadow-[#ff5351]/20 items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Baixar Todos
          </button>
        )}
      </header>

      {media.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-zinc-900/20 rounded-3xl border-2 border-dashed border-zinc-800">
          <Lock className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-500 font-medium">Nenhum item selecionado.</p>
          <p className="text-zinc-600 text-xs mt-2">Volte à tela de seleção e escolha seus vídeos primeiro.</p>
        </div>
      ) : (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {media.length} {media.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Pronto para download
            </span>
          </div>
          
          <div className="divide-y divide-zinc-800">
            {media.map((item) => (
              <div key={item.id} className="px-4 md:px-8 py-4 md:py-6 flex items-center justify-between hover:bg-zinc-800/30 transition-all group">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                    <FileVideo className="w-4 h-4 md:w-5 md:h-5 text-[#ff5351]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-xs md:text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-2 md:gap-4 mt-1 flex-wrap">
                      {item.uploadedAt && (
                        <span className="hidden md:flex text-[10px] text-zinc-500 items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Upload: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(item.uploadedAt?.toDate?.() || new Date())}
                        </span>
                      )}
                      {item.isDownloaded && (
                        <span className="text-[10px] text-amber-400 md:text-emerald-500 flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          <span className="md:hidden">Baixado</span>
                          <span className="hidden md:inline">Downloads: {item.downloadCount || 1}</span>
                        </span>
                      )}
                      {item.downloadedAt && (
                        <span className="hidden md:flex text-[10px] text-zinc-500 items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Último: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(item.downloadedAt?.toDate?.() || new Date())}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDownload(item)}
                  disabled={downloading === item.id}
                  className={cn(
                    "flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shrink-0 ml-2",
                    item.isDownloaded
                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 md:bg-emerald-500/10 md:border-emerald-500/30 md:text-emerald-400 md:hover:bg-emerald-500/20"
                      : "bg-[#ff5351] text-white hover:brightness-110 shadow-lg shadow-[#ff5351]/20"
                  )}
                >
                  {downloading === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : item.isDownloaded ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden md:inline">{downloading === item.id ? 'Buscando...' : item.isDownloaded ? 'Baixar Novamente' : 'Download'}</span>
                  <span className="md:hidden">{downloading === item.id ? '...' : item.isDownloaded ? '' : 'Baixar'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
