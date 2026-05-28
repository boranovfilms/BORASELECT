import React, { useState, useEffect, useRef } from 'react';
import { Bluetooth, Tv, Save, Trash2, RefreshCw, Cpu, Activity, Info, Play, Pause, RotateCcw, ChevronUp, ChevronDown, FileText, Upload, Settings, Keyboard } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

type TPAction = 'play_pause' | 'speed_up' | 'speed_down' | 'reset' | 'forward' | 'backward' | 'none';

interface InputMapping {
  id: string;
  hex: string;
  action: TPAction;
}

interface KeyHistory {
  key: string;
  code: string;
  timestamp: string;
}

const ACTION_LABELS: Record<TPAction, string> = {
  play_pause: 'Play / Pause',
  speed_up: 'Aumentar Velocidade',
  speed_down: 'Diminuir Velocidade',
  reset: 'Voltar ao Início',
  forward: 'Avançar Texto',
  backward: 'Recuar Texto',
  none: 'Nenhuma'
};

export default function Teleprompter() {
  const [activeTab, setActiveTab] = useState<'map' | 'prompter'>('map');
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRawInput, setLastRawInput] = useState<{hex: string, dec: string} | null>(null);
  const [mappings, setMappings] = useState<InputMapping[]>([]);
  const [keyHistory, setKeyHistory] = useState<KeyHistory[]>([]);
  
  // Estados do Teleprompter
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [fontSize, setFontSize] = useState(60);
  const prompterRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem('tp_mappings');
    if (saved) setMappings(JSON.parse(saved));
    
    const savedText = localStorage.getItem('tp_text');
    if (savedText) setText(savedText);
  }, []);

  // Loop de Rolagem
  useEffect(() => {
    let rafId: number;
    const scroll = () => {
      if (isPlaying && prompterRef.current) {
        scrollPos.current += (speed / 10);
        prompterRef.current.scrollTop = scrollPos.current;
      }
      rafId = requestAnimationFrame(scroll);
    };
    rafId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speed]);

  const connectBluetooth = async () => {
    try {
      setLoading(true);
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'FEELWORLD' }, { namePrefix: 'FEEL' }],
        optionalServices: ['00001812-0000-1000-8000-00805f9b34fb'] // HID Service
      });

      setDevice(dev);
      toast.success(`Conectado a ${dev.name}`);

      dev.addEventListener('gattserverdisconnected', () => {
        setDevice(null);
        toast.error('Controle desconectado');
      });

      await dev.gatt?.connect();
    } catch (error: any) {
      if (error.name !== 'NotFoundError') toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Listener de Eventos (Ponte para Mapeamento)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hexId = `KEY_${e.code}`;
      const decId = e.keyCode.toString();
      
      // Update history
      const newHistory: KeyHistory = {
        key: e.key === ' ' ? 'ESPAÇO' : e.key.toUpperCase(),
        code: e.code,
        timestamp: new Date().toLocaleTimeString()
      };
      setKeyHistory(prev => [newHistory, ...prev].slice(0, 5));

      if (activeTab === 'map') {
        setLastRawInput({ hex: hexId, dec: decId });
        setMappings(prev => {
          if (prev.find(m => m.id === hexId)) return prev;
          return [...prev, { id: hexId, hex: hexId, action: 'none' }];
        });
      } else {
        const mapping = mappings.find(m => m.id === hexId);
        if (mapping) executeAction(mapping.action);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, mappings, speed, isPlaying]);

  const executeAction = (action: TPAction) => {
    switch (action) {
      case 'play_pause': setIsPlaying(prev => !prev); break;
      case 'speed_up': setSpeed(prev => Math.min(prev + 1, 20)); break;
      case 'speed_down': setSpeed(prev => Math.max(prev - 1, 1)); break;
      case 'reset': 
        setIsPlaying(false);
        scrollPos.current = 0;
        if (prompterRef.current) prompterRef.current.scrollTop = 0;
        break;
      case 'forward': if (prompterRef.current) { scrollPos.current += 100; prompterRef.current.scrollTop = scrollPos.current; } break;
      case 'backward': if (prompterRef.current) { scrollPos.current = Math.max(0, scrollPos.current - 100); prompterRef.current.scrollTop = scrollPos.current; } break;
    }
  };

  const saveMapping = () => {
    localStorage.setItem('tp_mappings', JSON.stringify(mappings));
    toast.success('Mapeamento salvo!');
  };

  const updateMapping = (id: string, action: TPAction) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, action } : m));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
      localStorage.setItem('tp_text', content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-[80vh] flex flex-col animate-in fade-in duration-700">
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-3 mb-8">
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", device ? "bg-emerald-500" : "bg-red-500")} />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {device ? `Conectado: ${device.name}` : 'Desconectado'}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
          <span>1. Conectar</span>
          <span className="text-zinc-700">→</span>
          <span>2. Pressionar Botão</span>
          <span className="text-zinc-700">→</span>
          <span>3. Definir Função</span>
          <span className="text-zinc-700">→</span>
          <span>4. Salvar</span>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-4 mb-8">
        <button onClick={() => setActiveTab('map')} className={cn("px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all", activeTab === 'map' ? "bg-[#ff5351] border-[#ff5351] text-white shadow-lg" : "bg-zinc-900 border-zinc-800 text-zinc-500")}>1. Mapear Controle</button>
        <button onClick={() => setActiveTab('prompter')} className={cn("px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all", activeTab === 'prompter' ? "bg-[#ff5351] border-[#ff5351] text-white shadow-lg" : "bg-zinc-900 border-zinc-800 text-zinc-500")}>2. Teleprompter</button>
      </div>

      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bluetooth className="w-6 h-6 text-[#ff5351]" />
                  <h2 className="text-white font-black uppercase tracking-widest text-sm">Conexão Bluetooth</h2>
                </div>
                <button onClick={connectBluetooth} disabled={loading} className="px-6 py-3 bg-white text-black rounded-xl font-black uppercase text-[10px] hover:bg-[#ff5351] hover:text-white transition-all">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Conectar via Bluetooth'}
                </button>
              </div>

              {keyHistory.length > 0 && (
                <div className="bg-[#ff5351]/5 border border-[#ff5351]/20 rounded-2xl p-6 text-center animate-in zoom-in-95">
                  <p className="text-[9px] text-[#ff5351] font-black uppercase mb-4 tracking-[0.2em]">Botão pressionado!</p>
                  <div className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4">{keyHistory[0].key}</div>
                  <div className="flex items-center justify-center gap-3">
                    <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-lg text-[9px] font-black">CODE: {keyHistory[0].code}</span>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-[#ff5351]" />
                  <h2 className="text-white font-black uppercase tracking-widest text-sm">Configuração de Botões</h2>
                </div>
                <button onClick={saveMapping} className="flex items-center gap-2 text-[#ff5351] font-black uppercase text-[10px] hover:text-white transition-colors">
                  <Save className="w-4 h-4" /> Salvar Mapeamento
                </button>
              </div>

              <div className="space-y-3">
                {mappings.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-4">
                    <Keyboard className="w-12 h-12 text-zinc-800 animate-bounce" />
                    <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest max-w-[200px]">Pressione os botões do controle para iniciar o mapeamento</p>
                  </div>
                ) : (
                  mappings.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all">
                      <div className="font-mono text-xs text-white uppercase font-black">{m.hex}</div>
                      <select value={m.action} onChange={e => updateMapping(m.id, e.target.value as TPAction)} className="bg-black border border-zinc-800 rounded-lg px-4 py-2 text-[10px] font-bold text-white uppercase outline-none focus:border-[#ff5351]">
                        {Object.entries(ACTION_LABELS).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#ff5351]" />
                  <h3 className="text-white font-black uppercase tracking-widest text-[10px]">Histórico Recente</h3>
                </div>
                {keyHistory.length > 0 && (
                  <button onClick={() => setKeyHistory([])} className="text-zinc-600 hover:text-[#ff5351] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
              <div className="space-y-2">
                {keyHistory.length === 0 ? (
                  <p className="text-[10px] text-zinc-700 font-bold uppercase text-center py-4">Nenhum sinal...</p>
                ) : (
                  keyHistory.map((h, i) => (
                    <div key={i} className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-zinc-800/50">
                      <span className="text-[10px] font-black text-zinc-400">{h.key}</span>
                      <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">{h.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-blue-500" />
                <h4 className="text-blue-400 font-black uppercase text-[10px]">Importante</h4>
              </div>
              <p className="text-blue-400/70 text-[9px] leading-relaxed uppercase font-bold">O FEELWORLD-05 deve estar pareado no Windows/Mac antes de conectar aqui. Ele será identificado como um teclado externo.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'prompter' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-hidden h-[75vh]">
          {/* Editor/Config */}
          <div className="w-full lg:w-80 space-y-6 shrink-0 overflow-y-auto pr-2 custom-scrollbar">
            <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500">Texto do Script</label>
                <textarea value={text} onChange={e => { setText(e.target.value); localStorage.setItem('tp_text', e.target.value); }} className="w-full h-64 bg-black border border-zinc-800 rounded-2xl p-4 text-sm text-white resize-none outline-none focus:border-[#ff5351]" placeholder="DIGITE OU COLE SEU SCRIPT AQUI..."/>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-[#ff5351]" />
                  <span className="text-[10px] font-black uppercase text-white">Carregar TXT</span>
                  <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                </label>
                <button onClick={() => { setText(''); localStorage.removeItem('tp_text'); }} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </section>

            <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-6 space-y-6">
               <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500">
                    <span>Velocidade</span>
                    <span className="text-[#ff5351]">{speed}</span>
                  </div>
                  <input type="range" min="1" max="20" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff5351]" />
               </div>
               <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-500">
                    <span>Tamanho Fonte</span>
                    <span className="text-[#ff5351]">{fontSize}px</span>
                  </div>
                  <input type="range" min="20" max="150" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff5351]" />
               </div>
            </section>
          </div>

          {/* Exibição */}
          <div className="flex-1 bg-black border border-zinc-800 rounded-[40px] relative overflow-hidden flex flex-col shadow-inner">
            <div ref={prompterRef} className="flex-1 overflow-y-auto px-12 py-32 text-center select-none custom-scrollbar scroll-smooth" style={{ scrollBehavior: 'auto' }}>
              <div className="max-w-4xl mx-auto font-black leading-tight uppercase italic whitespace-pre-wrap transition-all" style={{ fontSize: `${fontSize}px`, color: '#fff' }}>{text || 'SEU TEXTO APARECERÁ AQUI...'}</div>
            </div>

            {/* Controles Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#141414]/90 backdrop-blur-xl border border-white/5 rounded-3xl p-2 flex items-center gap-2 shadow-2xl z-20">
              <button onClick={() => executeAction('reset')} className="p-4 text-zinc-400 hover:text-white transition-all"><RotateCcw className="w-6 h-6" /></button>
              <button onClick={() => executeAction('backward')} className="p-4 text-zinc-400 hover:text-white transition-all"><ChevronUp className="w-6 h-6" /></button>
              <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 bg-[#ff5351] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[#ff5351]/20 hover:scale-105 active:scale-95 transition-all">
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>
              <button onClick={() => executeAction('forward')} className="p-4 text-zinc-400 hover:text-white transition-all"><ChevronDown className="w-6 h-6" /></button>
              <div className="px-6 border-l border-white/5 flex flex-col items-center">
                <span className="text-[8px] font-black text-zinc-500 uppercase">Velocidade</span>
                <span className="text-xl font-black text-white italic">{speed}</span>
              </div>
            </div>

            {/* Linha de Leitura */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-[#ff5351]/20 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
}
