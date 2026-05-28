import React, { useState, useEffect, useRef } from 'react';
import { Tv, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, FlipHorizontal, Settings2, Trash2, Wifi, WifiOff, Loader2, Type, MoveHorizontal, Smartphone, Laptop } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function Teleprompter() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [fontSize, setFontSize] = useState(36);
  const [margin, setMargin] = useState(10);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeMode, setActiveMode] = useState<'MARGEM' | 'FONTE'>('MARGEM');
  const [viewMode, setViewMode] = useState<'prompter' | 'remote'>('prompter');
  
  const prompterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);

  // Manual WebSocket Connection with safety checks
  const connectToControl = () => {
    if (typeof window === 'undefined') return;
    
    try {
      if (!window.WebSocket) {
        toast.error('Navegador não suporta WebSocket');
        return;
      }

      setIsConnecting(true);
      const ws = new WebSocket('ws://10.0.0.113:81');

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        toast.success('Conectado ao ESP32');
      };

      ws.onmessage = (event) => {
        try {
          const command = event.data.toString().trim();
          handleCommand(command);
        } catch (msgErr) {
          console.error('Erro ao processar mensagem do socket:', msgErr);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onerror = (error) => {
        setIsConnected(false);
        setIsConnecting(false);
        toast.error('Erro na conexão com ESP32.');
        ws.close();
      };

      socketRef.current = ws;
    } catch (e: any) {
      setIsConnecting(false);
      toast.error('Erro ao abrir conexão.');
    }
  };

  const disconnectControl = () => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
      setIsConnected(false);
      toast.success('Controle desconectado');
    }
  };

  const sendCommand = (cmd: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(cmd);
    } else {
      toast.error('Controle não conectado ao servidor');
    }
  };

  const handleCommand = (command: string) => {
    switch (command) {
      case 'SPEED_UP':
        setSpeed(prev => Math.min(prev + 1, 20));
        break;
      case 'SPEED_DOWN':
        setSpeed(prev => Math.max(prev - 1, 1));
        break;
      case 'PLAY_PAUSE':
        setIsPlaying(prev => !prev);
        break;
      case 'RESET':
        handleReset();
        break;
      case 'MARGIN_LEFT':
        setMargin(prev => Math.max(prev - 2, 0));
        break;
      case 'MARGIN_RIGHT':
        setMargin(prev => Math.min(prev + 2, 40));
        break;
      case 'FONT_UP':
        setFontSize(prev => Math.min(prev + 2, 72));
        break;
      case 'FONT_DOWN':
        setFontSize(prev => Math.max(prev - 2, 20));
        break;
      case 'MODE_FONT':
        setActiveMode('FONTE');
        toast('Modo: Fonte', { icon: 'T', id: 'mode' });
        break;
      case 'MODE_MARGIN':
        setActiveMode('MARGEM');
        toast('Modo: Margem', { icon: '↔️', id: 'mode' });
        break;
    }
  };

  // Scroll Engine
  useEffect(() => {
    let rafId: number;
    const scroll = () => {
      if (isPlaying && prompterRef.current) {
        scrollPos.current += (speed / 10);
        if (scrollPos.current >= prompterRef.current.scrollHeight - prompterRef.current.clientHeight + 100) {
          setIsPlaying(false);
        }
        prompterRef.current.scrollTop = scrollPos.current;
      }
      rafId = requestAnimationFrame(scroll);
    };
    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speed]);

  const handleReset = () => {
    setIsPlaying(false);
    scrollPos.current = 0;
    if (prompterRef.current) prompterRef.current.scrollTop = 0;
    toast.success('Texto resetado');
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    } catch (e) {}
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
    };
  }, []);

  if (viewMode === 'remote') {
    return (
      <div className="animate-in fade-in duration-700 min-h-[80vh] flex flex-col gap-6">
        <header className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-[#ff5351]" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase italic tracking-tight">Controle Remoto</h1>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{isConnected ? '🟢 Online' : '🔴 Offline'}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <button onClick={connectToControl} disabled={isConnecting} className="px-4 py-3 bg-[#ff5351] text-white rounded-xl font-black text-[10px] uppercase transition-all shadow-lg">{isConnecting ? '...' : 'Conectar'}</button>
            ) : (
              <button onClick={disconnectControl} className="px-4 py-3 bg-zinc-800 text-zinc-400 rounded-xl font-black text-[10px] uppercase transition-all">Sair</button>
            )}
            <button onClick={() => setViewMode('prompter')} className="px-4 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl"><Laptop className="w-4 h-4" /> Tablet</button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-2 gap-4">
          <button onClick={() => sendCommand('PLAY_PAUSE')} className="col-span-2 h-32 bg-[#ff5351] rounded-[32px] flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-white">
            <Play className="w-10 h-10 fill-current" />
            <span className="font-black uppercase tracking-widest text-xs">Play / Pause</span>
          </button>
          
          <button onClick={() => sendCommand('SPEED_DOWN')} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronDown className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Velocidade -</span>
          </button>
          <button onClick={() => sendCommand('SPEED_UP')} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronUp className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Velocidade +</span>
          </button>

          <button onClick={() => sendCommand('MARGIN_LEFT')} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <MoveHorizontal className="w-8 h-8 rotate-90" />
            <span className="font-black uppercase tracking-widest text-[9px]">Margem -</span>
          </button>
          <button onClick={() => sendCommand('MARGIN_RIGHT')} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <MoveHorizontal className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Margem +</span>
          </button>

          <button onClick={() => sendCommand('FONT_DOWN')} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <Type className="w-8 h-8 scale-75" />
            <span className="font-black uppercase tracking-widest text-[9px]">Fonte Menor</span>
          </button>
          <button onClick={() => sendCommand('FONT_UP')} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <Type className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Fonte Maior</span>
          </button>

          <button onClick={() => sendCommand('RESET')} className="col-span-2 h-24 bg-zinc-800 border border-zinc-700 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-700 transition-all text-zinc-300">
            <RotateCcw className="w-6 h-6" />
            <span className="font-black uppercase tracking-widest text-[9px]">Voltar ao Início</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700 h-[calc(100vh-120px)] flex flex-col gap-4 md:gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800 p-4 md:p-6 rounded-3xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center shrink-0">
            <Tv className="w-6 h-6 md:w-8 md:h-8 text-[#ff5351]" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-black text-white uppercase italic tracking-tight leading-none">Teleprompter</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button onClick={() => setViewMode('remote')} className="hidden md:flex px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-all items-center gap-2"><Smartphone className="w-4 h-4" /> Controle Remoto</button>
          
          <button 
            onClick={isConnected ? disconnectControl : connectToControl}
            disabled={isConnecting}
            className={cn(
              "flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-3 shadow-xl",
              isConnected 
                ? "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-red-500/10 hover:text-red-500" 
                : "bg-[#ff5351] text-white hover:brightness-110 shadow-[#ff5351]/20"
            )}
          >
            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : isConnected ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            {isConnected ? 'Desconectar' : 'Conectar ao ESP32'}
          </button>
          
          <div className="flex gap-2 flex-1 md:flex-none">
            <button onClick={() => setIsMirrored(!isMirrored)} className={cn("flex-1 px-4 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2", isMirrored ? "bg-[#ff5351] border-[#ff5351] text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white")} title="Espelhar Texto"><FlipHorizontal className="w-4 h-4" /></button>
            <button onClick={toggleFullscreen} className={cn("flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2", !document.fullscreenEnabled && "hidden")}><Maximize2 className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <aside className="w-full lg:w-96 flex flex-col gap-6 shrink-0 h-1/2 lg:h-auto">
          <section className="flex-1 bg-[#141414] border border-zinc-800 rounded-[32px] p-6 flex flex-col space-y-4 shadow-2xl overflow-hidden min-h-[250px]">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#ff5351]" />
                <h3 className="text-white font-black uppercase tracking-widest text-[10px]">Roteiro / Script</h3>
              </div>
              <button onClick={() => setText('')} className="text-zinc-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="COLE SEU TEXTO AQUI..." className="flex-1 bg-black border border-zinc-800 rounded-2xl p-4 text-sm text-white resize-none outline-none focus:border-[#ff5351] font-medium leading-relaxed custom-scrollbar" />
          </section>

          <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-6 space-y-4 shadow-2xl shrink-0">
             <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500"><span>Velocidade</span><span className="text-[#ff5351]">{speed}</span></div>
                <input type="range" min="1" max="20" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff5351]" />
             </div>
             <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500"><span>Fonte</span><span className="text-[#ff5351]">{fontSize}px</span></div>
                <input type="range" min="20" max="72" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff5351]" />
             </div>
             <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500"><span>Margem</span><span className="text-[#ff5351]">{margin}%</span></div>
                <input type="range" min="0" max="40" value={margin} onChange={e => setMargin(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff5351]" />
             </div>
          </section>
        </aside>

        <main ref={containerRef} className="flex-1 bg-black border border-zinc-800 rounded-[32px] md:rounded-[40px] relative overflow-hidden flex flex-col shadow-inner min-h-[400px]">
          {/* Indicador de Modo Ativo */}
          <div className="absolute top-8 right-8 z-30 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3 px-6 py-3 bg-[#ff5351] rounded-2xl shadow-[0_0_20px_rgba(255,83,81,0.4)]">
              {activeMode === 'MARGEM' ? <MoveHorizontal className="w-4 h-4 text-white" /> : <Type className="w-4 h-4 text-white" />}
              <span className="text-xs font-black text-white uppercase tracking-[0.2em]">{activeMode}</span>
            </div>
          </div>

          <div ref={prompterRef} className={cn("flex-1 overflow-y-auto py-[45vh] text-center select-none no-scrollbar transition-transform duration-500", isMirrored && "scale-x-[-1]")} style={{ scrollBehavior: 'auto' }}>
            <div className="font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight mx-auto" style={{ fontSize: `${fontSize}px`, color: '#fff', paddingLeft: `${margin}%`, paddingRight: `${margin}%` }}>
              {text || 'INSIRA O TEXTO NO CAMPO AO LADO PARA COMEÇAR...'}
            </div>
          </div>

          <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 bg-[#141414]/95 backdrop-blur-2xl border border-white/5 rounded-[32px] p-3 flex items-center gap-3 shadow-2xl z-20 scale-90 md:scale-100">
            <button onClick={handleReset} className="p-4 text-zinc-400 hover:text-white transition-all hover:bg-zinc-800 rounded-2xl shrink-0"><RotateCcw className="w-6 h-6" /></button>
            <div className="flex items-center gap-1 bg-black/40 rounded-2xl p-1">
              <button onClick={() => setSpeed(prev => Math.max(prev - 1, 1))} className="p-4 text-zinc-500 hover:text-[#ff5351] transition-all"><ChevronDown className="w-6 h-6" /></button>
              <div className="px-4 text-center border-x border-white/5 min-w-[60px]"><span className="text-[8px] font-black text-zinc-600 uppercase block">Vel.</span><span className="text-xl font-black text-white italic">{speed}</span></div>
              <button onClick={() => setSpeed(prev => Math.min(prev + 1, 20))} className="p-4 text-zinc-500 hover:text-[#ff5351] transition-all"><ChevronUp className="w-6 h-6" /></button>
            </div>
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-20 h-20 bg-[#ff5351] rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-[#ff5351]/20 hover:scale-105 active:scale-95 transition-all">
              {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
            </button>
            <div className="flex items-center gap-1 bg-black/40 rounded-2xl p-1">
              <button onClick={() => setFontSize(prev => Math.max(prev - 2, 20))} className="p-4 text-zinc-500 hover:text-white transition-all font-black">-</button>
              <div className="px-4 text-center border-x border-white/5 min-w-[60px]"><span className="text-[8px] font-black text-zinc-600 uppercase block">Fonte</span><span className="text-xl font-black text-white italic">{fontSize}</span></div>
              <button onClick={() => setFontSize(prev => Math.min(prev + 2, 72))} className="p-4 text-zinc-500 hover:text-white transition-all font-black">+</button>
            </div>
          </div>

          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[#ff5351]/30 pointer-events-none z-10" />
          <div className="absolute top-1/2 left-4 w-2 h-2 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_10px_#ff5351] z-10" />
          <div className="absolute top-1/2 right-4 w-2 h-2 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_10px_#ff5351] z-10" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black opacity-60 z-0" />
        </main>
      </div>
    </div>
  );
}
