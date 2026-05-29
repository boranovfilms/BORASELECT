import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, FlipHorizontal, Settings2, Trash2, 
  Smartphone, Laptop, MoveHorizontal, Type, Upload
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
  const [selectedMode, setSelectedMode] = useState<'prompter' | 'remote' | null>(null);
  const [state, setState] = useState<TeleprompterState>(DEFAULT_STATE);
  const [showControls, setShowGlobalControls] = useState(true);
  
  const prompterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const docRef = doc(db, 'config', 'teleprompter');

  // Load mode from session
  useEffect(() => {
    const savedMode = sessionStorage.getItem('tp_selected_mode');
    if (savedMode) setSelectedMode(savedMode as any);

    // Sync with Firestore in real-time
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as TeleprompterState;
        console.log('TELEPROMPTER_SYNC_READ:', data.texto?.substring(0, 20) + '...');
        setState(data);
        if (data.voltarInicio) {
          handleResetInternal();
          updateDoc(docRef, { voltarInicio: false });
        }
      } else {
        setDoc(docRef, DEFAULT_STATE);
      }
    });

    return () => unsubscribe();
  }, []);

  const selectMode = (mode: 'prompter' | 'remote') => {
    setSelectedMode(mode);
    sessionStorage.setItem('tp_selected_mode', mode);
  };

  const updateState = (updates: Partial<TeleprompterState>) => {
    if (updates.texto !== undefined) {
      console.log('TELEPROMPTER_SYNC_WRITE:', updates.texto.substring(0, 20) + '...');
    }
    updateDoc(docRef, updates).catch(err => {
      console.error("Firestore sync failed:", err);
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
      if (state.playing && prompterRef.current && selectedMode === 'prompter') {
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
  }, [state.playing, state.velocidade, selectedMode]);

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

  // 1. SELECTION SCREEN
  if (!selectedMode) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-8 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white uppercase italic tracking-widest">Selecione o Modo</h1>
          <p className="text-zinc-500 text-sm">Como você deseja usar o dispositivo agora?</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-6">
          <button onClick={() => selectMode('prompter')} className="group p-10 bg-[#141414] border-2 border-zinc-800 rounded-[40px] hover:border-[#ff5351] transition-all flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center group-hover:bg-[#ff5351]/10 transition-colors">
              <Tv className="w-10 h-10 text-zinc-500 group-hover:text-[#ff5351] transition-colors" />
            </div>
            <div className="text-center">
              <span className="block text-xl font-black text-white uppercase italic tracking-tighter">Modo Teleprompter</span>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 block">(Para o Tablet no espelho)</span>
            </div>
          </button>

          <button onClick={() => selectMode('remote')} className="group p-10 bg-[#141414] border-2 border-zinc-800 rounded-[40px] hover:border-[#ff5351] transition-all flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center group-hover:bg-[#ff5351]/10 transition-colors">
              <Smartphone className="w-10 h-10 text-zinc-500 group-hover:text-[#ff5351] transition-colors" />
            </div>
            <div className="text-center">
              <span className="block text-xl font-black text-white uppercase italic tracking-tighter">Modo Controle</span>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 block">(Para o Celular na mão)</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // 2. REMOTE CONTROL MODE
  if (selectedMode === 'remote') {
    return (
      <div className="animate-in fade-in duration-700 min-h-[85vh] flex flex-col gap-6 max-w-lg mx-auto p-4 relative">
        <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className="absolute -top-12 left-4 text-[10px] font-black text-zinc-500 uppercase hover:text-white transition-colors">← Trocar Modo</button>
        
        <header className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px] shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#ff5351]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase italic tracking-tight">Controle Remoto</h1>
              <span className="text-[10px] font-black uppercase text-emerald-500 animate-pulse tracking-widest">Nuvem Online</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 block ml-1">Roteiro sincronizado</label>
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
        </header>

        <div className="flex-1 grid grid-cols-2 gap-4 pb-10">
          <button onClick={() => updateState({ playing: !state.playing })} className={cn("col-span-2 h-32 rounded-[40px] flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-white", state.playing ? "bg-zinc-800 border-2 border-[#ff5351]/50" : "bg-[#ff5351]")}>
            {state.playing ? <Pause className="w-12 h-12 fill-current" /> : <Play className="w-12 h-12 fill-current ml-1" />}
            <span className="font-black uppercase tracking-[0.2em] text-xs">{state.playing ? 'Pausar' : 'Iniciar'}</span>
          </button>
          
          <button onClick={() => updateState({ velocidade: Math.max(state.velocidade - 1, 1) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronDown className="w-8 h-8" /><span className="font-black uppercase tracking-widest text-[9px]">Velocidade -</span>
          </button>
          <button onClick={() => updateState({ velocidade: Math.min(state.velocidade + 1, 20) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
            <ChevronUp className="w-8 h-8" /><span className="font-black uppercase tracking-widest text-[9px]">Velocidade +</span>
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
          <button onClick={() => updateState({ fonte: Math.min(state.fonte + 2, 72) })} className="h-28 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-400">
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

  // 3. TELEPROMPTER MODE
  return (
    <div ref={containerRef} className="animate-in fade-in duration-700 h-[calc(100vh-120px)] flex flex-col bg-black overflow-hidden relative" onClick={() => setShowGlobalControls(true)}>
      <header className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 p-2 bg-zinc-900/90 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl transition-all duration-500",
        !showControls && "opacity-0 -translate-y-20 pointer-events-none"
      )}>
        <button onClick={() => updateState({ playing: !state.playing })} className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all", state.playing ? "bg-zinc-800 text-[#ff5351]" : "bg-[#ff5351] text-white")}>
          {state.playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
        <div className="h-8 w-px bg-white/10 mx-1" />
        <div className="px-2 flex items-center gap-2">
          <span className="text-[10px] font-black text-white italic leading-none">{state.velocidade} Vel.</span>
          <span className="text-zinc-700 mx-1">•</span>
          <span className="text-[10px] font-black text-white italic leading-none">{state.fonte}px</span>
        </div>
        <div className="h-8 w-px bg-white/10 mx-1" />
        <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-all", state.espelhado ? "bg-[#ff5351] text-white" : "bg-zinc-800 text-zinc-400")}><FlipHorizontal className="w-4 h-4" /></button>
        <button onClick={toggleFullscreen} className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center transition-colors"><Maximize2 className="w-4 h-4" /></button>
        <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white flex items-center justify-center transition-all" title="Trocar Modo"><Laptop className="w-4 h-4" /></button>
        <button onClick={(e) => { e.stopPropagation(); setShowGlobalControls(false); }} className="w-8 h-8 rounded-lg bg-black/20 text-zinc-600 flex items-center justify-center hover:text-white ml-2 text-sm">×</button>
      </header>

      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div ref={prompterRef} className={cn("flex-1 overflow-y-auto py-[45vh] text-center select-none no-scrollbar transition-transform duration-700", state.espelhado && "scale-x-[-1]")} style={{ scrollBehavior: 'auto' }}>
          <div className="font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight mx-auto" style={{ fontSize: `${state.fonte}px`, color: '#fff', paddingLeft: `${state.margem}%`, paddingRight: `${state.margem}%` }}>
            {state.texto || 'O ROTEIRO APARECERÁ AQUI... SINCRONIZE PELO CELULAR.'}
          </div>
        </div>

        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[#ff5351]/40 pointer-events-none z-10" />
        <div className="absolute top-1/2 left-8 w-3 h-3 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_20px_#ff5351] z-10" />
        <div className="absolute top-1/2 right-8 w-3 h-3 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_20px_#ff5351] z-10" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black via-transparent to-black opacity-95 z-0" />
      </main>
    </div>
  );
}
