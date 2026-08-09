import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft, Save, Loader2, ImageOff, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Margens em PROPORÇÃO da página (0–1).
// top/bottom são frações da ALTURA; left/right são frações da LARGURA.
// bottom/right são medidos a partir da borda de baixo/direita.
type Margens = { top: number; bottom: number; left: number; right: number };
type Borda = 'top' | 'bottom' | 'left' | 'right';

// Padrão equivalente às margens fixas atuais do gerarPdf (página 595x842):
// left/right 75pt, top 75pt, bottom 110pt.
const DEFAULT_MARGENS: Margens = {
  top: 0.089,
  bottom: 0.131,
  left: 0.126,
  right: 0.126,
};

const GAP_MIN = 0.05; // impede que as bordas se cruzem

export default function OrcamentoEditorTimbrado() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [timbradoJpgUrl, setTimbradoJpgUrl] = useState('');
  const [margens, setMargens] = useState<Margens>(DEFAULT_MARGENS);
  const [dragging, setDragging] = useState<Borda | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracoes', 'orcamento'));
        if (snap.exists()) {
          const data = snap.data();
          setTimbradoJpgUrl(data.timbradoJpgUrl || '');
          if (data.timbradoMargens) {
            setMargens({
              top: data.timbradoMargens.top ?? DEFAULT_MARGENS.top,
              bottom: data.timbradoMargens.bottom ?? DEFAULT_MARGENS.bottom,
              left: data.timbradoMargens.left ?? DEFAULT_MARGENS.left,
              right: data.timbradoMargens.right ?? DEFAULT_MARGENS.right,
            });
          }
        }
      } catch {
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const mover = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      setMargens(prev => {
        if (dragging === 'top') return { ...prev, top: Math.min(py, 1 - prev.bottom - GAP_MIN) };
        if (dragging === 'bottom') return { ...prev, bottom: Math.min(1 - py, 1 - prev.top - GAP_MIN) };
        if (dragging === 'left') return { ...prev, left: Math.min(px, 1 - prev.right - GAP_MIN) };
        return { ...prev, right: Math.min(1 - px, 1 - prev.left - GAP_MIN) };
      });
    };
    const soltar = () => setDragging(null);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [dragging]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await setDoc(
        doc(db, 'configuracoes', 'orcamento'),
        { timbradoMargens: margens, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast.success('Margens salvas!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurar = () => setMargens(DEFAULT_MARGENS);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  // Retângulo de conteúdo em %
  const rectLeft = margens.left * 100;
  const rectTop = margens.top * 100;
  const rectW = (1 - margens.left - margens.right) * 100;
  const rectH = (1 - margens.top - margens.bottom) * 100;

  const TabBar = (
    <div className="flex items-center gap-1 bg-[#1f1f1f] border border-zinc-800 rounded-xl p-1 w-fit">
      <button onClick={() => navigate('/orcamentos/editor-pdf')}
        className="px-4 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
        Capa
      </button>
      <button
        className="px-4 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#ff5351] text-white transition-all">
        Timbrado
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 text-left max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/orcamentos')}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Orçamentos</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Editor do Timbrado</h1>
          <p className="text-zinc-500 text-sm mt-1">Arraste as bordas para definir a área de conteúdo</p>
        </div>
        {timbradoJpgUrl && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleRestaurar}
              className="h-10 px-4 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all flex items-center gap-2">
              <RotateCcw className="w-3 h-3" /> Restaurar
            </button>
            <button onClick={handleSalvar} disabled={salvando}
              className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-[#ff5351]/20">
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
            </button>
          </div>
        )}
      </header>

      {TabBar}

      {!timbradoJpgUrl ? (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] p-10 flex flex-col items-center gap-4 text-center">
          <ImageOff className="w-10 h-10 text-zinc-700" />
          <div>
            <p className="text-white font-black uppercase text-sm">Nenhuma imagem de timbrado cadastrada</p>
            <p className="text-zinc-500 text-xs mt-2 max-w-sm">
              Envie primeiro a imagem JPG do timbrado nas Configurações. Ela é o fundo sobre o qual você define as margens.
            </p>
          </div>
          <button onClick={() => navigate('/orcamentos/configuracoes')}
            className="h-10 px-6 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all">
            Ir para Configurações
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
          {/* Área de edição */}
          <div
            ref={containerRef}
            className="relative select-none border border-zinc-800 bg-zinc-950 mx-auto rounded-xl"
            style={{ width: '100%', maxWidth: 440 }}
          >
            <img src={timbradoJpgUrl} alt="Timbrado" draggable={false}
              className="w-full h-auto block pointer-events-none rounded-xl" />

            {/* Sombreamento das margens */}
            <div className="absolute left-0 right-0 top-0 bg-black/45 pointer-events-none" style={{ height: `${rectTop}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-black/45 pointer-events-none" style={{ height: `${margens.bottom * 100}%` }} />
            <div className="absolute left-0 bg-black/45 pointer-events-none" style={{ top: `${rectTop}%`, height: `${rectH}%`, width: `${margens.left * 100}%` }} />
            <div className="absolute right-0 bg-black/45 pointer-events-none" style={{ top: `${rectTop}%`, height: `${rectH}%`, width: `${margens.right * 100}%` }} />

            {/* Retângulo de conteúdo */}
            <div className="absolute border-2 border-dashed border-[#ff5351] pointer-events-none rounded-sm"
              style={{ left: `${rectLeft}%`, top: `${rectTop}%`, width: `${rectW}%`, height: `${rectH}%` }} />

            {/* Bordas arrastáveis */}
            {/* Superior */}
            <div onPointerDown={() => setDragging('top')}
              className={`absolute cursor-ns-resize ${dragging === 'top' ? 'bg-[#ff5351]' : 'bg-[#ff5351]/60 hover:bg-[#ff5351]'}`}
              style={{ left: `${rectLeft}%`, width: `${rectW}%`, top: `${rectTop}%`, height: 10, transform: 'translateY(-50%)', touchAction: 'none' }} />
            {/* Inferior */}
            <div onPointerDown={() => setDragging('bottom')}
              className={`absolute cursor-ns-resize ${dragging === 'bottom' ? 'bg-[#ff5351]' : 'bg-[#ff5351]/60 hover:bg-[#ff5351]'}`}
              style={{ left: `${rectLeft}%`, width: `${rectW}%`, top: `${rectTop + rectH}%`, height: 10, transform: 'translateY(-50%)', touchAction: 'none' }} />
            {/* Esquerda */}
            <div onPointerDown={() => setDragging('left')}
              className={`absolute cursor-ew-resize ${dragging === 'left' ? 'bg-[#ff5351]' : 'bg-[#ff5351]/60 hover:bg-[#ff5351]'}`}
              style={{ top: `${rectTop}%`, height: `${rectH}%`, left: `${rectLeft}%`, width: 10, transform: 'translateX(-50%)', touchAction: 'none' }} />
            {/* Direita */}
            <div onPointerDown={() => setDragging('right')}
              className={`absolute cursor-ew-resize ${dragging === 'right' ? 'bg-[#ff5351]' : 'bg-[#ff5351]/60 hover:bg-[#ff5351]'}`}
              style={{ top: `${rectTop}%`, height: `${rectH}%`, left: `${rectLeft + rectW}%`, width: 10, transform: 'translateX(-50%)', touchAction: 'none' }} />
          </div>

          {/* Painel lateral */}
          <div className="space-y-4">
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Margens</p>
              {([
                ['Superior', margens.top],
                ['Inferior', margens.bottom],
                ['Esquerda', margens.left],
                ['Direita', margens.right],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-white text-xs font-bold">{label}</span>
                  <span className="text-zinc-600 text-[10px] font-mono">{Math.round(val * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Como funciona</p>
              <p className="text-zinc-500 text-xs leading-relaxed">
                O retângulo vermelho é a área onde o conteúdo do orçamento vai aparecer. Arraste cada borda para
                afastar o conteúdo do cabeçalho e do rodapé do timbrado. As margens são guardadas em proporção,
                então valem para qualquer tamanho de página.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
