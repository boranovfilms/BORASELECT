import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, FlipHorizontal, Settings2, Trash2, 
  Smartphone, Laptop, MoveHorizontal, Type, Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { rtdb } from '../lib/firebase';
import { ref, onValue, set, update } from 'firebase/database';

interface TeleprompterState {
  playing: boolean;
  velocidade: number;
  margem: number;
  fonte: number;
  espelhado: boolean;
  voltarInicio: boolean;
}

const DEFAULT_STATE: TeleprompterState = {
  playing: false,
  velocidade: 3,
  margem: 10,
  fonte: 36,
  espelhado: false,
  voltarInicio: false
};

export default function Teleprompter() {
  const [text, setText] = useState('');
  const [state, setState] = useState<TeleprompterState>(DEFAULT_STATE);
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'prompter' | 'remote'>('prompter');
  
  const prompterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const dbRef = ref(rtdb, 'teleprompter');

  // Detect mobile and load saved text
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const savedText = localStorage.getItem('tp_text');
    if (savedText) setText(savedText);

    // Sync with Firebase RTDB
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setState(data);
        if (data.voltarInicio) {
          handleResetInternal();
          update(dbRef, { voltarInicio: false });
        }
      } else {
        // Initialize DB if empty
        set(dbRef, DEFAULT_STATE);
      }
    });

    return () => {
      window.removeEventListener('resize', checkMobile);
      unsubscribe();
    };
  }, []);

  // Remote Control Sync Actions
  const updateDB = (updates: Partial<TeleprompterState>) => {
    update(dbRef, updates);
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
          updateDB({ playing: false });
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
      if (!document.fullscreenElement) containerRef.current.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) {}
  };

  // REMOTE CONTROL INTERFACE (MOBILE)
  if (isMobile || viewMode === 'remote') {
    return (
      <div className="animate-in fade-in duration-700 min-h-[85vh] flex flex-col gap-6 max-w-lg mx-auto">
        <header className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 p-5 rounded-[32px] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-[#ff5351]" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white uppercase italic tracking-tight">Controle</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest text-emerald-500">Online</span>
              </div>
            </div>
          </div>
          <button onClick={() => setViewMode('prompter')} className="px-5 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl hover:bg-[#ff5351] hover:text-white transition-all"><Laptop className="w-4 h-4" /> Teleprompter</button>
        </header>

        <div className="flex-1 grid grid-cols-2 gap-4 pb-10">
          <button 
            onClick={() => updateDB({ playing: !state.playing })} 
            className={cn(
              "col-span-2 h-32 rounded-[40px] flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-white",
              state.playing ? "bg-zinc-800 border-2 border-[#ff5351]/50" : "bg-[#ff5351]"
            )}
          >
            {state.playing ? <Pause className="w-12 h-12 fill-current" /> : <Play className="w-12 h-12 fill-current ml-1" />}
            <span className="font-black uppercase tracking-[0.2em] text-xs">{state.playing ? 'Pausar' : 'Iniciar'}</span>
          </button>
          
          <button onClick={() => updateDB({ velocidade: Math.max(state.velocidade - 1, 1) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronDown className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Devagar</span>
          </button>
          <button onClick={() => updateDB({ velocidade: Math.min(state.velocidade + 1, 20) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronUp className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Rápido</span>
          </button>

          <button onClick={() => updateDB({ margem: Math.max(state.margem - 2, 0) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <MoveHorizontal className="w-8 h-8 rotate-90" />
            <span className="font-black uppercase tracking-widest text-[9px]">Margem -</span>
          </button>
          <button onClick={() => updateDB({ margem: Math.min(state.margem + 2, 40) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <MoveHorizontal className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Margem +</span>
          </button>

          <button onClick={() => updateDB({ fonte: Math.max(state.fonte - 2, 20) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <Type className="w-8 h-8 scale-75" />
            <span className="font-black uppercase tracking-widest text-[9px]">Fonte -</span>
          </button>
          <button onClick={() => updateDB({ fonte: Math.min(state.fonte + 2, 80) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <Type className="w-8 h-8" />
            <span className="font-black uppercase tracking-widest text-[9px]">Fonte +</span>
          </button>

          <button onClick={() => updateDB({ espelhado: !state.espelhado })} className={cn("h-24 rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all", state.espelhado ? "bg-[#ff5351] text-white" : "bg-zinc-800 text-zinc-400")}>
            <FlipHorizontal className="w-6 h-6" />
            <span className="font-black uppercase tracking-widest text-[9px]">Espelhar</span>
          </button>
          <button onClick={() => updateDB({ voltarInicio: true })} className="h-24 bg-zinc-800 border border-zinc-700 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-700 transition-all text-zinc-300">
            <RotateCcw className="w-6 h-6" />
            <span className="font-black uppercase tracking-widest text-[9px]">Reiniciar</span>
          </button>
        </div>
      </div>
    );
  }

  // TABLET / DESKTOP INTERFACE (TELEPROMPTER)
  return (
    <div className="animate-in fade-in duration-700 h-[calc(100vh-120px)] flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800 p-4 md:p-6 rounded-[32px] shrink-0 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center shrink-0">
            <Tv className="w-6 h-6 md:w-8 md:h-8 text-[#ff5351]" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-black text-white uppercase italic tracking-tight leading-none">Teleprompter</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sincronizado via Nuvem</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setViewMode('remote')} className="hidden lg:flex px-5 py-3 bg-zinc-800 border border-zinc-700 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-all items-center gap-2 shadow-lg"><Smartphone className="w-4 h-4" /> Modo Controle</button>
          <button onClick={toggleFullscreen} className="px-5 py-3 bg-zinc-800 border border-zinc-700 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg"><Maximize2 className="w-4 h-4" /> Tela Cheia</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <aside className="w-full lg:w-96 flex flex-col gap-6 shrink-0 h-1/2 lg:h-auto">
          <section className="flex-1 bg-[#141414] border border-zinc-800 rounded-[40px] p-8 flex flex-col space-y-4 shadow-2xl overflow-hidden min-h-[300px]">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#ff5351]" />
                <h3 className="text-white font-black uppercase tracking-widest text-[10px]">Roteiro / Script</h3>
              </div>
              <button onClick={() => { setText(''); localStorage.removeItem('tp_text'); }} className="text-zinc-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
            <textarea 
              value={text} 
              onChange={e => { setText(e.target.value); localStorage.setItem('tp_text', e.target.value); }} 
              placeholder="COLE SEU TEXTO AQUI..." 
              className="flex-1 bg-black border border-zinc-800 rounded-2xl p-5 text-sm text-white resize-none outline-none focus:border-[#ff5351] font-medium leading-relaxed custom-scrollbar" 
            />
          </section>

          <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-6 space-y-6 shadow-2xl shrink-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black/40 rounded-2xl border border-zinc-800/50 text-center">
                <span className="text-[8px] font-black text-zinc-600 uppercase block mb-1">Velocidade</span>
                <span className="text-2xl font-black text-white italic">{state.velocidade}</span>
              </div>
              <div className="p-4 bg-black/40 rounded-2xl border border-zinc-800/50 text-center">
                <span className="text-[8px] font-black text-zinc-600 uppercase block mb-1">Margem</span>
                <span className="text-2xl font-black text-white italic">{state.margem}%</span>
              </div>
            </div>
          </section>
        </aside>

        <main ref={containerRef} className="flex-1 bg-black border border-zinc-800 rounded-[40px] relative overflow-hidden flex flex-col shadow-inner min-h-[400px]">
          <div 
            ref={prompterRef} 
            className={cn(
              "flex-1 overflow-y-auto py-[45vh] text-center select-none no-scrollbar transition-transform duration-700", 
              state.espelhado && "scale-x-[-1]"
            )} 
            style={{ scrollBehavior: 'auto' }}
          >
            <div 
              className="max-w-5xl mx-auto font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight" 
              style={{ 
                fontSize: `${state.fonte}px`, 
                color: '#fff', 
                paddingLeft: `${state.margem}%`, 
                paddingRight: `${state.margem}%` 
              }}
            >
              {text || 'INSIRA O TEXTO NO CAMPO AO LADO PARA COMEÇAR...'}
            </div>
          </div>

          {/* Local HUD Controls */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#141414]/95 backdrop-blur-2xl border border-white/5 rounded-[32px] p-3 flex items-center gap-4 shadow-2xl z-20 scale-90 md:scale-100">
            <button onClick={() => updateDB({ voltarInicio: true })} className="p-4 text-zinc-400 hover:text-white transition-all hover:bg-zinc-800 rounded-2xl shrink-0"><RotateCcw className="w-6 h-6" /></button>
            <button 
              onClick={() => updateDB({ playing: !state.playing })} 
              className="w-20 h-20 bg-[#ff5351] rounded-[28px] flex items-center justify-center text-white shadow-xl shadow-[#ff5351]/20 hover:scale-105 active:scale-95 transition-all"
            >
              {state.playing ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
            </button>
            <div className="px-6 flex items-center gap-3 border-l border-white/5">
               <div className="text-center">
                  <span className="text-[8px] font-black text-zinc-600 uppercase block">Fonte</span>
                  <span className="text-xl font-black text-white italic">{state.fonte}</span>
               </div>
            </div>
          </div>

          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[#ff5351]/30 pointer-events-none z-10" />
          <div className="absolute top-1/2 left-6 w-2.5 h-2.5 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-10" />
          <div className="absolute top-1/2 right-6 w-2.5 h-2.5 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-10" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black opacity-80 z-0" />
        </main>
      </div>
    </div>
  );
}
