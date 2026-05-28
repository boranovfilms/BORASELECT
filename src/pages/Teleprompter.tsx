import React, { useState, useEffect, useRef } from 'react';
import { Tv, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Monitor, Maximize2, FlipHorizontal, Wifi, WifiOff, Settings2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function Teleprompter() {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [fontSize, setFontSize] = useState(48);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const prompterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket Logic
  useEffect(() => {
    const connect = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      console.log('Tentando conectar ao ESP32...');
      const ws = new WebSocket('ws://10.0.0.113:81');

      ws.onopen = () => {
        setIsConnected(true);
        toast.success('Conectado ao ESP32');
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        const command = event.data.trim();
        console.log('Comando ESP32:', command);
        handleCommand(command);
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Conexão fechada. Tentando reconectar...');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        ws.close();
      };

      socketRef.current = ws;
    };

    connect();

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const handleCommand = (command: string) => {
    switch (command) {
      case 'SPEED_UP':
        setSpeed(prev => Math.min(prev + 1, 20));
        toast.success('Velocidade +', { id: 'speed' });
        break;
      case 'SPEED_DOWN':
        setSpeed(prev => Math.max(prev - 1, 1));
        toast.success('Velocidade -', { id: 'speed' });
        break;
      case 'PLAY_PAUSE':
        setIsPlaying(prev => !prev);
        break;
      case 'RESET':
        handleReset();
        break;
    }
  };

  // Scroll Engine
  useEffect(() => {
    let rafId: number;
    const scroll = () => {
      if (isPlaying && prompterRef.current) {
        scrollPos.current += (speed / 10);
        
        // Se chegar no final, para
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
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="animate-in fade-in duration-700 h-[calc(100vh-120px)] flex flex-col gap-6">
      {/* Header / Toolbar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
            <Tv className="w-6 h-6 text-[#ff5351]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase italic tracking-tight">Teleprompter Master</h1>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                {isConnected ? '🟢 Conectado ao ESP32' : '🔴 Desconectado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMirrored(!isMirrored)} 
            className={cn(
              "px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2",
              isMirrored ? "bg-[#ff5351] border-[#ff5351] text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            <FlipHorizontal className="w-4 h-4" /> {isMirrored ? 'Espelhado' : 'Normal'}
          </button>
          <button 
            onClick={toggleFullscreen} 
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center gap-2"
          >
            <Maximize2 className="w-4 h-4" /> Tela Cheia
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Lado Esquerdo: Input e Controles */}
        <aside className="w-full lg:w-96 flex flex-col gap-6 shrink-0">
          <section className="flex-1 bg-[#141414] border border-zinc-800 rounded-[32px] p-6 flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#ff5351]" />
                <h3 className="text-white font-black uppercase tracking-widest text-[10px]">Roteiro / Script</h3>
              </div>
              <button onClick={() => setText('')} className="text-zinc-600 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)}
              placeholder="COLE SEU TEXTO AQUI..."
              className="flex-1 bg-black border border-zinc-800 rounded-2xl p-4 text-sm text-white resize-none outline-none focus:border-[#ff5351] font-medium leading-relaxed custom-scrollbar"
            />
          </section>

          <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-6 space-y-6 shadow-2xl">
             <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500">
                  <span>Velocidade de Rolagem</span>
                  <span className="text-[#ff5351]">{speed}</span>
                </div>
                <input type="range" min="1" max="20" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff5351]" />
             </div>
             <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500">
                  <span>Tamanho da Fonte</span>
                  <span className="text-[#ff5351]">{fontSize}px</span>
                </div>
                <input type="range" min="20" max="100" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff5351]" />
             </div>
          </section>
        </aside>

        {/* Lado Direito: O Teleprompter Real */}
        <main ref={containerRef} className="flex-1 bg-black border border-zinc-800 rounded-[40px] relative overflow-hidden flex flex-col shadow-inner group">
          <div 
            ref={prompterRef} 
            className={cn(
              "flex-1 overflow-y-auto px-12 py-[40vh] text-center select-none no-scrollbar",
              isMirrored && "transform -scale-x-100"
            )}
            style={{ scrollBehavior: 'auto' }}
          >
            <div 
              className="max-w-5xl mx-auto font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight" 
              style={{ fontSize: `${fontSize}px`, color: '#fff' }}
            >
              {text || 'DIGITE OU COLE SEU TEXTO NO CAMPO AO LADO PARA COMEÇAR...'}
            </div>
          </div>

          {/* HUD de Controle Flutuante */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#141414]/90 backdrop-blur-2xl border border-white/5 rounded-[32px] p-3 flex items-center gap-3 shadow-2xl z-20 opacity-40 group-hover:opacity-100 transition-opacity">
            <button onClick={handleReset} className="p-4 text-zinc-400 hover:text-white transition-all hover:bg-zinc-800 rounded-2xl" title="Reiniciar"><RotateCcw className="w-6 h-6" /></button>
            
            <div className="flex items-center gap-1 bg-black/40 rounded-2xl p-1">
              <button onClick={() => setSpeed(prev => Math.max(prev - 1, 1))} className="p-4 text-zinc-500 hover:text-[#ff5351] transition-all"><ChevronDown className="w-6 h-6" /></button>
              <div className="px-4 text-center border-x border-white/5">
                <span className="text-[8px] font-black text-zinc-600 uppercase block">Vel.</span>
                <span className="text-xl font-black text-white italic">{speed}</span>
              </div>
              <button onClick={() => setSpeed(prev => Math.min(prev + 1, 20))} className="p-4 text-zinc-500 hover:text-[#ff5351] transition-all"><ChevronUp className="w-6 h-6" /></button>
            </div>

            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-20 h-20 bg-[#ff5351] rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-[#ff5351]/20 hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
            </button>

            <div className="flex items-center gap-1 bg-black/40 rounded-2xl p-1">
              <button onClick={() => setFontSize(prev => Math.max(prev - 5, 20))} className="p-4 text-zinc-500 hover:text-white transition-all"><RotateCcw className="w-6 h-6 rotate-90" /></button>
              <div className="px-4 text-center border-x border-white/5">
                <span className="text-[8px] font-black text-zinc-600 uppercase block">Fonte</span>
                <span className="text-xl font-black text-white italic">{fontSize}</span>
              </div>
              <button onClick={() => setFontSize(prev => Math.min(prev + 5, 100))} className="p-4 text-zinc-500 hover:text-white transition-all"><RotateCcw className="w-6 h-6 -rotate-90" /></button>
            </div>
          </div>

          {/* Linha de Leitura Central */}
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[#ff5351]/30 pointer-events-none z-10" />
          <div className="absolute top-1/2 left-4 w-2 h-2 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_10px_#ff5351] z-10" />
          <div className="absolute top-1/2 right-4 w-2 h-2 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_10px_#ff5351] z-10" />
          
          {/* Sombra de Vinheta */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black opacity-60 z-0" />
        </main>
      </div>
    </div>
  );
}
