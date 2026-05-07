export const dynamic = 'force-dynamic';
import { useState } from 'react';
import ReactPlayer from 'react-player';
const Player = ReactPlayer as any;
import { Play, Link as LinkIcon, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function VideoTest() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [playMethod, setPlayMethod] = useState<'native' | 'react-player' | 'drive-embed'>('native');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  const getDriveViewerUrl = (inputUrl: string) => {
    const match = inputUrl.match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/view`;
    }
    return inputUrl;
  };

  const getDriveEmbedUrl = (inputUrl: string) => {
    const match = inputUrl.match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return "";
  };

  const handleTest = () => {
    setError(null);
    setLogs([]);
    addLog(`Iniciando teste com URL: ${url}`);
    
    let processedUrl = url.trim();
    
    // Se for apenas um ID do Drive, converter para nossa rota de proxy
    if (processedUrl.length > 20 && !processedUrl.includes('/') && !processedUrl.includes('.')) {
      processedUrl = `/api-v2/media-proxy/${processedUrl}?type=video`;
      addLog(`Identificado ID do Drive. Usando proxy: ${processedUrl}`);
    } else if (processedUrl.includes('drive.google.com')) {
      const match = processedUrl.match(/\/file\/d\/([^\/]+)/) || processedUrl.match(/id=([^\&]+)/);
      if (match && match[1]) {
        processedUrl = `/api-v2/media-proxy/${match[1]}?type=video`;
        addLog(`Link do Drive convertido para proxy: ${processedUrl}`);
      }
    }

    setCurrentUrl(processedUrl);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">
          Teste de <span className="text-[#ff5351]">Vídeo</span>
        </h1>
        <p className="text-zinc-500 font-medium">Ferramenta de diagnóstico para reprodução de mídia do Google Drive.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel de Controle */}
        <div className="space-y-6">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-[2rem] p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#ff5351]/10 rounded-lg">
                <LinkIcon className="w-5 h-5 text-[#ff5351]" />
              </div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">Configuração do Teste</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-2 block">Link ou ID do Google Drive</label>
                <input 
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Cole o ID do arquivo ou o link completo..."
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-[#ff5351] focus:ring-1 focus:ring-[#ff5351] transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={() => setPlayMethod('native')}
                  className={cn(
                    "p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                    playMethod === 'native' 
                      ? "bg-[#ff5351] border-[#ff5351] text-white shadow-lg shadow-[#ff5351]/20" 
                      : "bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  Nativo
                </button>
                <button 
                  onClick={() => setPlayMethod('react-player')}
                  className={cn(
                    "p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                    playMethod === 'react-player' 
                      ? "bg-[#ff5351] border-[#ff5351] text-white shadow-lg shadow-[#ff5351]/20" 
                      : "bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  React
                </button>
                <button 
                  onClick={() => setPlayMethod('drive-embed')}
                  className={cn(
                    "p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                    playMethod === 'drive-embed' 
                      ? "bg-[#ff5351] border-[#ff5351] text-white shadow-lg shadow-[#ff5351]/20" 
                      : "bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  )}
                >
                  Drive Embed
                </button>
              </div>

              <button 
                onClick={handleTest}
                className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-[#ff5351] hover:text-white transition-all flex items-center justify-center gap-2 group"
              >
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                Executar Teste
              </button>
            </div>
          </div>

          {/* Logs de Depuração */}
          <div className="bg-black border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4 flex items-center gap-2">
               <RotateCcw className="w-3 h-3" /> Console de Diagnóstico
            </h3>
            <div className="space-y-2 font-mono text-[10px]">
              {logs.length > 0 ? logs.map((log, i) => (
                <div key={i} className="text-zinc-400 border-l border-zinc-800 pl-3 py-1">
                  {log}
                </div>
              )) : (
                <p className="text-zinc-700 italic">Aguardando execução...</p>
              )}
            </div>
          </div>
        </div>

        {/* Preview do Vídeo */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden flex flex-col relative min-h-[400px]">
          <div className="absolute top-4 left-4 z-30 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/60">
              Método: {playMethod === 'native' ? 'Nativo (video tag)' : 'React Player'}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center bg-black">
            {currentUrl ? (
              <div className="w-full h-full relative flex items-center justify-center">
                {playMethod === 'native' ? (
                  <div className="w-full h-full relative group/player overflow-hidden">
                    <video 
                      key={`native-${currentUrl}`}
                      src={currentUrl}
                      controls
                      className="w-full h-full object-contain"
                      crossOrigin="anonymous"
                      onClick={(e) => {
                        const v = e.target as HTMLVideoElement;
                        if (v.paused) v.play();
                        else v.pause();
                      }}
                      onLoadStart={() => addLog("Evento: LoadStart")}
                      onLoadedMetadata={(e) => {
                        addLog("Evento: LoadedMetadata");
                        const video = e.target as HTMLVideoElement;
                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                          playPromise.catch(err => {
                            if (err.name !== 'AbortError') {
                              addLog(`Play bloqueado ou interrompido: ${err.message}`);
                            }
                          });
                        }
                      }}
                      onCanPlay={() => addLog("Evento: CanPlay - Sucesso!")}
                      onPlay={() => {
                        addLog("Evento: Play - Iniciado");
                        (document.activeElement as HTMLElement)?.blur();
                      }}
                      onError={(e) => {
                        const err = (e.target as HTMLVideoElement).error;
                        setError(`Código de erro HTML5: ${err?.code} - ${err?.message || 'Erro desconhecido'}`);
                        addLog(`ERRO: ${err?.message || 'Falha no player nativo'}`);
                      }}
                    />
                  </div>
                ) : playMethod === 'react-player' ? (
                  <Player
                    key={`react-${currentUrl}`}
                    url={currentUrl}
                    controls
                    playing
                    width="100%"
                    height="100%"
                    config={{ 
                      file: { 
                        attributes: { 
                          crossOrigin: 'anonymous',
                          style: { width: '100%', height: '100%', objectFit: 'contain' }
                        } 
                      } 
                    } as any}
                    onReady={() => addLog("ReactPlayer: Ready - Sucesso!")}
                    onStart={() => addLog("ReactPlayer: Start - Play ok")}
                    onError={(e: any) => {
                      setError(`ReactPlayer detectou um erro.`)
                      addLog(`ERRO ReactPlayer: ${e?.message || 'Erro genérico'}`);
                    }}
                  />
                ) : (
                  <div className="w-full max-w-[340px] aspect-[9/16] relative overflow-hidden mx-auto">
                    <iframe 
                      src={`${getDriveEmbedUrl(url)}?rm=minimal`}
                      className="absolute top-0 left-[-108%] w-[316%] h-full border-0 z-30"
                      allow="autoplay"
                      onLoad={() => addLog("Drive Iframe: Loaded (Modo Seguro)")}
                    />
                    {/* Visual Blocker Overlay */}
                    <div className="absolute top-4 right-4 z-40 bg-black/90 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-2xl">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-16 z-40 bg-transparent pointer-events-auto" />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-12 space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700 border border-white/5">
                  <Play className="w-8 h-8" />
                </div>
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Aguardando link para teste</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-6 bg-[#ff5351]/10 border-t border-[#ff5351]/20 space-y-4">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-[#ff5351] shrink-0" />
                <div>
                  <h4 className="text-[10px] font-black text-[#ff5351] uppercase tracking-widest mb-1">Falha detectada</h4>
                  <p className="text-xs text-[#ff5351]/80 leading-relaxed font-medium">{error}</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-[#ff5351] font-bold text-center bg-[#ff5351]/5 py-2 rounded-lg border border-[#ff5351]/10">
                   VÍDEOS PESADOS: Use o método "Drive Embed" no seletor acima para carregar via player seguro.
                </p>
              </div>
            </div>
          )}

          {!error && currentUrl && (
            <div className="p-6">
               <div className="flex items-start gap-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Player Configurado</h4>
                  <p className="text-xs text-emerald-500/80 leading-relaxed font-medium">Visualização segura ativa (Crop 9:16)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guia de Formatos */}
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-[2rem] p-10">
        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8 text-center">Guia de Solução de Problemas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <span className="text-[#ff5351] text-xs font-black px-3 py-1 bg-[#ff5351]/10 rounded-full border border-[#ff5351]/20 uppercase">01. Permissões</span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">O link deve estar configurado como <strong>"Qualquer pessoa com o link"</strong> no Google Drive. Verifique se não há restrições organizacionais.</p>
          </div>
          <div className="space-y-4">
            <span className="text-[#ff5351] text-xs font-black px-3 py-1 bg-[#ff5351]/10 rounded-full border border-[#ff5351]/20 uppercase">02. Formato Mov</span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">Vídeos gravados em iPhone (.MOV / HEVC) não rodam nativamente no <strong>Chrome para Windows</strong> ou Android sem transcodificação.</p>
          </div>
          <div className="space-y-4">
            <span className="text-[#ff5351] text-xs font-black px-3 py-1 bg-[#ff5351]/10 rounded-full border border-[#ff5351]/20 uppercase">03. Proxy de Mídia</span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">Nosso servidor de proxy tenta resolver problemas de CORS e autenticação, mas pode ser limitado por <strong>limites de API</strong> do Google se abusado.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
