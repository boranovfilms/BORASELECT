export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Link as LinkIcon, 
  Info, 
  CloudUpload, 
  Image as ImageIcon,
  Check,
  Video,
  Loader2,
  ExternalLink,
  Save,
  RefreshCw,
  Trash2,
  Lock,
  Play,
  RotateCcw,
  Clock,
  Pause,
  ChevronRight,
  CheckCircle2,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { projectService, Project } from '../services/projectService';
import { mediaService, MediaItem } from '../services/mediaService';
import { settingsService } from '../services/settingsService';

interface UploadProgress {
  id: string;
  file: File;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

export default function ProjectConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingDrive, setFetchingDrive] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const activeRequests = useRef<Record<string, XMLHttpRequest>>({});

  const [mediaLink, setMediaLink] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [includedItems, setIncludedItems] = useState(15);
  const [extraPrice, setExtraPrice] = useState('45,00');
  const [allowHighRes, setAllowHighRes] = useState(true);
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadInitialData();
    }
  }, [id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [projData, mediaData, settingsData] = await Promise.all([
        projectService.getProject(id!),
        mediaService.getMedia(id!),
        settingsService.getSettings()
      ]);

      if (projData) {
        setProject(projData);
        setMediaLink(projData.driveLink || '');
        setClientEmail(projData.clientEmail || '');
        setIncludedItems(projData.includedItems || 15);
        setExtraPrice(projData.extraPrice?.toString().replace('.', ',') || '45,00');
        setAllowHighRes(projData.allowHighRes ?? true);
      }
      setMedia(mediaData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await projectService.updateProject(id, {
        driveLink: mediaLink,
        clientEmail,
        creditsTotal: includedItems,
        includedItems,
        extraPrice: parseFloat(extraPrice.replace(',', '.')),
        allowHighRes
      });
      await loadInitialData();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || !id) return;
    
    console.log(`[Upload] Selecionados ${files.length} arquivos.`);

    const newUploads: Record<string, UploadProgress> = {};
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      
      const uploadId = `${Date.now()}-${file.name}-${Math.random().toString(36).substr(2, 9)}`;
      
      newUploads[uploadId] = { 
        id: uploadId,
        file, 
        fileName: file.name, 
        progress: 0, 
        status: 'pending' 
      };
    }

    setUploads(prev => ({ ...prev, ...newUploads }));
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startUpload = async (uploadId: string) => {
    const upload = uploads[uploadId];
    if (!upload || !id) return;

    setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'uploading', progress: 0 } }));

    try {
      // 1. Pedir URL ao Worker (GET)
      const workerUrl = `https://nameless-dust-4193.boranovfilms.workers.dev/api/upload`;
      
      const response = await fetch(workerUrl, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Worker Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Upload] Worker response:', JSON.stringify(data));
      
      if (!data.success || !data.result?.uploadURL) {
        throw new Error('Worker não retornou URL');
      }
      
      const { uid, uploadURL } = data.result;
      console.log(`[Upload] UID: ${uid}`);
      console.log(`[Upload] uploadURL: ${uploadURL}`);

      // 2. Upload DIRETO para Cloudflare Stream via POST + FormData
      const xhr = new XMLHttpRequest();
      activeRequests.current[uploadId] = xhr;

      const formData = new FormData();
      formData.append('file', upload.file);

      xhr.open('POST', uploadURL, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploads(prev => ({ 
            ...prev, 
            [uploadId]: { ...prev[uploadId], progress } 
          }));
        }
      };

      xhr.onload = async () => {
        delete activeRequests.current[uploadId];
        console.log(`[Upload] Cloudflare response status: ${xhr.status}`);
        console.log(`[Upload] Cloudflare response body: ${xhr.responseText}`);

        if (xhr.status >= 200 && xhr.status < 300) {
          const streamUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/watch`;
          const thumbnailUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;

          await mediaService.addMedia(id!, {
            externalId: uid,
            name: upload.file.name,
            url: streamUrl,
            thumbnailUrl: thumbnailUrl,
            type: 'video',
            isSelected: false
          });

          setUploads(prev => ({ 
            ...prev, 
            [uploadId]: { ...prev[uploadId], status: 'completed', progress: 100 } 
          }));
          setTimeout(loadInitialData, 1000);
        } else {
          console.error('[Upload] Erro:', xhr.status, xhr.responseText);
          alert(`Erro Cloudflare (${xhr.status}): ${xhr.responseText?.substring(0, 200)}`);
          setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } }));
        }
      };

      xhr.onerror = () => {
        delete activeRequests.current[uploadId];
        alert('Erro de conexão com Cloudflare. Verifique CORS.');
        setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } }));
      };

      xhr.send(formData);
    } catch (error: any) {
      console.error('Upload Error:', error);
      alert(`Erro: ${error.message}`);
      setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } }));
    }
  };

  const startAllUploads = () => {
    Object.keys(uploads).forEach(id => {
      if (uploads[id].status === 'pending' || uploads[id].status === 'error') {
        startUpload(id);
      }
    });
  };

  const removeUpload = (uploadId: string) => {
    setUploads(prev => {
      const next = { ...prev };
      delete next[uploadId];
      return next;
    });
  };

  const cancelUpload = (uploadId: string) => {
    if (activeRequests.current[uploadId]) {
      activeRequests.current[uploadId].abort();
      delete activeRequests.current[uploadId];
    }
    removeUpload(uploadId);
  };

  const retryUpload = (uploadId: string) => {
    startUpload(uploadId);
  };

  const clearCompletedUploads = () => {
    setUploads(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (next[key].status === 'completed') delete next[key];
      });
      return next;
    });
  };

  const clearAllUploads = () => {
    Object.keys(activeRequests.current).forEach(id => {
      activeRequests.current[id].abort();
    });
    activeRequests.current = {};
    setUploads({});
  };

  const handleSyncMedia = async () => {
    if (!mediaLink) {
      alert('Por favor, insira um link fonte primeiro.');
      return;
    }
    setFetchingDrive(true);
    try {
      const response = await fetch('/api-v2/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mediaLink })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar');
      }

      if (data.files && data.files.length > 0) {
        let addedCount = 0;
        
        const existingIds = new Set(media.map(m => m.externalId).filter(Boolean));

        for (const file of data.files) {
          const fileId = file.id || file.uid;
          if (!existingIds.has(fileId)) {
            await mediaService.addMedia(id!, {
              externalId: fileId,
              name: file.name,
              url: file.url,
              thumbnailUrl: file.thumbnailUrl || file.url,
              type: file.type,
              isSelected: false
            });
            addedCount++;
          }
        }
        
        if (addedCount > 0) {
          alert(`${addedCount} novos arquivos sincronizados com sucesso!`);
          await loadInitialData();
        } else {
          alert('O catálogo já está atualizado.');
        }
      } else {
        alert('Nenhum arquivo encontrado na fonte fornecida.');
      }
    } catch (error: any) {
      console.error(error);
      alert('Falha ao sincronizar: ' + error.message);
    } finally {
      setFetchingDrive(false);
    }
  };

  const handleClearMedia = async () => {
    if (!window.confirm('Deseja apagar TODO o catálogo? Esta ação é irreversível.')) return;
    setLoading(true);
    try {
      for (const item of media) {
        if (item.id) {
          await mediaService.deleteMedia(id!, item.id);
        }
      }
      setMedia([]);
      alert('Catálogo limpo com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Erro ao limpar catálogo.');
    } finally {
      setLoading(false);
    }
  };

  const getThumbnailUrl = (item: MediaItem) => {
    if (!item.url) return item.thumbnailUrl || '';
    
    if (item.url.includes('drive.google.com') || (item.url.length > 20 && !item.url.includes('/') && !item.url.includes('.'))) {
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

  const filteredMedia = activeTab === 'all' 
    ? media 
    : media.filter(m => m.isSelected);

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
        <button onClick={() => navigate('/')} className="mt-4 text-[#ff5351] font-bold">Voltar ao Dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <button onClick={() => navigate('/')} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Projeto de Seleção</h1>
            <p className="text-[#ff5351] font-bold text-lg">{project.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-4 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest hover:brightness-110 transition-all text-sm shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Projeto
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 flex flex-col gap-8">
          <section className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff5351]/5 blur-[100px] -z-10" />
            
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">1. Upload de Mídia</h2>
              <span className="px-3 py-1 bg-[#ff5351]/10 border border-[#ff5351]/20 rounded text-[10px] font-bold uppercase tracking-widest text-[#ff5351]">Cloudflare Stream Direct</span>
            </div>

            <div className="space-y-6">
              <input 
                type="file" 
                multiple 
                className="hidden" 
                ref={fileInputRef} 
                onChange={(e) => handleFileUpload(e.target.files)}
                accept="image/*,video/*"
              />
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFileUpload(e.dataTransfer.files);
                }}
                className="group py-12 flex flex-col items-center justify-center bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-[#ff5351]/50 hover:bg-[#ff5351]/5 cursor-pointer transition-all duration-500"
              >
                <div className="w-16 h-16 rounded-3xl bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#ff5351] group-hover:text-white transition-all duration-500 shadow-xl group-hover:shadow-[#ff5351]/20">
                  <CloudUpload className="w-8 h-8" />
                </div>
                <h4 className="text-white font-black uppercase tracking-widest text-sm mb-2 italic">Subir Arquivos</h4>
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Arraste seus vídeos e fotos ou clique para buscar</p>
                <p className="text-[10px] text-zinc-700 mt-4 font-mono uppercase tracking-widest border border-zinc-800 px-3 py-1 rounded-full group-hover:border-[#ff5351]/30">JPG, PNG, MP4, MOV</p>
              </div>

              {Object.keys(uploads).length > 0 && (
                <div className="space-y-4 pt-6 border-t border-zinc-800">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                          <Loader2 className={cn("w-3 h-3", Object.values(uploads).some(u => u.status === 'uploading') && "animate-spin")} />
                          Fila de Arquivos ({Object.keys(uploads).length})
                        </h5>
                        
                        <div className="flex items-center gap-2">
                          {Object.values(uploads).some(u => u.status === 'completed') && (
                            <button 
                              onClick={clearCompletedUploads}
                              className="text-[10px] uppercase font-black tracking-widest text-emerald-500 hover:text-emerald-400 transition-all border border-emerald-500/30 px-2 py-1 rounded"
                            >
                              Limpar Concluídos
                            </button>
                          )}
                          <button 
                            onClick={clearAllUploads}
                            className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-red-500 transition-all"
                          >
                            Limpar Fila
                          </button>
                        </div>
                      </div>

                      {Object.values(uploads).some(u => u.status === 'pending' || u.status === 'error') && (
                        <button 
                          onClick={startAllUploads}
                          className="px-4 py-2 bg-[#ff5351] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#ff5351]/20"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Enviar Todos da Fila
                        </button>
                      )}
                    </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(uploads).map(([id, upload]) => (
                      <div key={id} className="group/item bg-black/40 rounded-2xl p-4 border border-zinc-800/50 hover:border-[#ff5351]/30 transition-all">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              upload.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : 
                              upload.status === 'error' ? "bg-red-500/10 text-red-500" : 
                              upload.status === 'uploading' ? "bg-[#ff5351]/10 text-[#ff5351]" : "bg-zinc-800 text-zinc-500"
                            )}>
                              {upload.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
                               upload.status === 'error' ? <Info className="w-4 h-4" /> :
                               upload.status === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                               <Clock className="w-4 h-4" />}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-[10px] font-black uppercase tracking-tight text-white truncate">{upload.fileName}</p>
                              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                                {upload.status === 'pending' ? 'Pendente' : 
                                 upload.status === 'uploading' ? 'Enviando...' : 
                                 upload.status === 'completed' ? 'Concluído' : 'Erro no envio'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {upload.status === 'pending' && (
                              <button onClick={() => startUpload(id)} className="p-1.5 text-zinc-400 hover:text-[#ff5351] hover:bg-[#ff5351]/10 rounded-lg transition-all" title="Iniciar">
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}
                            {upload.status === 'error' && (
                              <button onClick={() => retryUpload(id)} className="p-1.5 text-zinc-400 hover:text-[#ff5351] hover:bg-[#ff5351]/10 rounded-lg transition-all" title="Tentar novamente">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => cancelUpload(id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Cancelar">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-300 rounded-full",
                                upload.status === 'completed' ? "bg-emerald-500" : 
                                upload.status === 'error' ? "bg-red-500" : "bg-[#ff5351]"
                              )}
                              style={{ width: `${upload.progress}%` }}
                            />
                          </div>
                          <span className="text-[8px] font-mono font-bold text-zinc-600 w-6">{upload.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-zinc-800">
              <button 
                onClick={() => setMediaLink(mediaLink ? '' : ' ')} 
                className="text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-zinc-400 flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                {mediaLink ? "Ocultar sincronização manual" : "Mostrar sincronização por link (Legacy)"}
              </button>
              
              {mediaLink && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="relative group">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-[#ff5351]" />
                    <input 
                      type="text" 
                      value={mediaLink.trim()}
                      onChange={(e) => setMediaLink(e.target.value)}
                      placeholder="Link do R2 ou Drive..."
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-12 pr-12 py-3 text-xs text-white focus:border-[#ff5351] outline-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <button 
                        onClick={handleSyncMedia}
                        disabled={fetchingDrive || !mediaLink.trim()}
                        className="p-1.5 bg-zinc-800 text-white rounded hover:bg-[#ff5351] transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={cn("w-3 h-3", fetchingDrive && "animate-spin")} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-8 border-b border-zinc-800 pb-4 uppercase tracking-tight">2. Regras de Acesso</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center justify-between ml-1">
                    <span className="flex items-center gap-2">
                      E-mail de Acesso do Cliente
                      <Lock className="w-3 h-3" />
                    </span>
                    {project.status === 'Em Seleção' && (
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border font-black tracking-tighter",
                        project.clientStatus === 'confirmed' 
                          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" 
                          : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                      )}>
                        {project.clientStatus === 'confirmed' ? '✓ OK, SENHA CRIADA' : '⏳ AGUARDANDO SENHA'}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                    <input 
                      type="email" 
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="email@cliente.com"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 ml-1">O cliente deve usar este mesmo e-mail para fazer login e acessar a seleção.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-2">
                    Mídias Inclusas (Gratuitas)
                    <Info className="w-3 h-3" />
                  </label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                    <input 
                      type="number" 
                      value={includedItems}
                      onChange={(e) => setIncludedItems(parseInt(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-2">
                    Preço por Mídia Extra
                    <Info className="w-3 h-3" />
                  </label>
                  <div className="relative font-mono">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">R$</span>
                    <input 
                      type="text" 
                      value={extraPrice}
                      onChange={(e) => setExtraPrice(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center space-y-6 bg-black/20 p-6 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Download em Alta Resolução</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Liberar arquivo original</span>
                  </div>
                  <div 
                    onClick={() => setAllowHighRes(!allowHighRes)}
                    className={cn(
                      "w-12 h-7 rounded-full relative cursor-pointer transition-all p-1",
                      allowHighRes ? "bg-[#ff5351]" : "bg-zinc-800"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 bg-white rounded-full transition-all shadow-md",
                      allowHighRes ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                </div>

                <div className="flex items-center justify-between opacity-50">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-400">Proteção de Marca d'água</span>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Sempre ativo em prévias</span>
                  </div>
                  <div className="w-12 h-7 bg-[#ff5351]/20 rounded-full relative p-1">
                    <div className="w-5 h-5 bg-[#ff5351] rounded-full translate-x-5 flex items-center justify-center">
                      <Lock className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800 pb-4 gap-4">
          <div>
            <h3 className="text-3xl font-bold text-white">Právia do Catálogo ({media.length})</h3>
            <p className="text-zinc-500 text-sm mt-1">Media sincronizada da nova fonte Cloudflare.</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex bg-zinc-900 rounded-full p-1 border border-zinc-800 self-start">
              <button 
                onClick={() => setActiveTab('all')}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === 'all' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
                )}
              >Tudo</button>
              <button 
                onClick={() => setActiveTab('selected')}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === 'selected' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
                )}
              >Selecionados ({media.filter(m => m.isSelected).length})</button>
            </div>
            
            {media.length > 0 && (
              <button 
                onClick={handleClearMedia}
                className="flex items-center gap-2 text-zinc-600 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-all ml-4"
              >
                <Trash2 className="w-3 h-3" />
                Limpar Catálogo
              </button>
            )}
          </div>
        </div>

        {media.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-zinc-900/20 rounded-3xl border-2 border-dashed border-zinc-800">
            <CloudUpload className="w-12 h-12 text-zinc-700 mb-4" />
            <p className="text-zinc-500 font-medium">Nenhuma mídia encontrada.</p>
            <p className="text-zinc-600 text-xs">Insira o link da nova fonte e clique no ícone de sincronização acima.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {filteredMedia.map((item, idx) => (
              <div 
                key={item.id || idx} 
                className="group relative aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-[#ff5351] transition-all shadow-xl"
              >
                <img 
                  src={getThumbnailUrl(item)}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700"
                  alt={item.name || 'Preview'}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (item.type === 'video' && !target.src.includes('drive.google.com')) {
                      if (target.src.includes('#t=0.1')) {
                        target.src = target.src.split('#')[0];
                      }
                    }
                  }}
                />
                
                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[#ff5351] flex items-center justify-center text-white shadow-lg shadow-[#ff5351]/40">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                )}
                <div className="absolute top-4 right-4 z-20">
                  <div className={cn(
                    "w-6 h-6 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center",
                    item.isSelected ? "bg-[#ff5351] border-[#ff5351]" : ""
                  )}>
                    {item.isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <p className="text-[10px] text-zinc-200 font-bold uppercase tracking-widest bg-black/40 backdrop-blur-sm px-2 py-1 rounded self-start truncate max-w-full">
                    {item.name || `FILE_${idx + 1}.JPG`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
