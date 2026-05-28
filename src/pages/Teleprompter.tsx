import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, FlipHorizontal, Settings2, Trash2, 
  Smartphone, Laptop, MoveHorizontal, Type, Activity, Upload, FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

interface TeleprompterState {
  texto: string;
  playing: boolean;
  velocidade: number;
  margem: number;
  fonte: number;
  espelhado: boolean;
  voltarInicio: boolean;
}

const DEFAULT_STATE: TeleprompterState = {
  texto: '',
  playing: false,
  velocidade: 3,
  margem: 10,
  fonte: 36,
  espelhado: false,
  voltarInicio: false
};

export default function Teleprompter() {
  const [state, setState] = useState<TeleprompterState>(DEFAULT_STATE);
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowGlobalControls] = useState(true);
  
  const prompterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const docRef = doc(db, 'config', 'teleprompter');

  // Detect device and sync with Firestore
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as TeleprompterState;
        setState(data);
        if (data.voltarInicio) {
          handleResetInternal();
          updateDoc(docRef, { voltarInicio: false });
        }
      } else {
        setDoc(docRef, DEFAULT_STATE);
      }
    }, (error) => {
      console.error("Firestore sync error:", error);
    });

    return () => {
      window.removeEventListener('resize', checkMobile);
      unsubscribe();
    };
  }, []);

  const updateState = (updates: Partial<TeleprompterState>) => {
    updateDoc(docRef, updates).catch(err => {
      console.error("Update error:", err);
      toast.error("Erro ao sincronizar comandos");
    });
  };

  const handleResetInternal = () => {
    scrollPos.current = 0;
    if (prompterRef.current) prompterRef.current.scrollTop = 0;
  };

  // Scroll Engine
  useEffect(() => {
    let rafId: number;
    const scroll = () => {
      if (state.playing && prompterRef.current) {
        scrollPos.current += (state.velocidade / 10);
        if (scrollPos.current >= prompterRef.current.scrollHeight - prompterRef.current.clientHeight + 100) {
          updateState({ playing: false });
        }
        prompterRef.current.scrollTop = scrollPos.current;
      }
      rafId = requestAnimationFrame(scroll);
    };
    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [state.playing, state.velocidade]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
        setShowGlobalControls(false);
      } else {
        document.exitFullscreen();
        setShowGlobalControls(true);
      }
    } catch (e) {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      updateState({ texto: content });
      toast.success('Roteiro sincronizado!');
    };
    reader.readAsText(file);
  };

  // REMOTE CONTROL INTERFACE (MOBILE)
  if (isMobile) {
    return (
      <div className="animate-in fade-in duration-700 min-h-[85vh] flex flex-col gap-6 max-w-lg mx-auto p-4">
        <header className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px] shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#ff5351]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase italic tracking-tight">Controle Remoto</h1>
              <span className="text-[10px] font-black uppercase text-emerald-500 animate-pulse tracking-widest flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sincronizado
              </span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 block ml-1">Roteiro em tempo real</label>
              <div className="flex gap-2">
                <textarea 
                  value={state.texto} 
                  onChange={e => updateState({ texto: e.target.value })}
                  placeholder="DIGITE OU COLE O TEXTO..."
                  className="flex-1 bg-black border border-zinc-800 rounded-2xl p-4 text-xs text-white resize-none h-24 outline-none focus:border-[#ff5351]"
                />
                <label className="w-12 h-24 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-zinc-800 transition-all text-zinc-500">
                  <Upload className="w-4 h-4" />
                  <span className="text-[7px] font-black uppercase">TXT</span>
                  <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-2 gap-4 pb-10">
          <button onClick={() => updateState({ playing: !state.playing })} className={cn("col-span-2 h-32 rounded-[40px] flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-white", state.playing ? "bg-zinc-800 border-2 border-[#ff5351]/50" : "bg-[#ff5351]")}>
            {state.playing ? <Pause className="w-12 h-12 fill-current" /> : <Play className="w-12 h-12 fill-current ml-1" />}
            <span className="font-black uppercase tracking-[0.2em] text-xs">{state.playing ? 'Pausar' : 'Iniciar'}</span>
          </button>
          
          <button onClick={() => updateState({ velocidade: Math.max(state.velocidade - 1, 1) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronDown className="w-8 h-8" /><span className="font-black uppercase tracking-widest text-[9px]">Devagar</span>
          </button>
          <button onClick={() => updateState({ velocidade: Math.min(state.velocidade + 1, 20) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronUp className="w-8 h-8" /><span className="font-black uppercase tracking-widest text-[9px]">Rápido</span>
          </button>

          <button onClick={() => updateState({ margem: Math.max(state.margem - 2, 0) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <MoveHorizontal className="w-8 h-8 rotate-90" /><span className="font-black uppercase tracking-widest text-[9px]">Margem -</span>
          </button>
          <button onClick={() => updateState({ margem: Math.min(state.margem + 2, 40) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <MoveHorizontal className="w-8 h-8" /><span className="font-black uppercase tracking-widest text-[9px]">Margem +</span>
          </button>

          <button onClick={() => updateState({ fonte: Math.max(state.fonte - 2, 20) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <Type className="w-8 h-8 scale-75" /><span className="font-black uppercase tracking-widest text-[9px]">Fonte -</span>
          </button>
          <button onClick={() => updateState({ fonte: Math.min(state.fonte + 2, 80) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <Type className="w-8 h-8" /><span className="font-black uppercase tracking-widest text-[9px]">Fonte +</span>
          </button>

          <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("h-24 rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all", state.espelhado ? "bg-[#ff5351] text-white" : "bg-zinc-800 text-zinc-400")}>
            <FlipHorizontal className="w-6 h-6" /><span className="font-black uppercase tracking-widest text-[9px]">Espelhar</span>
          </button>
          <button onClick={() => updateState({ voltarInicio: true })} className="h-24 bg-zinc-800 border border-zinc-700 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-700 transition-all text-zinc-300">
            <RotateCcw className="w-6 h-6" /><span className="font-black uppercase tracking-widest text-[9px]">Reiniciar</span>
          </button>
        </div>
      </div>
    );
  }

  // TABLET / DESKTOP INTERFACE (TELEPROMPTER)
  return (
    <div ref={containerRef} className="animate-in fade-in duration-700 h-[calc(100vh-120px)] flex flex-col bg-black overflow-hidden relative" onClick={() => setShowGlobalControls(true)}>
      {/* Menu Superior Compacto */}
      <header className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 p-2 bg-zinc-900/90 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl transition-all duration-500",
        !showControls && "opacity-0 -translate-y-20 pointer-events-none"
      )}>
        <button onClick={() => updateState({ playing: !state.playing })} className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all", state.playing ? "bg-zinc-800 text-[#ff5351]" : "bg-[#ff5351] text-white")}>
          {state.playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
        <div className="h-8 w-px bg-white/10 mx-1" />
        <button onClick={() => updateState({ velocidade: Math.max(state.velocidade - 1, 1) })} className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors text-xs">🐢</button>
        <div className="px-2 text-center min-w-[30px]"><span className="text-[14px] font-black text-white italic leading-none">{state.velocidade}</span></div>
        <button onClick={() => updateState({ velocidade: Math.min(state.velocidade + 1, 20) })} className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors text-xs">🐇</button>
        <div className="h-8 w-px bg-white/10 mx-1" />
        <button onClick={() => updateState({ margem: Math.max(state.margem - 2, 0) })} className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"><MoveHorizontal className="w-4 h-4 rotate-90" /></button>
        <button onClick={() => updateState({ margem: Math.min(state.margem + 2, 40) })} className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"><MoveHorizontal className="w-4 h-4" /></button>
        <div className="h-8 w-px bg-white/10 mx-1" />
        <button onClick={() => updateState({ fonte: Math.max(state.fonte - 2, 20) })} className="w-10 h-10 rounded-lg bg-zinc-900 text-zinc-400 flex items-center justify-center transition-colors font-black text-[10px]">A-</button>
        <button onClick={() => updateState({ fonte: Math.min(state.fonte + 2, 72) })} className="w-10 h-10 rounded-lg bg-zinc-900 text-zinc-400 flex items-center justify-center transition-colors font-black text-[10px]">A+</button>
        <div className="h-8 w-px bg-white/10 mx-1" />
        <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-all", state.espelhado ? "bg-[#ff5351] text-white" : "bg-zinc-800 text-zinc-400")}><FlipHorizontal className="w-4 h-4" /></button>
        <button onClick={toggleFullscreen} className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center transition-colors"><Maximize2 className="w-4 h-4" /></button>
        <button onClick={(e) => { e.stopPropagation(); setShowGlobalControls(false); }} className="w-8 h-8 rounded-lg bg-black/20 text-zinc-600 flex items-center justify-center hover:text-white ml-2 text-sm">×</button>
      </header>

      {/* Área do Teleprompter */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div ref={prompterRef} className={cn("flex-1 overflow-y-auto py-[45vh] text-center select-none no-scrollbar transition-transform duration-700", state.espelhado && "scale-x-[-1]")} style={{ scrollBehavior: 'auto' }}>
          <div className="font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight mx-auto" style={{ fontSize: `${state.fonte}px`, color: '#fff', paddingLeft: `${state.margem}%`, paddingRight: `${state.margem}%` }}>
            {state.texto || 'O ROTEIRO APARECERÁ AQUI... SINCRONIZE PELO CELULAR.'}
          </div>
        </div>

        {/* Linha de Leitura Central */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[#ff5351]/40 pointer-events-none z-10" />
        <div className="absolute top-1/2 left-8 w-3 h-3 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_20px_#ff5351] z-10" />
        <div className="absolute top-1/2 right-8 w-3 h-3 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_20px_#ff5351] z-10" />
        
        {/* Sombra de Vinheta */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black opacity-90 z-0" />
      </main>
    </div>
  );
}
