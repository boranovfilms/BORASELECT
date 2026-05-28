import React, { useState, useEffect } from 'react';
import { Bluetooth, Tv, Save, Trash2, RefreshCw, Cpu, Activity, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface MappedButton {
  name: string;
  code: string;
  value: string;
  timestamp: string;
}

export default function Teleprompter() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [lastEvent, setLastEvent] = useState<any>(null);
  const [mappedButtons, setMappedButtons] = useState<MappedButton[]>([]);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('tp_mapped_buttons');
    if (saved) setMappedButtons(JSON.parse(saved));
  }, []);

  const connectBluetooth = async () => {
    try {
      setConnecting(true);
      // Filtro específico para o controle FEELWORLD-05
      const dev = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'FEELWORLD-05' }],
        optionalServices: ['generic_access', 'generic_attribute']
      });

      setDevice(dev);
      toast.success(`Conectado a ${dev.name}`);

      dev.addEventListener('gattserverdisconnected', () => {
        setDevice(null);
        toast.error('Controle desconectado');
      });

      const server = await dev.gatt?.connect();
      // Nota: Para controles HID (teclado), o navegador geralmente bloqueia acesso direto via Web Bluetooth 
      // por segurança. Se o FEELWORLD-05 usar serviços customizados, eles seriam mapeados aqui.
      // Como a instrução pede para detectar botões, simulamos a escuta de eventos.

    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        console.error(error);
        toast.error('Falha ao conectar: ' + error.message);
      }
    } finally {
      setConnecting(false);
    }
  };

  // Listener global para detectar teclas do controle (maioria dos remotes bluetooth funciona como HID/Teclado)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!device) return;

      const newEvent = {
        name: e.key === ' ' ? 'ESPAÇO' : e.key.toUpperCase(),
        code: e.code,
        value: e.keyCode.toString(),
        timestamp: new Date().toLocaleTimeString()
      };

      setLastEvent(newEvent);

      // Adiciona ao mapeamento da sessão se não existir
      setMappedButtons(prev => {
        const exists = prev.find(b => b.code === newEvent.code);
        if (exists) return prev;
        const updated = [newEvent, ...prev].slice(0, 10);
        sessionStorage.setItem('tp_mapped_buttons', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [device]);

  const clearMapping = () => {
    setMappedButtons([]);
    sessionStorage.removeItem('tp_mapped_buttons');
    toast.success('Mapeamento limpo');
  };

  return (
    <div className="animate-in fade-in duration-700 pb-20 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
            <Tv className="w-8 h-8 text-[#ff5351]" /> Teleprompter
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Configuração e mapeamento do controle remoto Bluetooth.</p>
        </div>
        <button 
          onClick={connectBluetooth}
          disabled={connecting || !!device}
          className={cn(
            "h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 shadow-2xl",
            device 
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" 
              : "bg-[#ff5351] text-white hover:brightness-110 shadow-[#ff5351]/20"
          )}
        >
          {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
          {device ? 'CONECTADO: FEELWORLD-05' : 'CONECTAR CONTROLE'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel de Detecção */}
        <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl space-y-8">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <Activity className="w-4 h-4 text-[#ff5351]" />
            <h2 className="text-white font-black uppercase tracking-widest text-sm">Monitor de Sinais</h2>
          </div>

          {!device ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto opacity-20">
                <Bluetooth className="w-8 h-8 text-white" />
              </div>
              <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Aguardando conexão bluetooth...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-black/50 border border-zinc-800/50 rounded-2xl p-6 text-center animate-in zoom-in-95">
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-4">Último Botão Detectado</p>
                {lastEvent ? (
                  <div className="space-y-2">
                    <div className="text-6xl font-black text-white italic tracking-tighter">{lastEvent.name}</div>
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <span className="px-3 py-1 bg-[#ff5351]/10 text-[#ff5351] rounded-lg text-[10px] font-black">CÓDIGO: {lastEvent.code}</span>
                      <span className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-black">VALOR: {lastEvent.value}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-700 italic text-sm py-10">Pressione um botão no controle...</p>
                )}
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-[10px] text-blue-400 leading-relaxed uppercase font-bold">
                  O dispositivo FEELWORLD-05 envia sinais via protocolo HID. Certifique-se de que ele está pareado com o sistema operacional antes de conectar aqui.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Lista de Mapeamento */}
        <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#ff5351]" />
              <h2 className="text-white font-black uppercase tracking-widest text-sm">Botões Mapeados</h2>
            </div>
            {mappedButtons.length > 0 && (
              <button onClick={clearMapping} className="p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-all rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {mappedButtons.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 text-zinc-600">
                <Save className="w-12 h-12 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum botão salvo na sessão</p>
              </div>
            ) : (
              mappedButtons.map((btn, idx) => (
                <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-right-4">
                  <div>
                    <div className="text-white font-black text-xs italic tracking-widest">{btn.name}</div>
                    <div className="text-[9px] text-zinc-600 font-bold uppercase mt-1">{btn.code} • {btn.timestamp}</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-[#ff5351] font-black text-[10px]">
                    {btn.value}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
