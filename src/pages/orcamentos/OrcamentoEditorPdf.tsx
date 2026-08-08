import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft, Save, Loader2, ImageOff, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';

type Coord = { x: number; y: number };
type ElementoKey = 'numero' | 'cliente' | 'data';
type Coords = Record<ElementoKey, Coord>;

// Coordenadas em PROPORÇÃO da imagem (0 = topo/esquerda, 1 = base/direita).
// Guardar em proporção faz a posição valer para qualquer tamanho de imagem/PDF.
// numero/data: âncora à esquerda (x = início do texto).
// cliente: âncora ao CENTRO (x = centro do texto), para ficar sempre centralizado.
const DEFAULT_COORDS: Coords = {
  numero: { x: 0.77, y: 0.05 },
  cliente: { x: 0.5, y: 0.41 },
  data: { x: 0.02, y: 0.93 },
};

const ELEMENTOS: {
  key: ElementoKey;
  label: string;
  sample: string;
  cor: string;
  corBorda: string;
  corLegenda: string;
  align: 'left' | 'center';
}[] = [
  { key: 'numero', label: 'Número', sample: '001-2026-v1', cor: 'bg-[#ff5351]/85', corBorda: 'border-[#ff5351]', corLegenda: 'bg-[#ff5351]', align: 'left' },
  { key: 'cliente', label: 'Cliente (centralizado)', sample: 'CLIENTE EXEMPLO', cor: 'bg-blue-500/85', corBorda: 'border-blue-400', corLegenda: 'bg-blue-500', align: 'center' },
  { key: 'data', label: 'Data', sample: 'Data do orçamento: 21/08/26', cor: 'bg-amber-500/85', corBorda: 'border-amber-400', corLegenda: 'bg-amber-500', align: 'left' },
];

export default function OrcamentoEditorPdf() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [capaJpgUrl, setCapaJpgUrl] = useState('');
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS);
  const [dragging, setDragging] = useState<ElementoKey | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracoes', 'orcamento'));
        if (snap.exists()) {
          const data = snap.data();
          setCapaJpgUrl(data.capaJpgUrl || '');
          if (data.capaCoords) {
            setCoords({
              numero: data.capaCoords.numero || DEFAULT_COORDS.numero,
              cliente: data.capaCoords.cliente || DEFAULT_COORDS.cliente,
              data: data.capaCoords.data || DEFAULT_COORDS.data,
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

  const iniciarDrag = (key: ElementoKey, e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const chipLeft = coords[key].x * rect.width;
    const chipTop = coords[key].y * rect.height;
    offsetRef.current = {
      x: e.clientX - rect.left - chipLeft,
      y: e.clientY - rect.top - chipTop,
    };
    setDragging(key);
  };

  useEffect(() => {
    if (!dragging) return;
    const mover = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      let x = (e.clientX - rect.left - offsetRef.current.x) / rect.width;
      let y = (e.clientY - rect.top - offsetRef.current.y) / rect.height;
      x = Math.min(1, Math.max(0, x));
      y = Math.min(1, Math.max(0, y));
      setCoords(prev => ({ ...prev, [dragging]: { x, y } }));
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
        { capaCoords: coords, updatedAt: serverTimestamp() },
        { merge: true }
      );
      toast.success('Posições salvas!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurar = () => setCoords(DEFAULT_COORDS);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
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
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Editor da Capa</h1>
          <p className="text-zinc-500 text-sm mt-1">Arraste cada etiqueta para a posição desejada sobre a capa</p>
        </div>
        {capaJpgUrl && (
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

      {!capaJpgUrl ? (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] p-10 flex flex-col items-center gap-4 text-center">
          <ImageOff className="w-10 h-10 text-zinc-700" />
          <div>
            <p className="text-white font-black uppercase text-sm">Nenhuma imagem de capa cadastrada</p>
            <p className="text-zinc-500 text-xs mt-2 max-w-sm">
              Envie primeiro a imagem JPG da capa nas Configurações. Ela é o fundo sobre o qual você posiciona os elementos.
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
            <img src={capaJpgUrl} alt="Capa" draggable={false}
              className="w-full h-auto block pointer-events-none rounded-xl" />
            {ELEMENTOS.map(el => {
              const c = coords[el.key];
              const ativo = dragging === el.key;
              return (
                <div
                  key={el.key}
                  onPointerDown={e => iniciarDrag(el.key, e)}
                  className={`absolute ${el.cor} ${el.corBorda} border rounded-md px-2 py-1 cursor-move shadow-lg ${ativo ? 'ring-2 ring-white z-20' : 'z-10'}`}
                  style={{
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    transform: el.align === 'center' ? 'translateX(-50%)' : undefined,
                    touchAction: 'none',
                    maxWidth: '92%',
                  }}
                >
                  <span className="text-white text-[10px] font-bold leading-tight whitespace-nowrap">{el.sample}</span>
                </div>
              );
            })}
          </div>

          {/* Painel lateral */}
          <div className="space-y-4">
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Elementos</p>
              {ELEMENTOS.map(el => (
                <div key={el.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded ${el.corLegenda}`} />
                    <span className="text-white text-xs font-bold">{el.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {el.align === 'center' && (
                      <button
                        onClick={() => setCoords(prev => ({ ...prev, [el.key]: { ...prev[el.key], x: 0.5 } }))}
                        title="Centralizar na horizontal (50%)"
                        className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all">
                        Centralizar
                      </button>
                    )}
                    <span className="text-zinc-600 text-[10px] font-mono">
                      {Math.round(coords[el.key].x * 100)}% · {Math.round(coords[el.key].y * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Como funciona</p>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Arraste cada etiqueta sobre a capa e clique em Salvar. As posições ficam guardadas em proporção,
                então funcionam mesmo que a capa mude de tamanho. Os textos de exemplo são só referência —
                no PDF final entram os dados reais de cada orçamento.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
