import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Play, Pause, RotateCcw, Maximize2, FlipHorizontal, Settings2, Trash2, 
  Smartphone, Laptop, MoveHorizontal, Type, Upload, X, Minus, Plus, FileText
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
  const [remoteTab, setRemoteTab] = useState<'control' | 'text'>('control');
  const [state, setState] = useState<TeleprompterState>(DEFAULT_STATE);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const prompterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const controlTimeout = useRef<any>(null);
  const docRef = doc(db, 'teleprompter', 'estado');

  useEffect(() => {
    const savedMode = sessionStorage.getItem('tp_selected_mode');
    if (savedMode) setSelectedMode(savedMode as any);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as TeleprompterState;
        setState(data);
        if (data.voltarInicio) {
          scrollPos.current = 0;
          if (prompterRef.current) prompterRef.current.scrollTop = 0;
          updateDoc(docRef, { voltarInicio: false });
        }
      } else {
        setDoc(docRef, DEFAULT_STATE);
      }
    });

    const handleFsChange = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    return () => {
      unsubscribe();
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    let rafId: number;
    const scroll = () => {
      if (state.playing && prompterRef.current && selectedMode === 'prompter') {
        scrollPos.current += (state.velocidade / 10);
        if (scrollPos.current >= prompterRef.current.scrollHeight - prompterRef.current.clientHeight + 100) {
          updateDoc(docRef, { playing: false });
        }
        prompterRef.current.scrollTop = scrollPos.current;
      }
      rafId = requestAnimationFrame(scroll);
    };
    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [state.playing, state.velocidade, selectedMode]);

  const updateState = (updates: Partial<TeleprompterState>) => {
    updateDoc(docRef, updates).catch(err => console.error(err));
  };

  const selectMode = (mode: 'prompter' | 'remote') => {
    setSelectedMode(mode);
    sessionStorage.setItem('tp_selected_mode', mode);
  };

  const toggleFullscreen = () => {
    const el = document.documentElement as any;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateState({ texto: ev.target?.result as string });
      toast.success('Sincronizado!');
    };
    reader.readAsText(file);
  };

  const handleScreenTouch = () => {
    if (selectedMode === 'prompter') {
      setShowControls(true);
      if (controlTimeout.current) clearTimeout(controlTimeout.current);
      if (isFullscreen) {
        controlTimeout.current = setTimeout(() => setShowControls(false), 4000);
      }
    }
  };

  const calculateMargin = (val: number) => (val / 40) * 30;

  if (!selectedMode) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-10 p-6 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Boranov TP</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Escolha o modo de operação</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button onClick={() => selectMode('prompter')} className="p-10 bg-[#141414] border-2 border-zinc-800 rounded-[40px] hover:border-[#ff5351] transition-all flex flex-col items-center gap-4 group">
            <Tv className="w-12 h-12 text-zinc-600 group-hover:text-[#ff5351] transition-colors" />
            <span className="text-lg font-black text-white uppercase italic">Modo Teleprompter</span>
          </button>
          <button onClick={() => selectMode('remote')} className="p-10 bg-[#141414] border-2 border-zinc-800 rounded-[40px] hover:border-[#ff5351] transition-all flex flex-col items-center gap-4 group">
            <Smartphone className="w-12 h-12 text-zinc-600 group-hover:text-[#ff5351] transition-colors" />
            <span className="text-lg font-black text-white uppercase italic">Modo Controle</span>
          </button>
        </div>
      </div>
    );
  }

  if (selectedMode === 'remote') {
    return (
      <div className="min-h-[85vh] flex flex-col gap-6 max-w-lg mx-auto p-4 text-left animate-in fade-in duration-500">
        <header className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px] flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#ff5351]/10 flex items-center justify-center"><Tv className="w-5 h-5 text-[#ff5351]" /></div>
            <div><h2 className="text-white font-black uppercase italic leading-none">Boranov TP</h2><span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Sincronizado</span></div>
          </div>
          <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Trocar Modo"><RotateCcw className="w-4 h-4" /></button>
        </header>

        <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
          <button onClick={() => setRemoteTab('control')} className={cn("flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all", remoteTab === 'control' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>Painel</button>
          <button onClick={() => setRemoteTab('text')} className={cn("flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all", remoteTab === 'text' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>Roteiro</button>
        </div>

        {remoteTab === 'control' ? (
          <div className="space-y-6">
            <button onClick={() => updateState({ playing: !state.playing })} className={cn("w-full h-28 rounded-[32px] flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-white", state.playing ? "bg-zinc-800 border-2 border-[#ff5351]" : "bg-[#ff5351]")}>
              {state.playing ? <Pause className="w-10 h-10 fill-current text-white" /> : <Play className="w-10 h-10 fill-current ml-1 text-white" />}
              <span className="font-black uppercase text-xs tracking-widest">{state.playing ? 'Pausar' : 'Iniciar'}</span>
            </button>

            {[
              { id: 'velocidade', label: 'Velocidade', min: 1, max: 20, value: state.velocidade },
              { id: 'margem', label: 'Margem', min: 0, max: 40, value: state.margem },
              { id: 'fonte', label: 'Fonte', min: 20, max: 72, value: state.fonte }
            ].map(ctrl => (
              <div key={ctrl.id} className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px]">
                <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{ctrl.label}</span><span className="text-xs font-black text-white italic">{ctrl.value}</span></div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateState({ [ctrl.id]: Math.max(ctrl.min, ctrl.value - 1) })} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white active:bg-[#ff5351] transition-all"><Minus className="w-4 h-4" /></button>
                  <input type="range" min={ctrl.min} max={ctrl.max} step="1" value={ctrl.value} onChange={e => updateState({ [ctrl.id]: Number(e.target.value) })} className="flex-1 h-1 rounded-full accent-[#ff5351] bg-zinc-800" />
                  <button onClick={() => updateState({ [ctrl.id]: Math.min(ctrl.max, ctrl.value + 1) })} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white active:bg-[#ff5351] transition-all"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => updateState({ voltarInicio: true })} className="h-20 bg-zinc-900 border border-zinc-800 rounded-[24px] flex flex-col items-center justify-center gap-1 text-zinc-400 active:bg-zinc-800 transition-all"><RotateCcw className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Reiniciar</span></button>
              <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("h-20 border rounded-[24px] flex flex-col items-center justify-center gap-1 transition-all", state.espelhado ? "bg-[#ff5351] border-[#ff5351] text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400")}><FlipHorizontal className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Espelhar</span></button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <textarea value={state.texto} onChange={e => updateState({ texto: e.target.value })} placeholder="DIGITE OU COLE O ROTEIRO..." className="flex-1 min-h-[350px] bg-black border border-zinc-800 rounded-[32px] p-6 text-sm text-white resize-none outline-none focus:border-[#ff5351] leading-relaxed custom-scrollbar" />
            <div className="grid grid-cols-2 gap-3 pb-8">
              <label className="flex-1 py-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center gap-2 cursor-pointer text-white font-black uppercase text-[10px] hover:bg-zinc-800 transition-all"><Upload className="w-4 h-4 text-[#ff5351]" /> Arquivo .TXT<input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" /></label>
              <button onClick={() => { if(window.confirm('Limpar texto?')) updateState({ texto: '' }); }} className="py-5 bg-zinc-800/50 rounded-2xl flex items-center justify-center gap-2 text-zinc-500 font-black uppercase text-[10px] hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /> Limpar Texto</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden select-none" onClick={handleScreenTouch}>
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div ref={prompterRef} className={cn("flex-1 overflow-y-auto py-[50vh] text-center no-scrollbar transition-all duration-700", state.espelhado && "scale-x-[-1]")} style={{ scrollBehavior: 'auto' }}>
          <div 
            className="font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight mx-auto" 
            style={{ 
              fontSize: `${state.fonte}px`, 
              color: '#fff', 
              paddingLeft: `${calculateMargin(state.margem)}%`, 
              paddingRight: `${calculateMargin(state.margem)}%` 
            }}
          >
            {state.texto || 'O ROTEIRO SINCRONIZADO APARECERÁ AQUI...'}
          </div>
        </div>

        {/* Linha Guia e Bolinhas */}
        <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-[#ff5351]/40 pointer-events-none z-10" />
        <div className="absolute top-1/2 w-4 h-4 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-20 transition-all duration-300" style={{ left: `calc(${calculateMargin(state.margem)}% - 8px)` }} />
        <div className="absolute top-1/2 w-4 h-4 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-20 transition-all duration-300" style={{ right: `calc(${calculateMargin(state.margem)}% - 8px)` }} />
        
        {/* Sombra de Vinheta */}
        <div className="absolute top-0 left-0 right-0 h-[35vh] bg-gradient-to-b from-black via-black/80 to-transparent z-0 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-[35vh] bg-gradient-to-t from-black via-black/80 to-transparent z-0 pointer-events-none" />
      </main>

      {/* Menu de Controle Inferior */}
      <div className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] w-[95%] max-w-5xl bg-zinc-900/95 backdrop-blur-3xl border border-white/5 rounded-[40px] p-4 flex items-center gap-6 shadow-2xl transition-all duration-700",
        !showControls && "opacity-0 translate-y-32"
      )}>
        <div className="pl-4 pr-6 border-r border-white/10 shrink-0 text-left">
          <p className="text-[8px] font-black text-[#ff5351] uppercase tracking-[0.3em] mb-1">Boranov</p>
          <h2 className="text-lg font-black text-white uppercase italic leading-none">TP Master</h2>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-6 text-left">
          {[
            { id: 'velocidade', min: 1, max: 20, value: state.velocidade },
            { id: 'margem', min: 0, max: 40, value: state.margem },
            { id: 'fonte', min: 20, max: 72, value: state.fonte }
          ].map(ctrl => (
            <div key={ctrl.id} className="flex flex-col gap-1.5 items-start">
              <span className="text-[8px] font-black text-zinc-500 uppercase ml-1">{ctrl.id} ({ctrl.value})</span>
              <input type="range" min={ctrl.min} max={ctrl.max} value={ctrl.value} onChange={e => updateState({ [ctrl.id]: Number(e.target.value) })} className="w-full h-1.5 rounded-full accent-[#ff5351] bg-zinc-800 cursor-pointer" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pr-2">
          <button onClick={() => updateState({ voltarInicio: true })} className="p-4 bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl transition-all" title="Reiniciar"><RotateCcw className="w-5 h-5" /></button>
          <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("p-4 rounded-2xl transition-all", state.espelhado ? "bg-[#ff5351] text-white" : "bg-zinc-800 text-zinc-400")} title="Espelhar"><FlipHorizontal className="w-5 h-5" /></button>
          <button onClick={() => updateState({ playing: !state.playing })} className="w-20 h-20 bg-[#ff5351] rounded-3xl flex items-center justify-center text-white shadow-xl shadow-[#ff5351]/30 hover:scale-105 active:scale-95 transition-all text-left">
            {state.playing ? <Pause className="w-8 h-8 fill-current text-white" /> : <Play className="w-8 h-8 fill-current ml-1 text-white" />}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={toggleFullscreen} className="p-4 bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl transition-all">{isFullscreen ? <X className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
            <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className="p-4 bg-zinc-800 text-zinc-600 hover:text-white rounded-2xl transition-all" title="Trocar Modo"><Laptop className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
