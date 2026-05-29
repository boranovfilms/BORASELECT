import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, FlipHorizontal, Settings2, Trash2, 
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
  posicao: number;
}

const DEFAULT_STATE: TeleprompterState = {
  texto: '',
  playing: false,
  velocidade: 3,
  margem: 10,
  fonte: 36,
  espelhado: false,
  voltarInicio: false,
  posicao: 0
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
  const docRef = doc(db, 'config', 'teleprompter');
  const debounceTimer = useRef<any>(null);

  // Load mode and sync
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    const savedMode = sessionStorage.getItem('tp_selected_mode');
    if (savedMode) setSelectedMode(savedMode as any);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as TeleprompterState;
        
        // Sincronização de posição sem interromper o play
        if (data.posicao !== undefined && prompterRef.current && selectedMode === 'prompter') {
          const maxScroll = prompterRef.current.scrollHeight - prompterRef.current.clientHeight;
          const targetScroll = (data.posicao / 100) * maxScroll;
          
          // Se não estivermos dando play localmente, ou se for um salto grande via controle remoto
          if (Math.abs(scrollPos.current - targetScroll) > 30) {
            scrollPos.current = targetScroll;
            prompterRef.current.scrollTop = targetScroll;
          }
        }

        setState(data);
        if (data.voltarInicio) {
          scrollPos.current = 0;
          if (prompterRef.current) prompterRef.current.scrollTop = 0;
          updateDoc(docRef, { voltarInicio: false, posicao: 0 });
        }
      } else {
        setDoc(docRef, DEFAULT_STATE);
      }
    });

    const handleFsChange = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    return () => {
      document.body.style.overflowX = 'auto';
      unsubscribe();
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [selectedMode]);

  // Scroll Engine
  useEffect(() => {
    let rafId: number;
    const scroll = () => {
      if (state.playing && prompterRef.current && selectedMode === 'prompter') {
        scrollPos.current += (state.velocidade / 10);
        const maxScroll = prompterRef.current.scrollHeight - prompterRef.current.clientHeight;
        
        if (scrollPos.current >= maxScroll + 100) {
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

  const updatePosicaoDebounced = (val: number) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      updateDoc(docRef, { posicao: val });
    }, 150);
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

  const calculateMargin = (val: number) => (val / 40) * 30;

  const handleScreenTouch = () => {
    if (selectedMode === 'prompter') {
      setShowControls(true);
      if (controlTimeout.current) clearTimeout(controlTimeout.current);
      if (isFullscreen) {
        controlTimeout.current = setTimeout(() => setShowControls(false), 4000);
      }
    }
  };

  const PillSlider = ({ label, value, min, max, onChange, icon: Icon, subLabels }: any) => {
    return (
      <div className="space-y-1 w-full select-none text-left">
        <div className="flex justify-between items-center px-1 mb-0.5">
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
            {Icon && <Icon className="w-2.5 h-2.5" />} {label}
          </span>
          <span className="text-[10px] font-black text-white italic">{value}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onChange(Math.max(min, value - 1))} className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white active:bg-[#ff5351] transition-all shrink-0"><Minus className="w-4 h-4" /></button>
          <input type="range" min={min} max={max} step="1" value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 h-3 rounded-full accent-[#ff5351] bg-zinc-800 cursor-pointer" />
          <button onClick={() => onChange(Math.min(max, value + 1))} className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white active:bg-[#ff5351] transition-all shrink-0"><Plus className="w-4 h-4" /></button>
        </div>
        {subLabels && (<div className="flex justify-between px-10 text-[7px] font-black text-zinc-600 uppercase tracking-tighter"><span>{subLabels.left}</span><span>{subLabels.right}</span></div>)}
      </div>
    );
  };

  if (!selectedMode) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-10 p-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Boranov TP</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Escolha o modo de operação</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          <button onClick={() => { setSelectedMode('prompter'); sessionStorage.setItem('tp_selected_mode', 'prompter'); }} className="p-10 bg-[#141414] border-2 border-zinc-800 rounded-[40px] hover:border-[#ff5351] transition-all flex flex-col items-center gap-4 shadow-2xl"><Tv className="w-12 h-12 text-[#ff5351]" /><span className="text-lg font-black text-white uppercase italic">Modo Teleprompter</span></button>
          <button onClick={() => { setSelectedMode('remote'); sessionStorage.setItem('tp_selected_mode', 'remote'); }} className="p-10 bg-[#141414] border-2 border-zinc-800 rounded-[40px] hover:border-[#ff5351] transition-all flex flex-col items-center gap-4 shadow-2xl"><Smartphone className="w-12 h-12 text-[#ff5351]" /><span className="text-lg font-black text-white uppercase italic">Modo Controle</span></button>
        </div>
      </div>
    );
  }

  if (selectedMode === 'remote') {
    return (
      <div className="min-h-[85vh] flex flex-col gap-6 max-w-lg mx-auto p-4 text-left pb-12">
        <header className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px] shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#ff5351]/10 flex items-center justify-center"><Tv className="w-5 h-5 text-[#ff5351]" /></div>
            <div><h2 className="text-white font-black uppercase italic leading-none">Boranov TP</h2><span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Sincronizado</span></div>
          </div>
          <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className="p-2 text-zinc-500 hover:text-white transition-colors"><RotateCcw className="w-4 h-4" /></button>
        </header>

        <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
          <button onClick={() => setRemoteTab('control')} className={cn("flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all", remoteTab === 'control' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>Painel</button>
          <button onClick={() => setRemoteTab('text')} className={cn("flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all", remoteTab === 'text' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>Roteiro</button>
        </div>

        {remoteTab === 'control' ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <button onClick={() => updateState({ playing: !state.playing })} className={cn("w-full h-28 rounded-[32px] flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-white", state.playing ? "bg-zinc-800 border-2 border-[#ff5351]" : "bg-[#ff5351]")}>
              {state.playing ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
              <span className="font-black uppercase text-xs tracking-widest">{state.playing ? 'Pausar' : 'Iniciar'}</span>
            </button>

            <div className="flex gap-4 items-stretch">
              <div className="flex-1 space-y-4">
                <div className="bg-[#141414] border border-zinc-800 p-5 rounded-[32px] shadow-xl"><PillSlider label="Velocidade" value={state.velocidade} min={1} max={20} onChange={(v:any) => updateState({ velocidade: v })} subLabels={{ left: 'Lento', right: 'Rápido' }} /></div>
                <div className="bg-[#141414] border border-zinc-800 p-5 rounded-[32px] shadow-xl space-y-4">
                  <PillSlider label="Margem" value={state.margem} min={0} max={40} onChange={(v:any) => updateState({ margem: v })} icon={MoveHorizontal} subLabels={{ left: 'Estreito', right: 'Largo' }} />
                  <PillSlider label="Fonte" value={state.fonte} min={20} max={72} onChange={(v:any) => updateState({ fonte: v })} icon={Type} subLabels={{ left: 'Pequena', right: 'Grande' }} />
                </div>
              </div>

              <div className="w-[80px] bg-[#141414] border border-zinc-800 rounded-[32px] shadow-xl flex flex-col items-center py-6 px-2">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-4">POS</span>
                <div className="flex-1 w-full relative">
                  <input type="range" min="0" max="100" step="1" value={state.posicao || 0} onChange={e => { const val = Number(e.target.value); setState({...state, posicao: val}); updatePosicaoDebounced(val); }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] accent-[#ff5351]" style={{ appearance: 'none', WebkitAppearance: 'none', transform: 'translate(-50%, -50%) rotate(-90deg)', background: 'rgba(255,255,255,0.05)', height: '20px', borderRadius: '999px' }} />
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2 text-[7px] font-black text-zinc-700 uppercase"><span>FIM</span><span>INI</span></div>
                </div>
                <span className="text-[10px] font-black text-white italic mt-4">{Math.round(state.posicao || 0)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => updateState({ voltarInicio: true })} className="h-20 bg-zinc-900 border border-zinc-800 rounded-[24px] flex flex-col items-center justify-center gap-1 text-zinc-400 active:bg-zinc-800 transition-all"><RotateCcw className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Início</span></button>
              <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("h-20 border rounded-[24px] flex flex-col items-center justify-center gap-1 transition-all", state.espelhado ? "bg-[#ff5351] border-[#ff5351] text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400")}><FlipHorizontal className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Espelhar</span></button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 min-h-[400px]">
            <textarea value={state.texto} onChange={e => updateState({ texto: e.target.value })} placeholder="DIGITE O ROTEIRO..." className="flex-1 bg-black border border-zinc-800 rounded-[32px] p-6 text-sm text-white resize-none outline-none focus:border-[#ff5351] custom-scrollbar" />
            <div className="grid grid-cols-2 gap-4 pb-8">
              <label className="flex-1 py-5 bg-zinc-800 rounded-2xl flex items-center justify-center gap-2 cursor-pointer text-white font-black uppercase text-[10px] shadow-lg"><Upload className="w-4 h-4" /> Arquivo .TXT<input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" /></label>
              <button onClick={() => { if(window.confirm('Limpar texto?')) updateState({ texto: '', posicao: 0 }); }} className="py-5 bg-zinc-800/50 rounded-2xl flex items-center justify-center gap-2 text-zinc-500 font-black uppercase text-[10px] hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /> Limpar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden select-none" onClick={handleScreenTouch}>
      <main className="flex-1 relative overflow-hidden flex flex-col h-full">
        <div ref={prompterRef} className={cn("flex-1 overflow-y-auto py-[50vh] text-center no-scrollbar transition-all duration-700", state.espelhado && "scale-x-[-1]")} style={{ scrollBehavior: 'auto' }}>
          <div className="font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight mx-auto" style={{ fontSize: `${state.fonte}px`, color: '#fff', paddingLeft: `${calculateMargin(state.margem)}%`, paddingRight: `${calculateMargin(state.margem)}%` }}>
            {state.texto || 'AGUARDANDO ROTEIRO SINCRONIZADO...'}
          </div>
        </div>
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-[#ff5351]/40 pointer-events-none z-10" />
        <div className="absolute top-1/2 w-4 h-4 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-20 transition-all duration-300" style={{ left: `calc(${calculateMargin(state.margem)}% - 8px)` }} />
        <div className="absolute top-1/2 w-4 h-4 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-20 transition-all duration-300" style={{ right: `calc(${calculateMargin(state.margem)}% - 8px)` }} />
        <div className="absolute top-0 left-0 right-0 h-[35vh] bg-gradient-to-b from-black via-black/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-[35vh] bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" />
      </main>

      <div className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] w-[95%] max-w-5xl bg-zinc-900/95 backdrop-blur-3xl border border-white/5 rounded-[40px] p-4 flex items-center gap-6 shadow-2xl transition-all duration-700", !showControls && "opacity-0 translate-y-32")}>
        <div className="pl-4 pr-6 border-r border-white/10 shrink-0 text-left">
          <p className="text-[8px] font-black text-[#ff5351] uppercase tracking-[0.3em] mb-1">Boranov</p>
          <h2 className="text-lg font-black text-white uppercase italic leading-none">TP Master</h2>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-6 text-left">
          <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-zinc-500 uppercase ml-1">Velocidade ({state.velocidade})</span><input type="range" min="1" max="20" value={state.velocidade} onChange={e => updateState({ velocidade: Number(e.target.value) })} className="w-full h-2 rounded-lg accent-[#ff5351] bg-zinc-800" /></div>
          <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-zinc-500 uppercase ml-1">Margem ({state.margem}%)</span><input type="range" min="0" max="40" value={state.margem} onChange={e => updateState({ margem: Number(e.target.value) })} className="w-full h-2 rounded-lg accent-[#ff5351] bg-zinc-800" /></div>
          <div className="flex flex-col gap-1"><span className="text-[8px] font-black text-zinc-500 uppercase ml-1">Fonte ({state.fonte}px)</span><input type="range" min="20" max="72" value={state.fonte} onChange={e => updateState({ fonte: Number(e.target.value) })} className="w-full h-2 rounded-lg accent-[#ff5351] bg-zinc-800" /></div>
        </div>
        <div className="flex items-center gap-3 pr-2 text-left">
          <button onClick={() => updateState({ voltarInicio: true })} className="p-4 bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white transition-all"><RotateCcw className="w-5 h-5" /></button>
          <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("p-4 rounded-2xl transition-all", state.espelhado ? \"bg-[#ff5351] text-white\" : \"bg-zinc-800 text-zinc-400\")} title=\"Espelhar\"><FlipHorizontal className=\"w-5 h-5\" /></button>
          <button onClick={() => updateState({ playing: !state.playing })} className=\"w-20 h-20 bg-[#ff5351] rounded-3xl flex items-center justify-center text-white shadow-xl shadow-[#ff5351]/30 hover:scale-105 active:scale-95 transition-all\">{state.playing ? <Pause className=\"w-8 h-8 fill-current text-white\" /> : <Play className=\"w-8 h-8 fill-current ml-1 text-white\" />}</button>
          <div className=\"flex items-center gap-2\">
            <button onClick={toggleFullscreen} className=\"p-4 bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl transition-all\">{isFullscreen ? <X className=\"w-5 h-5\" /> : <Maximize2 className=\"w-5 h-5\" />}</button>
            <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className=\"p-4 bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-white rounded-2xl transition-all\" title=\"Trocar Modo\"><Laptop className=\"w-5 h-5\" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
