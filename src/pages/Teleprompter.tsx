import React, { useState, useEffect } from 'react';
import { Bluetooth, Tv, Trash2, RefreshCw, Cpu, Activity, Info, MousePointer2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface MappedButton {
  name: string;
  reportId: number;
  hex: string;
  decimal: string;
  timestamp: string;
}

export default function Teleprompter() {
  const [device, setDevice] = useState<HIDDevice | null>(null);
  const [lastEvent, setLastEvent] = useState<MappedButton | null>(null);
  const [mappedButtons, setMappedButtons] = useState<MappedButton[]>([]);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('tp_mapped_buttons_hid');
    if (saved) setMappedButtons(JSON.parse(saved));
  }, []);

  const connectHID = async () => {
    try {
      setConnecting(true);
      
      // Solicita acesso ao dispositivo FEELWORLD-05
      // Nota: Podemos filtrar por vendorId/productId se soubermos, 
      // mas o requestDevice abre um seletor para o usuário.
      const [dev] = await (navigator as any).hid.requestDevice({
        filters: [] // Filtros vazios permitem selecionar qualquer dispositivo HID
      });

      if (!dev) return;

      await dev.open();
      setDevice(dev);
      toast.success(`Conectado a ${dev.productName}`);

      dev.oninputreport = (event: any) => {
        const { data, reportId } = event;
        const bytes = new Uint8Array(data.buffer);
        
        const hexValues = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        const decValues = Array.from(bytes).join(', ');

        const newEvent: MappedButton = {
          name: `REPORT ${reportId}`,
          reportId: reportId,
          hex: hexValues,
          decimal: decValues,
          timestamp: new Date().toLocaleTimeString()
        };

        setLastEvent(newEvent);

        setMappedButtons(prev => {
          // Evita duplicatas idênticas seguidas
          if (prev.length > 0 && prev[0].hex === newEvent.hex) return prev;
          
          const updated = [newEvent, ...prev].slice(0, 15);
          sessionStorage.setItem('tp_mapped_buttons_hid', JSON.stringify(updated));
          return updated;
        });
      };

    } catch (error: any) {
      console.error(error);
      toast.error('Falha ao conectar: ' + error.message);
    } finally {
      setConnecting(false);
    }
  };

  const clearMapping = () => {
    setMappedButtons([]);
    sessionStorage.removeItem('tp_mapped_buttons_hid');
    toast.success('Mapeamento limpo');
  };

  return (
    <div className="animate-in fade-in duration-700 pb-20 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
            <Tv className="w-8 h-8 text-[#ff5351]" /> Teleprompter
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Mapeamento profissional via WebHID API (FEELWORLD-05).</p>
        </div>
        <button 
          onClick={connectHID}
          disabled={connecting || !!device}
          className={cn(
            "h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 shadow-2xl",
            device 
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" 
              : "bg-[#ff5351] text-white hover:brightness-110 shadow-[#ff5351]/20"
          )}
        >
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
          {device ? `CONECTADO: ${device.productName}` : 'CONECTAR VIA HID'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel de Monitoramento em Tempo Real */}
        <section className="lg:col-span-2 bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl space-y-8">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <Activity className="w-4 h-4 text-[#ff5351]" />
            <h2 className="text-white font-black uppercase tracking-widest text-sm">Monitor de Dados Brutos (Raw Data)</h2>
          </div>

          {!device ? (
            <div className="py-32 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto opacity-20">
                <MousePointer2 className="w-10 h-10 text-white" />
              </div>
              <div className="max-w-xs mx-auto">
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mb-2">Aguardando dispositivo...</p>
                <p className="text-zinc-700 text-[10px] uppercase">Clique em conectar e selecione o FEELWORLD-05 na lista do navegador.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-black/50 border border-zinc-800/50 rounded-[24px] p-10 text-center animate-in zoom-in-95">
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-6">Sinal Detectado</p>
                {lastEvent ? (
                  <div className="space-y-6">
                    <div className="text-xl font-black text-[#ff5351] tracking-[0.2em]">{lastEvent.timestamp}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                        <p className="text-[9px] text-zinc-500 font-black uppercase mb-2">Hexadecimal</p>
                        <code className="text-white font-mono text-lg break-all">{lastEvent.hex}</code>
                      </div>
                      <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                        <p className="text-[9px] text-zinc-500 font-black uppercase mb-2">Decimal</p>
                        <code className="text-zinc-400 font-mono text-sm break-all">{lastEvent.decimal}</code>
                      </div>
                    </div>
                    <div className="inline-block px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase">
                      REPORT ID: {lastEvent.reportId}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 space-y-3">
                    <RefreshCw className="w-8 h-8 text-zinc-800 mx-auto animate-spin" />
                    <p className="text-zinc-700 italic text-sm">Pressione qualquer botão no controle para analisar os bytes...</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 flex gap-4">
                <Info className="w-6 h-6 text-blue-500 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-blue-400 uppercase font-black tracking-wider">Como funciona o mapeamento?</p>
                  <p className="text-[10px] text-blue-400/70 leading-relaxed uppercase font-bold">
                    Cada botão do FEELWORLD envia uma sequência única de bytes. Ao clicar neles, capturamos esses códigos para transformar em comandos de velocidade, scroll e pausa no Teleprompter.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Histórico de Mapeamento */}
        <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#ff5351]" />
              <h2 className="text-white font-black uppercase tracking-widest text-sm">Logs de Input</h2>
            </div>
            {mappedButtons.length > 0 && (
              <button onClick={clearMapping} className="p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-all rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {mappedButtons.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 text-zinc-600">
                <Cpu className="w-12 h-12 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Logs vazios</p>
              </div>
            ) : (
              mappedButtons.map((btn, idx) => (
                <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-[#ff5351] uppercase tracking-widest">ID {btn.reportId} • {btn.timestamp}</span>
                    <span className="text-[8px] font-mono text-zinc-600 font-black">{idx + 1}#</span>
                  </div>
                  <div className="text-[10px] font-mono text-white break-all bg-black/30 p-2 rounded-lg border border-zinc-800/50">
                    {btn.hex}
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
