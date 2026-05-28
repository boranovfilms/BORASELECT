import React, { useState, useEffect } from 'react';
import { Tv, Trash2, Cpu, Activity, Info, Keyboard } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface KeyLog {
  key: string;
  keyCode: number;
  code: string;
  timestamp: string;
}

export default function Teleprompter() {
  const [lastLog, setLastEvent] = useState<KeyLog | null>(null);
  const [logs, setLogs] = useState<KeyLog[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Impede comportamentos padrão (ex: scroll com espaço ou setas) 
      // para focar apenas na detecção
      e.preventDefault();

      const newLog: KeyLog = {
        key: e.key === ' ' ? 'ESPAÇO' : e.key.toUpperCase(),
        keyCode: e.keyCode,
        code: e.code,
        timestamp: new Date().toLocaleTimeString()
      };

      setLastEvent(newLog);
      setLogs(prev => [newLog, ...prev].slice(0, 10));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearLogs = () => {
    setLogs([]);
    setLastEvent(null);
    toast.success('Histórico limpo');
  };

  return (
    <div className="animate-in fade-in duration-700 pb-20 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
            <Tv className="w-8 h-8 text-[#ff5351]" /> Teleprompter
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Detecção universal de comandos (FEELWORLD-05 via Bluetooth HID).</p>
        </div>
        <div className="px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Monitor Ativo</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Painel de Monitoramento em Tempo Real */}
        <section className="lg:col-span-2 bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl space-y-8">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <Activity className="w-4 h-4 text-[#ff5351]" />
            <h2 className="text-white font-black uppercase tracking-widest text-sm">Detector de Teclas</h2>
          </div>

          <div className="space-y-8">
            <div className="bg-black/50 border border-zinc-800/50 rounded-[24px] p-10 text-center animate-in zoom-in-95">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-6">Última Tecla Detectada</p>
              {lastLog ? (
                <div className="space-y-6">
                  <div className="text-7xl font-black text-white italic tracking-tighter uppercase">{lastLog.key}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                      <p className="text-[9px] text-zinc-500 font-black uppercase mb-2">Code</p>
                      <code className="text-[#ff5351] font-mono text-xl break-all">{lastLog.code}</code>
                    </div>
                    <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                      <p className="text-[9px] text-zinc-500 font-black uppercase mb-2">Keycode</p>
                      <code className="text-zinc-400 font-mono text-xl break-all">{lastLog.keyCode}</code>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    Capturado às {lastLog.timestamp}
                  </div>
                </div>
              ) : (
                <div className="py-20 space-y-4">
                  <Keyboard className="w-12 h-12 text-zinc-800 mx-auto animate-bounce" />
                  <p className="text-zinc-700 italic text-sm">Pressione qualquer botão no controle para identificar o sinal...</p>
                </div>
              )}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 flex gap-4">
              <Info className="w-6 h-6 text-blue-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs text-blue-400 uppercase font-black tracking-wider">Como funciona?</p>
                <p className="text-[10px] text-blue-400/70 leading-relaxed uppercase font-bold">
                  A maioria dos controles Bluetooth são reconhecidos como teclados (HID). Ao pressionar os botões, eles enviam comandos de tecla padrão. Identifique qual botão envia qual código para configurarmos o Teleprompter.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Histórico */}
        <section className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#ff5351]" />
              <h2 className="text-white font-black uppercase tracking-widest text-sm">Histórico (10)</h2>
            </div>
            {logs.length > 0 && (
              <button onClick={clearLogs} className="p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-all rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 text-zinc-600">
                <Cpu className="w-12 h-12 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Aguardando sinais</p>
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-1 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{log.key}</span>
                    <span className="text-[8px] font-mono text-zinc-600 font-black">{log.timestamp}</span>
                  </div>
                  <div className="text-[9px] font-mono text-[#ff5351] font-bold">
                    CODE: {log.code} | KC: {log.keyCode}
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
