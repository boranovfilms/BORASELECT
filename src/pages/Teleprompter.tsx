import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, FlipHorizontal, Settings2, Trash2, 
  Smartphone, Laptop, MoveHorizontal, Type, Upload, X, Minus, Plus
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
  const docRef = doc(db, 'config', 'teleprompter');

  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    const savedMode = sessionStorage.getItem('tp_selected_mode');
    if (savedMode) setSelectedMode(savedMode as any);

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
    });

    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    return () => {
      document.body.style.overflowX = 'auto';
      unsubscribe();
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const selectMode = (mode: 'prompter' | 'remote') => {
    setSelectedMode(mode);
    sessionStorage.setItem('tp_selected_mode', mode);
  };

  const updateState = (updates: Partial<TeleprompterState>) => {
    updateDoc(docRef, updates).catch(err => console.error(err));
  };

  const handleResetInternal = () => {
    scrollPos.current = 0;
    if (prompterRef.current) prompterRef.current.scrollTop = 0;
  };

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

  const handleScreenTouch = () => {
    if (selectedMode === 'prompter') {
      setShowControls(true);
      if (controlTimeout.current) clearTimeout(controlTimeout.current);
      if (isFullscreen) {
        controlTimeout.current = setTimeout(() => setShowControls(false), 4000);
      }
    }
  };

  const toggleFullscreen = () => {
    const el = document.documentElement as any;
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        setShowControls(false);
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        setShowControls(true);
      }
    } catch (e) {
      toast.error('Tela cheia não suportada');
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

  const clearText = () => {
    if (window.confirm('Deseja limpar todo o texto do roteiro?')) {
      updateState({ texto: '' });
      toast.success('Texto removido');
    }
  };

  const calculateMargin = (val: number) => (val / 40) * 30;

  const PillSlider = ({ label, value, min, max, onChange, icon: Icon, subLabels }: any) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const percentage = ((value - min) / (max - min)) * 100;

    useEffect(() => {
      const slider = inputRef.current;
      if (!slider) return;

      const handleTouch = (e: TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const rect = slider.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const pct = Math.min(Math.max(x / rect.width, 0), 1);
        const newValue = min + pct * (max - min);
        onChange(Math.round(newValue * 10) / 10);
      };

      slider.addEventListener('touchstart', handleTouch, { passive: false });
      slider.addEventListener('touchmove', handleTouch, { passive: false });
      return () => {
        slider.removeEventListener('touchstart', handleTouch);
        slider.removeEventListener('touchmove', handleTouch);
      };
    }, [min, max, onChange]);

    return (
      <div className="space-y-1 w-full select-none">
        <div className="flex justify-between items-center px-1 mb-0.5">
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
            {Icon && <Icon className="w-2.5 h-2.5" />} {label}
          </span>
          <span className="text-[10px] font-black text-white italic">{value}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(Math.max(min, value - 1)); }}
            className="w-7 h-7 shrink-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white hover:text-[#ff5351] hover:border-[#ff5351] transition-all"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <div className="relative h-[27px] flex-1 flex items-center group">
            <input 
              ref={inputRef}
              type="range" 
              min={min} 
              max={max} 
              step="0.1"
              value={value} 
              onChange={e => onChange(Number(e.target.value))}
              className="pill-range-input"
              style={{ 
                background: `linear-gradient(to right, #ff5351 ${percentage}%, #1f1f1f ${percentage}%)`,
                touchAction: 'none'
              } as any}
            />
          </div>

          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, value + 1)); }}
            className="w-7 h-7 shrink-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white hover:text-[#ff5351] hover:border-[#ff5351] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {subLabels && (
          <div className="flex justify-between px-9 text-[7px] font-black text-zinc-600 uppercase tracking-tighter">
            <span>{subLabels.left}</span>
            <span>{subLabels.right}</span>
          </div>
        )}
      </div>
    );
  };

  if (!selectedMode) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-10 animate-in fade-in duration-500">
        <div className="text-center space-y-3 px-6">
          <h1 className="text-4xl font-black text-white uppercase italic tracking-widest">Boranov TP</h1>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Selecione o modo de operação</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl px-6">
          <button onClick={() => selectMode('prompter')} className="group p-12 bg-[#141414] border-2 border-zinc-800 rounded-[48px] hover:border-[#ff5351] hover:scale-105 transition-all flex flex-col items-center gap-6 shadow-2xl">
            <Tv className="w-16 h-16 text-zinc-700 group-hover:text-[#ff5351] transition-colors" />
            <div className="text-center">
              <span className="block text-2xl font-black text-white uppercase italic tracking-tighter">Teleprompter</span>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 block">Modo Exibição / Tablet</span>
            </div>
          </button>
          <button onClick={() => selectMode('remote')} className="group p-12 bg-[#141414] border-2 border-zinc-800 rounded-[48px] hover:border-[#ff5351] hover:scale-105 transition-all flex flex-col items-center gap-6 shadow-2xl">
            <Smartphone className="w-16 h-16 text-zinc-700 group-hover:text-[#ff5351] transition-colors" />
            <div className="text-center">
              <span className="block text-2xl font-black text-white uppercase italic tracking-tighter">Controle</span>
              <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 block">Modo Remoto / Celular</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (selectedMode === 'remote') {
    return (
      <div className="animate-in fade-in duration-700 min-h-[85vh] flex flex-col gap-6 max-w-lg mx-auto pb-10 px-4">
        <header className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px] shadow-2xl flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <Tv className="w-6 h-6 text-[#ff5351]" />
            <div>
              <h1 className="text-lg font-black text-white uppercase italic leading-none mb-1">Boranov TP</h1>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Sincronizado</span></div>
            </div>
          </div>
          <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest">
            <RotateCcw className="w-3.5 h-3.5" /> Trocar Modo
          </button>
        </header>

        <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800">
          <button onClick={() => setRemoteTab('control')} className={cn("flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all", remoteTab === 'control' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>Painel</button>
          <button onClick={() => setRemoteTab('text')} className={cn("flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all", remoteTab === 'text' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}>Roteiro</button>
        </div>

        {remoteTab === 'control' ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <button onClick={() => updateState({ playing: !state.playing })} className={cn("w-full h-32 rounded-[40px] flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all text-white", state.playing ? "bg-zinc-800 border-2 border-[#ff5351]" : "bg-[#ff5351]")}>
              {state.playing ? <Pause className="w-12 h-12 fill-current" /> : <Play className="w-12 h-12 fill-current ml-1" />}
              <span className="font-black uppercase tracking-[0.2em] text-xs">{state.playing ? 'Pausar' : 'Iniciar'}</span>
            </button>

            <div className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px] shadow-xl">
              <PillSlider 
                label="Velocidade" value={state.velocidade} min={1} max={20} 
                onChange={(v:any) => updateState({ velocidade: v })} 
                subLabels={{ left: 'Lento', right: 'Rápido' }}
              />
            </div>

            <div className="bg-[#141414] border border-zinc-800 p-6 rounded-[32px] shadow-xl space-y-6">
              <PillSlider 
                label="Margem Lateral" value={state.margem} min={0} max={40} 
                onChange={(v:any) => updateState({ margem: v })} 
                icon={MoveHorizontal} 
                subLabels={{ left: 'Estreito', right: 'Largo' }}
              />
              <PillSlider 
                label="Tamanho Fonte" value={state.fonte} min={20} max={72} 
                onChange={(v:any) => updateState({ fonte: v })} 
                icon={Type} 
                subLabels={{ left: 'Pequena', right: 'Grande' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => updateState({ voltarInicio: true })} className="h-24 bg-zinc-900 border border-zinc-800 rounded-[32px] flex flex-col items-center justify-center gap-2 active:bg-zinc-800 transition-all text-zinc-300">
                <RotateCcw className="w-6 h-6" /><span className="font-black uppercase tracking-widest text-[9px]">Reiniciar</span>
              </button>
              <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn("h-24 rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all", state.espelhado ? "bg-[#ff5351] text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-500")}>
                <FlipHorizontal className="w-6 h-6" /><span className="font-black uppercase tracking-widest text-[9px]">Espelhar</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 animate-in slide-in-from-bottom-4">
            <textarea value={state.texto} onChange={e => updateState({ texto: e.target.value })} placeholder="DIGITE OU COLE O ROTEIRO AQUI..." className="flex-1 min-h-[350px] bg-black border border-zinc-800 rounded-[32px] p-6 text-sm text-white resize-none outline-none focus:border-[#ff5351] leading-relaxed custom-scrollbar" />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex-1 py-5 bg-zinc-900 border border-zinc-800 rounded-[24px] flex items-center justify-center gap-3 cursor-pointer hover:bg-zinc-800 transition-all text-white font-black uppercase text-[10px]">
                <Upload className="w-4 h-4 text-[#ff5351]" /> Carregar .TXT
                <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
              </label>
              <button onClick={clearText} className="py-5 bg-zinc-900 border border-zinc-800 rounded-[24px] flex items-center justify-center gap-3 hover:bg-red-500/10 transition-all text-zinc-400 hover:text-red-500 font-black uppercase text-[10px]">
                <Trash2 className="w-4 h-4" /> Limpar Texto
              </button>
            </div>
          </div>\n        )}\n      </div>\n    );\n  }\n\n  return (\n    <div className=\"fixed inset-0 z-[500] bg-black flex flex-col overflow-hidden select-none max-w-[100vw]\" onClick={handleScreenTouch}>\n      <style>{`\n        .pill-range-input {\n          -webkit-appearance: none;\n          appearance: none;\n          width: 100%;\n          height: 27px;\n          border-radius: 999px;\n          outline: none;\n          cursor: pointer;\n          border: 1px solid rgba(255,255,255,0.05);\n        }\n        .pill-range-input::-webkit-slider-thumb {\n          -webkit-appearance: none;\n          width: 23px;\n          height: 23px;\n          border-radius: 50%;\n          background: white;\n          cursor: pointer;\n          box-shadow: 0 1px 4px rgba(0,0,0,.4);\n        }\n        .pill-range-input::-moz-range-thumb {\n          width: 23px;\n          height: 23px;\n          border-radius: 50%;\n          background: white;\n          cursor: pointer;\n          border: none;\n          box-shadow: 0 1px 4px rgba(0,0,0,.4);\n        }\n      `}</style>\n      <main className=\"flex-1 relative overflow-hidden flex flex-col\">\n        <div ref={prompterRef} className={cn(\"flex-1 overflow-y-auto py-[50vh] text-center no-scrollbar transition-all duration-700\", state.espelhado && \"scale-x-[-1]\")} style={{ scrollBehavior: 'auto' }}>\n          <div \n            className=\"font-black leading-tight uppercase italic whitespace-pre-wrap transition-all tracking-tight mx-auto\" \n            style={{ \n              fontSize: `${state.fonte}px`, \n              color: '#fff', \n              paddingLeft: `${calculateMargin(state.margem)}%`, \n              paddingRight: `${calculateMargin(state.margem)}%` \n            }}\n          >\n            {state.texto || 'O ROTEIRO SINCRONIZADO APARECERÁ AQUI...'}\n          </div>\n        </div>\n\n        <div className=\"absolute top-1/2 left-0 right-0 h-[1.5px] bg-[#ff5351]/40 pointer-events-none z-10\" />\n        <div \n          className=\"absolute top-1/2 w-4 h-4 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-20 transition-all duration-300\"\n          style={{ left: `calc(${calculateMargin(state.margem)}% - 8px)` }}\n        />\n        <div \n          className=\"absolute top-1/2 w-4 h-4 rounded-full bg-[#ff5351] -translate-y-1/2 shadow-[0_0_15px_#ff5351] z-20 transition-all duration-300\"\n          style={{ right: `calc(${calculateMargin(state.margem)}% - 8px)` }}\n        />\n        \n        <div className=\"absolute top-0 left-0 right-0 h-[35vh] bg-gradient-to-b from-black via-black/80 to-transparent z-0 pointer-events-none\" />\n        <div className=\"absolute bottom-0 left-0 right-0 h-[35vh] bg-gradient-to-t from-black via-black/80 to-transparent z-0 pointer-events-none\" />\n      </main>\n\n      <div className={cn(\n        \"fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] w-[95%] max-w-5xl bg-zinc-900/95 backdrop-blur-3xl border border-white/5 rounded-[40px] p-4 flex items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-700\",\n        !showControls && \"opacity-0 translate-y-32\"\n      )}>\n        <div className=\"pl-4 pr-6 border-r border-white/10 shrink-0\">\n          <p className=\"text-[8px] font-black text-[#ff5351] uppercase tracking-[0.3em] mb-1\">Boranov</p>\n          <h2 className=\"text-lg font-black text-white uppercase italic leading-none\">TP Master</h2>\n        </div>\n\n        <div className=\"flex-1 grid grid-cols-3 gap-6 text-left\">\n          <PillSlider \n            label=\"Velocidade\" value={state.velocidade} min={1} max={20} \n            onChange={(v:any) => updateState({ velocidade: v })} \n            subLabels={{ left: 'Lento', right: 'Rápido' }}\n          />\n          <PillSlider \n            label=\"Margem\" value={state.margem} min={0} max={40} \n            onChange={(v:any) => updateState({ margem: v })} \n            subLabels={{ left: 'Estreito', right: 'Largo' }}\n          />\n          <PillSlider \n            label=\"Fonte\" value={state.fonte} min={20} max={72} \n            onChange={(v:any) => updateState({ fonte: v })} \n            subLabels={{ left: 'A', right: 'A Grande' }}\n          />\n        </div>\n\n        <div className=\"flex items-center gap-3 pr-2\">\n          <button onClick={() => updateState({ voltarInicio: true })} className=\"p-4 bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl transition-all\" title=\"Reiniciar\"><RotateCcw className=\"w-5 h-5\" /></button>\n          <button onClick={() => updateState({ espelhado: !state.espelhado })} className={cn(\"p-4 rounded-2xl transition-all\", state.espelhado ? \"bg-[#ff5351] text-white\" : \"bg-zinc-800 text-zinc-400\")} title=\"Espelhar\"><FlipHorizontal className=\"w-5 h-5\" /></button>\n          <button onClick={() => updateState({ playing: !state.playing })} className=\"w-20 h-20 bg-[#ff5351] rounded-3xl flex items-center justify-center text-white shadow-xl shadow-[#ff5351]/30 hover:scale-105 active:scale-95 transition-all\">\n            {state.playing ? <Pause className=\"w-8 h-8 fill-current\" /> : <Play className=\"w-8 h-8 fill-current ml-1\" />}\n          </button>\n          <div className=\"flex items-center gap-2\">\n            <button onClick={toggleFullscreen} className=\"p-4 bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl transition-all\">{isFullscreen ? <X className=\"w-5 h-5\" /> : <Maximize2 className=\"w-5 h-5\" />}</button>\n            <button onClick={() => { setSelectedMode(null); sessionStorage.removeItem('tp_selected_mode'); }} className=\"p-4 bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-white rounded-2xl transition-all\" title=\"Trocar Modo\"><Laptop className=\"w-5 h-5\" /></button>\n          </div>\n        </div>\n      </div>\n    </div>\n  );\n}\n",path: